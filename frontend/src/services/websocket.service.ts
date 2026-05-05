/**
 * WebSocket Service
 * Socket.io client for real-time communication with backend
 */

import { io, Socket } from 'socket.io-client';
import {
  WebSocketEvent,
  type WebSocketConnectionState,
  type WebSocketConnectionOptions,
  type ServerReadyPayload,
  type ReportProgressPayload,
  type ReportCompletePayload,
  type ReportErrorPayload,
  type JoinRoomPayload,
  type LeaveRoomPayload,
  type CancelReportPayload,
  type WebSocketError,
} from '../types/websocket.types';

/**
 * Event callback type
 */
type EventCallback<T = unknown> = (data: T) => void;

/**
 * WebSocket Service class
 */
class WebSocketService {
  private socket: Socket | null = null;
  private connectionState: WebSocketConnectionState = 'disconnected';
  private eventListeners: Map<string, Set<EventCallback>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  /**
   * Connect to WebSocket server
   */
  connect(options?: Partial<WebSocketConnectionOptions>): void {
    if (this.socket?.connected) {
      console.warn('WebSocket already connected');
      return;
    }

    const url = options?.url || import.meta.env.VITE_WS_URL || 'http://localhost:3000';
    
    this.connectionState = 'connecting';
    this.socket = io(url, {
      autoConnect: options?.autoConnect ?? true,
      reconnection: options?.reconnection ?? true,
      reconnectionAttempts: options?.reconnectionAttempts ?? this.maxReconnectAttempts,
      reconnectionDelay: options?.reconnectionDelay ?? 1000,
      timeout: options?.timeout ?? 20000,
    });

    this.setupEventHandlers();
  }

  /**
   * Setup socket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      console.log('WebSocket connected:', this.socket?.id);
      this.connectionState = 'connected';
      this.reconnectAttempts = 0;
      this.emit('connection:state', { state: 'connected' });
    });

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      this.connectionState = 'disconnected';
      this.emit('connection:state', { state: 'disconnected', reason });
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      this.connectionState = 'error';
      this.emit('connection:error', { error: error.message });
    });

    this.socket.on('reconnect_attempt', (attempt) => {
      console.log('WebSocket reconnect attempt:', attempt);
      this.connectionState = 'reconnecting';
      this.reconnectAttempts = attempt;
      this.emit('connection:state', { state: 'reconnecting', attempt });
    });

    this.socket.on('reconnect', (attempt) => {
      console.log('WebSocket reconnected after', attempt, 'attempts');
      this.connectionState = 'connected';
      this.emit('connection:state', { state: 'connected' });
    });

    this.socket.on('reconnect_failed', () => {
      console.error('WebSocket reconnection failed');
      this.connectionState = 'error';
      this.emit('connection:error', { error: 'Reconnection failed' });
    });

    // Server events
    this.socket.on(WebSocketEvent.SERVER_READY, (data: ServerReadyPayload) => {
      console.log('Server ready:', data);
      this.emit(WebSocketEvent.SERVER_READY, data);
    });

    this.socket.on(WebSocketEvent.REPORT_PROGRESS, (data: ReportProgressPayload) => {
      this.emit(WebSocketEvent.REPORT_PROGRESS, data);
    });

    this.socket.on(WebSocketEvent.REPORT_COMPLETE, (data: ReportCompletePayload) => {
      this.emit(WebSocketEvent.REPORT_COMPLETE, data);
    });

    this.socket.on(WebSocketEvent.REPORT_ERROR, (data: ReportErrorPayload) => {
      this.emit(WebSocketEvent.REPORT_ERROR, data);
    });

    // Error handling
    this.socket.on('error', (error: WebSocketError) => {
      console.error('WebSocket error:', error);
      this.emit('error', error);
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connectionState = 'disconnected';
      this.eventListeners.clear();
    }
  }

  /**
   * Join a room
   */
  joinRoom(payload: JoinRoomPayload): void {
    if (!this.socket?.connected) {
      console.warn('Cannot join room: WebSocket not connected');
      return;
    }
    this.socket.emit(WebSocketEvent.JOIN_ROOM, payload);
  }

  /**
   * Leave a room
   */
  leaveRoom(payload: LeaveRoomPayload): void {
    if (!this.socket?.connected) {
      console.warn('Cannot leave room: WebSocket not connected');
      return;
    }
    this.socket.emit(WebSocketEvent.LEAVE_ROOM, payload);
  }

  /**
   * Cancel report generation
   */
  cancelReport(payload: CancelReportPayload): void {
    if (!this.socket?.connected) {
      console.warn('Cannot cancel report: WebSocket not connected');
      return;
    }
    this.socket.emit(WebSocketEvent.CANCEL_REPORT, payload);
  }

  /**
   * Subscribe to an event
   */
  on<T = unknown>(event: string, callback: EventCallback<T>): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback as EventCallback);

    // Return unsubscribe function
    return () => this.off(event, callback);
  }

  /**
   * Unsubscribe from an event
   */
  off<T = unknown>(event: string, callback: EventCallback<T>): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(callback as EventCallback);
      if (listeners.size === 0) {
        this.eventListeners.delete(event);
      }
    }
  }

  /**
   * Emit event to listeners
   */
  private emit<T = unknown>(event: string, data: T): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach((callback) => callback(data));
    }
  }

  /**
   * Get connection state
   */
  getConnectionState(): WebSocketConnectionState {
    return this.connectionState;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  /**
   * Get socket ID
   */
  getSocketId(): string | undefined {
    return this.socket?.id;
  }
}

// Export singleton instance
export const websocketService = new WebSocketService();
export default websocketService;

// Made with Bob
