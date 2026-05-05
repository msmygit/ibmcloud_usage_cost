import pino, { type Logger, type LoggerOptions } from 'pino';

import { serverConfig } from '../config/server.config';

const loggerOptions: LoggerOptions = {
  level: serverConfig.logLevel,
  base: {
    service: 'ibmcloud-cost-backend',
    environment: serverConfig.nodeEnv,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  transport: serverConfig.logPretty
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
};

export const logger: Logger = pino(loggerOptions);

export const createChildLogger = (bindings: Record<string, unknown>): Logger =>
  logger.child(bindings);

// Made with Bob
