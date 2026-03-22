'use client';

/**
 * Live Migration Detail Page
 *
 * Displays real-time migration execution with live metrics,
 * phase timeline, and scrolling event feed. This is the page
 * customers watch during their migration.
 */

import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  FileText,
  Image,
  Code,
  FlaskConical,
  Loader2,
  CheckCircle,
  Circle,
  Wifi,
  WifiOff,
} from 'lucide-react';

import { useLiveMetrics } from '@/hooks/use-live-metrics';
import { useMigrationProgress } from '@/hooks/use-migration-progress';
import { ScoreRing } from '@/components/ui/score-ring';
import { LiveCounter } from '@/components/portal/live-counter';
import { TransferSpeed } from '@/components/portal/transfer-speed';
import { EventFeed } from '@/components/portal/event-feed';

// ── Org Name Lookup ────────────────────────────────────────

function getOrgDisplayName(orgId: string): string {
  const names: Record<string, string> = {
    acme: 'ACME Corporation',
    globalretail: 'GlobalRetail Inc.',
  };
  return names[orgId] ?? `Organization ${orgId}`;
}

// ── Phase Duration Formatter ───────────────────────────────

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '--';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
}

// ── Phase Timeline Component ──────────────────────────────

function LivePhaseTimeline({
  phases,
}: {
  phases: {
    name: string;
    status: 'completed' | 'active' | 'pending';
    progress: number;
    itemsProcessed: number;
    itemsTotal: number;
    durationSeconds: number | null;
  }[];
}) {
  return (
    <div className="space-y-0">
      {phases.map((phase, i) => (
        <motion.div
          key={phase.name}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.05 + i * 0.06 }}
          className="relative flex gap-4"
        >
          {/* Connector Line */}
          {i < phases.length - 1 && (
            <div className="absolute left-[15px] top-[36px] h-[calc(100%-20px)] w-px bg-slate-700" />
          )}

          {/* Status Icon */}
          <div className="relative z-10 mt-1 shrink-0">
            {phase.status === 'completed' ? (
              <CheckCircle className="h-8 w-8 text-emerald-400" />
            ) : phase.status === 'active' ? (
              <div className="relative">
                <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
                <div className="absolute inset-0 h-8 w-8 animate-ping rounded-full bg-violet-400/20" />
              </div>
            ) : (
              <Circle className="h-8 w-8 text-slate-600" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 pb-6">
            <div className="flex items-center justify-between">
              <div>
                <h3
                  className={`text-base font-semibold ${
                    phase.status === 'pending' ? 'text-slate-500' : 'text-white'
                  }`}
                >
                  {phase.name}
                </h3>
                <p className="mt-0.5 text-sm text-slate-400">
                  {phase.status === 'completed'
                    ? `${phase.itemsProcessed.toLocaleString()} items processed`
                    : phase.status === 'active'
                      ? `${phase.itemsProcessed.toLocaleString()} / ${phase.itemsTotal.toLocaleString()} items`
                      : `${phase.itemsTotal.toLocaleString()} items queued`}
                </p>
              </div>
              <div className="text-right">
                {phase.status !== 'pending' && (
                  <span className="text-xs text-slate-500">
                    {formatDuration(phase.durationSeconds)}
                  </span>
                )}
              </div>
            </div>

            {/* Active Phase Progress Bar */}
            {phase.status === 'active' && (
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Progress</span>
                  <span className="font-medium tabular-nums text-violet-400">
                    {phase.progress}%
                  </span>
                </div>
                <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-slate-800">
                  <motion.div
                    className="relative h-full overflow-hidden rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${phase.progress}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                  >
                    {/* Pulsing gradient */}
                    <div className="absolute inset-0 bg-gradient-to-r from-violet-500 via-cyan-400 to-violet-500 animate-gradient-shimmer" />
                  </motion.div>
                </div>
              </div>
            )}

            {/* Completed Phase Bar */}
            {phase.status === 'completed' && (
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800">
                <div className="h-full w-full rounded-full bg-emerald-500/60" />
              </div>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ── Connection Status ──────────────────────────────────────

function ConnectionStatus({ connected }: { connected: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {connected ? (
        <>
          <div className="relative">
            <div className="h-2 w-2 rounded-full bg-emerald-400" />
            <div className="absolute inset-0 h-2 w-2 animate-ping rounded-full bg-emerald-400/50" />
          </div>
          <Wifi className="h-4 w-4 text-emerald-400" />
          <span className="text-xs text-emerald-400">Live</span>
        </>
      ) : (
        <>
          <div className="h-2 w-2 rounded-full bg-rose-400" />
          <WifiOff className="h-4 w-4 text-rose-400" />
          <span className="text-xs text-rose-400">Disconnected</span>
        </>
      )}
    </div>
  );
}

// ── Loading State ──────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-4 py-8">
        <div className="h-32 w-32 animate-pulse rounded-full bg-slate-800" />
        <div className="h-4 w-48 animate-pulse rounded bg-slate-800" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-800/50" />
        ))}
      </div>
      <div className="h-16 animate-pulse rounded-xl bg-slate-800/50" />
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────

export default function MigrationDetailPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const migrationId = params.migrationId as string;
  const orgName = getOrgDisplayName(orgId);

  // SSE connection for real-time events
  const sseState = useMigrationProgress(migrationId);

  // Polling for metrics
  const {
    metrics,
    phases,
    events,
    throughputHistory,
    itemsPerMinute,
    etaFormatted,
    overallProgress,
    isLoading,
  } = useLiveMetrics(migrationId);

  // Use SSE connection status, fall back to polling-based "connected"
  const isConnected = sseState.isConnected || !isLoading;

  if (isLoading && !metrics) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between"
      >
        <div>
          <p className="text-sm text-slate-400">{orgName}</p>
          <h1 className="mt-1 text-2xl font-bold text-white">
            {metrics?.migrationType ?? 'Migration in Progress'}
          </h1>
          <div className="mt-2 flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <div className="h-2 w-2 animate-pulse rounded-full bg-violet-400" />
              <span className="text-sm font-medium text-violet-400">
                Executing
              </span>
            </span>
            <span className="text-sm text-slate-500">
              ID: {migrationId}
            </span>
          </div>
        </div>
        <ConnectionStatus connected={isConnected} />
      </motion.div>

      {/* Overall Progress Ring */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="flex justify-center py-4"
      >
        <ScoreRing
          score={overallProgress}
          size={160}
          strokeWidth={10}
          label="Overall Progress"
        />
      </motion.div>

      {/* Live Metrics Row */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        <LiveCounter
          value={metrics?.pages.processed ?? 0}
          suffix={`/ ${(metrics?.pages.total ?? 0).toLocaleString()}`}
          label="Pages Migrated"
          icon={<FileText className="h-5 w-5" />}
          trend={itemsPerMinute > 600 ? 'up' : itemsPerMinute > 200 ? 'stable' : 'down'}
        />
        <LiveCounter
          value={metrics?.assets.processed ?? 0}
          suffix={`/ ${(metrics?.assets.total ?? 0).toLocaleString()}`}
          label="Assets Transferred"
          icon={<Image className="h-5 w-5" />}
          trend={itemsPerMinute > 600 ? 'up' : 'stable'}
        />
        <LiveCounter
          value={metrics?.codeChanges.processed ?? 0}
          suffix={`/ ${metrics?.codeChanges.total ?? 0}`}
          label="Code Changes Applied"
          icon={<Code className="h-5 w-5" />}
          trend={(metrics?.codeChanges.processed ?? 0) >= (metrics?.codeChanges.total ?? 1) ? 'up' : 'stable'}
        />
        <LiveCounter
          value={metrics?.tests.processed ?? 0}
          suffix={`/ ${(metrics?.tests.total ?? 0).toLocaleString()}`}
          label="Tests Passing"
          icon={<FlaskConical className="h-5 w-5" />}
          trend={(metrics?.tests.processed ?? 0) > 0 ? 'up' : 'stable'}
        />
      </motion.div>

      {/* Transfer Speed */}
      <TransferSpeed
        throughput={itemsPerMinute}
        throughputHistory={throughputHistory}
        etaFormatted={etaFormatted}
      />

      {/* Two-Column: Phase Timeline + Event Feed */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Phase Timeline */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-5"
        >
          <h3 className="mb-4 text-sm font-semibold text-white">
            Phase Timeline
          </h3>
          <LivePhaseTimeline
            phases={phases.map((p) => ({
              name: p.name,
              status: p.status,
              progress: p.progress,
              itemsProcessed: p.itemsProcessed,
              itemsTotal: p.itemsTotal,
              durationSeconds: p.durationSeconds,
            }))}
          />
        </motion.div>

        {/* Event Feed */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <EventFeed events={events} />
        </motion.div>
      </div>
    </div>
  );
}
