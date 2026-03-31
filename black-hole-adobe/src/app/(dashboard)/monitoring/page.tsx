'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Activity,
  RefreshCw,
  XCircle,
  Shield,
  ExternalLink,
  Play,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { MonitoringSummary } from '@/lib/monitoring/drift-monitor';

// ============================================================
// Alert Level Badge
// ============================================================

const alertConfig: Record<string, { dot: string; bg: string; text: string; label: string }> = {
  green: {
    dot: 'bg-emerald-500',
    bg: 'bg-emerald-500/10 border-emerald-500/20',
    text: 'text-emerald-400',
    label: 'Healthy',
  },
  yellow: {
    dot: 'bg-amber-500',
    bg: 'bg-amber-500/10 border-amber-500/20',
    text: 'text-amber-400',
    label: 'Warning',
  },
  red: {
    dot: 'bg-red-500',
    bg: 'bg-red-500/10 border-red-500/20',
    text: 'text-red-400',
    label: 'Critical',
  },
};

function AlertBadge({ level }: { level: string }) {
  const config = alertConfig[level] ?? alertConfig.green;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        config.bg,
        config.text,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', config.dot)} />
      {config.label}
    </span>
  );
}

// ============================================================
// Drift Score Display
// ============================================================

function DriftScore({ score }: { score: number }) {
  const color =
    score <= 10
      ? 'text-emerald-400'
      : score <= 30
        ? 'text-amber-400'
        : 'text-red-400';

  return <span className={cn('text-2xl font-bold tabular-nums', color)}>{score}</span>;
}

// ============================================================
// Skeleton Card
// ============================================================

function SkeletonCard({ index }: { index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6"
    >
      <div className="animate-pulse space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-5 w-40 rounded bg-slate-800" />
          <div className="h-5 w-20 rounded-full bg-slate-800" />
        </div>
        <div className="h-4 w-56 rounded bg-slate-800" />
        <div className="flex items-end justify-between">
          <div className="h-10 w-16 rounded bg-slate-800" />
          <div className="h-8 w-24 rounded bg-slate-800" />
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================
// Migration Card
// ============================================================

function MigrationCard({
  migration,
  index,
  onCheckNow,
  checking,
}: {
  migration: MonitoringSummary;
  index: number;
  onCheckNow: (id: string) => void;
  checking: boolean;
}) {
  const lastChecked = migration.lastCheckAt
    ? new Date(migration.lastCheckAt).toLocaleString()
    : 'Never';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className="group rounded-2xl border border-slate-800 bg-slate-900/60 p-6 transition-colors hover:border-slate-700"
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-white">
            {migration.migrationId}
          </h3>
          <p className="mt-0.5 truncate text-xs text-slate-500">{migration.siteUrl}</p>
        </div>
        <AlertBadge level={migration.currentAlertLevel} />
      </div>

      {/* Drift Score */}
      <div className="mt-5 flex items-end justify-between">
        <div>
          <p className="text-xs text-slate-500">Drift Score</p>
          <DriftScore score={migration.currentDriftScore} />
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">Last Checked</p>
          <p className="text-xs text-slate-400">{lastChecked}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-4 flex items-center gap-4 border-t border-slate-800 pt-4 text-xs text-slate-500">
        <span>
          Baseline:{' '}
          {new Date(migration.baselineCapturedAt).toLocaleDateString()}
        </span>
        <span>{migration.totalChecks} checks</span>
      </div>

      {/* Actions */}
      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={() => onCheckNow(migration.migrationId)}
          disabled={checking}
          className={cn(
            'flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-700',
            checking && 'cursor-not-allowed opacity-50',
          )}
        >
          {checking ? (
            <RefreshCw className="h-3 w-3 animate-spin" />
          ) : (
            <Play className="h-3 w-3" />
          )}
          Check Now
        </button>
        <Link
          href={`/monitoring/${migration.migrationId}`}
          className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-700"
        >
          <ExternalLink className="h-3 w-3" />
          View Details
        </Link>
      </div>
    </motion.div>
  );
}

// ============================================================
// Page
// ============================================================

export default function MonitoringPage() {
  const [migrations, setMigrations] = useState<MonitoringSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkingId, setCheckingId] = useState<string | null>(null);

  const fetchMigrations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/monitoring');
      const json = await res.json();
      if (json.success) {
        setMigrations(json.data);
      } else {
        setError(json.error?.message ?? 'Failed to load monitored migrations');
      }
    } catch {
      setError('Failed to load monitored migrations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMigrations();
  }, [fetchMigrations]);

  const handleCheckNow = async (migrationId: string) => {
    try {
      setCheckingId(migrationId);
      const res = await fetch(`/api/monitoring/${migrationId}`, {
        method: 'POST',
      });
      const json = await res.json();
      if (json.success) {
        // Refresh the list to show updated data
        await fetchMigrations();
      }
    } catch {
      // Silent — user sees stale state
    } finally {
      setCheckingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10">
            <Activity className="h-5 w-5 text-violet-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Drift Monitoring</h1>
            <p className="text-sm text-slate-400">
              Track post-migration environment changes across all sites
            </p>
          </div>
        </div>
        <button
          onClick={fetchMigrations}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-700"
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          Refresh
        </button>
      </motion.div>

      {/* Error Banner */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between rounded-xl border border-rose-800/50 bg-rose-900/20 px-5 py-3"
        >
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-rose-400" />
            <p className="text-sm text-rose-300">{error}</p>
          </div>
          <button
            onClick={fetchMigrations}
            className="text-xs font-medium text-rose-400 hover:text-rose-300"
          >
            Retry
          </button>
        </motion.div>
      )}

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <SkeletonCard key={i} index={i} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && migrations.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/60 py-16"
        >
          <Shield className="h-12 w-12 text-slate-700" />
          <h2 className="mt-4 text-lg font-semibold text-white">
            No migrations being monitored
          </h2>
          <p className="mt-1 max-w-md text-center text-sm text-slate-400">
            Complete a migration and capture a baseline to start monitoring.
            Drift checks will automatically detect environment changes.
          </p>
        </motion.div>
      )}

      {/* Migration Cards */}
      {!loading && migrations.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {migrations.map((migration, i) => (
            <MigrationCard
              key={migration.migrationId}
              migration={migration}
              index={i}
              onCheckNow={handleCheckNow}
              checking={checkingId === migration.migrationId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
