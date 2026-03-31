'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  RefreshCw,
  XCircle,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Trash2,
  Camera,
  Play,
  Shield,
  Gauge,
  Clock,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type {
  AlertLevel,
  DriftCheck,
  DriftChange,
  DriftCategory,
} from '@/lib/monitoring/drift-monitor';

// ============================================================
// Types for API response
// ============================================================

interface MonitoringDetail {
  migrationId: string;
  siteUrl: string;
  baselineCapturedAt: string;
  baselineHealthScore: number;
  latestCheck: DriftCheck | null;
  alertLevel: AlertLevel;
  driftScore: number;
  totalChecks: number;
  history: DriftCheck[];
}

// ============================================================
// Animated Counter
// ============================================================

function useAnimatedCounter(target: number, duration = 800): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const startTime = performance.now();
    function step(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(target * eased));
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }, [target, duration]);
  return count;
}

// ============================================================
// Alert Level Gauge
// ============================================================

const alertMeta: Record<AlertLevel, { color: string; stroke: string; label: string }> = {
  green: { color: 'text-emerald-400', stroke: '#34d399', label: 'Healthy' },
  yellow: { color: 'text-amber-400', stroke: '#fbbf24', label: 'Warning' },
  red: { color: 'text-red-400', stroke: '#f87171', label: 'Critical' },
};

function AlertGauge({ level, score }: { level: AlertLevel; score: number }) {
  const meta = alertMeta[level];
  const circumference = 2 * Math.PI * 54;
  const fraction = Math.min(score / 100, 1);
  const strokeDashoffset = circumference * (1 - fraction);

  return (
    <div className="relative flex items-center justify-center">
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle
          cx="70"
          cy="70"
          r="54"
          fill="none"
          stroke="#1e293b"
          strokeWidth="10"
        />
        <motion.circle
          cx="70"
          cy="70"
          r="54"
          fill="none"
          stroke={meta.stroke}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
          transform="rotate(-90 70 70)"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn('text-3xl font-bold', meta.color)}>{score}</span>
        <span className="text-xs text-slate-500">{meta.label}</span>
      </div>
    </div>
  );
}

