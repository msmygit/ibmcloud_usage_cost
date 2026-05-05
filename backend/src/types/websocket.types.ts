import type { ReportStatus } from './report.types';

/**
 * WebSocket event types
 */
export enum WebSocketEvent {
  // Server events
  SERVER_READY = 'server:ready',
  REPORT_PROGRESS = 'report:progress',
  REPORT_COMPLETE = 'report:complete',
  REPORT_ERROR = 'report:error',
  
  // Client events
  JOIN_ROOM = 'client:join-room',
  LEAVE_ROOM = 'client:leave-room',
  CANCEL_REPORT = 'client:cancel-report',
}

/**
 * Report generation step
 */
export type ReportGenerationStep =
  | 'started'
  | 'collecting_resources'
  | 'collecting_usage'
  | 'correlating_data'
  | 'calculating_trends'
  | 'generating_forecasts'
  | 'aggregating_results'
  | 'finalizing'
  | 'complete';

/**
 * Server ready event payload
 */
export interface ServerReadyPayload {
  readonly timestamp: string;
  readonly message: string;
  readonly version?: string;
}

/**
 * Report progress event payload
 */
export interface ReportProgressPayload {
  readonly reportId: string;
  readonly status: ReportStatus;
  readonly progress: number; // 0-100
  readonly currentStep: ReportGenerationStep;
  readonly stepProgress?: number; // 0-100 for current step
  readonly message?: string;
  readonly estimatedTimeRemaining?: number; // seconds
  readonly timestamp: string;
}

/**
 * Report complete event payload
 */
export interface ReportCompletePayload {
  readonly reportId: string;
  readonly status: 'completed';
  readonly message: string;
  readonly timestamp: string;
  readonly duration: number; // milliseconds
  readonly reportUrl?: string;
}

/**
 * Report error event payload
 */
export interface ReportErrorPayload {
  readonly reportId: string;
  readonly status: 'failed';
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details?: Record<string, unknown>;
  };
  readonly timestamp: string;
}

/**
 * Join room request payload
 */
export interface JoinRoomPayload {
  readonly room: string;
  readonly userId?: string;
}

/**
 * Leave room request payload
 */
export interface LeaveRoomPayload {
  readonly room: string;
}

/**
 * Cancel report request payload
 */
export interface CancelReportPayload {
  readonly reportId: string;
  readonly reason?: string;
}

/**
 * WebSocket room identifier
 */
export type WebSocketRoom = `report:${string}` | `user:${string}` | 'global';

/**
 * WebSocket connection metadata
 */
export interface WebSocketConnectionMetadata {
  readonly socketId: string;
  readonly connectedAt: Date;
  readonly userId?: string;
  readonly rooms: Set<string>;
  readonly lastActivity: Date;
}

/**
 * WebSocket message wrapper
 */
export interface WebSocketMessage<T = unknown> {
  readonly event: WebSocketEvent | string;
  readonly payload: T;
  readonly timestamp: string;
  readonly requestId?: string;
}

/**
 * WebSocket error
 */
export interface WebSocketError {
  readonly code: string;
  readonly message: string;
  readonly event?: string;
  readonly timestamp: string;
}

/**
 * WebSocket authentication payload
 */
export interface WebSocketAuthPayload {
  readonly token?: string;
  readonly apiKey?: string;
  readonly userId?: string;
}

/**
 * WebSocket authentication response
 */
export interface WebSocketAuthResponse {
  readonly authenticated: boolean;
  readonly userId?: string;
  readonly expiresAt?: string;
  readonly error?: string;
}

// Made with Bob