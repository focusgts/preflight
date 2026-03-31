'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Clock,
  DollarSign,
  Users,
  TrendingDown,
  BarChart3,
  Shield,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Card } from '@/components/ui/card';
import type {
  EffortEstimate as EffortEstimateType,
  EffortDriver,
  EffortRange,
  CostRange,
} from '@/lib/engine/effort-estimator';

// ============================================================
// Props
// ============================================================

interface EffortEstimateProps {
  migrationId: string;
  className?: string;
}

// ============================================================
// Helpers
// ============================================================

function formatRange(range: EffortRange, suffix = ''): string {
  if (range.min === range.max) return `${range.min}${suffix}`;
  return `${range.min}-${range.max}${suffix}`;
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`;
  }
  return `$${value.toLocaleString()}`;
}

function formatCostRange(range: CostRange): string {
  return `${formatCurrency(range.min)} - ${formatCurrency(range.max)}`;
}

function confidenceColor(confidence: number): string {
  if (confidence >= 85) return 'text-emerald-400';
  if (confidence >= 70) return 'text-amber-400';
  return 'text-orange-400';
}

function confidenceBgColor(confidence: number): string {
  if (confidence >= 85) return 'bg-emerald-500/20 border-emerald-500/30';
  if (confidence >= 70) return 'bg-amber-500/20 border-amber-500/30';
  return 'bg-orange-500/20 border-orange-500/30';
}

function confidenceLabel(level: string): string {
  switch (level) {
    case 'high-confidence': return 'High Confidence';
    case 'detailed': return 'Detailed Estimate';
    case 'preliminary': return 'Preliminary Estimate';
    default: return level;
  }
}

// ============================================================
// Sub-components
// ============================================================

function StatCard({
  icon: Icon,
  label,
  value,
  subtext,
  index,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  subtext?: string;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + index * 0.06 }}
      className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="rounded-lg bg-slate-800 p-1.5">
          <Icon className="h-4 w-4 text-violet-400" />
        </div>
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-xl font-semibold text-white font-mono">{value}</div>
      {subtext && (
        <div className="mt-1 text-xs text-slate-500">{subtext}</div>
      )}
    </motion.div>
  );
}

function EffortDriverBar({
  driver,
  index,
  maxPercent,
}: {
  driver: EffortDriver;
  index: number;
  maxPercent: number;
}) {
  const barWidth = maxPercent > 0 ? (driver.percentOfTotal / maxPercent) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.3 + index * 0.06 }}
      className="space-y-1"
    >
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-300 truncate max-w-[60%]">{driver.label}</span>
        <div className="flex items-center gap-3 text-slate-400">
          <span className="text-xs">{driver.instanceCount} items</span>
          <span className="font-mono text-white">{driver.percentOfTotal}%</span>
        </div>
      </div>
      <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${barWidth}%` }}
          transition={{ delay: 0.5 + index * 0.06, duration: 0.4 }}
          className="h-full rounded-full bg-gradient-to-r from-violet-600 to-violet-400"
        />
      </div>
    </motion.div>
  );
}

function TimelineRow({
  label,
  weeks,
  index,
}: {
  label: string;
  weeks: number;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.2 + index * 0.06 }}
      className="flex items-center justify-between py-2 border-b border-slate-800/50 last:border-0"
    >
      <div className="flex items-center gap-2">
        <Users className="h-3.5 w-3.5 text-slate-500" />
        <span className="text-sm text-slate-300">{label}</span>
      </div>
      <span className="font-mono text-sm text-white">{weeks} weeks</span>
    </motion.div>
  );
}

// ============================================================
// Main Component
// ============================================================

