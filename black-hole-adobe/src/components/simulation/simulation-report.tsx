'use client';

/**
 * Simulation Report Component
 *
 * Displays the full simulation report with confidence ring,
 * phase predictions, issues, timeline, and recommendation.
 */

import { motion } from 'framer-motion';
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
  ArrowRight,
  Shield,
  Zap,
  FileCode,
  FolderOpen,
  Link2,
  ClipboardCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { RiskMatrix } from './risk-matrix';
import type {
  SimulationReport as ReportType,
  SimulationResult,
  SimulationIssue,
  SimulationPhase,
  ComparisonData,
} from '@/types/simulation';
import { Severity } from '@/types';

interface SimulationReportProps {
  report: ReportType;
}

const PHASE_ICONS: Record<SimulationPhase, typeof FileCode> = {
  assessment: Shield,
  code_modernization: FileCode,
  content_migration: FolderOpen,
  integration_reconnection: Link2,
  validation: ClipboardCheck,
};

const PHASE_LABELS: Record<SimulationPhase, string> = {
  assessment: 'Assessment',
  code_modernization: 'Code Modernization',
  content_migration: 'Content Migration',
  integration_reconnection: 'Integration Reconnection',
  validation: 'Validation',
};

const OUTCOME_CONFIG = {
  success: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Success' },
  partial_success: { color: 'text-amber-400', bg: 'bg-amber-500/10', label: 'Partial' },
  failure: { color: 'text-rose-400', bg: 'bg-rose-500/10', label: 'Failure' },
};

const PREDICTION_CONFIG = {
  will_succeed: { color: 'text-emerald-400', ringColor: 'stroke-emerald-500', label: 'Migration will succeed', icon: CheckCircle },
  likely_succeed: { color: 'text-blue-400', ringColor: 'stroke-blue-500', label: 'Migration likely to succeed', icon: CheckCircle },
  needs_attention: { color: 'text-amber-400', ringColor: 'stroke-amber-500', label: 'Needs attention before proceeding', icon: AlertTriangle },
  high_risk: { color: 'text-rose-400', ringColor: 'stroke-rose-500', label: 'High risk - address issues first', icon: XCircle },
};

const SEVERITY_ORDER: Severity[] = [Severity.CRITICAL, Severity.HIGH, Severity.MEDIUM, Severity.LOW, Severity.INFO];

