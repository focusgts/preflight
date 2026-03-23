'use client';

import { motion } from 'framer-motion';
import type { CostBreakdown, TimelineComparison, RiskComparison } from '@/types/calculator';

interface CostComparisonProps {
  traditional: CostBreakdown;
  blackHole: CostBreakdown;
  timeline: TimelineComparison;
  risk: RiskComparison;
}

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n.toLocaleString()}`;
}

function ComparisonCard({
  title,
  cost,
  weeks,
  riskPercent,
  variant,
}: {
  title: string;
  cost: number;
  weeks: number;
  riskPercent: number;
  variant: 'traditional' | 'blackhole';
}) {
  const isTraditional = variant === 'traditional';
  const borderColor = isTraditional ? 'border-rose-500/30' : 'border-emerald-500/30';
  const bgGradient = isTraditional
    ? 'from-rose-950/30 to-slate-900/60'
    : 'from-emerald-950/30 to-slate-900/60';
  const accentColor = isTraditional ? 'text-rose-400' : 'text-emerald-400';
  const badgeBg = isTraditional ? 'bg-rose-500/10' : 'bg-emerald-500/10';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: isTraditional ? 0 : 0.15 }}
      className={`rounded-xl border ${borderColor} bg-gradient-to-b ${bgGradient} p-6`}
    >
      <h3 className={`mb-1 text-sm font-semibold uppercase tracking-wider ${accentColor}`}>
        {title}
      </h3>

      <p className="mt-3 text-3xl font-black text-white sm:text-4xl">
        {formatCurrency(cost)}
      </p>

      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-400">Duration</span>
          <span className={`rounded-md ${badgeBg} px-2 py-0.5 text-sm font-semibold ${accentColor}`}>
            {weeks} weeks ({Math.round(weeks / 4.33)} months)
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-400">Overrun risk</span>
          <span className={`rounded-md ${badgeBg} px-2 py-0.5 text-sm font-semibold ${accentColor}`}>
            {riskPercent}%
          </span>
        </div>
      </div>
    </motion.div>
  );
}

export function CostComparison({
  traditional,
  blackHole,
  timeline,
  risk,
}: CostComparisonProps) {
  const phases = [
    { label: 'Assessment', trad: traditional.assessment, bh: blackHole.assessment },
    { label: 'Code Modernization', trad: traditional.codeModernization, bh: blackHole.codeModernization },
    { label: 'Content Migration', trad: traditional.contentMigration, bh: blackHole.contentMigration },
    { label: 'Integration', trad: traditional.integrationWork, bh: blackHole.integrationWork },
    { label: 'Testing', trad: traditional.testing, bh: blackHole.testing },
    { label: 'Project Management', trad: traditional.projectManagement, bh: blackHole.projectManagement },
    { label: 'Contingency / Buffer', trad: traditional.contingency, bh: blackHole.contingency },
  ];

  return (
    <div>
      {/* Side-by-side cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <ComparisonCard
          title="Traditional SI"
          cost={traditional.total}
          weeks={timeline.traditionalTotalWeeks}
          riskPercent={risk.traditionalOverrunPercent}
          variant="traditional"
        />
        <ComparisonCard
          title="With Black Hole"
          cost={blackHole.total}
          weeks={timeline.blackHoleTotalWeeks}
          riskPercent={risk.blackHoleOverrunPercent}
          variant="blackhole"
        />
      </div>

      {/* Savings arrow callout */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="my-4 flex items-center justify-center gap-2"
      >
        <div className="h-px flex-1 bg-gradient-to-r from-transparent to-emerald-500/40" />
        <span className="whitespace-nowrap rounded-full bg-emerald-500/10 px-4 py-1.5 text-sm font-bold text-emerald-400">
          Save {formatCurrency(traditional.total - blackHole.total)}
        </span>
        <div className="h-px flex-1 bg-gradient-to-l from-transparent to-emerald-500/40" />
      </motion.div>

      {/* Phase breakdown table */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="mt-6 overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60"
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800">
              <th className="px-4 py-3 text-left font-medium text-slate-400">Phase</th>
              <th className="px-4 py-3 text-right font-medium text-rose-400">Traditional</th>
              <th className="px-4 py-3 text-right font-medium text-emerald-400">Black Hole</th>
              <th className="px-4 py-3 text-right font-medium text-cyan-400">Saved</th>
            </tr>
          </thead>
          <tbody>
            {phases.map((phase) => {
              const saved = phase.trad - phase.bh;
              return (
                <tr key={phase.label} className="border-b border-slate-800/50 last:border-0">
                  <td className="px-4 py-2.5 text-slate-300">{phase.label}</td>
                  <td className="px-4 py-2.5 text-right text-slate-300">
                    {formatCurrency(phase.trad)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-300">
                    {formatCurrency(phase.bh)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-emerald-400">
                    {saved > 0 ? formatCurrency(saved) : '--'}
                  </td>
                </tr>
              );
            })}
            <tr className="bg-slate-800/30 font-bold">
              <td className="px-4 py-3 text-white">Total</td>
              <td className="px-4 py-3 text-right text-rose-400">
                {formatCurrency(traditional.total)}
              </td>
              <td className="px-4 py-3 text-right text-emerald-400">
                {formatCurrency(blackHole.total)}
              </td>
              <td className="px-4 py-3 text-right text-cyan-300">
                {formatCurrency(traditional.total - blackHole.total)}
              </td>
            </tr>
          </tbody>
        </table>
      </motion.div>
    </div>
  );
}