export function EffortEstimate({ migrationId, className }: EffortEstimateProps) {
  const [estimate, setEstimate] = useState<EffortEstimateType | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchEstimate() {
      try {
        setLoading(true);
        setFetchError(null);

        const res = await fetch(`/api/migrations/${migrationId}/estimate`);
        const json = await res.json();

        if (!cancelled) {
          if (json.success && json.data) {
            setEstimate(json.data);
          } else {
            setFetchError(json.error?.message ?? 'Failed to load estimate');
          }
        }
      } catch {
        if (!cancelled) {
          setFetchError('Failed to fetch effort estimate');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchEstimate();

    return () => {
      cancelled = true;
    };
  }, [migrationId]);

  // ── Loading state ──
  if (loading) {
    return (
      <Card className={className}>
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
            <span className="text-sm text-slate-400">Calculating effort estimate...</span>
          </div>
        </div>
      </Card>
    );
  }

  // ── Error state ──
  if (fetchError || !estimate) {
    return (
      <Card className={className}>
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3 text-center">
            <AlertCircle className="h-8 w-8 text-slate-500" />
            <span className="text-sm text-slate-400">{fetchError ?? 'No estimate available'}</span>
          </div>
        </div>
      </Card>
    );
  }

  const maxDriverPercent = estimate.topEffortDrivers.length > 0
    ? Math.max(...estimate.topEffortDrivers.map(d => d.percentOfTotal))
    : 1;

  const comparison = estimate.industryComparison;

  return (
    <div className={cn('space-y-6', className)}>
      {/* Confidence Banner */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          'flex items-center justify-between rounded-xl border px-4 py-3',
          confidenceBgColor(estimate.confidence),
        )}
      >
        <div className="flex items-center gap-2">
          <Shield className={cn('h-4 w-4', confidenceColor(estimate.confidence))} />
          <span className="text-sm font-medium text-slate-200">
            {confidenceLabel(estimate.confidenceLevel)}
          </span>
          <span className={cn('text-sm font-mono font-semibold', confidenceColor(estimate.confidence))}>
            {estimate.confidence}% confidence
          </span>
        </div>
        {estimate.confidenceLevel === 'preliminary' && (
          <button className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 transition-colors">
            Get detailed estimate
            <ChevronRight className="h-3 w-3" />
          </button>
        )}
      </motion.div>

      {/* Top Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Clock}
          label="Total Dev-Weeks"
          value={formatRange(estimate.totalDevWeeks, ' wks')}
          subtext={`${formatRange(estimate.totalDevDays)} developer-days`}
          index={0}
        />
        <StatCard
          icon={DollarSign}
          label="Cost Range"
          value={formatCostRange(estimate.costRange)}
          subtext={`$${estimate.costRange.blendedRate}/hr blended - $${estimate.costRange.premiumRate}/hr premium`}
          index={1}
        />
        <StatCard
          icon={Users}
          label="4-Person Team"
          value={`${estimate.timeline.fourPersonTeam} weeks`}
          subtext={`2-person: ${estimate.timeline.twoPersonTeam}wk | 6-person: ${estimate.timeline.sixPersonTeam}wk`}
          index={2}
        />
        <StatCard
          icon={TrendingDown}
          label="vs. Industry Avg"
          value={`${comparison.savingsPercent}% less`}
          subtext={comparison.savingsPercent > 0
            ? `Save ${formatCurrency(comparison.costSaved.min)}-${formatCurrency(comparison.costSaved.max)}`
            : 'Competitive with industry average'
          }
          index={3}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top Effort Drivers */}
        <Card
          header={
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-violet-400" />
              <h3 className="text-sm font-semibold text-white">Top Effort Drivers</h3>
            </div>
          }
        >
          <div className="space-y-3">
            {estimate.topEffortDrivers.map((driver, i) => (
              <EffortDriverBar
                key={driver.category}
                driver={driver}
                index={i}
                maxPercent={maxDriverPercent}
              />
            ))}
            {estimate.topEffortDrivers.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-4">
                No effort drivers identified yet
              </p>
            )}
          </div>
        </Card>

        {/* Timeline by Team Size */}
        <Card
          header={
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-violet-400" />
              <h3 className="text-sm font-semibold text-white">Timeline by Team Size</h3>
            </div>
          }
        >
          <div>
            <TimelineRow label="2-person team" weeks={estimate.timeline.twoPersonTeam} index={0} />
            <TimelineRow label="4-person team" weeks={estimate.timeline.fourPersonTeam} index={1} />
            <TimelineRow label="6-person team" weeks={estimate.timeline.sixPersonTeam} index={2} />
          </div>

          <div className="mt-4 pt-4 border-t border-slate-800">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Testing overhead included</span>
              <span className="font-mono">
                {formatRange(estimate.testingOverhead)} days ({Math.round(estimate.testingOverhead.min / estimate.totalDevDays.min * 100)}-{Math.round(estimate.testingOverhead.max / estimate.totalDevDays.max * 100)}%)
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500 mt-1">
              <span>Complexity multiplier</span>
              <span className="font-mono">{estimate.complexityMultiplier}x</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Industry Comparison */}
      <Card
        header={
          <div className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-white">Industry Comparison</h3>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Traditional SI */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-lg border border-slate-800 bg-slate-800/40 p-4"
          >
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
              Traditional SI
            </div>
            <div className="text-lg font-semibold text-slate-300 font-mono">
              {formatRange(comparison.industryAvgWeeks)} wks
            </div>
            <div className="text-sm text-slate-500 mt-1">
              {formatCurrency(comparison.industryAvgCost.min)} - {formatCurrency(comparison.industryAvgCost.max)}
            </div>
          </motion.div>

          {/* Black Hole */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="rounded-lg border border-violet-500/30 bg-violet-500/10 p-4"
          >
            <div className="text-xs font-medium text-violet-400 uppercase tracking-wider mb-2">
              Black Hole Estimate
            </div>
            <div className="text-lg font-semibold text-white font-mono">
              {formatRange(estimate.totalDevWeeks)} wks
            </div>
            <div className="text-sm text-slate-400 mt-1">
              {formatCostRange(estimate.costRange)}
            </div>
          </motion.div>

          {/* Savings */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4"
          >
            <div className="text-xs font-medium text-emerald-400 uppercase tracking-wider mb-2">
              You Save
            </div>
            <div className="text-lg font-semibold text-emerald-400 font-mono">
              {comparison.savingsPercent}% less
            </div>
            <div className="text-sm text-slate-400 mt-1">
              {formatRange(comparison.weeksSaved)} weeks faster
            </div>
          </motion.div>
        </div>
      </Card>
    </div>
  );
}
