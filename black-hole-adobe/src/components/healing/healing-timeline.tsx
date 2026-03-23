'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  ChevronDown,
  ChevronRight,
  Wrench,
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { HealingAction, HealingActionType } from '@/types/healing';

// ============================================================
// Types
// ============================================================

interface HealingTimelineProps {
  actions: HealingAction[];
  onApprove?: (actionId: string) => void;
  onReject?: (actionId: string) => void;
}

type FilterStatus = 'all' | 'auto_applied' | 'suggested' | 'escalated';

// ============================================================
// Helpers
// ============================================================

const statusConfig: Record<
  HealingActionType,
  { icon: React.ElementType; color: string; label: string; bgColor: string }
> = {
  auto_applied: {
    icon: CheckCircle2,
    color: 'text-emerald-400',
    label: 'Auto-healed',
    bgColor: 'bg-emerald-500/10 border-emerald-500/20',
  },
  suggested: {
    icon: AlertTriangle,
    color: 'text-amber-400',
    label: 'Awaiting approval',
    bgColor: 'bg-amber-500/10 border-amber-500/20',
  },
  escalated: {
    icon: XCircle,
    color: 'text-rose-400',
    label: 'Needs attention',
    bgColor: 'bg-rose-500/10 border-rose-500/20',
  },
};

function ConfidenceBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-mono font-medium',
        pct >= 90 && 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
        pct >= 60 && pct < 90 && 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
        pct < 60 && 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
      )}
    >
      {pct}%
    </span>
  );
}

// ============================================================
// Component
// ============================================================

export function HealingTimeline({ actions, onApprove, onReject }: HealingTimelineProps) {
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const filtered = filter === 'all'
    ? actions
    : actions.filter((a) => a.action === filter);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const filters: { key: FilterStatus; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'auto_applied', label: 'Auto-healed' },
    { key: 'suggested', label: 'Suggested' },
    { key: 'escalated', label: 'Escalated' },
  ];

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="flex gap-2">
        {filters.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              filter === key
                ? 'bg-violet-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Timeline */}
      <div className="relative space-y-0">
        {/* Vertical line */}
        {filtered.length > 1 && (
          <div className="absolute left-5 top-6 bottom-6 w-px bg-slate-700" />
        )}

        <AnimatePresence initial={false}>
          {filtered.map((action, idx) => {
            const config = statusConfig[action.action];
            const Icon = config.icon;
            const isExpanded = expandedIds.has(action.id);

            return (
              <motion.div
                key={action.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ delay: idx * 0.05, duration: 0.3 }}
                className="relative pl-12"
              >
                {/* Timeline dot */}
                <div
                  className={cn(
                    'absolute left-3 top-4 flex h-5 w-5 items-center justify-center rounded-full border',
                    config.bgColor,
                  )}
                >
                  <Icon className={cn('h-3 w-3', config.color)} />
                </div>

                {/* Card */}
                <div
                  className={cn(
                    'mb-3 rounded-xl border border-slate-800 bg-slate-900/80 p-4',
                    'transition-all duration-200 hover:border-slate-700',
                  )}
                >
                  {/* Header */}
                  <button
                    onClick={() => toggleExpand(action.id)}
                    className="flex w-full items-start justify-between text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn('text-sm font-medium', config.color)}>
                          {config.label}
                        </span>
                        {action.confidence > 0 && (
                          <ConfidenceBadge value={action.confidence} />
                        )}
                      </div>
                      <p className="mt-1 text-sm text-white truncate">
                        {action.itemName}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500 truncate">
                        {action.errorMessage}
                      </p>
                    </div>
                    <div className="ml-3 flex items-center gap-2">
                      <span className="text-xs text-slate-500">
                        {new Date(action.timestamp).toLocaleTimeString()}
                      </span>
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-slate-500" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-slate-500" />
                      )}
                    </div>
                  </button>

                  {/* Expanded details */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-3 space-y-3 border-t border-slate-800 pt-3">
                          {/* Root cause */}
                          {action.rootCause && (
                            <div>
                              <p className="text-xs font-medium text-slate-400">Root Cause</p>
                              <p className="mt-0.5 text-sm text-slate-300">
                                {action.rootCause}
                              </p>
                            </div>
                          )}

                          {/* Fix description */}
                          {action.fixDescription && (
                            <div>
                              <p className="text-xs font-medium text-slate-400">
                                {action.action === 'auto_applied' ? 'Fix Applied' : 'Suggested Fix'}
                              </p>
                              <p className="mt-0.5 text-sm text-slate-300">
                                {action.fixDescription}
                              </p>
                            </div>
                          )}

                          {/* Remedy name */}
                          {action.remedyName && (
                            <div className="flex items-center gap-2">
                              <Wrench className="h-3.5 w-3.5 text-slate-500" />
                              <span className="text-xs text-slate-400">
                                {action.remedyName}
                              </span>
                            </div>
                          )}

                          {/* Action buttons for suggested remedies */}
                          {action.action === 'suggested' && action.result === 'pending' && (
                            <div className="flex gap-2 pt-1">
                              {onApprove && (
                                <button
                                  onClick={() => onApprove(action.id)}
                                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 transition-colors"
                                >
                                  Approve Fix
                                </button>
                              )}
                              {onReject && (
                                <button
                                  onClick={() => onReject(action.id)}
                                  className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-600 transition-colors"
                                >
                                  Reject
                                </button>
                              )}
                            </div>
                          )}

                          {/* Resolved info */}
                          {action.resolvedAt && (
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              <Shield className="h-3 w-3" />
                              <span>
                                Resolved by {action.resolvedBy} at{' '}
                                {new Date(action.resolvedAt).toLocaleString()}
                              </span>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {filtered.length === 0 && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-8 text-center">
            <Clock className="mx-auto h-8 w-8 text-slate-600" />
            <p className="mt-2 text-sm text-slate-400">
              No healing actions to display
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
