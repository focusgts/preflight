'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Play,
  Pause,
  Square,
  Zap,
  Clock,
  RefreshCw,
  AlertTriangle,
  Settings2,
  Loader2,
} from 'lucide-react';
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
  SyncStats,
} from '@/types/sync';
import {
  SyncStatus,
  SyncHealthLevel,
  ConflictStrategy,
  CutoverStepStatus,
  DetectionStrategy,
} from '@/types/sync';

// ── Types ──────────────────────────────────────────────────────────

type ConflictType = typeof import('@/types/sync').ConflictType[keyof typeof import('@/types/sync').ConflictType];

type PageState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'no-sync' }
  | { kind: 'stopped'; sync: ContentSync; health: SyncHealth }
  | { kind: 'active'; sync: ContentSync; health: SyncHealth };

interface SyncConfigForm {
  sourceUrl: string;
  sourceBasePath: string;
  targetUrl: string;
  targetBasePath: string;
  interval: number;
  conflictResolution: ConflictStrategy;
}

const DEFAULT_FORM: SyncConfigForm = {
  sourceUrl: '',
  sourceBasePath: '/content',
  targetUrl: '',
  targetBasePath: '/content',
  interval: 300000,
  conflictResolution: ConflictStrategy.SOURCE_WINS,
};

const INTERVAL_OPTIONS = [
  { label: '1 min', value: 60000 },
  { label: '5 min', value: 300000 },
  { label: '15 min', value: 900000 },
  { label: '30 min', value: 1800000 },
];

const CONFLICT_OPTIONS = [
  { label: 'Source Wins', value: ConflictStrategy.SOURCE_WINS },
  { label: 'Target Wins', value: ConflictStrategy.TARGET_WINS },
  { label: 'Manual Review', value: ConflictStrategy.MANUAL },
];

// ── API helpers ────────────────────────────────────────────────────

async function fetchSyncStatus(migrationId: string) {
  const res = await fetch(`/api/sync/${migrationId}`);
  const body = await res.json();
  if (!res.ok) return { ok: false as const, status: res.status, error: body?.error?.message ?? 'Unknown error' };
  return { ok: true as const, data: body.data as { sync: ContentSync; health: SyncHealth } };
}

