/**
 * useMigrationProgress Hook
 *
 * React hook that connects to the SSE progress endpoint and
 * provides real-time migration progress state.
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  MigrationProgressState,
  PhaseProgressState,
  ProgressEvent,
} from '@/lib/progress/types';

/** Maximum number of events to keep in history */
const MAX_EVENT_HISTORY = 200;

/** Reconnection delay in milliseconds */
const RECONNECT_DELAY_MS = 3_000;

/** Maximum reconnection attempts before giving up */
const MAX_RECONNECT_ATTEMPTS = 10;

function createInitialState(migrationId: string): MigrationProgressState {
  return {
    migrationId,
    status: 'idle',
    overallProgress: 0,
    currentPhase: '',
    phases: [],
    events: [],
    startedAt: null,
    completedAt: null,
    isConnected: false,
  };
}

export function useMigrationProgress(migrationId: string | null) {
  const [state, setState] = useState<MigrationProgressState>(() =>
    createInitialState(migrationId ?? ''),
  );

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const processEvent = useCallback((event: ProgressEvent) => {
    setState((prev) => {
      const events = [...prev.events, event].slice(-MAX_EVENT_HISTORY);
      const phases = updatePhases(prev.phases, event);

      let status = prev.status;
      let overallProgress = prev.overallProgress;
      let startedAt = prev.startedAt;
      let completedAt = prev.completedAt;

      switch (event.type) {
        case 'phase_start':
          if (status === 'idle') {
            status = 'running';
            startedAt = startedAt ?? event.timestamp;
          }
          break;

        case 'phase_progress':
        case 'item_processed':
          status = 'running';
          overallProgress = calculateOverallProgress(phases);
          break;

        case 'phase_complete':
          overallProgress = calculateOverallProgress(phases);
          break;

        case 'migration_complete':
          status = 'completed';
          overallProgress = 100;
          completedAt = event.timestamp;
          break;

        case 'error':
          status = 'failed';
          break;
      }

      return {
        ...prev,
        status,
        overallProgress,
        currentPhase: event.phase,
        phases,
        events,
        startedAt,
        completedAt,
      };
    });
  }, []);

  const connect = useCallback(() => {
    if (!migrationId) return;

    // Close existing connection
    eventSourceRef.current?.close();

    const url = `/api/migrations/${migrationId}/progress`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => {
      reconnectAttemptRef.current = 0;
      setState((prev) => ({ ...prev, isConnected: true }));
    };

    // Listen to all event types
    const eventTypes = [
      'phase_start',
      'phase_progress',
      'item_processed',
      'phase_complete',
      'migration_complete',
      'error',
    ];

    for (const type of eventTypes) {
      es.addEventListener(type, (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data) as ProgressEvent;
          processEvent(data);
        } catch (err) {
          console.error('[useMigrationProgress] Failed to parse event:', err);
        }
      });
    }

    es.onerror = () => {
      setState((prev) => ({ ...prev, isConnected: false }));
      es.close();

      // Auto-reconnect with backoff
      if (reconnectAttemptRef.current < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttemptRef.current++;
        const delay = RECONNECT_DELAY_MS * reconnectAttemptRef.current;

        console.log(
          `[useMigrationProgress] Reconnecting in ${delay}ms (attempt ${reconnectAttemptRef.current})`,
        );

        reconnectTimerRef.current = setTimeout(connect, delay);
      } else {
        console.warn('[useMigrationProgress] Max reconnection attempts reached');
      }
    };
  }, [migrationId, processEvent]);

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setState((prev) => ({ ...prev, isConnected: false }));
  }, []);

  useEffect(() => {
    if (migrationId) {
      setState(createInitialState(migrationId));
      connect();
    }

    return () => {
      disconnect();
    };
  }, [migrationId, connect, disconnect]);

  return {
    ...state,
    connect,
    disconnect,
  };
}

/**
 * Update the phase list based on an incoming event.
 */
function updatePhases(
  phases: PhaseProgressState[],
  event: ProgressEvent,
): PhaseProgressState[] {
  const updated = [...phases];
  let phaseIndex = updated.findIndex((p) => p.name === event.phase);

  if (phaseIndex === -1 && event.phase !== 'connection') {
    updated.push({
      name: event.phase,
      status: 'pending',
      progress: 0,
      itemsProcessed: 0,
      itemsTotal: 0,
      startedAt: null,
      completedAt: null,
    });
    phaseIndex = updated.length - 1;
  }

  if (phaseIndex === -1) return updated;

  const phase = { ...updated[phaseIndex] };

  switch (event.type) {
    case 'phase_start':
      phase.status = 'running';
      phase.startedAt = event.timestamp;
      phase.itemsTotal = event.details.itemsTotal ?? phase.itemsTotal;
      break;

    case 'phase_progress':
      phase.status = 'running';
      phase.progress = event.progress;
      phase.itemsProcessed = event.details.itemsProcessed ?? phase.itemsProcessed;
      phase.itemsTotal = event.details.itemsTotal ?? phase.itemsTotal;
      break;

    case 'item_processed':
      phase.status = 'running';
      phase.itemsProcessed = event.details.itemsProcessed ?? phase.itemsProcessed + 1;
      phase.itemsTotal = event.details.itemsTotal ?? phase.itemsTotal;
      if (phase.itemsTotal > 0) {
        phase.progress = Math.round((phase.itemsProcessed / phase.itemsTotal) * 100);
      }
      break;

    case 'phase_complete':
      phase.status = 'completed';
      phase.progress = 100;
      phase.completedAt = event.timestamp;
      break;

    case 'error':
      phase.status = 'failed';
      break;
  }

  updated[phaseIndex] = phase;
  return updated;
}

/**
 * Calculate overall progress as a weighted average of phase progress.
 */
function calculateOverallProgress(phases: PhaseProgressState[]): number {
  if (phases.length === 0) return 0;

  const total = phases.reduce((sum, p) => sum + p.progress, 0);
  return Math.round(total / phases.length);
}
