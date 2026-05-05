/**
 * useWebSocket Hook
 * React hook for WebSocket connection management and real-time updates
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { websocketService } from '../services/websocket.service';
import {
  WebSocketEvent,
  type WebSocketConnectionState,
  type ReportProgressPayload,
  type ReportCompletePayload,
  type ReportErrorPayload,
} from '../types/websocket.types';

/**
 * WebSocket connection hook
 */
export function useWebSocketConnection() {
  const [connectionState, setConnectionState] = useState<WebSocketConnectionState>('disconnected');
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Connect to WebSocket
    websocketService.connect();

    // Subscribe to connection state changes
    const unsubscribe = websocketService.on<{ state: WebSocketConnectionState }>(
      'connection:state',
      (data) => {
        setConnectionState(data.state);
        setIsConnected(data.state === 'connected');
      }
    );

    // Cleanup on unmount
    return () => {
      unsubscribe();
      websocketService.disconnect();
    };
  }, []);

  return {
    connectionState,
    isConnected,
    socketId: websocketService.getSocketId(),
  };
}

/**
 * Hook to subscribe to report progress updates
 */
export function useReportProgress(reportId: string) {
  const [progress, setProgress] = useState<ReportProgressPayload | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!reportId) return;

    // Join the report room
    websocketService.joinRoom({ room: `report:${reportId}` });

    // Subscribe to progress updates
    const unsubscribeProgress = websocketService.on<ReportProgressPayload>(
      WebSocketEvent.REPORT_PROGRESS,
      (data) => {
        if (data.reportId === reportId) {
          setProgress(data);
        }
      }
    );

    // Subscribe to completion
    const unsubscribeComplete = websocketService.on<ReportCompletePayload>(
      WebSocketEvent.REPORT_COMPLETE,
      (data) => {
        if (data.reportId === reportId) {
          setIsComplete(true);
          setProgress({
            reportId: data.reportId,
            status: 'completed',
            progress: 100,
            currentStep: 'complete',
            timestamp: data.timestamp,
          });
        }
      }
    );

    // Subscribe to errors
    const unsubscribeError = websocketService.on<ReportErrorPayload>(
      WebSocketEvent.REPORT_ERROR,
      (data) => {
        if (data.reportId === reportId) {
          setError(data.error.message);
          setProgress({
            reportId: data.reportId,
            status: 'failed',
            progress: 0,
            currentStep: 'complete',
            timestamp: data.timestamp,
          });
        }
      }
    );

    // Cleanup
    return () => {
      websocketService.leaveRoom({ room: `report:${reportId}` });
      unsubscribeProgress();
      unsubscribeComplete();
      unsubscribeError();
    };
  }, [reportId]);

  const cancelReport = useCallback(() => {
    if (reportId) {
      websocketService.cancelReport({ reportId });
    }
  }, [reportId]);

  return {
    progress,
    isComplete,
    error,
    cancelReport,
  };
}

/**
 * Hook to subscribe to multiple report updates
 */
export function useMultipleReportProgress(reportIds: string[]) {
  const [progressMap, setProgressMap] = useState<Map<string, ReportProgressPayload>>(new Map());
  const [completedReports, setCompletedReports] = useState<Set<string>>(new Set());
  const [errorMap, setErrorMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (reportIds.length === 0) return;

    // Join all report rooms
    reportIds.forEach((reportId) => {
      websocketService.joinRoom({ room: `report:${reportId}` });
    });

    // Subscribe to progress updates
    const unsubscribeProgress = websocketService.on<ReportProgressPayload>(
      WebSocketEvent.REPORT_PROGRESS,
      (data) => {
        if (reportIds.includes(data.reportId)) {
          setProgressMap((prev) => new Map(prev).set(data.reportId, data));
        }
      }
    );

    // Subscribe to completion
    const unsubscribeComplete = websocketService.on<ReportCompletePayload>(
      WebSocketEvent.REPORT_COMPLETE,
      (data) => {
        if (reportIds.includes(data.reportId)) {
          setCompletedReports((prev) => new Set(prev).add(data.reportId));
        }
      }
    );

    // Subscribe to errors
    const unsubscribeError = websocketService.on<ReportErrorPayload>(
      WebSocketEvent.REPORT_ERROR,
      (data) => {
        if (reportIds.includes(data.reportId)) {
          setErrorMap((prev) => new Map(prev).set(data.reportId, data.error.message));
        }
      }
    );

    // Cleanup
    return () => {
      reportIds.forEach((reportId) => {
        websocketService.leaveRoom({ room: `report:${reportId}` });
      });
      unsubscribeProgress();
      unsubscribeComplete();
      unsubscribeError();
    };
  }, [reportIds]);

  return {
    progressMap,
    completedReports,
    errorMap,
  };
}

/**
 * Hook to manage WebSocket reconnection
 */
export function useWebSocketReconnect() {
  const reconnectAttempts = useRef(0);
  const maxAttempts = 5;

  const reconnect = useCallback(() => {
    if (reconnectAttempts.current < maxAttempts) {
      reconnectAttempts.current += 1;
      websocketService.connect();
    }
  }, []);

  const resetAttempts = useCallback(() => {
    reconnectAttempts.current = 0;
  }, []);

  return {
    reconnect,
    resetAttempts,
    attempts: reconnectAttempts.current,
    maxAttempts,
  };
}

// Made with Bob