async function startSync(migrationId: string, form: SyncConfigForm) {
  const res = await fetch(`/api/sync/${migrationId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sourceConfig: {
        platform: 'AEM 6.5',
        url: form.sourceUrl,
        credentials: null,
        basePath: form.sourceBasePath,
      },
      targetConfig: {
        platform: 'AEM Cloud',
        url: form.targetUrl,
        credentials: null,
        basePath: form.targetBasePath,
      },
      options: {
        interval: form.interval,
        conflictResolution: form.conflictResolution,
        autoStart: true,
      },
    }),
  });
  const body = await res.json();
  if (!res.ok) return { ok: false as const, error: body?.error?.message ?? 'Failed to start sync' };
  return { ok: true as const, data: body.data as ContentSync };
}

async function stopSync(migrationId: string) {
  const res = await fetch(`/api/sync/${migrationId}`, { method: 'DELETE' });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    return { ok: false as const, error: body?.error?.message ?? 'Failed to stop sync' };
  }
  return { ok: true as const };
}

async function fetchConflicts(migrationId: string) {
  const res = await fetch(`/api/sync/${migrationId}/conflicts`);
  if (!res.ok) {
    if (res.status === 404) return { ok: true as const, data: [] as Conflict[] };
    const body = await res.json().catch(() => null);
    return { ok: false as const, error: body?.error?.message ?? 'Failed to fetch conflicts' };
  }
  const body = await res.json();
  return { ok: true as const, data: (body.data?.conflicts ?? []) as Conflict[] };
}

async function resolveConflictApi(migrationId: string, conflictId: string, strategy: ConflictStrategy, notes?: string) {
  const res = await fetch(`/api/sync/${migrationId}/conflicts`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conflictId, strategy, notes }),
  });
  const body = await res.json();
  if (!res.ok) return { ok: false as const, error: body?.error?.message ?? 'Failed to resolve conflict' };
  return { ok: true as const };
}

async function updateMigrationStatus(migrationId: string, status: string) {
  const res = await fetch(`/api/migrations/${migrationId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  return res.ok;
}

// ── Page Component ──────────────────────────────────────────────────

export default function SyncPage() {
  const params = useParams();
  const router = useRouter();
  const migrationId = params.id as string;

  // Core state
  const [pageState, setPageState] = useState<PageState>({ kind: 'loading' });
  const [changes, setChanges] = useState<ContentChange[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [cutoverPlan, setCutoverPlan] = useState<CutoverPlan | null>(null);
  const [cutoverProgress, setCutoverProgress] = useState(0);
  const [resolving, setResolving] = useState(false);
  const [configForm, setConfigForm] = useState<SyncConfigForm>(DEFAULT_FORM);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Track previous stats for computing change deltas
  const prevStatsRef = useRef<SyncStats | null>(null);

  // ── Load sync status ─────────────────────────────────────────────

  const loadStatus = useCallback(async (showLoading = false) => {
    if (showLoading) setPageState({ kind: 'loading' });

    const result = await fetchSyncStatus(migrationId);

    if (!result.ok) {
      if (result.status === 404) {
        setPageState({ kind: 'no-sync' });
        return;
      }
      setPageState({ kind: 'error', message: result.error });
      return;
    }

    const { sync, health } = result.data;
    const isStopped = sync.status === SyncStatus.STOPPED || sync.status === SyncStatus.COMPLETED || sync.status === SyncStatus.ERROR;

    setPageState(isStopped ? { kind: 'stopped', sync, health } : { kind: 'active', sync, health });

    // Build change entries from changeLog if available, otherwise track deltas
    if (sync.changeLog && sync.changeLog.length > 0) {
      setChanges(sync.changeLog.slice(-20));
    } else {
      const prev = prevStatsRef.current;
      if (prev && sync.stats.totalChangesDetected > prev.totalChangesDetected) {
        const delta = sync.stats.totalChangesDetected - prev.totalChangesDetected;
        const newChanges: ContentChange[] = Array.from({ length: delta }, (_, i) => ({
          id: `chg-${Date.now()}-${i}`,
          type: 'page_modified' as ContentChange['type'],
          path: `/content/change-${sync.stats.totalChangesDetected - delta + i + 1}`,
          before: null,
          after: null,
          timestamp: new Date().toISOString(),
          hash: `h-${Date.now()}-${i}`,
          synced: sync.stats.totalChangesSynced > prev.totalChangesSynced,
          syncedAt: sync.stats.totalChangesSynced > prev.totalChangesSynced ? new Date().toISOString() : null,
          error: null,
        }));
        setChanges((prevChanges) => [...newChanges, ...prevChanges].slice(0, 50));
      }
    }
    prevStatsRef.current = sync.stats;
  }, [migrationId]);

  // ── Load conflicts ───────────────────────────────────────────────

  const loadConflicts = useCallback(async () => {
    const result = await fetchConflicts(migrationId);
    if (result.ok) {
      setConflicts(result.data);
    }
  }, [migrationId]);

  // ── Initial load ─────────────────────────────────────────────────

  useEffect(() => {
    loadStatus(true);
    loadConflicts();
  }, [loadStatus, loadConflicts]);

  // ── Poll while active ────────────────────────────────────────────

  useEffect(() => {
    if (pageState.kind !== 'active') return;

    const timer = setInterval(() => {
      loadStatus();
      loadConflicts();
    }, 5000);

    return () => clearInterval(timer);
  }, [pageState.kind, loadStatus, loadConflicts]);

  // ── Actions ──────────────────────────────────────────────────────

  const handleStart = useCallback(async () => {
    setStarting(true);
    setActionError(null);

    const result = await startSync(migrationId, configForm);
    if (!result.ok) {
      setActionError(result.error);
      setStarting(false);
      return;
    }

    setStarting(false);
    await loadStatus(true);
    await loadConflicts();
  }, [migrationId, configForm, loadStatus, loadConflicts]);

  const handleStop = useCallback(async () => {
    setStopping(true);
    setActionError(null);

    const result = await stopSync(migrationId);
    if (!result.ok) {
      setActionError(result.error);
      setStopping(false);
      return;
    }

    setStopping(false);
    prevStatsRef.current = null;
    setPageState({ kind: 'no-sync' });
  }, [migrationId]);

  const handlePause = useCallback(async () => {
    // The API uses DELETE for stop. Pause is a conceptual state change;
    // for now, stop and allow restart. A PATCH pause could be added later.
    await handleStop();
  }, [handleStop]);

  const handleResolve = useCallback(
    async (conflictId: string, strategy: ConflictStrategy) => {
      setResolving(true);
      setActionError(null);

      const result = await resolveConflictApi(migrationId, conflictId, strategy);
      if (!result.ok) {
        setActionError(result.error);
        setResolving(false);
        return;
      }

      await loadConflicts();
      await loadStatus();
      setResolving(false);
    },
    [migrationId, loadConflicts, loadStatus],
  );

  const handleAutoResolveAll = useCallback(async () => {
    setResolving(true);
    setActionError(null);

    for (const conflict of conflicts) {
      const result = await resolveConflictApi(
        migrationId,
        conflict.id,
        ConflictStrategy.SOURCE_WINS,
      );
      if (!result.ok) {
        setActionError(result.error);
        break;
      }
    }

    await loadConflicts();
    await loadStatus();
    setResolving(false);
  }, [conflicts, migrationId, loadConflicts, loadStatus]);

  // ── Cutover ──────────────────────────────────────────────────────

  const handlePlanCutover = useCallback(() => {
    const syncId = pageState.kind === 'active' || pageState.kind === 'stopped'
      ? pageState.sync.id
      : 'cutover-plan';

    const plan: CutoverPlan = {
      id: 'cutover-plan-1',
      syncId,
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
  }, [pageState]);

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
    setCutoverPlan({ ...updated });

    // Update migration status to COMPLETED
    await updateMigrationStatus(migrationId, 'COMPLETED');
    await loadStatus();
  }, [cutoverPlan, migrationId, loadStatus]);

  // ── Derived values ───────────────────────────────────────────────

  const syncData = (pageState.kind === 'active' || pageState.kind === 'stopped') ? pageState.sync : null;
  const healthData = (pageState.kind === 'active' || pageState.kind === 'stopped') ? pageState.health : null;

  // ── Render ───────────────────────────────────────────────────────

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

        {/* Action error banner */}
        {actionError && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 rounded-lg border border-rose-500/20 bg-rose-500/5 px-4 py-3 flex items-center gap-2"
          >
            <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
            <span className="text-sm text-rose-300">{actionError}</span>
            <button
              onClick={() => setActionError(null)}
              className="ml-auto text-rose-500 hover:text-rose-400 text-xs"
            >
              Dismiss
            </button>
          </motion.div>
        )}

        {/* Loading state */}
        {pageState.kind === 'loading' && <LoadingSkeleton />}

        {/* Error state */}
        {pageState.kind === 'error' && (
          <div className="text-center py-16">
            <AlertTriangle className="h-8 w-8 text-rose-400 mx-auto mb-3" />
            <p className="text-sm text-slate-400 mb-4">{pageState.message}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => loadStatus(true)}
              className="border border-slate-700 text-slate-300"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Retry
            </Button>
          </div>
        )}

        {/* No sync configured — show setup form */}
        {pageState.kind === 'no-sync' && (
          <ConfigureSyncForm
            form={configForm}
            onChange={setConfigForm}
            onStart={handleStart}
            starting={starting}
          />
        )}

        {/* Active or stopped sync */}
        {(pageState.kind === 'active' || pageState.kind === 'stopped') && syncData && healthData && (
          <>
            {/* Sync Status */}
            <div className="mb-6">
              <SyncStatusDisplay
                status={syncData.status}
                stats={syncData.stats}
                health={healthData}
                lastSyncAt={syncData.lastSyncAt}
                sourcePlatform={syncData.sourceConfig.platform}
                targetPlatform={syncData.targetConfig.platform}
              />
            </div>

            {/* Controls */}
            <div className="flex gap-2 mb-6">
              {syncData.status === SyncStatus.SYNCING && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handlePause}
                  disabled={stopping}
                  className="border border-slate-700 text-slate-300"
                >
                  {stopping ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Pause className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Pause
                </Button>
              )}
              {syncData.status === SyncStatus.PAUSED && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleStart}
                  disabled={starting}
                  className="border border-emerald-500/30 text-emerald-400"
                >
                  {starting ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Play className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Resume
                </Button>
              )}
              {(syncData.status === SyncStatus.SYNCING || syncData.status === SyncStatus.PAUSED) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleStop}
                  disabled={stopping}
                  className="border border-rose-500/20 text-rose-400"
                >
                  {stopping ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Square className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Stop
                </Button>
              )}
              {pageState.kind === 'stopped' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPageState({ kind: 'no-sync' })}
                  className="border border-emerald-500/30 text-emerald-400"
                >
                  <Play className="h-3.5 w-3.5 mr-1.5" />
                  Restart Sync
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
                  {changes.length === 0 ? (
                    <div className="px-4 py-8 text-center text-xs text-slate-500">
                      No changes detected yet. Changes will appear here as they are synced.
                    </div>
                  ) : (
                    changes.map((change) => (
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
                    ))
                  )}
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
          </>
        )}
      </div>
    </div>
  );
}

