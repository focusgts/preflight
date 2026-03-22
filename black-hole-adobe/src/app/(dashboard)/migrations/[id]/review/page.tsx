'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Check,
  X,
  SkipForward,
  ChevronDown,
  ChevronRight,
  FileCode,
  Download,
  PartyPopper,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DiffViewer } from '@/components/review/diff-viewer';
import { ReviewStats } from '@/components/review/review-stats';
import { BulkActions } from '@/components/review/bulk-actions';
import { CONFIDENCE_THRESHOLDS, getConfidenceTier } from '@/lib/review/review-engine';
import type { CodeReviewItem, ReviewQueue, ReviewQueueStats, CodeChangeType, ReviewStatus } from '@/types/review';

// ── Helpers ───────────────────────────────────────────────────────────

const changeTypeLabels: Record<CodeChangeType, string> = {
  osgi_config: 'OSGi Config',
  deprecated_api: 'Deprecated API',
  maven_structure: 'Maven',
  dispatcher: 'Dispatcher',
  workflow: 'Workflow',
  index: 'Index',
};

const changeTypeVariant: Record<CodeChangeType, 'info' | 'warning' | 'error' | 'purple' | 'success' | 'default'> = {
  osgi_config: 'info',
  deprecated_api: 'error',
  maven_structure: 'purple',
  dispatcher: 'warning',
  workflow: 'warning',
  index: 'info',
};

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const tier = getConfidenceTier(confidence);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-mono font-medium',
        tier === 'high' && 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
        tier === 'medium' && 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
        tier === 'low' && 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
      )}
    >
      {pct}%
    </span>
  );
}

function StatusIndicator({ status }: { status: ReviewStatus }) {
  if (status === 'approved')
    return <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400"><Check className="h-3 w-3" /></span>;
  if (status === 'rejected')
    return <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-500/20 text-rose-400"><X className="h-3 w-3" /></span>;
  if (status === 'skipped')
    return <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-600/30 text-slate-500"><SkipForward className="h-3 w-3" /></span>;
  return <span className="h-2 w-2 rounded-full bg-amber-400" />;
}

// ── Main Page ─────────────────────────────────────────────────────────

type Filters = {
  changeType: CodeChangeType | null;
  status: ReviewStatus | null;
  confidenceTier: 'high' | 'medium' | 'low' | null;
};

