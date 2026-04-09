'use client';

/**
 * Pre-Flight Report Component (ADR-036)
 *
 * Migration-linked wrapper around the shared <PreFlightReportView />.
 * Fetches the latest report for a migration on mount and allows
 * re-running the check. All presentation lives in the view component
 * (src/components/preflight/preflight-report-view.tsx) so the public
 * /preflight page (ADR-064) can reuse it.
 */

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ShieldCheck,
  ShieldAlert,
  Loader2,
  RefreshCw,
  AlertTriangle,
  Rocket,
} from 'lucide-react';
import type { PreFlightReport as PreFlightReportType } from '@/lib/preflight/cloud-manager-rules';
import { PreFlightReportView } from '@/components/preflight/preflight-report-view';

// ── Types ────────────────────────────────────────────────────────────────

type ComponentState = 'loading' | 'no-report' | 'running' | 'ready' | 'error' | 'migration-not-found';

interface PreFlightReportProps {
  migrationId: string;
}

interface ApiResponse<T> {
  data?: T;
  error?: { code: string; message: string };
}

// ── Skeleton ─────────────────────────────────────────────────────────────

function ReportSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-8">
        <div className="h-[140px] w-[140px] animate-pulse rounded-full bg-slate-800" />
        <div className="flex-1 space-y-3">
          <div className="h-4 w-48 animate-pulse rounded bg-slate-800" />
          <div className="h-3 w-64 animate-pulse rounded bg-slate-800" />
          <div className="flex gap-3 mt-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-12 w-24 animate-pulse rounded-lg bg-slate-800"
              />
            ))}
          </div>
        </div>
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-14 animate-pulse rounded-xl bg-slate-800"
          />
        ))}
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────

export function PreFlightReport({ migrationId }: PreFlightReportProps) {
  const [state, setState] = useState<ComponentState>('loading');
  const [report, setReport] = useState<PreFlightReportType | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    setState('loading');
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/migrations/${migrationId}/preflight`);
      const body: ApiResponse<PreFlightReportType> = await res.json();

      if (res.ok && body.data) {
        setReport(body.data);
        setState('ready');
      } else if (res.status === 404 && body.error?.code === 'NO_REPORT') {
        setState('no-report');
      } else if (
        res.status === 404 &&
        (body.error?.code === 'NOT_FOUND' ||
          (body.error?.message?.toLowerCase().includes('migration') &&
            body.error?.message?.toLowerCase().includes('not found')))
      ) {
        setState('migration-not-found');
      } else {
        setErrorMsg(body.error?.message ?? 'Unknown error');
        setState('error');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to fetch report');
      setState('error');
    }
  }, [migrationId]);

  const runCheck = useCallback(async () => {
    setState('running');
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/migrations/${migrationId}/preflight`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const body: ApiResponse<PreFlightReportType> = await res.json();

      if (res.ok && body.data) {
        setReport(body.data);
        setState('ready');
      } else {
        setErrorMsg(body.error?.message ?? 'Pre-flight check failed');
        setState('error');
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to run pre-flight check',
      );
      setState('error');
    }
  }, [migrationId]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // ── Loading ────────────────────────────────────────────────────────────
  if (state === 'loading') {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <div className="flex items-center gap-2 mb-6">
          <ShieldCheck className="h-5 w-5 text-cyan-400" />
          <h2 className="text-lg font-semibold text-white">
            Cloud Manager Pre-Flight
          </h2>
        </div>
        <ReportSkeleton />
      </div>
    );
  }

  // ── No report ──────────────────────────────────────────────────────────
  if (state === 'no-report') {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <div className="flex items-center gap-2 mb-6">
          <ShieldCheck className="h-5 w-5 text-cyan-400" />
          <h2 className="text-lg font-semibold text-white">
            Cloud Manager Pre-Flight
          </h2>
        </div>
        <div className="flex flex-col items-center gap-4 py-12">
          <div className="rounded-full bg-cyan-500/10 p-4">
            <Rocket className="h-8 w-8 text-cyan-400" />
          </div>
          <div className="text-center max-w-sm">
            <p className="text-sm font-medium text-slate-300">
              No pre-flight report yet
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Run a pre-flight check to validate your code against Cloud Manager
              quality gates that BPA does not cover, including SonarQube custom
              rules, OakPAL index checks, and Java runtime compatibility.
            </p>
          </div>
          <button
            onClick={runCheck}
            className="flex items-center gap-2 rounded-lg bg-cyan-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-cyan-500 transition-colors shadow-lg shadow-cyan-500/20"
          >
            <ShieldCheck className="h-4 w-4" />
            Run Pre-Flight Check
          </button>
        </div>
      </div>
    );
  }

  // ── Running ────────────────────────────────────────────────────────────
  if (state === 'running') {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <div className="flex items-center gap-2 mb-6">
          <ShieldCheck className="h-5 w-5 text-cyan-400" />
          <h2 className="text-lg font-semibold text-white">
            Cloud Manager Pre-Flight
          </h2>
        </div>
        <div className="flex flex-col items-center gap-4 py-12">
          <Loader2 className="h-10 w-10 text-cyan-400 animate-spin" />
          <div className="text-center">
            <p className="text-sm font-medium text-slate-300">
              Running pre-flight analysis...
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Checking SonarQube rules, OakPAL indexes, and Java compatibility
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Migration not found ────────────────────────────────────────────────
  if (state === 'migration-not-found') {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <div className="flex items-center gap-2 mb-6">
          <ShieldAlert className="h-5 w-5 text-amber-400" />
          <h2 className="text-lg font-semibold text-white">
            Cloud Manager Pre-Flight
          </h2>
        </div>
        <div className="flex flex-col items-center gap-4 py-8 text-center max-w-md mx-auto">
          <div className="rounded-full bg-amber-500/10 p-3">
            <AlertTriangle className="h-6 w-6 text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-amber-300">
              That migration no longer exists
            </p>
            <p className="mt-1 text-xs text-slate-400">
              The migration ID{' '}
              <span className="font-mono text-slate-300">{migrationId}</span>{' '}
              was not found. It may have been deleted, or the link you followed
              is out of date.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full">
            <a
              href="/migrations"
              className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 transition-colors text-center"
            >
              Back to migrations
            </a>
            <a
              href="/migrations/new/code"
              className="flex-1 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-300 hover:bg-cyan-500/20 transition-colors text-center"
            >
              Run standalone check
            </a>
          </div>
        </div>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────
  if (state === 'error') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6"
      >
        <div className="flex items-center gap-2 mb-6">
          <ShieldAlert className="h-5 w-5 text-red-400" />
          <h2 className="text-lg font-semibold text-white">
            Cloud Manager Pre-Flight
          </h2>
        </div>
        <div className="flex flex-col items-center gap-4 py-8">
          <div className="rounded-full bg-red-500/10 p-3">
            <AlertTriangle className="h-6 w-6 text-red-400" />
          </div>
          <div className="text-center max-w-sm">
            <p className="text-sm font-medium text-red-300">
              Pre-flight check failed
            </p>
            <p className="mt-1 text-xs text-red-400/70">{errorMsg}</p>
          </div>
          <button
            onClick={fetchReport}
            className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </div>
      </motion.div>
    );
  }

  // ── Report ready ───────────────────────────────────────────────────────
  if (!report) return null;

  return (
    <PreFlightReportView
      report={report}
      headerRight={
        <button
          onClick={runCheck}
          className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
        >
          <RefreshCw className="h-3 w-3" />
          Re-run
        </button>
      }
    />
  );
}
