'use client';

import { motion } from 'framer-motion';
import {
  TicketCheck,
  BookOpen,
  Brain,
  TrendingUp,
  Clock,
  ExternalLink,
  Shield,
  Users,
  Database as DatabaseIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Card } from '@/components/ui/card';
import type { HandoffReport, ExportResult } from '@/lib/bridge';

interface HandoffSummaryProps {
  report: HandoffReport;
  result: ExportResult | null;
}

export function HandoffSummary({ report, result }: HandoffSummaryProps) {
  const plan = report.suggestedPlan;
  const est = report.estimatedMonthlyTickets;

  return (
    <div className="space-y-6">
      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          icon={TicketCheck}
          label="Tickets Exported"
          value={result?.tickets.exported ?? report.itemsSummary.total}
          color="violet"
        />
        <StatCard
          icon={BookOpen}
          label="KB Articles"
          value={result?.knowledgeArticles.exported ?? report.knowledgeBase.articleCount}
          color="cyan"
        />
        <StatCard
          icon={Brain}
          label="Navi Memories"
          value={result?.memories.exported ?? 0}
          color="amber"
        />
        <StatCard
          icon={TrendingUp}
          label="ROI Entries"
          value={result?.roiEntries.exported ?? 0}
          color="emerald"
        />
      </div>

      {/* Migration summary */}
      <Card
        header={
          <h3 className="text-base font-semibold text-white">Migration Summary</h3>
        }
      >
        <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <SummaryRow label="Migration" value={report.migration.name} />
          <SummaryRow label="Organization" value={report.migration.organization} />
          <SummaryRow label="Source" value={`${report.migration.sourcePlatform} ${report.migration.sourceVersion}`} />
          <SummaryRow label="Target" value={report.migration.targetPlatform} />
          <SummaryRow label="Duration" value={`${report.migration.durationWeeks} weeks`} />
          <SummaryRow
            label="Cost"
            value={`$${(report.migration.actualCost ?? report.migration.estimatedCost).toLocaleString()}`}
          />
          <SummaryRow label="Assessment Score" value={`${report.migration.overallScore}/100`} />
          <SummaryRow
            label="Items"
            value={`${report.itemsSummary.completed} completed, ${report.itemsSummary.failed} failed, ${report.itemsSummary.total} total`}
          />
        </div>
      </Card>

      {/* Two-column: Plan + Tickets */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Navigator plan recommendation */}
        <Card
          gradient
          header={
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-violet-400" />
              <h3 className="text-base font-semibold text-white">Recommended Plan</h3>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold text-white">
                Navigator {plan.plan}
              </span>
              <span className="text-lg text-slate-400">
                ${plan.monthlyRate.toLocaleString()}/mo
              </span>
            </div>

            <p className="text-sm text-slate-400">{plan.rationale}</p>

            <div className="space-y-2">
              <HoursBar label="Support" hours={plan.hourlyBreakdown.support} color="bg-cyan-500" max={plan.plan === '40hr' ? 40 : 20} />
              <HoursBar label="Enhance" hours={plan.hourlyBreakdown.enhance} color="bg-violet-500" max={plan.plan === '40hr' ? 40 : 20} />
              <HoursBar label="Advise" hours={plan.hourlyBreakdown.advise} color="bg-amber-500" max={plan.plan === '40hr' ? 40 : 20} />
            </div>
          </div>
        </Card>

        {/* Monthly ticket estimate */}
        <Card
          header={
            <div className="flex items-center gap-2">
              <TicketCheck className="h-4 w-4 text-cyan-400" />
              <h3 className="text-base font-semibold text-white">Monthly Ticket Estimate</h3>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold text-white">
                {est.monthlyVolume}
              </span>
              <span className="text-sm text-slate-400">tickets/month</span>
              <span className="ml-auto rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
                {Math.round(est.confidence * 100)}% confidence
              </span>
            </div>

            <p className="text-sm text-slate-400">{est.rationale}</p>

            <div className="grid grid-cols-3 gap-3">
              <TicketStat label="Support" count={est.breakdown.support} color="text-cyan-400" />
              <TicketStat label="Enhance" count={est.breakdown.enhance} color="text-violet-400" />
              <TicketStat label="Advise" count={est.breakdown.advise} color="text-amber-400" />
            </div>
          </div>
        </Card>
      </div>

      {/* Environment context */}
      <Card
        header={
          <div className="flex items-center gap-2">
            <DatabaseIcon className="h-4 w-4 text-emerald-400" />
            <h3 className="text-base font-semibold text-white">Environment Context Captured</h3>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <SummaryRow label="Products" value={report.environmentContext.productsInScope.join(', ')} />
          <SummaryRow label="Integrations" value={`${report.environmentContext.integrationCount} (${report.environmentContext.integrations.slice(0, 3).join(', ')}${report.environmentContext.integrations.length > 3 ? '...' : ''})`} />
          <SummaryRow label="Content" value={`${report.environmentContext.contentVolume.pages} pages, ${report.environmentContext.contentVolume.assets} assets, ${report.environmentContext.contentVolume.sizeGB}GB`} />
          <SummaryRow label="Compliance" value={report.environmentContext.complianceFrameworks.join(', ') || 'None'} />
        </div>

        {report.environmentContext.knownIssues.length > 0 && (
          <div className="mt-4 border-t border-slate-800 pt-4">
            <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
              Known Issues
            </h4>
            <ul className="space-y-1">
              {report.environmentContext.knownIssues.map((issue, i) => (
                <li key={i} className="text-sm text-rose-300/80">
                  - {issue}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {/* Recommendations */}
      {report.recommendations.length > 0 && (
        <Card
          header={
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-amber-400" />
              <h3 className="text-base font-semibold text-white">
                Recommendations for Ongoing Support
              </h3>
            </div>
          }
        >
          <div className="space-y-3">
            {report.recommendations.map((rec, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-900/50 p-3"
              >
                <SeaCategoryBadge category={rec.category} />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{rec.title}</span>
                    <PriorityDot priority={rec.priority} />
                  </div>
                  <p className="mt-1 text-xs text-slate-400">{rec.description}</p>
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <Clock className="h-3 w-3" />
                  {rec.estimatedHours}h
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Navigator link */}
      {result && (
        <div className="flex justify-center pb-8">
          <a
            href={`https://navigator-portal-api-yfokmdhikq-uc.a.run.app/organizations/${result.organizationId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-violet-400 hover:text-violet-300 transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            View in Navigator Portal
          </a>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof TicketCheck;
  label: string;
  value: number;
  color: 'violet' | 'cyan' | 'amber' | 'emerald';
}) {
  const colorMap = {
    violet: 'text-violet-400 bg-violet-500/10',
    cyan: 'text-cyan-400 bg-cyan-500/10',
    amber: 'text-amber-400 bg-amber-500/10',
    emerald: 'text-emerald-400 bg-emerald-500/10',
  };
  const [textColor, bgColor] = colorMap[color].split(' ');

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-xl border border-slate-800 bg-slate-900/80 p-4"
    >
      <div className={cn('mb-2 inline-flex rounded-lg p-2', bgColor)}>
        <Icon className={cn('h-4 w-4', textColor)} />
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-slate-400">{label}</p>
    </motion.div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-slate-500">{label}</span>
      <span className="text-right text-slate-200">{value}</span>
    </div>
  );
}

function HoursBar({
  label,
  hours,
  color,
  max,
}: {
  label: string;
  hours: number;
  color: string;
  max: number;
}) {
  const pct = Math.round((hours / max) * 100);
  return (
    <div className="flex items-center gap-3">
      <span className="w-16 text-xs text-slate-400">{label}</span>
      <div className="flex-1 overflow-hidden rounded-full bg-slate-800 h-2">
        <motion.div
          className={cn('h-full rounded-full', color)}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
      <span className="w-8 text-right text-xs font-mono text-slate-300">{hours}h</span>
    </div>
  );
}

function TicketStat({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-2 text-center">
      <p className={cn('text-lg font-bold', color)}>{count}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

function SeaCategoryBadge({ category }: { category: 'support' | 'enhance' | 'advise' }) {
  const styles = {
    support: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    enhance: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
    advise: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium uppercase',
        styles[category],
      )}
    >
      {category[0].toUpperCase()}
    </span>
  );
}

function PriorityDot({ priority }: { priority: 'high' | 'medium' | 'low' }) {
  const colors = {
    high: 'bg-rose-400',
    medium: 'bg-amber-400',
    low: 'bg-slate-400',
  };
  return <span className={cn('h-1.5 w-1.5 rounded-full', colors[priority])} />;
}
