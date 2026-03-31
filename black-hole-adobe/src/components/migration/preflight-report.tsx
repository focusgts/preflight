'use client';

/**
 * Pre-Flight Report Component (ADR-036)
 *
 * Displays Cloud Manager pre-flight analysis results for a migration.
 * Fetches the latest report on mount; allows triggering a new check.
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  ShieldAlert,
  Loader2,
  RefreshCw,
  AlertTriangle,
  AlertOctagon,
  Info,
  ChevronDown,
  ChevronRight,
  FileWarning,
  Rocket,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type {
  PreFlightReport,
  PreFlightFinding,
  PreFlightSeverity,
  PreFlightCategory,
} from '@/lib/preflight/cloud-manager-rules';

// ── Types ────────────────────────────────────────────────────────────────

type ComponentState = 'loading' | 'no-report' | 'running' | 'ready' | 'error';

interface PreFlightReportProps {
  migrationId: string;
}

interface ApiResponse<T> {
  data?: T;
  error?: { code: string; message: string };
}

// ── Severity helpers ─────────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<
  PreFlightSeverity,
  { label: string; color: string; bg: string; border: string; icon: typeof AlertOctagon }
> = {
  blocker: {
    label: 'Blocker',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    icon: AlertOctagon,
  },
  critical: {
    label: 'Critical',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
    icon: AlertTriangle,
  },
  major: {
    label: 'Major',
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    icon: FileWarning,
  },
  minor: {
    label: 'Minor',
    color: 'text-slate-400',
    bg: 'bg-slate-500/10',
    border: 'border-slate-500/30',
    icon: Info,
  },
};

const CATEGORY_LABELS: Record<PreFlightCategory, string> = {
  sonarqube: 'SonarQube Custom Rules',
  oakpal: 'OakPAL Index Validation',
  'java-compat': 'Java Runtime Compatibility',
};

// ── Gauge component ──────────────────────────────────────────────────────

function SuccessGauge({ probability }: { probability: number }) {
  const pct = Math.round(probability);
  const size = 140;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (pct / 100) * circumference;

  let color: string;
  let glow: string;
  if (pct >= 80) {
    color = '#10b981';
    glow = 'drop-shadow(0 0 8px rgba(16, 185, 129, 0.4))';
  } else if (pct >= 50) {
    color = '#f59e0b';
    glow = 'drop-shadow(0 0 8px rgba(245, 158, 11, 0.4))';
  } else {
    color = '#f43f5e';
    glow = 'drop-shadow(0 0 8px rgba(244, 63, 94, 0.4))';
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          className="-rotate-90"
          style={{ filter: glow }}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="rgb(30 41 59)"
            strokeWidth={strokeWidth}
            fill="none"
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.2, ease: 'easeOut', delay: 0.2 }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className="text-3xl font-bold text-white"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            {pct}%
          </motion.span>
          <span className="text-[10px] text-slate-500 uppercase tracking-wider">
            success
          </span>
        </div>
      </div>
      <span className="text-xs text-slate-400">Deployment Probability</span>
    </div>
  );
}

// ── Severity badge ───────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: PreFlightSeverity }) {
  const config = SEVERITY_CONFIG[severity];
  const Icon = config.icon;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium border',
        config.bg,
        config.color,
        config.border,
      )}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}

// ── Severity counter pill ────────────────────────────────────────────────

function SeverityCount({
  severity,
  count,
}: {
  severity: PreFlightSeverity;
  count: number;
}) {
  const config = SEVERITY_CONFIG[severity];
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg border px-3 py-2',
        config.bg,
        config.border,
      )}
    >
      <span className={cn('text-lg font-bold', config.color)}>{count}</span>
      <span className={cn('text-xs', config.color)}>{config.label}s</span>
    </div>
  );
}

// ── Finding row ──────────────────────────────────────────────────────────

function FindingRow({ finding }: { finding: PreFlightFinding }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border-b border-slate-800/50 last:border-b-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-800/30 transition-colors"
      >
        <div className="mt-0.5">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-slate-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-slate-500" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <SeverityBadge severity={finding.severity} />
            <span className="font-mono text-xs text-slate-500">
              {finding.ruleId}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-300">{finding.message}</p>
          <p className="mt-0.5 text-xs text-slate-500 truncate">
            {finding.filePath}
            {finding.line != null && `:${finding.line}`}
          </p>
        </div>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="ml-11 mr-4 mb-3 rounded-lg border border-slate-700 bg-slate-800/50 p-3">
              <p className="text-xs font-medium text-slate-400 mb-1">
                Remediation
              </p>
              <p className="text-sm text-slate-300">{finding.remediation}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Category group ───────────────────────────────────────────────────────

function CategoryGroup({
  category,
  findings,
}: {
  category: PreFlightCategory;
  findings: PreFlightFinding[];
}) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex w-full items-center gap-3 px-4 py-3 hover:bg-slate-800/30 transition-colors"
      >
        {collapsed ? (
          <ChevronRight className="h-4 w-4 text-slate-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-500" />
        )}
        <span className="text-sm font-medium text-slate-200">
          {CATEGORY_LABELS[category]}
        </span>
        <span className="ml-auto rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
          {findings.length} finding{findings.length !== 1 ? 's' : ''}
        </span>
      </button>
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-slate-800">
              {findings.map((f, i) => (
                <FindingRow key={`${f.ruleId}-${f.filePath}-${i}`} finding={f} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
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
  const [report, setReport] = useState<PreFlightReport | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    setState('loading');
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/migrations/${migrationId}/preflight`);
      const body: ApiResponse<PreFlightReport> = await res.json();

      if (res.ok && body.data) {
        setReport(body.data);
        setState('ready');
      } else if (res.status === 404 && body.error?.code === 'NO_REPORT') {
        setState('no-report');
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
      const body: ApiResponse<PreFlightReport> = await res.json();

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

  // ── Error ──────────────────────────────────────────────────────────────
  if (state === 'error') {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
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
      </div>
    );
  }

  // ── Report ready ───────────────────────────────────────────────────────
  if (!report) return null;

  const grouped = groupFindingsByCategory(report.findings);
  const topBlockerFindings = report.findings
    .filter((f) => f.severity === 'blocker')
    .slice(0, 3);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-cyan-400" />
          <h2 className="text-lg font-semibold text-white">
            Cloud Manager Pre-Flight
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">
            {new Date(report.timestamp).toLocaleString()}
          </span>
          <button
            onClick={runCheck}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
          >
            <RefreshCw className="h-3 w-3" />
            Re-run
          </button>
        </div>
      </div>

      {/* Overview row */}
      <div className="flex flex-col md:flex-row items-start gap-8">
        {/* Gauge */}
        <SuccessGauge probability={report.successProbability} />

        {/* Summary stats */}
        <div className="flex-1 space-y-4">
          <div className="text-sm text-slate-300">
            <span className="font-semibold text-white">
              {report.totalRulesChecked}
            </span>{' '}
            rules checked &mdash;{' '}
            <span className="text-emerald-400 font-medium">
              {report.passCount} pass
            </span>
            ,{' '}
            <span className="text-red-400 font-medium">
              {report.failCount} fail
            </span>
            {report.warningCount > 0 && (
              <>
                ,{' '}
                <span className="text-yellow-400 font-medium">
                  {report.warningCount} warning{report.warningCount !== 1 ? 's' : ''}
                </span>
              </>
            )}
          </div>

          {/* Severity counters */}
          <div className="flex flex-wrap gap-3">
            <SeverityCount severity="blocker" count={report.summary.blockers} />
            <SeverityCount severity="critical" count={report.summary.criticals} />
            <SeverityCount severity="major" count={report.summary.majors} />
            <SeverityCount severity="minor" count={report.summary.minors} />
          </div>

          {/* BPA note */}
          {report.bpaComparisonNote && (
            <div className="flex items-start gap-2 rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-3 py-2">
              <Info className="h-4 w-4 text-cyan-400 mt-0.5 shrink-0" />
              <p className="text-xs text-cyan-300">
                {report.bpaComparisonNote}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Top blockers */}
      {topBlockerFindings.length > 0 && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-medium text-red-400">
            <AlertOctagon className="h-4 w-4" />
            Top Blockers
          </h3>
          <ul className="space-y-1.5">
            {topBlockerFindings.map((f, i) => (
              <li
                key={`top-${i}`}
                className="flex items-start gap-2 text-sm text-red-300"
              >
                <span className="shrink-0 mt-1 h-1.5 w-1.5 rounded-full bg-red-400" />
                <span>
                  <span className="font-mono text-xs text-red-400/70">
                    {f.ruleId}
                  </span>{' '}
                  {f.message}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Findings by category */}
      {report.findings.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-slate-300">
            Findings by Category
          </h3>
          {(Object.entries(grouped) as [PreFlightCategory, PreFlightFinding[]][]).map(
            ([cat, findings]) => (
              <CategoryGroup
                key={cat}
                category={cat}
                findings={findings}
              />
            ),
          )}
        </div>
      )}

      {/* No findings */}
      {report.findings.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-8">
          <div className="rounded-full bg-emerald-500/10 p-3">
            <ShieldCheck className="h-6 w-6 text-emerald-400" />
          </div>
          <p className="text-sm text-emerald-300 font-medium">
            All quality gates passed
          </p>
          <p className="text-xs text-slate-500">
            No issues found. Your code is ready for Cloud Manager deployment.
          </p>
        </div>
      )}
    </motion.div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────

function groupFindingsByCategory(
  findings: PreFlightFinding[],
): Partial<Record<PreFlightCategory, PreFlightFinding[]>> {
  const map: Partial<Record<PreFlightCategory, PreFlightFinding[]>> = {};
  for (const f of findings) {
    if (!map[f.category]) {
      map[f.category] = [];
    }
    map[f.category]!.push(f);
  }
  // Sort each group: blockers first, then critical, major, minor
  const order: PreFlightSeverity[] = ['blocker', 'critical', 'major', 'minor'];
  for (const cat of Object.keys(map) as PreFlightCategory[]) {
    map[cat]!.sort(
      (a, b) => order.indexOf(a.severity) - order.indexOf(b.severity),
    );
  }
  return map;
}
