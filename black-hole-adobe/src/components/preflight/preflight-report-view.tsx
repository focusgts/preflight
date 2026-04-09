'use client';

/**
 * PreFlightReportView — presentational Cloud Manager pre-flight results
 *
 * Pure display component extracted from the migration-linked
 * <PreFlightReport /> so it can be reused by the public /preflight page
 * (ADR-064) without dragging migration fetching logic along.
 *
 * Takes a fully-formed PreFlightReport and renders the gauge, severity
 * counters, top blockers, and grouped findings. Caller owns loading /
 * error / refresh state.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  AlertTriangle,
  AlertOctagon,
  Info,
  ChevronDown,
  ChevronRight,
  FileWarning,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type {
  PreFlightReport,
  PreFlightFinding,
  PreFlightSeverity,
  PreFlightCategory,
} from '@/lib/preflight/cloud-manager-rules';

// ── Severity config (shared) ─────────────────────────────────────────────

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

// ── Gauge ────────────────────────────────────────────────────────────────

export function SuccessGauge({ probability }: { probability: number }) {
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

// ── Badges ───────────────────────────────────────────────────────────────

export function SeverityBadge({ severity }: { severity: PreFlightSeverity }) {
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

export function SeverityCount({
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

// ── Helpers ──────────────────────────────────────────────────────────────

export function groupFindingsByCategory(
  findings: PreFlightFinding[],
): Partial<Record<PreFlightCategory, PreFlightFinding[]>> {
  const map: Partial<Record<PreFlightCategory, PreFlightFinding[]>> = {};
  for (const f of findings) {
    if (!map[f.category]) {
      map[f.category] = [];
    }
    map[f.category]!.push(f);
  }
  const order: PreFlightSeverity[] = ['blocker', 'critical', 'major', 'minor'];
  for (const cat of Object.keys(map) as PreFlightCategory[]) {
    map[cat]!.sort(
      (a, b) => order.indexOf(a.severity) - order.indexOf(b.severity),
    );
  }
  return map;
}

// ── Main view ────────────────────────────────────────────────────────────

interface PreFlightReportViewProps {
  report: PreFlightReport;
  /** Optional node rendered in the header's right slot (e.g. a "Re-run" button). */
  headerRight?: React.ReactNode;
  /** Hide the timestamp (useful for public page where runs are ephemeral). */
  hideTimestamp?: boolean;
  /** Show the overall heading (default true). */
  showHeading?: boolean;
}

export function PreFlightReportView({
  report,
  headerRight,
  hideTimestamp = false,
  showHeading = true,
}: PreFlightReportViewProps) {
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
      {(showHeading || headerRight || !hideTimestamp) && (
        <div className="flex items-center justify-between">
          {showHeading ? (
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-cyan-400" />
              <h2 className="text-lg font-semibold text-white">
                Cloud Manager Pre-Flight
              </h2>
            </div>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-3">
            {!hideTimestamp && (
              <span className="text-xs text-slate-500">
                {new Date(report.timestamp).toLocaleString()}
              </span>
            )}
            {headerRight}
          </div>
        </div>
      )}

      {/* Overview row */}
      <div className="flex flex-col md:flex-row items-start gap-8">
        <SuccessGauge probability={report.successProbability} />

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

          <div className="flex flex-wrap gap-3">
            <SeverityCount severity="blocker" count={report.summary.blockers} />
            <SeverityCount severity="critical" count={report.summary.criticals} />
            <SeverityCount severity="major" count={report.summary.majors} />
            <SeverityCount severity="minor" count={report.summary.minors} />
          </div>

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
              <CategoryGroup key={cat} category={cat} findings={findings} />
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
