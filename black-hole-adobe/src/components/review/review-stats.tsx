'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils/cn';
import type { ReviewQueueStats } from '@/types/review';

interface ReviewStatsProps {
  stats: ReviewQueueStats;
  className?: string;
}

function AnimatedCounter({ value, duration = 600 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const start = display;
    const diff = value - start;
    if (diff === 0) return;

    const startTime = performance.now();

    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + diff * eased));
      if (progress < 1) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  return <span>{display}</span>;
}

interface StatCardProps {
  label: string;
  value: number;
  color: string;
  bgColor: string;
}

function StatCard({ label, value, color, bgColor }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn('rounded-lg border px-4 py-3 text-center', bgColor)}
    >
      <div className={cn('text-2xl font-bold tabular-nums', color)}>
        <AnimatedCounter value={value} />
      </div>
      <div className="text-xs text-slate-500 mt-1">{label}</div>
    </motion.div>
  );
}

export function ReviewStats({ stats, className }: ReviewStatsProps) {
  const completedCount = stats.approved + stats.rejected + stats.skipped;
  const progressPercent = stats.total > 0 ? Math.round((completedCount / stats.total) * 100) : 0;
  const estimatedMinutes = Math.max(1, Math.ceil(stats.pending * 0.5));

  return (
    <div className={cn('space-y-4', className)}>
      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        <StatCard
          label="Total Changes"
          value={stats.total}
          color="text-slate-200"
          bgColor="bg-slate-800/60 border-slate-700"
        />
        <StatCard
          label="Pending"
          value={stats.pending}
          color="text-amber-400"
          bgColor="bg-amber-500/5 border-amber-500/20"
        />
        <StatCard
          label="Approved"
          value={stats.approved}
          color="text-emerald-400"
          bgColor="bg-emerald-500/5 border-emerald-500/20"
        />
        <StatCard
          label="Rejected"
          value={stats.rejected}
          color="text-rose-400"
          bgColor="bg-rose-500/5 border-rose-500/20"
        />
        <StatCard
          label="Skipped"
          value={stats.skipped}
          color="text-slate-400"
          bgColor="bg-slate-800/40 border-slate-700"
        />
      </div>

      {/* Progress Bar */}
      <div className="rounded-lg border border-slate-700 bg-slate-800/40 px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-slate-300">
            Review Progress: <span className="font-semibold text-white">{progressPercent}%</span>
          </span>
          {stats.pending > 0 && (
            <span className="text-xs text-slate-500">
              Est. {estimatedMinutes} min remaining
            </span>
          )}
        </div>
        <div className="h-2 rounded-full bg-slate-900 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
        <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
          <span>
            High confidence: <span className="text-emerald-400">{stats.highConfidence}</span>
          </span>
          <span>
            Needs review: <span className="text-amber-400">{stats.needsReview}</span>
          </span>
          <span>
            Manual required: <span className="text-rose-400">{stats.manualRequired}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
