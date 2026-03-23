'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Play, Pause, Square, Zap, Clock } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { SyncStatusDisplay } from '@/components/sync/sync-status';
import { ConflictResolverUI } from '@/components/sync/conflict-resolver-ui';
import type {
  ContentSync,
  SyncHealth,
  ContentChange,
  Conflict,
  CutoverPlan,
  CutoverStep,
} from '@/types/sync';
import {
  SyncStatus,
  SyncHealthLevel,
  ConflictStrategy,
  CutoverStepStatus,
} from '@/types/sync';

// ── Mock data for demo ──────────────────────────────────────────────

function createMockSync(): ContentSync & { health: SyncHealth } {
  return {
    id: 'sync-demo',
    migrationId: '',
    status: SyncStatus.SYNCING,
    sourceConfig: { platform: 'AEM 6.5', url: 'https://author.acme.com', credentials: null, basePath: '/content/acme' },
    targetConfig: { platform: 'AEM Cloud', url: 'https://author-p1234.adobeaemcloud.com', credentials: null, basePath: '/content/acme' },
    options: { interval: 300000, strategy: 'polling' as never, includePatterns: [], excludePatterns: [], conflictResolution: ConflictStrategy.SOURCE_WINS, batchSize: 100, autoStart: true },
    stats: { totalChangesDetected: 247, totalChangesSynced: 241, totalConflicts: 3, totalConflictsResolved: 1, totalErrors: 2, averageSyncDurationMs: 1420, lastSyncDurationMs: 890, syncCyclesCompleted: 48 },
    changeLog: [],
    conflicts: [],
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
    lastSyncAt: new Date(Date.now() - 120000).toISOString(),
    health: { level: SyncHealthLevel.HEALTHY, message: 'Sync is running normally', unresolvedConflicts: 2, pendingChanges: 4, errorRate: 0.008 },
  };
}

function createMockChanges(): ContentChange[] {
  const types = ['page_modified', 'page_created', 'asset_uploaded', 'page_deleted', 'tag_added'] as const;
  return Array.from({ length: 12 }, (_, i) => ({
    id: `chg-${i}`,
    type: types[i % types.length] as ContentChange['type'],
    path: `/content/acme/en/${['about', 'products', 'blog/post-' + i, 'careers', 'contact'][i % 5]}`,
    before: null,
    after: { title: `Updated Page ${i}` },
    timestamp: new Date(Date.now() - i * 180000).toISOString(),
    hash: `h${i}`,
    synced: i > 2,
    syncedAt: i > 2 ? new Date(Date.now() - i * 170000).toISOString() : null,
    error: null,
  }));
}

function createMockConflicts(): Conflict[] {
  return [
    {
      id: 'conflict-1', type: 'both_modified' as ConflictType, resolution: null, resolvedBy: null, resolvedAt: null, flaggedForReview: true,
      sourceChange: { id: 'sc-1', type: 'page_modified' as never, path: '/content/acme/en/about', before: { title: 'About Us' }, after: { title: 'About Our Company' }, timestamp: new Date().toISOString(), hash: 'a1', synced: false, syncedAt: null, error: null },
      targetChange: { id: 'tc-1', type: 'page_modified' as never, path: '/content/acme/en/about', before: { title: 'About Us' }, after: { title: 'About Acme Inc.' }, timestamp: new Date().toISOString(), hash: 'a2', synced: false, syncedAt: null, error: null },
    },
    {
      id: 'conflict-2', type: 'source_deleted_target_modified' as ConflictType, resolution: null, resolvedBy: null, resolvedAt: null, flaggedForReview: true,
      sourceChange: { id: 'sc-2', type: 'page_deleted' as never, path: '/content/acme/en/old-promo', before: { title: 'Summer Sale' }, after: null, timestamp: new Date().toISOString(), hash: 'b1', synced: false, syncedAt: null, error: null },
      targetChange: { id: 'tc-2', type: 'page_modified' as never, path: '/content/acme/en/old-promo', before: { title: 'Summer Sale' }, after: { title: 'Summer Sale Extended' }, timestamp: new Date().toISOString(), hash: 'b2', synced: false, syncedAt: null, error: null },
    },
  ];
}

// ── Enums imported as values for type narrowing ─────────────────────

type ConflictType = typeof import('@/types/sync').ConflictType[keyof typeof import('@/types/sync').ConflictType];

