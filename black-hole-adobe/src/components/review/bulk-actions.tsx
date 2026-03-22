'use client';

import { useState } from 'react';
import { CheckCheck, X, SkipForward, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/button';
import type { CodeChangeType, ReviewStatus } from '@/types/review';

interface BulkActionsProps {
  highConfidenceCount: number;
  pendingCount: number;
  selectedCount: number;
  onApproveHighConfidence: (threshold: number) => void;
  onApproveSelected: () => void;
  onRejectSelected: () => void;
  onSkipSelected: () => void;
  onSelectAll: (checked: boolean) => void;
  allSelected: boolean;
  onFilterChange: (filters: {
    changeType: CodeChangeType | null;
    status: ReviewStatus | null;
    confidenceTier: 'high' | 'medium' | 'low' | null;
  }) => void;
  activeFilters: {
    changeType: CodeChangeType | null;
    status: ReviewStatus | null;
    confidenceTier: 'high' | 'medium' | 'low' | null;
  };
  loading?: boolean;
  className?: string;
}

const changeTypeOptions: Array<{ value: CodeChangeType; label: string }> = [
  { value: 'osgi_config', label: 'OSGi Config' },
  { value: 'deprecated_api', label: 'Deprecated API' },
  { value: 'maven_structure', label: 'Maven Structure' },
  { value: 'dispatcher', label: 'Dispatcher' },
  { value: 'workflow', label: 'Workflow' },
  { value: 'index', label: 'Index Definition' },
];

const statusOptions: Array<{ value: ReviewStatus; label: string }> = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'skipped', label: 'Skipped' },
];

const confidenceTiers: Array<{ value: 'high' | 'medium' | 'low'; label: string }> = [
  { value: 'high', label: '> 95% (High)' },
  { value: 'medium', label: '80-95% (Medium)' },
  { value: 'low', label: '< 80% (Low)' },
];

export function BulkActions({
  highConfidenceCount,
  pendingCount,
  selectedCount,
  onApproveHighConfidence,
  onApproveSelected,
  onRejectSelected,
  onSkipSelected,
  onSelectAll,
  allSelected,
  onFilterChange,
  activeFilters,
  loading = false,
  className,
}: BulkActionsProps) {
  const [threshold, setThreshold] = useState(0.95);
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div className={cn('space-y-3', className)}>
      {/* Primary Actions Bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-3">
        {/* Select All */}
        <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={(e) => onSelectAll(e.target.checked)}
            className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-violet-500 focus:ring-violet-500 focus:ring-offset-0"
          />
          Select all
        </label>

        <div className="h-5 w-px bg-slate-700" />

        {/* Approve High Confidence */}
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onApproveHighConfidence(threshold)}
          disabled={highConfidenceCount === 0 || loading}
          loading={loading}
          className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20 hover:border-emerald-500/30"
        >
          <CheckCheck className="h-3.5 w-3.5" />
          Approve All High Confidence ({highConfidenceCount})
        </Button>

        {/* Selected Actions */}
        {selectedCount > 0 && (
          <>
            <div className="h-5 w-px bg-slate-700" />
            <span className="text-xs text-slate-500">
              {selectedCount} selected:
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={onApproveSelected}
              disabled={loading}
              className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
            >
              Approve
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={onRejectSelected}
              disabled={loading}
            >
              <X className="h-3.5 w-3.5" />
              Reject
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onSkipSelected}
              disabled={loading}
            >
              <SkipForward className="h-3.5 w-3.5" />
              Skip
            </Button>
          </>
        )}

        <div className="flex-1" />

        {/* Filter Toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className={cn(showFilters && 'text-violet-400')}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters
        </Button>

        {/* Pending count */}
        <span className="text-xs text-slate-500">
          {pendingCount} pending
        </span>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="flex flex-wrap items-center gap-4 rounded-lg border border-slate-700 bg-slate-800/40 px-4 py-3">
          {/* Change Type Filter */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500">Type:</label>
            <select
              value={activeFilters.changeType ?? ''}
              onChange={(e) =>
                onFilterChange({
                  ...activeFilters,
                  changeType: (e.target.value as CodeChangeType) || null,
                })
              }
              className="h-7 rounded border border-slate-600 bg-slate-900 px-2 text-xs text-slate-300 focus:border-violet-500 focus:outline-none"
            >
              <option value="">All types</option>
              {changeTypeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500">Status:</label>
            <select
              value={activeFilters.status ?? ''}
              onChange={(e) =>
                onFilterChange({
                  ...activeFilters,
                  status: (e.target.value as ReviewStatus) || null,
                })
              }
              className="h-7 rounded border border-slate-600 bg-slate-900 px-2 text-xs text-slate-300 focus:border-violet-500 focus:outline-none"
            >
              <option value="">All statuses</option>
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Confidence Filter */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500">Confidence:</label>
            <select
              value={activeFilters.confidenceTier ?? ''}
              onChange={(e) =>
                onFilterChange({
                  ...activeFilters,
                  confidenceTier: (e.target.value as 'high' | 'medium' | 'low') || null,
                })
              }
              className="h-7 rounded border border-slate-600 bg-slate-900 px-2 text-xs text-slate-300 focus:border-violet-500 focus:outline-none"
            >
              <option value="">All levels</option>
              {confidenceTiers.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Threshold Slider */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500">Auto-approve threshold:</label>
            <input
              type="range"
              min="0.80"
              max="1.00"
              step="0.01"
              value={threshold}
              onChange={(e) => setThreshold(parseFloat(e.target.value))}
              className="w-24 accent-violet-500"
            />
            <span className="text-xs font-mono text-violet-400 w-10">
              {(threshold * 100).toFixed(0)}%
            </span>
          </div>

          {/* Clear Filters */}
          {(activeFilters.changeType || activeFilters.status || activeFilters.confidenceTier) && (
            <button
              onClick={() =>
                onFilterChange({ changeType: null, status: null, confidenceTier: null })
              }
              className="text-xs text-slate-500 hover:text-slate-300 underline"
            >
              Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
