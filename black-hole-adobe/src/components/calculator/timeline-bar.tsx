'use client';

import { motion } from 'framer-motion';
import type { TimelineComparison } from '@/types/calculator';

const PHASE_COLORS = [
  'bg-violet-500',
  'bg-blue-500',
  'bg-cyan-500',
  'bg-teal-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-pink-500',
];

interface TimelineBarProps {
  timeline: TimelineComparison;
}

function Bar({
  label,
  totalWeeks,
  maxWeeks,
  phases,
  variant,
  delay,
}: {
  label: string;
  totalWeeks: number;
  maxWeeks: number;
  phases: { name: string; weeks: number }[];
  variant: 'traditional' | 'blackhole';
  delay: number;
}) {
  const widthPercent = (totalWeeks / maxWeeks) * 100;
  const isTraditional = variant === 'traditional';
  const labelColor = isTraditional ? 'text-rose-400' : 'text-emerald-400';

  return (
    <div className="mb-6">
      <div className="mb-2 flex items-baseline justify-between">
        <span className={`text-sm font-semibold ${labelColor}`}>{label}</span>
        <span className="text-sm text-slate-400">
          {totalWeeks} weeks ({Math.round(totalWeeks / 4.33)} months)
        </span>
      </div>
      <div className="relative h-10 w-full rounded-lg bg-slate-800/50">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${widthPercent}%` }}
          transition={{ duration: 1, ease: 'easeOut', delay }}
          className="flex h-full overflow-hidden rounded-lg"
        >
          {phases.map((phase, i) => {
            const phasePercent = (phase.weeks / totalWeeks) * 100;
            return (
              <div
                key={phase.name}
                className={`${PHASE_COLORS[i % PHASE_COLORS.length]} relative flex items-center justify-center overflow-hidden opacity-80 transition-opacity hover:opacity-100`}
                style={{ width: `${phasePercent}%` }}
                title={`${phase.name}: ${phase.weeks} weeks`}
              >
                {phasePercent > 12 && (
                  <span className="truncate px-1 text-[10px] font-medium text-white/90">
                    {phase.weeks}w
                  </span>
                )}
              </div>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
}

export function TimelineBar({ timeline }: TimelineBarProps) {
  const maxWeeks = timeline.traditionalTotalWeeks;
  const monthsSaved = Math.round(timeline.weeksSaved / 4.33);

  const traditionalPhases = timeline.phases.map((p) => ({
    name: p.name,
    weeks: p.traditionalWeeks,
  }));

  const blackHolePhases = timeline.phases.map((p) => ({
    name: p.name,
    weeks: p.blackHoleWeeks,
  }));

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
      <h3 className="mb-6 text-lg font-semibold text-white">Timeline Comparison</h3>

      <Bar
        label="Traditional SI"
        totalWeeks={timeline.traditionalTotalWeeks}
        maxWeeks={maxWeeks}
        phases={traditionalPhases}
        variant="traditional"
        delay={0}
      />

      <Bar
        label="With Black Hole"
        totalWeeks={timeline.blackHoleTotalWeeks}
        maxWeeks={maxWeeks}
        phases={blackHolePhases}
        variant="blackhole"
        delay={0.3}
      />

      {/* Time saved annotation */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-emerald-500/10 px-4 py-3"
      >
        <svg
          className="h-5 w-5 text-emerald-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span className="text-sm font-semibold text-emerald-400">
          You save {timeline.weeksSaved} weeks ({monthsSaved} months)
        </span>
      </motion.div>

      {/* Phase legend */}
      <div className="mt-4 flex flex-wrap gap-3">
        {timeline.phases.map((phase, i) => (
          <div key={phase.name} className="flex items-center gap-1.5">
            <div
              className={`h-2.5 w-2.5 rounded-sm ${PHASE_COLORS[i % PHASE_COLORS.length]}`}
            />
            <span className="text-xs text-slate-400">{phase.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