// ── Page Component ──────────────────────────────────────────────────

export default function SyncPage() {
  const params = useParams();
  const router = useRouter();
  const migrationId = params.id as string;

  const [sync, setSync] = useState(createMockSync);
  const [changes, setChanges] = useState(createMockChanges);
  const [conflicts, setConflicts] = useState(createMockConflicts);
  const [cutoverPlan, setCutoverPlan] = useState<CutoverPlan | null>(null);
  const [cutoverProgress, setCutoverProgress] = useState(0);
  const [resolving, setResolving] = useState(false);

  // Poll for updates
  useEffect(() => {
    const timer = setInterval(() => {
      setSync((prev) => ({
        ...prev,
        stats: {
          ...prev.stats,
          totalChangesDetected: prev.stats.totalChangesDetected + Math.floor(Math.random() * 3),
          totalChangesSynced: prev.stats.totalChangesSynced + Math.floor(Math.random() * 3),
          syncCyclesCompleted: prev.stats.syncCyclesCompleted + 1,
        },
        lastSyncAt: new Date().toISOString(),
      }));
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  const handleResolve = useCallback(
    async (conflictId: string, strategy: ConflictStrategy) => {
      setResolving(true);
      // Simulate API call
      await new Promise((r) => setTimeout(r, 500));
      setConflicts((prev) => prev.filter((c) => c.id !== conflictId));
      setSync((prev) => ({
        ...prev,
        stats: { ...prev.stats, totalConflictsResolved: prev.stats.totalConflictsResolved + 1 },
      }));
      setResolving(false);
    },
    [],
  );

  const handleAutoResolveAll = useCallback(async () => {
    setResolving(true);
    await new Promise((r) => setTimeout(r, 800));
    const count = conflicts.length;
    setConflicts([]);
    setSync((prev) => ({
      ...prev,
      stats: { ...prev.stats, totalConflictsResolved: prev.stats.totalConflictsResolved + count },
    }));
    setResolving(false);
  }, [conflicts.length]);

  const handlePlanCutover = useCallback(() => {
    const plan: CutoverPlan = {
      id: 'cutover-plan-1',
      syncId: sync.id,
      estimatedDurationMinutes: 12,
      createdAt: new Date().toISOString(),
      status: CutoverStepStatus.PENDING,
      startedAt: null,
      completedAt: null,
      steps: [
        { id: 's1', order: 1, name: 'Final content sync', description: 'Capture remaining changes', status: CutoverStepStatus.PENDING, estimatedDurationMinutes: 2, actualDurationMinutes: null, startedAt: null, completedAt: null, error: null, rollbackable: true },
        { id: 's2', order: 2, name: 'Pause source authoring', description: 'Briefly disable editing', status: CutoverStepStatus.PENDING, estimatedDurationMinutes: 1, actualDurationMinutes: null, startedAt: null, completedAt: null, error: null, rollbackable: true },
        { id: 's3', order: 3, name: 'Verify sync completeness', description: 'Confirm all changes replicated', status: CutoverStepStatus.PENDING, estimatedDurationMinutes: 2, actualDurationMinutes: null, startedAt: null, completedAt: null, error: null, rollbackable: true },
        { id: 's4', order: 4, name: 'Switch DNS / routing', description: 'Point traffic to target', status: CutoverStepStatus.PENDING, estimatedDurationMinutes: 3, actualDurationMinutes: null, startedAt: null, completedAt: null, error: null, rollbackable: true },
        { id: 's5', order: 5, name: 'Verify target is live', description: 'Run smoke tests', status: CutoverStepStatus.PENDING, estimatedDurationMinutes: 2, actualDurationMinutes: null, startedAt: null, completedAt: null, error: null, rollbackable: true },
        { id: 's6', order: 6, name: 'Resume authoring on target', description: 'Enable editing on new platform', status: CutoverStepStatus.PENDING, estimatedDurationMinutes: 1, actualDurationMinutes: null, startedAt: null, completedAt: null, error: null, rollbackable: true },
        { id: 's7', order: 7, name: 'Start reverse-sync', description: 'Catch any straggler changes', status: CutoverStepStatus.PENDING, estimatedDurationMinutes: 1, actualDurationMinutes: null, startedAt: null, completedAt: null, error: null, rollbackable: false },
      ],
      rollbackSteps: [],
    };
    setCutoverPlan(plan);
  }, [sync.id]);

  const handleExecuteCutover = useCallback(async () => {
    if (!cutoverPlan) return;
    setCutoverProgress(0);
    const updated = { ...cutoverPlan, status: CutoverStepStatus.IN_PROGRESS, startedAt: new Date().toISOString() };

    for (let i = 0; i < updated.steps.length; i++) {
      updated.steps[i].status = CutoverStepStatus.IN_PROGRESS;
      updated.steps[i].startedAt = new Date().toISOString();
      setCutoverPlan({ ...updated });

      await new Promise((r) => setTimeout(r, 1200));

      updated.steps[i].status = CutoverStepStatus.COMPLETED;
      updated.steps[i].completedAt = new Date().toISOString();
      updated.steps[i].actualDurationMinutes = updated.steps[i].estimatedDurationMinutes;
      setCutoverProgress(Math.round(((i + 1) / updated.steps.length) * 100));
      setCutoverPlan({ ...updated });
    }

    updated.status = CutoverStepStatus.COMPLETED;
    updated.completedAt = new Date().toISOString();
    setSync((prev) => ({ ...prev, status: SyncStatus.COMPLETED }));
    setCutoverPlan({ ...updated });
  }, [cutoverPlan]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/migrations/${migrationId}`)}
            className="text-slate-400 hover:text-slate-200"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div>
            <h1 className="text-xl font-bold text-slate-100">Content Sync</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Zero content freeze migration — authors keep publishing
            </p>
          </div>
        </div>

        {/* Sync Status */}
        <div className="mb-6">
          <SyncStatusDisplay
            status={sync.status}
            stats={sync.stats}
            health={sync.health}
            lastSyncAt={sync.lastSyncAt}
            sourcePlatform={sync.sourceConfig.platform}
            targetPlatform={sync.targetConfig.platform}
          />
        </div>

        {/* Controls */}
        <div className="flex gap-2 mb-6">
          {sync.status === SyncStatus.SYNCING && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSync((p) => ({ ...p, status: SyncStatus.PAUSED }))}
              className="border border-slate-700 text-slate-300"
            >
              <Pause className="h-3.5 w-3.5 mr-1.5" />
              Pause
            </Button>
          )}
          {sync.status === SyncStatus.PAUSED && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSync((p) => ({ ...p, status: SyncStatus.SYNCING }))}
              className="border border-emerald-500/30 text-emerald-400"
            >
              <Play className="h-3.5 w-3.5 mr-1.5" />
              Resume
            </Button>
          )}
          {(sync.status === SyncStatus.SYNCING || sync.status === SyncStatus.PAUSED) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSync((p) => ({ ...p, status: SyncStatus.STOPPED }))}
              className="border border-rose-500/20 text-rose-400"
            >
              <Square className="h-3.5 w-3.5 mr-1.5" />
              Stop
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Change log */}
          <Card padding="none">
            <div className="p-4 border-b border-slate-800">
              <h3 className="text-sm font-semibold text-slate-200">Change Log</h3>
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/50">
              {changes.map((change) => (
                <motion.div
                  key={change.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center justify-between px-4 py-2.5 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <ChangeTypeDot type={change.type} />
                    <span className="text-slate-400 font-mono truncate">{change.path}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    {change.synced ? (
                      <span className="text-emerald-500 text-[10px]">synced</span>
                    ) : (
                      <span className="text-amber-500 text-[10px]">pending</span>
                    )}
                    <span className="text-slate-600 text-[10px]">
                      {timeAgo(change.timestamp)}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </Card>

          {/* Conflict resolver */}
          <ConflictResolverUI
            conflicts={conflicts}
            onResolve={handleResolve}
            onAutoResolveAll={handleAutoResolveAll}
            resolving={resolving}
          />
        </div>

        {/* Cutover section */}
        <Card
          padding="md"
          gradient
          header={
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-violet-400" />
                <h3 className="text-sm font-semibold text-slate-200">Zero-Downtime Cutover</h3>
              </div>
              {cutoverPlan && cutoverPlan.status === CutoverStepStatus.PENDING && (
                <div className="flex items-center gap-1.5 text-violet-400">
                  <Clock className="h-3.5 w-3.5" />
                  <span className="text-sm font-mono font-semibold">
                    ~{cutoverPlan.estimatedDurationMinutes} min freeze
                  </span>
                </div>
              )}
            </div>
          }
        >
          {!cutoverPlan ? (
            <div className="text-center py-4">
              <p className="text-sm text-slate-400 mb-3">
                Plan and execute a zero-downtime cutover. Total content freeze is measured in
                <span className="text-violet-400 font-semibold"> minutes</span>, not days or weeks.
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePlanCutover}
                className="border border-violet-500/30 text-violet-400 hover:bg-violet-500/10"
                disabled={conflicts.length > 0}
              >
                Plan Cutover
              </Button>
              {conflicts.length > 0 && (
                <p className="text-xs text-amber-400 mt-2">
                  Resolve all conflicts before planning cutover
                </p>
              )}
            </div>
          ) : (
            <div>
              {/* Estimated freeze time */}
              <div className="rounded-lg bg-violet-500/5 border border-violet-500/10 p-3 mb-4 text-center">
                <div className="text-[10px] uppercase tracking-wider text-violet-500 mb-1">
                  Estimated Content Freeze
                </div>
                <div className="text-2xl font-mono font-bold text-violet-400">
                  {cutoverPlan.estimatedDurationMinutes} minutes
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  vs. 2-4 weeks with traditional migration
                </div>
              </div>

              {/* Steps */}
              <div className="space-y-1.5 mb-4">
                {cutoverPlan.steps.map((step) => (
                  <CutoverStepRow key={step.id} step={step} />
                ))}
              </div>

              {/* Progress bar */}
              {cutoverPlan.status === CutoverStepStatus.IN_PROGRESS && (
                <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden mb-4">
                  <motion.div
                    className="h-full bg-gradient-to-r from-violet-500 to-cyan-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${cutoverProgress}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              )}

              {/* Execute button */}
              {cutoverPlan.status === CutoverStepStatus.PENDING && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleExecuteCutover}
                  className="w-full border border-violet-500/30 text-violet-400 hover:bg-violet-500/10"
                >
                  <Zap className="h-3.5 w-3.5 mr-1.5" />
                  Execute Cutover
                </Button>
              )}

              {cutoverPlan.status === CutoverStepStatus.COMPLETED && (
                <div className="text-center py-2">
                  <span className="text-emerald-400 text-sm font-medium">
                    Cutover completed successfully
                  </span>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────

function CutoverStepRow({ step }: { step: CutoverStep }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-800/30">
      <StepStatusIcon status={step.status} />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-slate-300">{step.name}</div>
        <div className="text-[10px] text-slate-500 truncate">{step.description}</div>
      </div>
      <span className="text-[10px] text-slate-600 font-mono shrink-0">
        {step.actualDurationMinutes ?? step.estimatedDurationMinutes}m
      </span>
    </div>
  );
}

function StepStatusIcon({ status }: { status: CutoverStepStatus }) {
  const base = 'h-4 w-4 rounded-full flex items-center justify-center text-[8px]';
  switch (status) {
    case CutoverStepStatus.COMPLETED:
      return <div className={cn(base, 'bg-emerald-500/20 text-emerald-400')}>&#10003;</div>;
    case CutoverStepStatus.IN_PROGRESS:
      return (
        <div className={cn(base, 'bg-violet-500/20')}>
          <motion.div
            className="h-2 w-2 rounded-full bg-violet-400"
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
        </div>
      );
    case CutoverStepStatus.FAILED:
      return <div className={cn(base, 'bg-rose-500/20 text-rose-400')}>&#10005;</div>;
    case CutoverStepStatus.SKIPPED:
      return <div className={cn(base, 'bg-slate-700 text-slate-500')}>-</div>;
    default:
      return <div className={cn(base, 'bg-slate-800 border border-slate-700')} />;
  }
}

const changeTypeColors: Record<string, string> = {
  page_created: 'bg-emerald-400',
  page_modified: 'bg-cyan-400',
  page_deleted: 'bg-rose-400',
  page_moved: 'bg-violet-400',
  asset_uploaded: 'bg-emerald-400',
  asset_modified: 'bg-cyan-400',
  asset_deleted: 'bg-rose-400',
  tag_added: 'bg-amber-400',
  tag_removed: 'bg-amber-400',
};

function ChangeTypeDot({ type }: { type: string }) {
  return <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', changeTypeColors[type] ?? 'bg-slate-500')} />;
}

function timeAgo(timestamp: string): string {
  const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}
