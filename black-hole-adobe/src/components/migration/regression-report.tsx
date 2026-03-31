'use client';

/**
 * Visual Regression Report Component (ADR-034)
 *
 * Displays content-based regression testing results for a migration.
 * Compares source vs target site: page inventory, SEO, content, performance.
 * Fetches latest report on mount; allows triggering a new comparison.
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Eye,
  EyeOff,
  Loader2,
  RefreshCw,
  AlertTriangle,
  AlertOctagon,
  Info,
  ChevronDown,
  ChevronRight,
  Globe,
  Camera,
  Play,
  TrendingDown,
  FileX2,
  ArrowRightLeft,
  Search,
  Gauge,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type {
  RegressionReport as RegressionReportType,
  RegressionIssue,
  IssueSeverity,
  BaselineSnapshot,
} from '@/lib/validation/regression-engine';

// ── Types ────────────────────────────────────────────────────────────────

type ComponentState = 'loading' | 'no-report' | 'running' | 'ready' | 'error';

interface RegressionReportProps {
  migrationId: string;
}

interface ApiResponse<T> {
  data?: T;
  error?: { code: string; message: string };
}

type IssueCategory = RegressionIssue['category'];

// ── Severity config ─────────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<
  IssueSeverity,
  { label: string; color: string; bg: string; border: string; icon: typeof AlertOctagon }
> = {
  critical: {
    label: 'Critical',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    icon: AlertOctagon,
  },
  major: {
    label: 'Major',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
    icon: AlertTriangle,
  },
  minor: {
    label: 'Minor',
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    icon: Info,
  },
};

const CATEGORY_CONFIG: Record<IssueCategory, { label: string; icon: typeof FileX2 }> = {
  missing_page: { label: 'Missing Pages', icon: FileX2 },
  status_change: { label: 'Status Code Changes', icon: ArrowRightLeft },
  seo_regression: { label: 'SEO Regressions', icon: Search },
  content_change: { label: 'Content Changes', icon: Eye },
  performance: { label: 'Performance Regressions', icon: TrendingDown },
  broken_link: { label: 'Broken Links', icon: EyeOff },
  broken_asset: { label: 'Broken Assets', icon: EyeOff },
};

// Category display order (critical categories first)
const CATEGORY_ORDER: IssueCategory[] = [
  'missing_page',
  'status_change',
  'seo_regression',
  'content_change',
  'performance',
  'broken_link',
  'broken_asset',
];

// ── Match Rate Gauge ────────────────────────────────────────────────────

function MatchRateGauge({ rate }: { rate: number }) {
  const pct = Math.round(rate);
  const size = 140;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (pct / 100) * circumference;

  let color: string;
  let glow: string;
  if (pct >= 90) {
    color = '#10b981';
    glow = 'drop-shadow(0 0 8px rgba(16, 185, 129, 0.4))';
  } else if (pct >= 70) {
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
            match
          </span>
        </div>
      </div>
      <span className="text-xs text-slate-400">Page Match Rate</span>
    </div>
  );
}

// ── Severity badge ──────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: IssueSeverity }) {
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

// ── Severity counter pill ───────────────────────────────────────────────

function SeverityCount({
  severity,
  count,
}: {
  severity: IssueSeverity;
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
      <span className={cn('text-xs', config.color)}>{config.label}</span>
    </div>
  );
}

// ── Issue row ───────────────────────────────────────────────────────────

function IssueRow({ issue }: { issue: RegressionIssue }) {
  const [expanded, setExpanded] = useState(false);
  const hasBeforeAfter = issue.sourceValue || issue.targetValue;

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
            <SeverityBadge severity={issue.severity} />
            <span className="font-mono text-xs text-slate-500">
              {issue.field}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-300">{issue.message}</p>
          <p className="mt-0.5 font-mono text-xs text-slate-500 truncate">
            {issue.page}
          </p>
        </div>
      </button>
      <AnimatePresence>
        {expanded && hasBeforeAfter && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="ml-11 mr-4 mb-3 space-y-2">
              {issue.sourceValue && (
                <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-3">
                  <p className="text-xs font-medium text-slate-400 mb-1">
                    Source (before)
                  </p>
                  <p className="font-mono text-sm text-slate-300 break-all">
                    {issue.sourceValue}
                  </p>
                </div>
              )}
              {issue.targetValue && (
                <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-3">
                  <p className="text-xs font-medium text-slate-400 mb-1">
                    Target (after)
                  </p>
                  <p className="font-mono text-sm text-slate-300 break-all">
                    {issue.targetValue}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Category group ──────────────────────────────────────────────────────

function CategoryGroup({
  category,
  issues,
}: {
  category: IssueCategory;
  issues: RegressionIssue[];
}) {
  const [collapsed, setCollapsed] = useState(false);
  const config = CATEGORY_CONFIG[category];
  const Icon = config.icon;

  // Determine dominant severity for the group border color
  const hasCritical = issues.some((i) => i.severity === 'critical');
  const hasMajor = issues.some((i) => i.severity === 'major');
  const borderColor = hasCritical
    ? 'border-red-500/20'
    : hasMajor
      ? 'border-orange-500/20'
      : 'border-yellow-500/20';

  return (
    <div className={cn('rounded-xl border bg-slate-900/60 overflow-hidden', borderColor)}>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex w-full items-center gap-3 px-4 py-3 hover:bg-slate-800/30 transition-colors"
      >
        {collapsed ? (
          <ChevronRight className="h-4 w-4 text-slate-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-500" />
        )}
        <Icon className="h-4 w-4 text-slate-400" />
        <span className="text-sm font-medium text-slate-200">
          {config.label}
        </span>
        <span className="ml-auto rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
          {issues.length} issue{issues.length !== 1 ? 's' : ''}
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
              {issues.map((issue, i) => (
                <IssueRow
                  key={`${issue.category}-${issue.page}-${issue.field}-${i}`}
                  issue={issue}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Skeleton ────────────────────────────────────────────────────────────

function ReportSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-8">
        <div className="h-[140px] w-[140px] animate-pulse rounded-full bg-slate-800" />
        <div className="flex-1 space-y-3">
          <div className="h-4 w-48 animate-pulse rounded bg-slate-800" />
          <div className="h-3 w-64 animate-pulse rounded bg-slate-800" />
          <div className="flex gap-3 mt-4">
            {Array.from({ length: 3 }).map((_, i) => (
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

// ── Run Regression Form ─────────────────────────────────────────────────

function RunRegressionForm({
  onSubmit,
}: {
  onSubmit: (config: {
    sourceUrl: string;
    targetUrl: string;
    pageLimit: number;
    options: { checkSeo: boolean; checkPerformance: boolean; checkContent: boolean };
  }) => void;
}) {
  const [sourceUrl, setSourceUrl] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [pageLimit, setPageLimit] = useState(50);
  const [checkSeo, setCheckSeo] = useState(true);
  const [checkPerformance, setCheckPerformance] = useState(true);
  const [checkContent, setCheckContent] = useState(true);

  const canSubmit = sourceUrl.trim().length > 0 && targetUrl.trim().length > 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            Source URL
          </label>
          <input
            type="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="https://source-site.example.com"
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            Target URL
          </label>
          <input
            type="url"
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            placeholder="https://target-site.example.com"
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            Page Limit
          </label>
          <select
            value={pageLimit}
            onChange={(e) => setPageLimit(Number(e.target.value))}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/30"
          >
            <option value={50}>50 pages</option>
            <option value={200}>200 pages</option>
            <option value={1000}>1,000 pages</option>
          </select>
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={checkSeo}
              onChange={(e) => setCheckSeo(e.target.checked)}
              className="rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500/30"
            />
            Check SEO
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={checkPerformance}
              onChange={(e) => setCheckPerformance(e.target.checked)}
              className="rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500/30"
            />
            Check Performance
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={checkContent}
              onChange={(e) => setCheckContent(e.target.checked)}
              className="rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500/30"
            />
            Check Content
          </label>
        </div>
      </div>

      <button
        onClick={() =>
          onSubmit({
            sourceUrl: sourceUrl.trim(),
            targetUrl: targetUrl.trim(),
            pageLimit,
            options: { checkSeo, checkPerformance, checkContent },
          })
        }
        disabled={!canSubmit}
        className={cn(
          'flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-colors shadow-lg',
          canSubmit
            ? 'bg-cyan-600 hover:bg-cyan-500 shadow-cyan-500/20'
            : 'bg-slate-700 cursor-not-allowed text-slate-500 shadow-none',
        )}
      >
        <Play className="h-4 w-4" />
        Run Test
      </button>
    </div>
  );
}

// ── Baseline section ────────────────────────────────────────────────────

function BaselineSection({ migrationId }: { migrationId: string }) {
  const [baseline, setBaseline] = useState<BaselineSnapshot | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const fetchBaseline = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/migrations/${migrationId}/regression/baseline`,
      );
      const body: ApiResponse<BaselineSnapshot> = await res.json();
      if (res.ok && body.data) {
        setBaseline(body.data);
      }
    } catch {
      // Baseline may not exist yet — that is fine
    } finally {
      setLoaded(true);
    }
  }, [migrationId]);

  useEffect(() => {
    fetchBaseline();
  }, [fetchBaseline]);

  const captureBaseline = async () => {
    setCapturing(true);
    try {
      const res = await fetch(
        `/api/migrations/${migrationId}/regression/baseline`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        },
      );
      const body: ApiResponse<BaselineSnapshot> = await res.json();
      if (res.ok && body.data) {
        setBaseline(body.data);
      }
    } catch {
      // Silent failure for baseline capture
    } finally {
      setCapturing(false);
    }
  };

  if (!loaded) return null;

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera className="h-4 w-4 text-slate-400" />
          <h3 className="text-sm font-medium text-slate-300">
            Source Baseline
          </h3>
        </div>
        {baseline ? (
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>
              Captured {new Date(baseline.capturedAt).toLocaleDateString()}
            </span>
            <span className="text-slate-600">|</span>
            <span>{baseline.pageCount} pages</span>
            <button
              onClick={captureBaseline}
              disabled={capturing}
              className="flex items-center gap-1 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              {capturing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              Recapture
            </button>
          </div>
        ) : (
          <button
            onClick={captureBaseline}
            disabled={capturing}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            {capturing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Camera className="h-3 w-3" />
            )}
            Capture Baseline
          </button>
        )}
      </div>
      {!baseline && (
        <p className="mt-2 text-xs text-slate-600">
          Capture a baseline snapshot of the source site before migration.
          Future regression tests will compare against this baseline for faster results.
        </p>
      )}
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────

export function RegressionReport({ migrationId }: RegressionReportProps) {
  const [state, setState] = useState<ComponentState>('loading');
  const [report, setReport] = useState<RegressionReportType | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    setState('loading');
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/migrations/${migrationId}/regression`);
      const body: ApiResponse<RegressionReportType> = await res.json();

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
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to fetch report',
      );
      setState('error');
    }
  }, [migrationId]);

  const runRegression = useCallback(
    async (config: {
      sourceUrl: string;
      targetUrl: string;
      pageLimit: number;
      options: {
        checkSeo: boolean;
        checkPerformance: boolean;
        checkContent: boolean;
      };
    }) => {
      setState('running');
      setErrorMsg(null);

      try {
        const res = await fetch(`/api/migrations/${migrationId}/regression`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(config),
        });
        const body: ApiResponse<RegressionReportType> = await res.json();

        if (res.ok && body.data) {
          setReport(body.data);
          setState('ready');
        } else {
          setErrorMsg(body.error?.message ?? 'Regression test failed');
          setState('error');
        }
      } catch (err) {
        setErrorMsg(
          err instanceof Error ? err.message : 'Failed to run regression test',
        );
        setState('error');
      }
    },
    [migrationId],
  );

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // ── Loading ───────────────────────────────────────────────────────────
  if (state === 'loading') {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <div className="flex items-center gap-2 mb-6">
          <Gauge className="h-5 w-5 text-cyan-400" />
          <h2 className="text-lg font-semibold text-white">
            Visual Regression
          </h2>
        </div>
        <ReportSkeleton />
      </div>
    );
  }

  // ── No report ─────────────────────────────────────────────────────────
  if (state === 'no-report') {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <div className="flex items-center gap-2 mb-6">
          <Gauge className="h-5 w-5 text-cyan-400" />
          <h2 className="text-lg font-semibold text-white">
            Visual Regression
          </h2>
        </div>
        <div className="space-y-6">
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="rounded-full bg-cyan-500/10 p-4">
              <Globe className="h-8 w-8 text-cyan-400" />
            </div>
            <div className="text-center max-w-md">
              <p className="text-sm font-medium text-slate-300">
                No regression report yet
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Compare your source and target sites to detect missing pages,
                SEO regressions, content changes, and performance issues.
              </p>
            </div>
          </div>
          <RunRegressionForm onSubmit={runRegression} />
          <BaselineSection migrationId={migrationId} />
        </div>
      </div>
    );
  }

  // ── Running ───────────────────────────────────────────────────────────
  if (state === 'running') {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <div className="flex items-center gap-2 mb-6">
          <Gauge className="h-5 w-5 text-cyan-400" />
          <h2 className="text-lg font-semibold text-white">
            Visual Regression
          </h2>
        </div>
        <div className="flex flex-col items-center gap-4 py-12">
          <Loader2 className="h-10 w-10 text-cyan-400 animate-spin" />
          <div className="text-center">
            <p className="text-sm font-medium text-slate-300">
              Running regression analysis...
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Crawling pages, comparing content, checking SEO and performance
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────
  if (state === 'error') {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <div className="flex items-center gap-2 mb-6">
          <Gauge className="h-5 w-5 text-red-400" />
          <h2 className="text-lg font-semibold text-white">
            Visual Regression
          </h2>
        </div>
        <div className="flex flex-col items-center gap-4 py-8">
          <div className="rounded-full bg-red-500/10 p-3">
            <AlertTriangle className="h-6 w-6 text-red-400" />
          </div>
          <div className="text-center max-w-sm">
            <p className="text-sm font-medium text-red-300">
              Regression test failed
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

  // ── Report ready ──────────────────────────────────────────────────────
  if (!report) return null;

  const grouped = groupIssuesByCategory(report.issues);
  const criticalIssues = report.issues
    .filter((i) => i.severity === 'critical')
    .slice(0, 5);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gauge className="h-5 w-5 text-cyan-400" />
          <h2 className="text-lg font-semibold text-white">
            Visual Regression
          </h2>
          <span
            className={cn(
              'ml-2 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider border',
              report.status === 'completed'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : report.status === 'partial'
                  ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
                  : 'bg-red-500/10 text-red-400 border-red-500/30',
            )}
          >
            {report.status}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">
            {new Date(report.executedAt).toLocaleString()}
          </span>
          <button
            onClick={() => setState('no-report')}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
          >
            <RefreshCw className="h-3 w-3" />
            Re-run
          </button>
        </div>
      </div>

      {/* Overview row */}
      <div className="flex flex-col md:flex-row items-start gap-8">
        <MatchRateGauge rate={report.summary.matchRate} />

        <div className="flex-1 space-y-4">
          <div className="text-sm text-slate-300">
            <span className="font-semibold text-white">
              {report.summary.pagesCompared}
            </span>{' '}
            of{' '}
            <span className="font-semibold text-white">
              {report.summary.totalPages}
            </span>{' '}
            pages compared &mdash;{' '}
            <span className="text-emerald-400 font-medium">
              {report.summary.pagesCompared - report.summary.missingPages} matched
            </span>
            {report.summary.missingPages > 0 && (
              <>
                ,{' '}
                <span className="text-red-400 font-medium">
                  {report.summary.missingPages} missing
                </span>
              </>
            )}
            {report.summary.newPages > 0 && (
              <>
                ,{' '}
                <span className="text-cyan-400 font-medium">
                  {report.summary.newPages} new
                </span>
              </>
            )}
          </div>

          {/* Severity counters */}
          <div className="flex flex-wrap gap-3">
            <SeverityCount severity="critical" count={report.summary.criticalIssues} />
            <SeverityCount severity="major" count={report.summary.majorIssues} />
            <SeverityCount severity="minor" count={report.summary.minorIssues} />
          </div>

          {/* Source / Target URLs */}
          <div className="flex items-start gap-2 rounded-lg border border-slate-700/50 bg-slate-800/30 px-3 py-2">
            <ArrowRightLeft className="h-4 w-4 text-slate-500 mt-0.5 shrink-0" />
            <div className="text-xs text-slate-500 space-y-0.5 min-w-0">
              <p className="truncate">
                <span className="text-slate-400">Source:</span>{' '}
                <span className="font-mono">{report.sourceUrl}</span>
              </p>
              <p className="truncate">
                <span className="text-slate-400">Target:</span>{' '}
                <span className="font-mono">{report.targetUrl}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Critical issues highlight */}
      {criticalIssues.length > 0 && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 space-y-2">
          <h3 className="flex items-center gap-2 text-sm font-medium text-red-400">
            <AlertOctagon className="h-4 w-4" />
            Critical Issues
          </h3>
          <ul className="space-y-1.5">
            {criticalIssues.map((issue, i) => (
              <li
                key={`critical-${i}`}
                className="flex items-start gap-2 text-sm text-red-300"
              >
                <span className="shrink-0 mt-1 h-1.5 w-1.5 rounded-full bg-red-400" />
                <span>
                  <span className="font-mono text-xs text-red-400/70">
                    {issue.page}
                  </span>{' '}
                  {issue.message}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Issues by category */}
      {report.issues.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-slate-300">
            Issues by Category
          </h3>
          {CATEGORY_ORDER.filter((cat) => grouped[cat]).map((cat) => (
            <CategoryGroup
              key={cat}
              category={cat}
              issues={grouped[cat]!}
            />
          ))}
        </div>
      )}

      {/* No issues */}
      {report.issues.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-8">
          <div className="rounded-full bg-emerald-500/10 p-3">
            <Eye className="h-6 w-6 text-emerald-400" />
          </div>
          <p className="text-sm text-emerald-300 font-medium">
            No regressions detected
          </p>
          <p className="text-xs text-slate-500">
            All compared pages match between source and target environments.
          </p>
        </div>
      )}

      {/* Baseline section */}
      <BaselineSection migrationId={migrationId} />
    </motion.div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────

function groupIssuesByCategory(
  issues: RegressionIssue[],
): Partial<Record<IssueCategory, RegressionIssue[]>> {
  const map: Partial<Record<IssueCategory, RegressionIssue[]>> = {};
  for (const issue of issues) {
    if (!map[issue.category]) {
      map[issue.category] = [];
    }
    map[issue.category]!.push(issue);
  }
  // Sort each group: critical first, then major, then minor
  const order: IssueSeverity[] = ['critical', 'major', 'minor'];
  for (const cat of Object.keys(map) as IssueCategory[]) {
    map[cat]!.sort(
      (a, b) => order.indexOf(a.severity) - order.indexOf(b.severity),
    );
  }
  return map;
}