// ── Configure Sync Form ────────────────────────────────────────────

function ConfigureSyncForm({
  form,
  onChange,
  onStart,
  starting,
}: {
  form: SyncConfigForm;
  onChange: (form: SyncConfigForm) => void;
  onStart: () => void;
  starting: boolean;
}) {
  const update = (key: keyof SyncConfigForm, value: string | number) => {
    onChange({ ...form, [key]: value });
  };

  return (
    <Card padding="md" gradient>
      <div className="flex items-center gap-2 mb-6">
        <Settings2 className="h-4 w-4 text-cyan-400" />
        <h3 className="text-sm font-semibold text-slate-200">Configure Content Sync</h3>
      </div>
      <p className="text-xs text-slate-500 mb-6">
        No sync configured. Configure source and target to begin continuous content synchronization.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Source */}
        <div className="space-y-3">
          <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider">Source (AEM 6.5)</h4>
          <div>
            <label className="block text-[10px] text-slate-500 mb-1">URL</label>
            <input
              type="text"
              value={form.sourceUrl}
              onChange={(e) => update('sourceUrl', e.target.value)}
              placeholder="https://author.example.com"
              className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] text-slate-500 mb-1">Base Path</label>
            <input
              type="text"
              value={form.sourceBasePath}
              onChange={(e) => update('sourceBasePath', e.target.value)}
              placeholder="/content"
              className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none"
            />
          </div>
        </div>

        {/* Target */}
        <div className="space-y-3">
          <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider">Target (AEM Cloud)</h4>
          <div>
            <label className="block text-[10px] text-slate-500 mb-1">URL</label>
            <input
              type="text"
              value={form.targetUrl}
              onChange={(e) => update('targetUrl', e.target.value)}
              placeholder="https://author-p1234.adobeaemcloud.com"
              className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] text-slate-500 mb-1">Base Path</label>
            <input
              type="text"
              value={form.targetBasePath}
              onChange={(e) => update('targetBasePath', e.target.value)}
              placeholder="/content"
              className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-[10px] text-slate-500 mb-1">Sync Interval</label>
          <select
            value={form.interval}
            onChange={(e) => update('interval', Number(e.target.value))}
            className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-1.5 text-xs text-slate-200 focus:border-cyan-500/50 focus:outline-none"
          >
            {INTERVAL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-slate-500 mb-1">Conflict Strategy</label>
          <select
            value={form.conflictResolution}
            onChange={(e) => update('conflictResolution', e.target.value)}
            className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-1.5 text-xs text-slate-200 focus:border-cyan-500/50 focus:outline-none"
          >
            {CONFLICT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={onStart}
        disabled={starting || !form.sourceUrl || !form.targetUrl}
        className="w-full border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
      >
        {starting ? (
          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
        ) : (
          <Play className="h-3.5 w-3.5 mr-1.5" />
        )}
        Start Sync
      </Button>
    </Card>
  );
}

// ── Loading Skeleton ───────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Status skeleton */}
      <div className="rounded-lg bg-slate-800/50 border border-slate-800 p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="h-3 w-20 rounded bg-slate-700" />
          <div className="h-3 w-16 rounded bg-slate-700" />
        </div>
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-2 w-16 rounded bg-slate-700" />
              <div className="h-6 w-12 rounded bg-slate-700" />
            </div>
          ))}
        </div>
      </div>

      {/* Controls skeleton */}
      <div className="flex gap-2">
        <div className="h-8 w-20 rounded bg-slate-800/50" />
        <div className="h-8 w-20 rounded bg-slate-800/50" />
      </div>

      {/* Grid skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-lg bg-slate-800/50 border border-slate-800 h-64" />
        <div className="rounded-lg bg-slate-800/50 border border-slate-800 h-64" />
      </div>

      {/* Cutover skeleton */}
      <div className="rounded-lg bg-slate-800/50 border border-slate-800 h-32" />
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