// ============================================================
// Stat Card
// ============================================================

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  suffix,
  index,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  suffix?: string;
  index: number;
}) {
  const animated = useAnimatedCounter(value);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
      className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 backdrop-blur-sm"
    >
      <div className="flex items-center gap-3">
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', color)}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-white">
            {animated}
            {suffix && <span className="text-sm font-normal text-slate-400">{suffix}</span>}
          </p>
          <p className="text-sm text-slate-400">{label}</p>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================
// Severity Badge
// ============================================================

function SeverityBadge({ severity }: { severity: DriftChange['severity'] }) {
  const styles = {
    low: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    high: 'bg-red-500/10 text-red-400 border-red-500/20',
  };

  return (
    <span
      className={cn(
        'inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase',
        styles[severity],
      )}
    >
      {severity}
    </span>
  );
}

// ============================================================
// Category Icon & Label
// ============================================================

const categoryMeta: Record<DriftCategory, { label: string; color: string }> = {
  performance: { label: 'Performance', color: 'text-blue-400' },
  security: { label: 'Security', color: 'text-red-400' },
  content: { label: 'Content', color: 'text-emerald-400' },
  configuration: { label: 'Configuration', color: 'text-violet-400' },
  seo: { label: 'SEO', color: 'text-amber-400' },
};

// ============================================================
// History Timeline Item
// ============================================================

function HistoryItem({ check, index }: { check: DriftCheck; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const meta = alertMeta[check.alertLevel];

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-slate-800/50"
      >
        {/* Timeline dot */}
        <div className="flex flex-col items-center">
          <div
            className={cn('h-2.5 w-2.5 rounded-full', {
              'bg-emerald-500': check.alertLevel === 'green',
              'bg-amber-500': check.alertLevel === 'yellow',
              'bg-red-500': check.alertLevel === 'red',
            })}
          />
        </div>

        {/* Details */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={cn('text-sm font-medium', meta.color)}>
              Score: {check.driftScore}
            </span>
            <span className="text-xs text-slate-600">|</span>
            <span className="text-xs text-slate-500">
              {check.changes.length} change{check.changes.length !== 1 ? 's' : ''}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            {new Date(check.checkedAt).toLocaleString()}
          </p>
        </div>

        {/* Expand icon */}
        {check.changes.length > 0 && (
          expanded ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
          )
        )}
      </button>

      <AnimatePresence>
        {expanded && check.changes.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="ml-8 space-y-2 pb-2">
              {check.changes.map((change, ci) => (
                <div
                  key={`${change.category}-${change.field}-${ci}`}
                  className="rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <SeverityBadge severity={change.severity} />
                    <span className={cn('text-xs font-medium', categoryMeta[change.category].color)}>
                      {categoryMeta[change.category].label}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-300">{change.description}</p>
                  <div className="mt-1 flex gap-4 text-[10px] text-slate-600">
                    <span>Baseline: {change.baselineValue}</span>
                    <span>Current: {change.currentValue}</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ============================================================
// Changes Breakdown by Category
// ============================================================

function ChangesBreakdown({ changes }: { changes: DriftChange[] }) {
  if (changes.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-center">
        <Shield className="mx-auto h-8 w-8 text-emerald-500/40" />
        <p className="mt-2 text-sm text-slate-400">No drift detected</p>
      </div>
    );
  }

  const grouped = changes.reduce<Record<DriftCategory, DriftChange[]>>(
    (acc, change) => {
      if (!acc[change.category]) acc[change.category] = [];
      acc[change.category].push(change);
      return acc;
    },
    {} as Record<DriftCategory, DriftChange[]>,
  );

  return (
    <div className="space-y-4">
      {(Object.entries(grouped) as [DriftCategory, DriftChange[]][]).map(
        ([category, items]) => (
          <div key={category}>
            <h4 className={cn('mb-2 text-sm font-semibold', categoryMeta[category].color)}>
              {categoryMeta[category].label}
              <span className="ml-2 text-xs font-normal text-slate-600">
                ({items.length})
              </span>
            </h4>
            <div className="space-y-2">
              {items.map((change, i) => (
                <div
                  key={`${change.field}-${i}`}
                  className="rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-3"
                >
                  <div className="flex items-center gap-2">
                    <SeverityBadge severity={change.severity} />
                    <span className="text-xs text-slate-400">{change.field}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-300">{change.description}</p>
                  <div className="mt-1.5 flex gap-6 text-xs text-slate-600">
                    <span>
                      Baseline: <span className="text-slate-400">{change.baselineValue}</span>
                    </span>
                    <span>
                      Current: <span className="text-slate-400">{change.currentValue}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ),
      )}
    </div>
  );
}

// ============================================================
// Page
// ============================================================

export default function MonitoringDetailPage() {
  const params = useParams();
  const router = useRouter();
  const migrationId = params.migrationId as string;

  const [data, setData] = useState<MonitoringDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [recapturing, setRecapturing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/monitoring/${migrationId}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        setError(json.error?.message ?? 'Failed to load monitoring data');
      }
    } catch {
      setError('Failed to load monitoring data');
    } finally {
      setLoading(false);
    }
  }, [migrationId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRunCheck = async () => {
    try {
      setChecking(true);
      const res = await fetch(`/api/monitoring/${migrationId}`, {
        method: 'POST',
      });
      const json = await res.json();
      if (json.success) {
        await fetchData();
      }
    } catch {
      // Silent
    } finally {
      setChecking(false);
    }
  };

  const handleRecaptureBaseline = async () => {
    if (!data) return;
    try {
      setRecapturing(true);
      const res = await fetch(`/api/monitoring/${migrationId}/baseline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteUrl: data.siteUrl }),
      });
      const json = await res.json();
      if (json.success) {
        await fetchData();
      }
    } catch {
      // Silent
    } finally {
      setRecapturing(false);
    }
  };

  const handleStopMonitoring = async () => {
    try {
      setDeleting(true);
      const res = await fetch(`/api/monitoring/${migrationId}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.success) {
        router.push('/monitoring');
      }
    } catch {
      // Silent
    } finally {
      setDeleting(false);
    }
  };

  // Loading
  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <RefreshCw className="h-6 w-6 animate-spin text-violet-400" />
      </div>
    );
  }

  // Error
  if (error || !data) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => router.push('/monitoring')}
          className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Monitoring
        </button>
        <div className="rounded-xl border border-rose-800/50 bg-rose-900/20 p-8 text-center">
          <XCircle className="mx-auto h-8 w-8 text-rose-400" />
          <p className="mt-2 text-sm text-rose-300">{error ?? 'Not found'}</p>
          <button
            onClick={fetchData}
            className="mt-3 text-xs font-medium text-rose-400 hover:text-rose-300"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const latestChanges = data.latestCheck?.changes ?? [];
  const healthDelta = data.baselineHealthScore - (data.latestCheck?.currentHealthScore ?? data.baselineHealthScore);

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div>
        <button
          onClick={() => router.push('/monitoring')}
          className="mb-3 flex items-center gap-1.5 text-sm text-slate-400 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Monitoring
        </button>
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
              <h1 className="text-xl font-bold text-white">{migrationId}</h1>
              <p className="text-sm text-slate-400">{data.siteUrl}</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Gauge + Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="flex items-center justify-center sm:col-span-2 lg:col-span-1">
          <AlertGauge level={data.alertLevel} score={data.driftScore} />
        </div>
        <StatCard
          label="Baseline Health"
          value={data.baselineHealthScore}
          icon={Shield}
          color="bg-emerald-500/10 text-emerald-400"
          index={0}
        />
        <StatCard
          label="Current Health"
          value={data.latestCheck?.currentHealthScore ?? data.baselineHealthScore}
          icon={Gauge}
          color="bg-blue-500/10 text-blue-400"
          index={1}
        />
        <StatCard
          label="Health Delta"
          value={Math.abs(healthDelta)}
          icon={healthDelta > 0 ? TrendingDown : TrendingUp}
          color={healthDelta > 0 ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}
          suffix={healthDelta > 0 ? ' pts' : ' pts'}
          index={2}
        />
        <StatCard
          label="Total Checks"
          value={data.totalChecks}
          icon={Clock}
          color="bg-slate-500/10 text-slate-400"
          index={3}
        />
      </div>

      {/* Baseline Info */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5"
      >
        <h2 className="mb-3 text-sm font-semibold text-white">Baseline</h2>
        <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs text-slate-500">Site URL</p>
            <p className="text-slate-300">{data.siteUrl}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Captured</p>
            <p className="text-slate-300">
              {new Date(data.baselineCapturedAt).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Baseline Health Score</p>
            <p className="text-slate-300">{data.baselineHealthScore}</p>
          </div>
        </div>
      </motion.div>

      {/* Main: History + Changes */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* History Timeline */}
        <div className="lg:col-span-1">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <h2 className="mb-3 text-lg font-semibold text-white">
              Check History
            </h2>
            {data.history.length > 0 ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
                <div className="max-h-[480px] space-y-1 overflow-y-auto">
                  {data.history.map((check, i) => (
                    <HistoryItem key={check.id} check={check} index={i} />
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-center">
                <Clock className="mx-auto h-8 w-8 text-slate-700" />
                <p className="mt-2 text-sm text-slate-400">
                  No checks yet. Run a check to start tracking drift.
                </p>
              </div>
            )}
          </motion.div>
        </div>

        {/* Changes Breakdown */}
        <div className="lg:col-span-2">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
          >
            <h2 className="mb-3 text-lg font-semibold text-white">
              Latest Changes
              {latestChanges.length > 0 && (
                <span className="ml-2 text-sm font-normal text-slate-500">
                  ({latestChanges.length} detected)
                </span>
              )}
            </h2>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <ChangesBreakdown changes={latestChanges} />
            </div>
          </motion.div>
        </div>
      </div>

      {/* Actions */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="flex flex-wrap items-center gap-3"
      >
        <button
          onClick={handleRunCheck}
          disabled={checking}
          className={cn(
            'flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500',
            checking && 'cursor-not-allowed opacity-50',
          )}
        >
          {checking ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          Run Check Now
        </button>
        <button
          onClick={handleRecaptureBaseline}
          disabled={recapturing}
          className={cn(
            'flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-700',
            recapturing && 'cursor-not-allowed opacity-50',
          )}
        >
          {recapturing ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Camera className="h-4 w-4" />
          )}
          Recapture Baseline
        </button>
        <button
          onClick={handleStopMonitoring}
          disabled={deleting}
          className={cn(
            'flex items-center gap-2 rounded-lg border border-red-800/50 bg-red-900/20 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-900/40',
            deleting && 'cursor-not-allowed opacity-50',
          )}
        >
          {deleting ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
          Stop Monitoring
        </button>
      </motion.div>
    </div>
  );
}