export function SimulationReportDisplay({ report }: SimulationReportProps) {
  const prediction = PREDICTION_CONFIG[report.overallPrediction];
  const PredictionIcon = prediction.icon;
  const confidencePct = Math.round(report.overallConfidence * 100);

  return (
    <div className="space-y-6">
      {/* Overall Prediction */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-slate-700 bg-slate-800/50 p-6"
      >
        <div className="flex items-center gap-6">
          {/* Confidence Ring */}
          <div className="relative h-28 w-28 flex-shrink-0">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50" cy="50" r="42"
                fill="none"
                stroke="currentColor"
                strokeWidth="6"
                className="text-slate-700"
              />
              <motion.circle
                cx="50" cy="50" r="42"
                fill="none"
                strokeWidth="6"
                strokeLinecap="round"
                className={prediction.ringColor}
                strokeDasharray={`${2 * Math.PI * 42}`}
                initial={{ strokeDashoffset: 2 * Math.PI * 42 }}
                animate={{
                  strokeDashoffset: 2 * Math.PI * 42 * (1 - report.overallConfidence),
                }}
                transition={{ duration: 1.5, ease: 'easeOut' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={cn('text-2xl font-bold', prediction.color)}>
                {confidencePct}%
              </span>
              <span className="text-[10px] text-slate-400">confidence</span>
            </div>
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <PredictionIcon className={cn('h-5 w-5', prediction.color)} />
              <h3 className={cn('text-lg font-semibold', prediction.color)}>
                {prediction.label}
              </h3>
            </div>
            <p className="text-sm text-slate-400">
              Simulation analyzed {report.changesSummary.totalItemsCount} changes
              across {report.phaseBreakdowns.length} phases.
              {report.riskMatrix.length > 0 && (
                <> Found {report.riskMatrix.length} risk factor(s).</>
              )}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Phase Predictions */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-slate-300">Phase Predictions</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {report.phaseBreakdowns.map((result, idx) => (
            <PhaseCard key={result.phase} result={result} index={idx} />
          ))}
        </div>
      </div>

      {/* Changes Summary */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="rounded-xl border border-slate-700 bg-slate-800/50 p-4"
      >
        <h4 className="text-sm font-medium text-slate-300 mb-3">What Would Change</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <ChangeStatBadge label="Pages moved" value={report.changesSummary.pagesMovedCount} />
          <ChangeStatBadge label="Configs converted" value={report.changesSummary.configsConvertedCount} />
          <ChangeStatBadge label="APIs replaced" value={report.changesSummary.apisReplacedCount} />
          <ChangeStatBadge label="Assets transferred" value={report.changesSummary.assetsTransferredCount} />
          <ChangeStatBadge label="Code files modified" value={report.changesSummary.codeFilesModifiedCount} />
          <ChangeStatBadge label="Integrations" value={report.changesSummary.integrationsReconnectedCount} />
        </div>
      </motion.div>

      {/* Risk Matrix */}
      {report.riskMatrix.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="rounded-xl border border-slate-700 bg-slate-800/50 p-4"
        >
          <h4 className="text-sm font-medium text-slate-300 mb-3">Risk Matrix</h4>
          <RiskMatrix risks={report.riskMatrix} />
        </motion.div>
      )}

      {/* Issues */}
      <IssuesList results={report.phaseBreakdowns} />

      {/* Timeline */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="rounded-xl border border-slate-700 bg-slate-800/50 p-4"
      >
        <h4 className="text-sm font-medium text-slate-300 mb-3">Timeline Prediction</h4>
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-blue-400" />
            <span className="text-sm text-slate-400">Black Hole:</span>
            <span className="text-lg font-bold text-blue-400">
              {report.timelinePrediction.estimatedWeeks} weeks
            </span>
          </div>
          <ArrowRight className="h-4 w-4 text-slate-600" />
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-slate-500" />
            <span className="text-sm text-slate-400">Traditional:</span>
            <span className="text-lg font-bold text-slate-500 line-through">
              {report.timelinePrediction.traditionalWeeks} weeks
            </span>
          </div>
          <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
            {report.timelinePrediction.timeSavingsPercent}% faster
          </span>
        </div>
        <div className="space-y-2">
          {report.timelinePrediction.phaseTimelines.map((pt) => (
            <div key={pt.phase} className="flex items-center gap-3">
              <span className="w-44 text-xs text-slate-400">{PHASE_LABELS[pt.phase]}</span>
              <div className="flex-1 h-2 rounded-full bg-slate-700 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{
                    width: `${Math.min(100, (pt.estimatedHours / Math.max(...report.timelinePrediction.phaseTimelines.map((t) => t.estimatedHours), 1)) * 100)}%`,
                  }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                  className="h-full rounded-full bg-blue-500/50"
                />
              </div>
              <span className="w-16 text-right text-xs text-slate-400 font-mono">
                {pt.estimatedHours.toFixed(1)}h
              </span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Recommendation */}
      <RecommendationBanner report={report} />

      {/* Comparison (if available) */}
      {report.comparisonData && (
        <ComparisonPanel data={report.comparisonData} />
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────

function PhaseCard({ result, index }: { result: SimulationResult; index: number }) {
  const outcome = OUTCOME_CONFIG[result.predictedOutcome];
  const Icon = PHASE_ICONS[result.phase];
  const confidencePct = Math.round(result.confidence * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="rounded-lg border border-slate-700 bg-slate-800/40 p-3 space-y-2"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-200">
            {PHASE_LABELS[result.phase]}
          </span>
        </div>
        <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', outcome.bg, outcome.color)}>
          {outcome.label}
        </span>
      </div>

      <div className="flex items-center gap-3">
        {/* Confidence bar */}
        <div className="flex-1 h-1.5 rounded-full bg-slate-700 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${confidencePct}%` }}
            transition={{ duration: 0.8, delay: 0.3 + index * 0.1 }}
            className={cn(
              'h-full rounded-full',
              confidencePct >= 80 ? 'bg-emerald-500' : confidencePct >= 60 ? 'bg-amber-500' : 'bg-rose-500',
            )}
          />
        </div>
        <span className="text-xs font-mono text-slate-400">{confidencePct}%</span>
      </div>

      <div className="flex items-center gap-3 text-xs text-slate-400">
        <span>{result.itemsAffected} items</span>
        {result.issuesFound.length > 0 && (
          <span className="text-amber-400">{result.issuesFound.length} issues</span>
        )}
        {result.itemsBlocker > 0 && (
          <span className="text-rose-400">{result.itemsBlocker} blockers</span>
        )}
      </div>
    </motion.div>
  );
}

function ChangeStatBadge({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center space-y-1">
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="block text-xl font-bold text-slate-200"
      >
        {value}
      </motion.span>
      <span className="block text-[10px] text-slate-400 leading-tight">{label}</span>
    </div>
  );
}

function IssuesList({ results }: { results: SimulationResult[] }) {
  const allIssues = results.flatMap((r) => r.issuesFound);
  if (allIssues.length === 0) return null;

  const grouped = new Map<Severity, SimulationIssue[]>();
  for (const issue of allIssues) {
    const existing = grouped.get(issue.severity) ?? [];
    existing.push(issue);
    grouped.set(issue.severity, existing);
  }

  const severityColors: Record<string, string> = {
    critical: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    high: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
    medium: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    low: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    info: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.5 }}
      className="rounded-xl border border-slate-700 bg-slate-800/50 p-4"
    >
      <h4 className="text-sm font-medium text-slate-300 mb-3">
        Issues Found ({allIssues.length})
      </h4>
      <div className="space-y-3">
        {SEVERITY_ORDER.map((severity) => {
          const issues = grouped.get(severity);
          if (!issues || issues.length === 0) return null;

          return (
            <div key={severity} className="space-y-1">
              <div className="flex items-center gap-2">
                <span className={cn('text-xs font-medium uppercase px-2 py-0.5 rounded border', severityColors[severity])}>
                  {severity} ({issues.length})
                </span>
              </div>
              {issues.slice(0, 5).map((issue) => (
                <div key={issue.id} className="flex items-start gap-2 pl-4 py-1">
                  <span className="text-xs text-slate-300">{issue.title}</span>
                  {issue.autoFixable && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 whitespace-nowrap">
                      auto-fix
                    </span>
                  )}
                </div>
              ))}
              {issues.length > 5 && (
                <p className="pl-4 text-xs text-slate-500">
                  +{issues.length - 5} more
                </p>
              )}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

function RecommendationBanner({ report }: { report: ReportType }) {
  const topRec = report.recommendations[0];
  if (!topRec) return null;

  const isProceed = topRec.action === 'proceed';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.7 }}
      className={cn(
        'rounded-xl border p-4',
        isProceed
          ? 'border-emerald-500/30 bg-emerald-500/5'
          : 'border-amber-500/30 bg-amber-500/5',
      )}
    >
      <div className="flex items-center gap-3">
        {isProceed ? (
          <CheckCircle className="h-5 w-5 text-emerald-400" />
        ) : (
          <AlertTriangle className="h-5 w-5 text-amber-400" />
        )}
        <div>
          <p className={cn('text-sm font-medium', isProceed ? 'text-emerald-300' : 'text-amber-300')}>
            {topRec.title}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">{topRec.description}</p>
        </div>
      </div>
    </motion.div>
  );
}

function ComparisonPanel({ data }: { data: ComparisonData }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="rounded-xl border border-slate-700 bg-slate-800/50 p-4"
    >
      <h4 className="text-sm font-medium text-slate-300 mb-3">
        Predicted vs Actual
      </h4>
      <div className="grid grid-cols-3 gap-4">
        <ComparisonStat
          label="Duration (weeks)"
          predicted={data.predictedDuration}
          actual={data.actualDuration}
        />
        <ComparisonStat
          label="Issues Found"
          predicted={data.predictedIssueCount}
          actual={data.actualIssueCount}
        />
        <ComparisonStat
          label="Success Rate %"
          predicted={Math.round(data.predictedSuccessRate)}
          actual={Math.round(data.actualSuccessRate)}
        />
      </div>
      <div className="mt-3 text-center">
        <span className="text-xs text-slate-400">Prediction accuracy: </span>
        <span className={cn(
          'text-sm font-bold',
          data.accuracyScore >= 80 ? 'text-emerald-400' : data.accuracyScore >= 60 ? 'text-amber-400' : 'text-rose-400',
        )}>
          {data.accuracyScore}%
        </span>
      </div>
    </motion.div>
  );
}

function ComparisonStat({
  label,
  predicted,
  actual,
}: {
  label: string;
  predicted: number;
  actual: number;
}) {
  return (
    <div className="text-center space-y-1">
      <span className="text-[10px] text-slate-400">{label}</span>
      <div className="flex items-center justify-center gap-2">
        <span className="text-sm text-slate-300">{predicted}</span>
        <ArrowRight className="h-3 w-3 text-slate-600" />
        <span className="text-sm font-medium text-slate-200">{actual}</span>
      </div>
    </div>
  );
}
