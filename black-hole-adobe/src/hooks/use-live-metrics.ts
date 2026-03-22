'use client';

/**
 * useLiveMetrics Hook
 *
 * Polls the metrics API endpoint every 5 seconds and computes
 * derived metrics such as throughput trend, ETA, and phase durations.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { LiveMetrics, LivePhase, LiveEvent } from '@/config/mock-live-data';

// ── Public Types ───────────────────────────────────────────

export interface LiveMetricsState {
  metrics: LiveMetrics | null;
  phases: LivePhase[];
  events: LiveEvent[];
  throughputHistory: number[];
  itemsPerMinute: number;
  etaFormatted: string;
  overallProgress: number;
  isLoading: boolean;
  error: string | null;
}

// ── Constants ──────────────────────────────────────────────

const POLL_INTERVAL_MS = 5_000;
const MAX_THROUGHPUT_HISTORY = 60;
const MAX_EVENTS = 100;

// ── ETA Formatter ──────────────────────────────────────────

function formatEta(totalSeconds: number): string {
  if (totalSeconds <= 0) return 'Complete';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return '<1m';
}

// ── Hook ───────────────────────────────────────────────────

export function useLiveMetrics(migrationId: string | null): LiveMetricsState {
  const [metrics, setMetrics] = useState<LiveMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const throughputHistoryRef = useRef<number[]>([]);
  const allEventsRef = useRef<LiveEvent[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchMetrics = useCallback(async () => {
    if (!migrationId) return;

    try {
      const res = await fetch(`/api/migrations/${migrationId}/metrics`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const json = await res.json();
      const data: LiveMetrics = json.data ?? json;

      // Accumulate throughput history
      throughputHistoryRef.current = [
        ...throughputHistoryRef.current,
        data.throughput,
      ].slice(-MAX_THROUGHPUT_HISTORY);

      // Accumulate events (deduplicate by id)
      const existingIds = new Set(allEventsRef.current.map((e) => e.id));
      const newEvents = data.events.filter((e) => !existingIds.has(e.id));
      allEventsRef.current = [
        ...allEventsRef.current,
        ...newEvents,
      ].slice(-MAX_EVENTS);

      setMetrics(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch metrics');
    } finally {
      setIsLoading(false);
    }
  }, [migrationId]);

  useEffect(() => {
    if (!migrationId) {
      setIsLoading(false);
      return;
    }

    // Initial fetch
    fetchMetrics();

    // Poll
    timerRef.current = setInterval(fetchMetrics, POLL_INTERVAL_MS);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [migrationId, fetchMetrics]);

  const throughputHistory = throughputHistoryRef.current;
  const itemsPerMinute = metrics?.throughput ?? 0;
  const etaFormatted = formatEta(metrics?.etaSeconds ?? 0);

  return {
    metrics,
    phases: metrics?.phases ?? [],
    events: allEventsRef.current,
    throughputHistory,
    itemsPerMinute,
    etaFormatted,
    overallProgress: metrics?.overallProgress ?? 0,
    isLoading,
    error,
  };
}