export default function ReviewPage() {
  const params = useParams();
  const router = useRouter();
  const migrationId = params.id as string;

  const [queue, setQueue] = useState<ReviewQueue | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<Filters>({ changeType: null, status: null, confidenceTier: null });
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});

  // ── Data Fetching ─────────────────────────────────────────────────

  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch(`/api/reviews/${migrationId}`);
      const json = await res.json();
      if (json.success) {
        setQueue(json.data);
      }
    } catch (err) {
      console.error('Failed to fetch review queue:', err);
    } finally {
      setLoading(false);
    }
  }, [migrationId]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  // ── Filtered Items ────────────────────────────────────────────────

  const filteredItems = useMemo(() => {
    if (!queue) return [];
    return queue.items.filter((item) => {
      if (filters.changeType && item.changeType !== filters.changeType) return false;
      if (filters.status && item.status !== filters.status) return false;
      if (filters.confidenceTier) {
        const tier = getConfidenceTier(item.confidence);
        if (tier !== filters.confidenceTier) return false;
      }
      return true;
    });
  }, [queue, filters]);

  const pendingHighConfidence = useMemo(() => {
    if (!queue) return 0;
    return queue.items.filter(
      (i) => i.status === 'pending' && i.confidence >= CONFIDENCE_THRESHOLDS.HIGH,
    ).length;
  }, [queue]);

  const pendingCount = queue?.stats.pending ?? 0;
  const allCompleted = queue !== null && queue.stats.pending === 0;

  // ── Actions ───────────────────────────────────────────────────────

  async function sendPatch(body: Record<string, unknown>) {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/reviews/${migrationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.success) {
        await fetchQueue();
      }
    } catch (err) {
      console.error('Review action failed:', err);
    } finally {
      setActionLoading(false);
    }
  }

  function handleSingleAction(itemId: string, action: 'approved' | 'rejected' | 'skipped') {
    sendPatch({
      type: 'single',
      itemId,
      action,
      notes: noteInputs[itemId] || undefined,
    });
  }

  function handleApproveHighConfidence(threshold: number) {
    sendPatch({
      type: 'bulk',
      action: 'approve_all_high_confidence',
      confidenceThreshold: threshold,
    });
    setSelectedItems(new Set());
  }

  function handleApproveSelected() {
    sendPatch({
      type: 'bulk',
      action: 'approve_selected',
      itemIds: Array.from(selectedItems),
    });
    setSelectedItems(new Set());
  }

  function handleRejectSelected() {
    sendPatch({
      type: 'bulk',
      action: 'reject_selected',
      itemIds: Array.from(selectedItems),
    });
    setSelectedItems(new Set());
  }

  function handleSkipSelected() {
    sendPatch({
      type: 'bulk',
      action: 'skip_selected',
      itemIds: Array.from(selectedItems),
    });
    setSelectedItems(new Set());
  }

  function toggleExpanded(id: string) {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelected(id: string) {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSelectAll(checked: boolean) {
    if (checked) {
      const pendingIds = filteredItems.filter((i) => i.status === 'pending').map((i) => i.id);
      setSelectedItems(new Set(pendingIds));
    } else {
      setSelectedItems(new Set());
    }
  }

  // ── Loading / Error States ────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent mx-auto" />
          <p className="text-slate-400 text-sm">Loading review queue...</p>
        </div>
      </div>
    );
  }

  if (!queue) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-slate-400">No review queue found for this migration.</p>
          <Button variant="secondary" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
            Go back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold text-white">Code Review Queue</h1>
            <p className="text-sm text-slate-400 mt-0.5">
              Migration {migrationId} &middot; {queue.items.length} changes to review
            </p>
          </div>
        </div>

        {allCompleted && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              // Export approved patches
              window.open(`/api/reviews/${migrationId}?status=approved`, '_blank');
            }}
          >
            <Download className="h-4 w-4" />
            Export Approved
          </Button>
        )}
      </div>

      {/* Stats */}
      <ReviewStats stats={queue.stats} />

      {/* All Complete Celebration */}
      <AnimatePresence>
        {allCompleted && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative overflow-hidden rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-cyan-500/10 to-violet-500/10 p-6 text-center"
          >
            {/* Confetti-like dots */}
            {Array.from({ length: 20 }).map((_, i) => (
              <motion.div
                key={i}
                className={cn(
                  'absolute h-1.5 w-1.5 rounded-full',
                  i % 4 === 0 && 'bg-emerald-400',
                  i % 4 === 1 && 'bg-cyan-400',
                  i % 4 === 2 && 'bg-violet-400',
                  i % 4 === 3 && 'bg-amber-400',
                )}
                initial={{
                  opacity: 0,
                  x: '50%',
                  y: '50%',
                }}
                animate={{
                  opacity: [0, 1, 0],
                  x: `${10 + Math.random() * 80}%`,
                  y: `${Math.random() * 100}%`,
                }}
                transition={{
                  duration: 2,
                  delay: i * 0.1,
                  repeat: Infinity,
                  repeatDelay: 3,
                }}
              />
            ))}
            <PartyPopper className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
            <h2 className="text-lg font-semibold text-white">All items reviewed!</h2>
            <p className="text-sm text-slate-400 mt-1">
              {queue.stats.approved} approved, {queue.stats.rejected} rejected, {queue.stats.skipped} skipped
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk Actions */}
      <BulkActions
        highConfidenceCount={pendingHighConfidence}
        pendingCount={pendingCount}
        selectedCount={selectedItems.size}
        onApproveHighConfidence={handleApproveHighConfidence}
        onApproveSelected={handleApproveSelected}
        onRejectSelected={handleRejectSelected}
        onSkipSelected={handleSkipSelected}
        onSelectAll={handleSelectAll}
        allSelected={
          selectedItems.size > 0 &&
          selectedItems.size === filteredItems.filter((i) => i.status === 'pending').length
        }
        onFilterChange={setFilters}
        activeFilters={filters}
        loading={actionLoading}
      />

      {/* Review Items List */}
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {filteredItems.map((item) => {
            const isExpanded = expandedItems.has(item.id);
            const isSelected = selectedItems.has(item.id);

            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className={cn(
                  'rounded-xl border bg-slate-900/80 backdrop-blur-sm overflow-hidden transition-colors',
                  item.status === 'approved' && 'border-emerald-500/20 bg-emerald-500/[0.02]',
                  item.status === 'rejected' && 'border-rose-500/20 bg-rose-500/[0.02]',
                  item.status === 'skipped' && 'border-slate-700/50 opacity-60',
                  item.status === 'pending' && isSelected && 'border-violet-500/40',
                  item.status === 'pending' && !isSelected && 'border-slate-800',
                )}
              >
                {/* Item Header */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
                  onClick={() => toggleExpanded(item.id)}
                >
                  {/* Checkbox (only for pending) */}
                  {item.status === 'pending' && (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleSelected(item.id);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-violet-500 focus:ring-violet-500 focus:ring-offset-0"
                    />
                  )}

                  {/* Status indicator */}
                  <StatusIndicator status={item.status} />

                  {/* Expand chevron */}
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-slate-500 shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-slate-500 shrink-0" />
                  )}

                  {/* File path */}
                  <FileCode className="h-4 w-4 text-slate-600 shrink-0" />
                  <span className="text-sm text-slate-300 font-mono truncate flex-1">
                    {item.filePath}
                  </span>

                  {/* Badges */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={changeTypeVariant[item.changeType]}>
                      {changeTypeLabels[item.changeType]}
                    </Badge>
                    <ConfidenceBadge confidence={item.confidence} />
                    {item.autoFixApplied && (
                      <Badge variant="success">Auto-fix</Badge>
                    )}
                  </div>
                </div>

                {/* Expanded Content */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-slate-800 px-4 py-4 space-y-4">
                        {/* Description */}
                        <p className="text-sm text-slate-400">{item.description}</p>

                        {/* Diff View */}
                        <DiffViewer
                          before={item.before}
                          after={item.after}
                          filePath={item.filePath}
                        />

                        {/* Action Buttons (only for pending) */}
                        {item.status === 'pending' && (
                          <div className="flex items-center gap-3">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSingleAction(item.id, 'approved');
                              }}
                              disabled={actionLoading}
                              className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
                            >
                              <Check className="h-3.5 w-3.5" />
                              Approve
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSingleAction(item.id, 'rejected');
                              }}
                              disabled={actionLoading}
                            >
                              <X className="h-3.5 w-3.5" />
                              Reject
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSingleAction(item.id, 'skipped');
                              }}
                              disabled={actionLoading}
                            >
                              <SkipForward className="h-3.5 w-3.5" />
                              Skip
                            </Button>

                            <div className="flex-1" />

                            {/* Notes input */}
                            <input
                              type="text"
                              placeholder="Add a note..."
                              value={noteInputs[item.id] ?? ''}
                              onChange={(e) =>
                                setNoteInputs((prev) => ({ ...prev, [item.id]: e.target.value }))
                              }
                              onClick={(e) => e.stopPropagation()}
                              className="h-8 w-56 rounded border border-slate-700 bg-slate-900/80 px-3 text-xs text-slate-300 placeholder:text-slate-600 focus:border-violet-500 focus:outline-none"
                            />
                          </div>
                        )}

                        {/* Review info for already-reviewed items */}
                        {item.status !== 'pending' && item.reviewedAt && (
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span>
                              {item.status.charAt(0).toUpperCase() + item.status.slice(1)} by{' '}
                              {item.reviewedBy}
                            </span>
                            <span>&middot;</span>
                            <span>{new Date(item.reviewedAt).toLocaleString()}</span>
                            {item.notes && (
                              <>
                                <span>&middot;</span>
                                <span className="text-slate-400">{item.notes}</span>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {filteredItems.length === 0 && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-12 text-center">
            <p className="text-slate-500">No items match the current filters.</p>
          </div>
        )}
      </div>
    </div>
  );
}
