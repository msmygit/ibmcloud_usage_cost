import type { Server as SocketIOServer, Socket } from 'socket.io';
import type {
  WebSocketEvent,
  ReportProgressPayload,
  ReportCompletePayload,
  ReportErrorPayload,
  JoinRoomPayload,
  LeaveRoomPayload,
  CancelReportPayload,
  WebSocketRoom,
} from '../types/websocket.types';
import { logger } from '../utils/logger';

/**
 * WebSocket progress handler for real-time report generation updates
 */
export class ProgressHandler {
  private io: SocketIOServer;
  private activeReports: Map<string, { socketId: string; startTime: number }>;

  constructor(io: SocketIOServer) {
    this.io = io;
    this.activeReports = new Map();
    this.setupEventHandlers();
  }

  /**
   * Sets up WebSocket event handlers
   */
  private setupEventHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      logger.info({ socketId: socket.id }, 'Client connected to progress handler');

      // Handle join room
      socket.on('client:join-room', (payload: JoinRoomPayload) => {
        this.handleJoinRoom(socket, payload);
      });

      // Handle leave room
      socket.on('client:leave-room', (payload: LeaveRoomPayload) => {
        this.handleLeaveRoom(socket, payload);
      });

      // Handle cancel report
      socket.on('client:cancel-report', (payload: CancelReportPayload) => {
        this.handleCancelReport(socket, payload);
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        logger.info({ socketId: socket.id }, 'Client disconnected from progress handler');
        this.handleDisconnect(socket);
      });
    });
  }

  /**
   * Handles client joining a room
   */
  private handleJoinRoom(socket: Socket, payload: JoinRoomPayload): void {
    const { room, userId } = payload;
    socket.join(room);
    
    logger.info(
      { socketId: socket.id, room, userId },
      'Client joined room',
    );

    // Send acknowledgment
    socket.emit('server:room-joined', {
      room,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Handles client leaving a room
   */
  private handleLeaveRoom(socket: Socket, payload: LeaveRoomPayload): void {
    const { room } = payload;
    socket.leave(room);
    
    logger.info(
      { socketId: socket.id, room },
      'Client left room',
    );
  }

  /**
   * Handles report cancellation request
   */
  private handleCancelReport(socket: Socket, payload: CancelReportPayload): void {
    const { reportId, reason } = payload;
    
    logger.info(
      { socketId: socket.id, reportId, reason },
      'Report cancellation requested',
    );

    // Remove from active reports
    this.activeReports.delete(reportId);

    // Emit cancellation to all clients in the report room
    this.io.to(`report:${reportId}`).emit('report:cancelled', {
      reportId,
      reason: reason || 'Cancelled by user',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Handles client disconnect
   */
  private handleDisconnect(socket: Socket): void {
    // Clean up any active reports associated with this socket
    for (const [reportId, data] of this.activeReports.entries()) {
      if (data.socketId === socket.id) {
        this.activeReports.delete(reportId);
        logger.info(
          { socketId: socket.id, reportId },
          'Cleaned up active report on disconnect',
        );
      }
    }
  }

  /**
   * Emits progress update for a report
   */
  public emitProgress(payload: ReportProgressPayload): void {
    const room: WebSocketRoom = `report:${payload.reportId}`;
    
    this.io.to(room).emit('report:progress', payload);
    
    logger.debug(
      {
        reportId: payload.reportId,
        progress: payload.progress,
        step: payload.currentStep,
      },
      'Progress update emitted',
    );
  }

  /**
   * Emits report completion
   */
  public emitComplete(payload: ReportCompletePayload): void {
    const room: WebSocketRoom = `report:${payload.reportId}`;
    
    this.io.to(room).emit('report:complete', payload);
    
    // Clean up active report
    this.activeReports.delete(payload.reportId);
    
    logger.info(
      {
        reportId: payload.reportId,
        duration: payload.duration,
      },
      'Report completion emitted',
    );
  }

  /**
   * Emits report error
   */
  public emitError(payload: ReportErrorPayload): void {
    const room: WebSocketRoom = `report:${payload.reportId}`;
    
    this.io.to(room).emit('report:error', payload);
    
    // Clean up active report
    this.activeReports.delete(payload.reportId);
    
    logger.error(
      {
        reportId: payload.reportId,
        error: payload.error,
      },
      'Report error emitted',
    );
  }

  /**
   * Registers a new report generation
   */
  public registerReport(reportId: string, socketId: string): void {
    this.activeReports.set(reportId, {
      socketId,
      startTime: Date.now(),
    });
    
    logger.info(
      { reportId, socketId },
      'Report generation registered',
    );
  }

  /**
   * Gets active report count
   */
  public getActiveReportCount(): number {
    return this.activeReports.size;
  }

  /**
   * Gets active reports
   */
  public getActiveReports(): Array<{ reportId: string; socketId: string; duration: number }> {
    const now = Date.now();
    return Array.from(this.activeReports.entries()).map(([reportId, data]) => ({
      reportId,
      socketId: data.socketId,
      duration: now - data.startTime,
    }));
  }

  /**
   * Broadcasts a message to all connected clients
   */
  public broadcast(event: string, payload: unknown): void {
    this.io.emit(event, payload);
    logger.debug({ event }, 'Broadcast message sent');
  }

  /**
   * Sends a message to a specific room
   */
  public sendToRoom(room: WebSocketRoom, event: string, payload: unknown): void {
    this.io.to(room).emit(event, payload);
    logger.debug({ room, event }, 'Message sent to room');
  }

  /**
   * Gets the number of clients in a room
   */
  public async getRoomSize(room: WebSocketRoom): Promise<number> {
    const sockets = await this.io.in(room).fetchSockets();
    return sockets.length;
  }

  /**
   * Checks if a report is active
   */
  public isReportActive(reportId: string): boolean {
    return this.activeReports.has(reportId);
  }
}

// Made with Bob