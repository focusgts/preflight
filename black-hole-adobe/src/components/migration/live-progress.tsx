'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  Circle,
  Loader2,
  XCircle,
  Wifi,
  WifiOff,
  Clock,
  Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Badge } from '@/components/ui/badge';
import { useMigrationProgress } from '@/hooks/use-migration-progress';
import type { PhaseProgressState, ProgressEvent } from '@/lib/progress/types';

// ── Types ────────────────────────────────────────────────────────────────

interface LiveProgressProps {
  migrationId: string;
  className?: string;
}

// ── Phase Status Icons ───────────────────────────────────────────────────

const PHASE_STATUS_ICON: Record<PhaseProgressState['status'], typeof Circle> = {
  pending: Circle,
  running: Loader2,
  completed: CheckCircle2,
  failed: XCircle,
};

const PHASE_STATUS_CLASSES: Record<PhaseProgressState['status'], string> = {
  pending: 'text-slate-600',
  running: 'text-cyan-400 animate-spin',
  completed: 'text-emerald-400',
  failed: 'text-rose-400',
};

// ── Component ────────────────────────────────────────────────────────────

export function LiveProgress({ migrationId, className }: LiveProgressProps) {
  const progress = useMigrationProgress(migrationId);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll log to bottom
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [progress.events.length]);

  const estimatedRemaining = getEstimatedRemaining(progress.events);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header with Connection Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="h-5 w-5 text-violet-400" />
          <h3 className="text-lg font-semibold text-white">Migration Progress</h3>
        </div>

        <div className="flex items-center gap-2">
          {estimatedRemaining !== null && (
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Clock className="h-3.5 w-3.5" />
              <span>{formatDuration(estimatedRemaining)} remaining</span>
            </div>
          )}
          <ConnectionIndicator connected={progress.isConnected} />
        </div>
      </div>

      {/* Overall Progress Bar */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-medium text-slate-200">
            Overall Progress
          </span>
          <span className="font-mono text-sm font-semibold text-white">
            {progress.overallProgress}%
          </span>
        </div>
        <ProgressBar
          value={progress.overallProgress}
          size="lg"
          active={progress.status === 'running'}
        />
        <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
          <span>
            {progress.status === 'idle' && 'Waiting to start...'}
            {progress.status === 'running' && `Processing: ${progress.currentPhase}`}
            {progress.status === 'completed' && 'Migration completed'}
            {progress.status === 'failed' && 'Migration failed'}
          </span>
          <StatusBadge status={progress.status} />
        </div>
      </div>

      {/* Phase Timeline */}
      {progress.phases.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <h4 className="mb-4 text-sm font-medium text-slate-300">Phase Timeline</h4>
          <div className="space-y-1">
            {progress.phases.map((phase, idx) => (
              <PhaseRow key={phase.name} phase={phase} isLast={idx === progress.phases.length - 1} />
            ))}
          </div>
        </div>
      )}

      {/* Event Log */}
      {progress.events.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60">
          <div className="border-b border-slate-800 px-5 py-3">
            <h4 className="text-sm font-medium text-slate-300">Event Log</h4>
          </div>
          <div className="max-h-64 overflow-y-auto px-5 py-3">
            <div className="space-y-1.5">
              <AnimatePresence initial={false}>
                {progress.events.slice(-50).map((event, idx) => (
                  <EventRow key={`${event.timestamp}-${idx}`} event={event} />
                ))}
              </AnimatePresence>
              <div ref={logEndRef} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-Components ───────────────────────────────────────────────────────

function ConnectionIndicator({ connected }: { connected: boolean }) {
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        connected
          ? 'bg-emerald-500/10 text-emerald-400'
          : 'bg-rose-500/10 text-rose-400',
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          connected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400',
        )}
      />
      {connected ? (
        <>
          <Wifi className="h-3 w-3" />
          <span>Live</span>
        </>
      ) : (
        <>
          <WifiOff className="h-3 w-3" />
          <span>Disconnected</span>
        </>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variantMap: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
    idle: 'default',
    running: 'info',
    completed: 'success',
    failed: 'error',
  };

  return (
    <Badge variant={variantMap[status] ?? 'default'} dot>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

function PhaseRow({ phase, isLast }: { phase: PhaseProgressState; isLast: boolean }) {
  const Icon = PHASE_STATUS_ICON[phase.status];
  const iconClasses = PHASE_STATUS_CLASSES[phase.status];

  return (
    <div className="flex items-start gap-3">
      {/* Timeline connector */}
      <div className="flex flex-col items-center">
        <Icon className={cn('h-4 w-4 shrink-0', iconClasses)} />
        {!isLast && (
          <div
            className={cn(
              'mt-1 h-8 w-px',
              phase.status === 'completed' ? 'bg-emerald-500/30' : 'bg-slate-800',
            )}
          />
        )}
      </div>

      {/* Phase content */}
      <div className="min-w-0 flex-1 pb-3">
        <div className="flex items-center justify-between">
          <span
            className={cn(
              'text-sm font-medium',
              phase.status === 'running'
                ? 'text-white'
                : phase.status === 'completed'
                ? 'text-emerald-400'
                : phase.status === 'failed'
                ? 'text-rose-400'
                : 'text-slate-500',
            )}
          >
            {formatPhaseName(phase.name)}
          </span>
          <span className="font-mono text-xs text-slate-500">
            {phase.itemsTotal > 0
              ? `${phase.itemsProcessed}/${phase.itemsTotal}`
              : `${phase.progress}%`}
          </span>
        </div>

        {phase.status === 'running' && (
          <ProgressBar value={phase.progress} size="sm" active className="mt-1.5" />
        )}
      </div>
    </div>
  );
}

function EventRow({ event }: { event: ProgressEvent }) {
  const colorMap: Record<string, string> = {
    phase_start: 'text-cyan-400',
    phase_progress: 'text-slate-400',
    item_processed: 'text-slate-400',
    phase_complete: 'text-emerald-400',
    migration_complete: 'text-emerald-400',
    error: 'text-rose-400',
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-start gap-2 font-mono text-xs"
    >
      <span className="shrink-0 text-slate-600">
        {new Date(event.timestamp).toLocaleTimeString()}
      </span>
      <span className={cn('min-w-0 break-words', colorMap[event.type] ?? 'text-slate-400')}>
        {event.message}
      </span>
    </motion.div>
  );
}

// ── Utilities ────────────────────────────────────────────────────────────

function formatPhaseName(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function getEstimatedRemaining(events: ProgressEvent[]): number | null {
  // Find the most recent event with estimated time remaining
  for (let i = events.length - 1; i >= 0; i--) {
    const est = events[i].details.estimatedSecondsRemaining;
    if (typeof est === 'number' && est > 0) {
      return est;
    }
  }
  return null;
}
