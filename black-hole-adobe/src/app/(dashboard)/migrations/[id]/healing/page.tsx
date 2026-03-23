'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Heart,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Activity,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { HealingTimeline } from '@/components/healing/healing-timeline';
import { RemedyCard } from '@/components/healing/remedy-card';
import type { HealingReport, HealingAction, RemedyStat } from '@/types/healing';

// ============================================================
// Animated Counter Hook
// ============================================================

function useAnimatedCounter(target: number, duration = 1000): number {
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
// Healing Rate Gauge
// ============================================================

function HealingGauge({ rate }: { rate: number }) {
  const pct = Math.round(rate * 100);
  const circumference = 2 * Math.PI * 54;
  const strokeDashoffset = circumference * (1 - rate);

  const color =
    pct >= 80 ? 'text-emerald-400' :
    pct >= 50 ? 'text-amber-400' :
    'text-rose-400';

  const strokeColor =
    pct >= 80 ? '#34d399' :
    pct >= 50 ? '#fbbf24' :
    '#f87171';

  return (
    <div className="relative flex items-center justify-center">
      <svg width="128" height="128" viewBox="0 0 128 128">
        {/* Background ring */}
        <circle
          cx="64"
          cy="64"
          r="54"
          fill="none"
          stroke="#1e293b"
          strokeWidth="8"
        />
        {/* Progress ring */}
        <motion.circle
          cx="64"
          cy="64"
          r="54"
          fill="none"
          stroke={strokeColor}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
          transform="rotate(-90 64 64)"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn('text-2xl font-bold', color)}>{pct}%</span>
        <span className="text-xs text-slate-500">healing rate</span>
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
  index,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  index: number;
}) {
  const animatedValue = useAnimatedCounter(value);

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
          <p className="text-2xl font-bold text-white">{animatedValue}</p>
          <p className="text-sm text-slate-400">{label}</p>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================
// Page
// ============================================================

export default function HealingPage() {
  const params = useParams();
  const migrationId = params.id as string;

  const [report, setReport] = useState<HealingReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/healing/${migrationId}`);
      const json = await res.json();
      if (json.success) {
        setReport(json.data);
      } else {
        setError(json.error?.message ?? 'Failed to load healing report');
      }
    } catch {
      setError('Failed to load healing report');
    } finally {
      setLoading(false);
    }
  }, [migrationId]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleApprove = async (actionId: string) => {
    try {
      const res = await fetch(`/api/healing/${migrationId}/actions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionId, decision: 'approve' }),
      });
      const json = await res.json();
      if (json.success) {
        fetchReport();
      }
    } catch {
      // Silent fail — user will see stale state
    }
  };

  const handleReject = async (actionId: string) => {
    try {
      const res = await fetch(`/api/healing/${migrationId}/actions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionId, decision: 'reject' }),
      });
      const json = await res.json();
      if (json.success) {
        fetchReport();
      }
    } catch {
      // Silent fail
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <RefreshCw className="h-6 w-6 animate-spin text-violet-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-rose-800/50 bg-rose-900/20 p-8 text-center">
        <XCircle className="mx-auto h-8 w-8 text-rose-400" />
        <p className="mt-2 text-sm text-rose-300">{error}</p>
      </div>
    );
  }

  const data = report ?? {
    migrationId,
    totalFailures: 0,
    autoHealed: 0,
    suggested: 0,
    escalated: 0,
    healingRate: 0,
    actions: [],
    topRemedies: [],
    generatedAt: new Date().toISOString(),
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
            <Heart className="h-5 w-5 text-violet-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Self-Healing</h1>
            <p className="text-sm text-slate-400">
              Automatic failure detection and recovery
            </p>
          </div>
        </div>
        <button
          onClick={fetchReport}
          className="flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </motion.div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="sm:col-span-2 lg:col-span-1 flex justify-center">
          <HealingGauge rate={data.healingRate} />
        </div>
        <StatCard
          label="Total Failures"
          value={data.totalFailures}
          icon={Activity}
          color="bg-slate-500/10 text-slate-400"
          index={0}
        />
        <StatCard
          label="Auto-Healed"
          value={data.autoHealed}
          icon={CheckCircle2}
          color="bg-emerald-500/10 text-emerald-400"
          index={1}
        />
        <StatCard
          label="Suggested"
          value={data.suggested}
          icon={AlertTriangle}
          color="bg-amber-500/10 text-amber-400"
          index={2}
        />
        <StatCard
          label="Escalated"
          value={data.escalated}
          icon={XCircle}
          color="bg-rose-500/10 text-rose-400"
          index={3}
        />
      </div>

      {/* Main Content: Timeline + Remedies */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Timeline */}
        <div className="lg:col-span-2">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <h2 className="mb-4 text-lg font-semibold text-white">
              Action Timeline
            </h2>
            <HealingTimeline
              actions={data.actions}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          </motion.div>
        </div>

        {/* Top Remedies */}
        <div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <h2 className="mb-4 text-lg font-semibold text-white">
              Top Remedies
            </h2>
            <div className="space-y-3">
              {data.topRemedies.length > 0 ? (
                data.topRemedies.slice(0, 10).map((remedy, idx) => (
                  <RemedyCard key={remedy.remedyId} remedy={remedy} index={idx} />
                ))
              ) : (
                <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-6 text-center">
                  <p className="text-sm text-slate-400">No remedy data yet</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
