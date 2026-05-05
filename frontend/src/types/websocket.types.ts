/**
 * Frontend WebSocket Types
 * Mirrors backend WebSocket types for real-time communication
 */

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
  readonly progress: number;
  readonly currentStep: ReportGenerationStep;
  readonly stepProgress?: number;
  readonly message?: string;
  readonly estimatedTimeRemaining?: number;
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
  readonly duration: number;
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
 * WebSocket connection state
 */
export type WebSocketConnectionState = 
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

/**
 * WebSocket connection options
 */
export interface WebSocketConnectionOptions {
  readonly url: string;
  readonly autoConnect?: boolean;
  readonly reconnection?: boolean;
  readonly reconnectionAttempts?: number;
  readonly reconnectionDelay?: number;
  readonly timeout?: number;
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

// Made with Bob
