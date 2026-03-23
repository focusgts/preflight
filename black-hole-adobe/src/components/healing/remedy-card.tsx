'use client';

import { motion } from 'framer-motion';
import {
  Wrench,
  CheckCircle2,
  XCircle,
  BarChart3,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { RemedyStat } from '@/types/healing';

// ============================================================
// Types
// ============================================================

interface RemedyCardProps {
  remedy: RemedyStat;
  index?: number;
  onApply?: (remedyId: string) => void;
}

interface RemedyCardDetailProps {
  remedyName: string;
  fixDescription: string | null;
  confidence: number;
  successRate: number;
  errorPattern: string;
  onApprove?: () => void;
  onReject?: () => void;
  showActions?: boolean;
}

// ============================================================
// Stat Remedy Card (for top remedies list)
// ============================================================

export function RemedyCard({ remedy, index = 0 }: RemedyCardProps) {
  const successPct = Math.round(remedy.successRate * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 transition-all duration-200 hover:border-slate-700"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10">
            <Wrench className="h-4 w-4 text-violet-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {remedy.name}
            </p>
            <p className="text-xs text-slate-500 capitalize">
              {remedy.category.replace(/_/g, ' ')}
            </p>
          </div>
        </div>
        <div className="text-right shrink-0 ml-3">
          <p className="text-sm font-mono font-medium text-slate-300">
            {remedy.usageCount}
          </p>
          <p className="text-xs text-slate-500">uses</p>
        </div>
      </div>

      {/* Success rate bar */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">Success rate</span>
          <span
            className={cn(
              'font-mono font-medium',
              successPct >= 80 && 'text-emerald-400',
              successPct >= 50 && successPct < 80 && 'text-amber-400',
              successPct < 50 && 'text-rose-400',
            )}
          >
            {successPct}%
          </span>
        </div>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${successPct}%` }}
            transition={{ duration: 0.8, delay: index * 0.05 }}
            className={cn(
              'h-full rounded-full',
              successPct >= 80 && 'bg-emerald-500',
              successPct >= 50 && successPct < 80 && 'bg-amber-500',
              successPct < 50 && 'bg-rose-500',
            )}
          />
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================
// Detail Remedy Card (for action details with approve/reject)
// ============================================================

export function RemedyCardDetail({
  remedyName,
  fixDescription,
  confidence,
  successRate,
  errorPattern,
  onApprove,
  onReject,
  showActions = false,
}: RemedyCardDetailProps) {
  const confPct = Math.round(confidence * 100);
  const successPct = Math.round(successRate * 100);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10">
          <Zap className="h-5 w-5 text-violet-400" />
        </div>
        <div>
          <p className="text-sm font-medium text-white">{remedyName}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-mono font-medium',
                confPct >= 90 && 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
                confPct >= 60 && confPct < 90 && 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
                confPct < 60 && 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
              )}
            >
              {confPct}% confidence
            </span>
          </div>
        </div>
      </div>

      {/* Error pattern */}
      <div>
        <p className="text-xs font-medium text-slate-400 mb-1">Error Pattern</p>
        <code className="block rounded-lg bg-slate-800/80 px-3 py-2 text-xs text-rose-300 font-mono">
          {errorPattern}
        </code>
      </div>

      {/* Fix description */}
      {fixDescription && (
        <div>
          <p className="text-xs font-medium text-slate-400 mb-1">Fix</p>
          <p className="text-sm text-slate-300">{fixDescription}</p>
        </div>
      )}

      {/* Success rate */}
      <div>
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-slate-400 flex items-center gap-1">
            <BarChart3 className="h-3 w-3" />
            Historical success rate
          </span>
          <span className="font-mono text-slate-300">{successPct}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              successPct >= 80 && 'bg-emerald-500',
              successPct >= 50 && successPct < 80 && 'bg-amber-500',
              successPct < 50 && 'bg-rose-500',
            )}
            style={{ width: `${successPct}%` }}
          />
        </div>
      </div>

      {/* Action buttons */}
      {showActions && (
        <div className="flex gap-2 pt-1">
          {onApprove && (
            <button
              onClick={onApprove}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
            >
              <CheckCircle2 className="h-4 w-4" />
              Apply Fix
            </button>
          )}
          {onReject && (
            <button
              onClick={onReject}
              className="flex items-center gap-1.5 rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-600 transition-colors"
            >
              <XCircle className="h-4 w-4" />
              Reject
            </button>
          )}
        </div>
      )}
    </div>
  );
}
