import http from 'node:http';

import compression from 'compression';
import cors from 'cors';
import express, {
  type Application,
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import helmet from 'helmet';
import { Server as SocketIOServer } from 'socket.io';

import { authService } from './services/auth.service';
import { serverConfig } from './config/server.config';
import { createChildLogger, logger } from './utils/logger';
import { isAppError, normalizeError } from './utils/error-handler';
import { ProgressHandler } from './websocket/progress.handler';
import { reportsController } from './api/controllers/reports.controller';
import { shutdownRateLimitStore } from './api/middleware/rate-limit.middleware';
import { CacheManager } from './cache/cache-manager';
import { clientFactory } from './clients/client-factory';

// Import route factories and controllers
import { createResourcesRoutes } from './api/routes/resources.routes';
import { createUsageRoutes } from './api/routes/usage.routes';
import { createCacheRoutes } from './api/routes/cache.routes';
import reportsRoutes from './api/routes/reports.routes';
import accountsRoutes from './api/routes/accounts.routes';
import { ResourcesController } from './api/controllers/resources.controller';
import { UsageController } from './api/controllers/usage.controller';
import { CacheController } from './api/controllers/cache.controller';

const app: Application = express();
const httpServer = http.createServer(app);

const io = serverConfig.websocketEnabled
  ? new SocketIOServer(httpServer, {
      cors: {
        origin: serverConfig.corsOrigin,
        credentials: serverConfig.corsCredentials,
      },
      path: serverConfig.websocketPath,
    })
  : null;

app.use((req, res, next) => {
  const requestId = req.header(serverConfig.requestIdHeader) ?? crypto.randomUUID();
  res.setHeader(serverConfig.requestIdHeader, requestId);
  res.locals.requestId = requestId;
  res.locals.startedAt = performance.now();
  next();
});

app.use(helmet());
app.use(
  cors({
    origin: serverConfig.corsOrigin,
    credentials: serverConfig.corsCredentials,
  }),
);
app.use(
  compression({
    level: serverConfig.compressionEnabled ? serverConfig.compressionLevel : 0,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  const requestLogger = createChildLogger({
    requestId: res.locals.requestId as string,
    method: req.method,
    path: req.path,
  });

  res.on('finish', () => {
    requestLogger.info(
      {
        statusCode: res.statusCode,
        durationMs: Number((performance.now() - (res.locals.startedAt as number)).toFixed(2)),
      },
      'HTTP request completed',
    );
  });

  next();
});

app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: serverConfig.nodeEnv,
    websocketEnabled: serverConfig.websocketEnabled,
  });
});

app.get('/api/auth/test', async (_req, res, next) => {
  try {
    const token = await authService.testAuthentication();
    res.status(200).json({
      authenticated: true,
      tokenType: token.tokenType,
      expiresAt: token.expiresAt.toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

app.get('/', (_req, res) => {
  res.status(200).json({
    name: 'IBM Cloud Cost Tracking System API',
    version: '1.0.0',
    status: 'ready',
    endpoints: {
      health: '/health',
      accounts: '/api/accounts',
      resources: '/api/resources',
      usage: '/api/usage',
      reports: '/api/reports',
      cache: '/api/cache',
    },
  });
});

// Initialize controllers and routes
const cacheManager = new CacheManager();
const resourcesController = new ResourcesController(clientFactory, cacheManager);
const usageController = new UsageController(clientFactory, cacheManager);
const cacheController = new CacheController(cacheManager);

// Register API routes
app.use('/api/accounts', accountsRoutes);
app.use('/api/resources', createResourcesRoutes(resourcesController));
app.use('/api/usage', createUsageRoutes(usageController, cacheManager));
app.use('/api/cache', createCacheRoutes(cacheController));
app.use('/api/reports', reportsRoutes);

// Initialize WebSocket progress handler
let progressHandler: ProgressHandler | null = null;
if (io) {
  progressHandler = new ProgressHandler(io);
  reportsController.setProgressHandler(progressHandler);
  logger.info('WebSocket progress handler initialized');
}

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const normalized = normalizeError(error);
  const requestId = res.locals.requestId as string | undefined;

  logger.error(
    {
      requestId,
      code: normalized.code,
      statusCode: normalized.statusCode,
      context: normalized.context,
      error: normalized,
    },
    'Request failed',
  );

  res.status(normalized.statusCode).json({
    error: {
      code: normalized.code,
      message: normalized.message,
      ...(serverConfig.nodeEnv !== 'production' ? { context: normalized.context } : {}),
    },
  });
});

if (io) {
  io.on('connection', (socket) => {
    logger.info({ socketId: socket.id }, 'WebSocket client connected');

    socket.emit('server:ready', {
      timestamp: new Date().toISOString(),
      message: 'WebSocket server initialized',
    });

    socket.on('disconnect', () => {
      logger.info({ socketId: socket.id }, 'WebSocket client disconnected');
    });
  });
}

let shuttingDown = false;

const shutdown = async (signal: string): Promise<void> => {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  logger.info({ signal }, 'Graceful shutdown started');

  // Close HTTP server
  await new Promise<void>((resolve, reject) => {
    httpServer.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

  // Close WebSocket server
  if (io) {
    io.close();
  }

  // Shutdown rate limit store
  shutdownRateLimitStore();

  // Shutdown cache manager
  if (cacheManager) {
    await cacheManager.shutdown();
  }

  logger.info({ signal }, 'Graceful shutdown completed');
};

const startServer = (): void => {
  httpServer.listen(serverConfig.port, serverConfig.host, () => {
    logger.info(
      {
        host: serverConfig.host,
        port: serverConfig.port,
        websocketEnabled: serverConfig.websocketEnabled,
      },
      'Backend server started',
    );
  });
};

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

process.on('unhandledRejection', (error) => {
  const normalized = normalizeError(error);
  logger.error({ error: normalized }, 'Unhandled promise rejection');
});

process.on('uncaughtException', (error) => {
  logger.fatal({ error }, 'Uncaught exception');
});

startServer();

export { app, httpServer, io, startServer, shutdown };
export default app;

// Made with Bob
