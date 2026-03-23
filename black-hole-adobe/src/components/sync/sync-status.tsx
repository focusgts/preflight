'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils/cn';
import type { SyncStats, SyncHealth } from '@/types/sync';
import { SyncStatus, SyncHealthLevel } from '@/types/sync';

interface SyncStatusProps {
  status: SyncStatus;
  stats: SyncStats;
  health: SyncHealth;
  lastSyncAt: string | null;
  sourcePlatform: string;
  targetPlatform: string;
}

function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const start = display;
    const diff = value - start;
    if (diff === 0) return;
    const steps = 20;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      setDisplay(Math.round(start + diff * (step / steps)));
      if (step >= steps) clearInterval(timer);
    }, 30);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <span className={className}>{display.toLocaleString()}</span>;
}

function PulsingDot({ color }: { color: string }) {
  return (
    <span className="relative flex h-3 w-3">
      <span
        className={cn(
          'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
          color,
        )}
      />
      <span
        className={cn(
          'relative inline-flex h-3 w-3 rounded-full',
          color,
        )}
      />
    </span>
  );
}

function ConnectionLine({ active }: { active: boolean }) {
  return (
    <div className="relative flex-1 mx-2 h-[2px] overflow-hidden rounded-full bg-slate-800">
      {active && (
        <motion.div
          className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-transparent via-violet-500 to-transparent"
          animate={{ x: ['-100%', '400%'] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
        />
      )}
    </div>
  );
}

const statusConfig: Record<SyncStatus, { label: string; color: string; dotColor: string }> = {
  [SyncStatus.INITIALIZING]: { label: 'Initializing', color: 'text-cyan-400', dotColor: 'bg-cyan-400' },
  [SyncStatus.SYNCING]: { label: 'Syncing', color: 'text-emerald-400', dotColor: 'bg-emerald-400' },
  [SyncStatus.PAUSED]: { label: 'Paused', color: 'text-amber-400', dotColor: 'bg-amber-400' },
  [SyncStatus.STOPPED]: { label: 'Stopped', color: 'text-slate-400', dotColor: 'bg-slate-400' },
  [SyncStatus.CUTOVER_IN_PROGRESS]: { label: 'Cutover', color: 'text-violet-400', dotColor: 'bg-violet-400' },
  [SyncStatus.COMPLETED]: { label: 'Completed', color: 'text-emerald-400', dotColor: 'bg-emerald-400' },
  [SyncStatus.ERROR]: { label: 'Error', color: 'text-rose-400', dotColor: 'bg-rose-400' },
};

const healthConfig: Record<SyncHealthLevel, { label: string; color: string; bg: string }> = {
  [SyncHealthLevel.HEALTHY]: { label: 'Healthy', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  [SyncHealthLevel.DEGRADED]: { label: 'Degraded', color: 'text-amber-400', bg: 'bg-amber-500/10' },
  [SyncHealthLevel.ERROR]: { label: 'Error', color: 'text-rose-400', bg: 'bg-rose-500/10' },
};

export function SyncStatusDisplay({
  status,
  stats,
  health,
  lastSyncAt,
  sourcePlatform,
  targetPlatform,
}: SyncStatusProps) {
  const active = status === SyncStatus.SYNCING;
  const cfg = statusConfig[status];
  const hCfg = healthConfig[health.level];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-slate-800 bg-slate-900/80 backdrop-blur-sm p-6"
    >
      {/* Connection visualization */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex flex-col items-center gap-1">
          <div className="h-10 w-10 rounded-lg bg-slate-800 flex items-center justify-center text-xs font-mono text-slate-300">
            SRC
          </div>
          <span className="text-xs text-slate-500">{sourcePlatform}</span>
        </div>

        <ConnectionLine active={active} />

        <div className="flex flex-col items-center gap-1">
          <div className="h-10 w-10 rounded-lg bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
            <span className="text-xs font-bold text-violet-400">BH</span>
          </div>
          <span className="text-xs text-slate-500">Black Hole</span>
        </div>

        <ConnectionLine active={active} />

        <div className="flex flex-col items-center gap-1">
          <div className="h-10 w-10 rounded-lg bg-slate-800 flex items-center justify-center text-xs font-mono text-slate-300">
            TGT
          </div>
          <span className="text-xs text-slate-500">{targetPlatform}</span>
        </div>
      </div>

      {/* Status and health */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {active && <PulsingDot color={cfg.dotColor} />}
          <span className={cn('text-sm font-medium', cfg.color)}>{cfg.label}</span>
        </div>

        <div className={cn('flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium', hCfg.bg, hCfg.color)}>
          <span className={cn('h-1.5 w-1.5 rounded-full', hCfg.color === 'text-emerald-400' ? 'bg-emerald-400' : hCfg.color === 'text-amber-400' ? 'bg-amber-400' : 'bg-rose-400')} />
          {hCfg.label}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatBox label="Detected" value={stats.totalChangesDetected} />
        <StatBox label="Synced" value={stats.totalChangesSynced} />
        <StatBox label="Conflicts" value={stats.totalConflicts} variant={stats.totalConflicts > 0 ? 'warning' : 'default'} />
        <StatBox label="Errors" value={stats.totalErrors} variant={stats.totalErrors > 0 ? 'error' : 'default'} />
      </div>

      {/* Last sync time */}
      {lastSyncAt && (
        <div className="mt-4 text-xs text-slate-500">
          Last sync: {new Date(lastSyncAt).toLocaleString()}
          {stats.lastSyncDurationMs !== null && (
            <span className="ml-2 text-slate-600">
              ({stats.lastSyncDurationMs}ms)
            </span>
          )}
        </div>
      )}
    </motion.div>
  );
}

function StatBox({
  label,
  value,
  variant = 'default',
}: {
  label: string;
  value: number;
  variant?: 'default' | 'warning' | 'error';
}) {
  return (
    <div className="rounded-lg bg-slate-800/50 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">{label}</div>
      <AnimatedNumber
        value={value}
        className={cn(
          'text-lg font-mono font-semibold',
          variant === 'warning' && 'text-amber-400',
          variant === 'error' && 'text-rose-400',
          variant === 'default' && 'text-slate-200',
        )}
      />
    </div>
  );
}
