'use client';

/**
 * Deployment Status Component (ADR-052)
 *
 * Provides a "Deploy to Cloud Manager" flow:
 * 1. Credential form (Program ID, Pipeline ID, Access Token)
 * 2. Trigger deployment via POST /api/migrations/[id]/deploy
 * 3. Poll execution status via GET /api/migrations/[id]/deploy
 * 4. Render pipeline steps with live status indicators
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Rocket,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Cloud,
  Settings,
  Eye,
  EyeOff,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { CMExecutionStatus, CMExecutionStep } from '@/lib/deployment/cloud-manager-client';

// ── Types ───────────────────────────────────────────────────────────────

interface DeploymentStatusProps {
  migrationId: string;
}

interface DeployForm {
  programId: string;
  pipelineId: string;
  accessToken: string;
  clientId: string;
  imsOrg: string;
}

interface DeployState {
  phase: 'idle' | 'form' | 'triggering' | 'polling' | 'finished' | 'error';
  executionId?: string;
  pipelineId?: string;
  programId?: string;
  accessToken?: string;
  clientId?: string;
  imsOrg?: string;
  status?: CMExecutionStatus;
  steps?: CMExecutionStep[];
  errorMessage?: string;
}

interface ApiResponse<T> {
  data?: T;
  error?: { code: string; message: string };
}

// ── Status helpers ──────────────────────────────────────────────────────

const TERMINAL_STATUSES: CMExecutionStatus[] = ['FINISHED', 'ERROR', 'FAILED', 'CANCELLED'];
const POLL_INTERVAL_MS = 10_000;

function statusIcon(status: CMExecutionStep['status']) {
  switch (status) {
    case 'FINISHED':
      return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
    case 'RUNNING':
      return <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />;
    case 'ERROR':
    case 'FAILED':
      return <XCircle className="h-4 w-4 text-red-400" />;
    case 'CANCELLED':
      return <XCircle className="h-4 w-4 text-slate-500" />;
    case 'WAITING':
      return <Clock className="h-4 w-4 text-yellow-400" />;
    default:
      return <Clock className="h-4 w-4 text-slate-500" />;
  }
}

function executionStatusBadge(status?: CMExecutionStatus) {
  if (!status) return null;

  const config: Record<string, { label: string; color: string; bg: string }> = {
    NOT_STARTED: { label: 'Not Started', color: 'text-slate-400', bg: 'bg-slate-500/10' },
    RUNNING: { label: 'Running', color: 'text-blue-400', bg: 'bg-blue-500/10' },
    CANCELLING: { label: 'Cancelling', color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
    CANCELLED: { label: 'Cancelled', color: 'text-slate-400', bg: 'bg-slate-500/10' },
    FINISHED: { label: 'Finished', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    ERROR: { label: 'Error', color: 'text-red-400', bg: 'bg-red-500/10' },
    FAILED: { label: 'Failed', color: 'text-red-400', bg: 'bg-red-500/10' },
  };

  const c = config[status] ?? config.NOT_STARTED;

  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium', c.color, c.bg)}>
      {status === 'RUNNING' && <Loader2 className="h-3 w-3 animate-spin" />}
      {c.label}
    </span>
  );
}

// ── Component ───────────────────────────────────────────────────────────

export function DeploymentStatus({ migrationId }: DeploymentStatusProps) {
  const [state, setState] = useState<DeployState>({ phase: 'idle' });
  const [form, setForm] = useState<DeployForm>({
    programId: '',
    pipelineId: '',
    accessToken: '',
    clientId: '',
    imsOrg: '',
  });
  const [showToken, setShowToken] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Cleanup polling on unmount ──────────────────────────────────────

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // ── Trigger deployment ──────────────────────────────────────────────

  const triggerDeploy = useCallback(async () => {
    setState((prev) => ({ ...prev, phase: 'triggering' }));

    try {
      const res = await fetch(`/api/migrations/${migrationId}/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          programId: form.programId,
          pipelineId: form.pipelineId || undefined,
          credentials: {
            clientId: form.clientId,
            clientSecret: '',
            imsOrg: form.imsOrg,
            technicalAccountId: '',
            accessToken: form.accessToken,
          },
        }),
      });

      const json = (await res.json()) as ApiResponse<{
        executionId: string;
        pipelineId: string;
        programId: string;
        status: CMExecutionStatus;
      }>;

      if (!res.ok || json.error) {
        setState({
          phase: 'error',
          errorMessage: json.error?.message ?? `HTTP ${res.status}`,
        });
        return;
      }

      const data = json.data!;
      setState({
        phase: 'polling',
        executionId: data.executionId,
        pipelineId: data.pipelineId,
        programId: data.programId,
        accessToken: form.accessToken,
        clientId: form.clientId,
        imsOrg: form.imsOrg,
        status: data.status,
      });
    } catch (err) {
      setState({
        phase: 'error',
        errorMessage: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }, [migrationId, form]);

  // ── Poll execution status ───────────────────────────────────────────

  useEffect(() => {
    if (state.phase !== 'polling' || !state.executionId) return;

    const poll = async () => {
      try {
        const params = new URLSearchParams({
          executionId: state.executionId!,
          pipelineId: state.pipelineId!,
          programId: state.programId!,
          accessToken: state.accessToken!,
        });
        if (state.clientId) params.set('clientId', state.clientId);
        if (state.imsOrg) params.set('imsOrg', state.imsOrg);

        const res = await fetch(
          `/api/migrations/${migrationId}/deploy?${params.toString()}`,
        );
        const json = (await res.json()) as ApiResponse<{
          execution: { status: CMExecutionStatus; currentStep?: string };
          steps: CMExecutionStep[];
        }>;

        if (json.data) {
          const executionStatus = json.data.execution.status;
          const isTerminal = TERMINAL_STATUSES.includes(executionStatus);

          setState((prev) => ({
            ...prev,
            status: executionStatus,
            steps: json.data!.steps,
            phase: isTerminal ? 'finished' : 'polling',
          }));

          if (isTerminal && pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
        }
      } catch {
        // Swallow transient fetch errors during polling
      }
    };

    // Poll immediately, then on interval
    poll();
    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [state.phase, state.executionId, state.pipelineId, state.programId, state.accessToken, state.clientId, state.imsOrg, migrationId]);

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-900/50 backdrop-blur-sm">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
            <Cloud className="h-4 w-4 text-blue-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-200">
              Cloud Manager Deployment
            </h3>
            <p className="text-xs text-slate-500">
              {state.phase === 'idle' && 'Deploy modernized code via Cloud Manager pipeline'}
              {state.phase === 'form' && 'Enter Cloud Manager credentials'}
              {state.phase === 'triggering' && 'Triggering pipeline...'}
              {state.phase === 'polling' && 'Pipeline execution in progress'}
              {state.phase === 'finished' && `Pipeline ${state.status?.toLowerCase()}`}
              {state.phase === 'error' && 'Deployment failed'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {executionStatusBadge(state.status)}
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-slate-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-slate-500" />
          )}
        </div>
      </button>

      {/* Content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-slate-700/50 p-4">
              {/* Idle — show deploy button */}
              {state.phase === 'idle' && (
                <button
                  type="button"
                  onClick={() => setState({ phase: 'form' })}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
                >
                  <Rocket className="h-4 w-4" />
                  Deploy to Cloud Manager
                </button>
              )}

              {/* Form — credential inputs */}
              {state.phase === 'form' && (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <FormField
                      label="Program ID"
                      value={form.programId}
                      onChange={(v) => setForm((f) => ({ ...f, programId: v }))}
                      placeholder="12345"
                      required
                    />
                    <FormField
                      label="Pipeline ID"
                      value={form.pipelineId}
                      onChange={(v) => setForm((f) => ({ ...f, pipelineId: v }))}
                      placeholder="Leave blank to auto-detect"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <FormField
                      label="Client ID (API Key)"
                      value={form.clientId}
                      onChange={(v) => setForm((f) => ({ ...f, clientId: v }))}
                      placeholder="e.g. cm-p12345-e67890"
                    />
                    <FormField
                      label="IMS Org ID"
                      value={form.imsOrg}
                      onChange={(v) => setForm((f) => ({ ...f, imsOrg: v }))}
                      placeholder="ABC123@AdobeOrg"
                    />
                  </div>
                  <div className="relative">
                    <FormField
                      label="Access Token"
                      value={form.accessToken}
                      onChange={(v) => setForm((f) => ({ ...f, accessToken: v }))}
                      placeholder="Bearer token from Adobe Developer Console"
                      type={showToken ? 'text' : 'password'}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="absolute right-3 top-8 text-slate-500 hover:text-slate-300"
                      aria-label={showToken ? 'Hide token' : 'Show token'}
                    >
                      {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  <div className="flex items-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={triggerDeploy}
                      disabled={!form.programId || !form.accessToken}
                      className={cn(
                        'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors',
                        form.programId && form.accessToken
                          ? 'bg-blue-600 hover:bg-blue-500'
                          : 'cursor-not-allowed bg-slate-700 text-slate-500',
                      )}
                    >
                      <Rocket className="h-4 w-4" />
                      Trigger Pipeline
                    </button>
                    <button
                      type="button"
                      onClick={() => setState({ phase: 'idle' })}
                      className="rounded-lg px-4 py-2 text-sm text-slate-400 transition-colors hover:text-slate-200"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Triggering — loading state */}
              {state.phase === 'triggering' && (
                <div className="flex items-center gap-3 py-4 text-sm text-slate-400">
                  <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
                  Triggering Cloud Manager pipeline...
                </div>
              )}

              {/* Polling / Finished — step list */}
              {(state.phase === 'polling' || state.phase === 'finished') && (
                <div className="space-y-3">
                  {/* Execution summary */}
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>
                      Pipeline {state.pipelineId} &middot; Execution {state.executionId}
                    </span>
                    {state.phase === 'polling' && (
                      <span className="flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Polling every 10s
                      </span>
                    )}
                  </div>

                  {/* Steps */}
                  {state.steps && state.steps.length > 0 ? (
                    <div className="space-y-1">
                      {state.steps.map((step) => (
                        <div
                          key={step.id}
                          className={cn(
                            'flex items-center justify-between rounded-lg px-3 py-2 text-sm',
                            step.status === 'RUNNING'
                              ? 'bg-blue-500/5 border border-blue-500/20'
                              : step.status === 'ERROR' || step.status === 'FAILED'
                                ? 'bg-red-500/5 border border-red-500/20'
                                : 'bg-slate-800/30',
                          )}
                        >
                          <div className="flex items-center gap-2.5">
                            {statusIcon(step.status)}
                            <span className="text-slate-300">{step.name}</span>
                          </div>
                          <span className="text-xs text-slate-500">
                            {step.status === 'FINISHED' && step.finishedAt
                              ? formatDuration(step.startedAt, step.finishedAt)
                              : step.status.toLowerCase().replace('_', ' ')}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-3 text-center text-xs text-slate-500">
                      Waiting for step information...
                    </div>
                  )}

                  {/* Quality gate failure hint */}
                  {state.phase === 'finished' &&
                    (state.status === 'ERROR' || state.status === 'FAILED') && (
                      <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-300">
                        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400" />
                        <div>
                          <p className="font-medium">Pipeline failed</p>
                          <p className="mt-0.5 text-red-400/80">
                            Check the Cloud Manager console for quality gate details.
                            Failed checks may correspond to findings in the Pre-Flight report.
                          </p>
                        </div>
                      </div>
                    )}

                  {/* Success message */}
                  {state.phase === 'finished' && state.status === 'FINISHED' && (
                    <div className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-300">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" />
                      <div>
                        <p className="font-medium">Deployment successful</p>
                        <p className="mt-0.5 text-emerald-400/80">
                          Pipeline execution completed. Your modernized code is now deployed.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Reset button when finished */}
                  {state.phase === 'finished' && (
                    <button
                      type="button"
                      onClick={() => setState({ phase: 'idle' })}
                      className="mt-2 flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-slate-400 transition-colors hover:text-slate-200"
                    >
                      <Settings className="h-3 w-3" />
                      Deploy again
                    </button>
                  )}
                </div>
              )}

              {/* Error */}
              {state.phase === 'error' && (
                <div className="space-y-3">
                  <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-300">
                    <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400" />
                    <div>
                      <p className="font-medium">Deployment error</p>
                      <p className="mt-1 text-xs text-red-400/80">
                        {state.errorMessage ?? 'An unexpected error occurred'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setState({ phase: 'form' })}
                    className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-slate-400 transition-colors hover:text-slate-200"
                  >
                    <Settings className="h-3 w-3" />
                    Try again
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────

function FormField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-400">
        {label}
        {required && <span className="ml-0.5 text-red-400">*</span>}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder-slate-600 transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
      />
    </label>
  );
}

function formatDuration(start?: string, end?: string): string {
  if (!start || !end) return '';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return '<1s';
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}
