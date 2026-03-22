'use client';

import { motion } from 'framer-motion';
import {
  Shield,
  Code2,
  FileText,
  Plug,
  Settings,
  AlertTriangle,
  Clock,
  DollarSign,
  TrendingDown,
  Lightbulb,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Card } from '@/components/ui/card';
import { ScoreRing } from '@/components/ui/score-ring';
import { ProgressBar } from '@/components/ui/progress-bar';
import { SeverityBadge, Badge } from '@/components/ui/badge';
import { FindingsTable } from './findings-table';
import type { AssessmentResult } from '@/types';

interface ReadinessReportProps {
  assessment: AssessmentResult;
}

function CategoryScore({
  icon: Icon,
  label,
  score,
  index,
}: {
  icon: React.ElementType;
  label: string;
  score: number;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.3 + index * 0.08 }}
      className="flex items-center gap-3"
    >
      <div className="rounded-lg bg-slate-800 p-2">
        <Icon className="h-4 w-4 text-slate-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-slate-300">{label}</span>
          <span className="text-sm font-mono font-medium text-white">{score}</span>
        </div>
        <ProgressBar value={score} size="sm" />
      </div>
    </motion.div>
  );
}

export function ReadinessReport({ assessment }: ReadinessReportProps) {
  const categories = [
    { icon: Code2, label: 'Code Compatibility', score: assessment.codeCompatibilityScore },
    { icon: FileText, label: 'Content Readiness', score: assessment.contentReadinessScore },
    { icon: Plug, label: 'Integration Complexity', score: assessment.integrationComplexityScore },
    { icon: Settings, label: 'Configuration Readiness', score: assessment.configurationReadinessScore },
    { icon: Shield, label: 'Compliance', score: assessment.complianceScore },
  ];

  const criticalCount = assessment.findings.filter(f => f.severity === 'critical').length;
  const highCount = assessment.findings.filter(f => f.severity === 'high').length;
  const autoFixCount = assessment.findings.filter(f => f.autoFixAvailable).length;

  return (
    <div className="space-y-6">
      {/* Top Row: Score + Categories */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Overall Score */}
        <Card className="lg:col-span-1">
          <div className="flex flex-col items-center py-4">
            <ScoreRing score={assessment.overallScore} size={160} strokeWidth={10} />
            <h3 className="mt-4 text-lg font-semibold text-white">Overall Readiness</h3>
            <p className="mt-1 text-sm text-slate-400">
              {assessment.overallScore >= 70
                ? 'Good to proceed with migration'
                : assessment.overallScore >= 40
                ? 'Some issues need attention'
                : 'Significant preparation required'}
            </p>
            <div className="mt-4 flex gap-3">
              <div className="text-center">
                <p className="text-xl font-bold text-rose-400">{criticalCount}</p>
                <p className="text-xs text-slate-500">Critical</p>
              </div>
              <div className="h-8 w-px bg-slate-800" />
              <div className="text-center">
                <p className="text-xl font-bold text-amber-400">{highCount}</p>
                <p className="text-xs text-slate-500">High</p>
              </div>
              <div className="h-8 w-px bg-slate-800" />
              <div className="text-center">
                <p className="text-xl font-bold text-emerald-400">{autoFixCount}</p>
                <p className="text-xs text-slate-500">Auto-fix</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Category Breakdown */}
        <Card className="lg:col-span-2" header={
          <h3 className="text-base font-semibold text-white">Category Breakdown</h3>
        }>
          <div className="space-y-4">
            {categories.map((cat, i) => (
              <CategoryScore key={cat.label} {...cat} index={i} />
            ))}
          </div>
        </Card>
      </div>

      {/* Risk Factors */}
      <Card header={
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-400" />
          <h3 className="text-base font-semibold text-white">Risk Factors</h3>
        </div>
      }>
        <div className="space-y-3">
          {assessment.riskFactors.map((risk, i) => (
            <motion.div
              key={risk.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.08 }}
              className="rounded-lg border border-slate-800 bg-slate-800/30 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <SeverityBadge severity={risk.severity} />
                    <span className="text-xs text-slate-500">{risk.category}</span>
                  </div>
                  <p className="mt-2 text-sm text-white">{risk.description}</p>
                  <p className="mt-1 text-xs text-slate-400">{risk.impact}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs text-slate-500">Probability</p>
                  <p className="font-mono text-sm font-medium text-white">
                    {Math.round(risk.probability * 100)}%
                  </p>
                </div>
              </div>
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-slate-900/50 p-2.5">
                <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-400" />
                <p className="text-xs text-slate-300">{risk.mitigation}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </Card>

      {/* Timeline & Cost Comparison */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Timeline */}
        <Card header={
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-cyan-400" />
            <h3 className="text-base font-semibold text-white">Timeline Comparison</h3>
          </div>
        }>
          <div className="space-y-4">
            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-slate-400">Traditional Approach</span>
                <span className="font-mono text-slate-300">{assessment.traditionalEstimate.durationWeeks} weeks</span>
              </div>
              <div className="h-6 w-full overflow-hidden rounded-full bg-slate-800">
                <motion.div
                  className="h-full rounded-full bg-slate-600"
                  initial={{ width: 0 }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 0.8 }}
                />
              </div>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-slate-400">With Black Hole</span>
                <span className="font-mono text-white">{assessment.estimatedTimeline.totalWeeks} weeks</span>
              </div>
              <div className="h-6 w-full overflow-hidden rounded-full bg-slate-800">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400"
                  initial={{ width: 0 }}
                  animate={{
                    width: `${(assessment.estimatedTimeline.totalWeeks / assessment.traditionalEstimate.durationWeeks) * 100}%`,
                  }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                />
              </div>
            </div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="flex items-center justify-center gap-2 rounded-lg bg-emerald-500/10 py-2"
            >
              <TrendingDown className="h-4 w-4 text-emerald-400" />
              <span className="text-sm font-semibold text-emerald-400">
                {assessment.traditionalEstimate.timeSavingsPercent}% faster
              </span>
            </motion.div>
          </div>
        </Card>

        {/* Cost */}
        <Card header={
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-emerald-400" />
            <h3 className="text-base font-semibold text-white">Cost Comparison</h3>
          </div>
        }>
          <div className="space-y-4">
            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-slate-400">Traditional Approach</span>
                <span className="font-mono text-slate-300">
                  ${assessment.traditionalEstimate.cost.toLocaleString()}
                </span>
              </div>
              <div className="h-6 w-full overflow-hidden rounded-full bg-slate-800">
                <motion.div
                  className="h-full rounded-full bg-slate-600"
                  initial={{ width: 0 }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 0.8 }}
                />
              </div>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-slate-400">With Black Hole</span>
                <span className="font-mono text-white">
                  ${assessment.estimatedCost.totalEstimate.toLocaleString()}
                </span>
              </div>
              <div className="h-6 w-full overflow-hidden rounded-full bg-slate-800">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400"
                  initial={{ width: 0 }}
                  animate={{
                    width: `${(assessment.estimatedCost.totalEstimate / assessment.traditionalEstimate.cost) * 100}%`,
                  }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                />
              </div>
            </div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="flex items-center justify-center gap-2 rounded-lg bg-emerald-500/10 py-2"
            >
              <TrendingDown className="h-4 w-4 text-emerald-400" />
              <span className="text-sm font-semibold text-emerald-400">
                {assessment.traditionalEstimate.costSavingsPercent}% cost reduction
              </span>
            </motion.div>
          </div>
        </Card>
      </div>

      {/* Recommendations */}
      <Card header={
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-violet-400" />
          <h3 className="text-base font-semibold text-white">Recommendations</h3>
        </div>
      }>
        <div className="space-y-2">
          {assessment.recommendations.map((rec, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + i * 0.06 }}
              className="flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-slate-800/40"
            >
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-violet-400" />
              <p className="text-sm text-slate-300">{rec}</p>
            </motion.div>
          ))}
        </div>
      </Card>

      {/* Findings Table */}
      <Card header={
        <div>
          <h3 className="text-base font-semibold text-white">Assessment Findings</h3>
          <p className="text-sm text-slate-400">{assessment.findings.length} findings detected</p>
        </div>
      }>
        <FindingsTable findings={assessment.findings} />
      </Card>
    </div>
  );
}
