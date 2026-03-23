'use client';

/**
 * Risk Matrix Component
 *
 * Visual 5x5 grid showing probability vs impact for simulation risks.
 * Color-coded from green (low) to red (critical). Each cell shows
 * count and supports hover for details.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils/cn';
import type { RiskMatrixEntry } from '@/types/simulation';

interface RiskMatrixProps {
  risks: RiskMatrixEntry[];
}

const AXIS_LABELS = ['1', '2', '3', '4', '5'];
const PROBABILITY_LABELS = ['Very Low', 'Low', 'Medium', 'High', 'Very High'];
const IMPACT_LABELS = ['Negligible', 'Minor', 'Moderate', 'Major', 'Severe'];

function getCellColor(probability: number, impact: number): string {
  const score = probability * impact;
  if (score >= 20) return 'bg-rose-500/30 border-rose-500/40 hover:bg-rose-500/40';
  if (score >= 15) return 'bg-rose-500/20 border-rose-500/30 hover:bg-rose-500/30';
  if (score >= 12) return 'bg-orange-500/20 border-orange-500/30 hover:bg-orange-500/30';
  if (score >= 8) return 'bg-amber-500/20 border-amber-500/30 hover:bg-amber-500/30';
  if (score >= 4) return 'bg-yellow-500/15 border-yellow-500/25 hover:bg-yellow-500/25';
  return 'bg-emerald-500/15 border-emerald-500/25 hover:bg-emerald-500/25';
}

function getCellTextColor(probability: number, impact: number): string {
  const score = probability * impact;
  if (score >= 15) return 'text-rose-300';
  if (score >= 8) return 'text-amber-300';
  return 'text-emerald-300';
}

export function RiskMatrix({ risks }: RiskMatrixProps) {
  const [hoveredCell, setHoveredCell] = useState<{ p: number; i: number } | null>(null);

  // Group risks by cell (probability, impact)
  const cellMap = new Map<string, RiskMatrixEntry[]>();
  for (const risk of risks) {
    const key = `${risk.probability}-${risk.impact}`;
    const existing = cellMap.get(key) ?? [];
    existing.push(risk);
    cellMap.set(key, existing);
  }

  const hoveredRisks = hoveredCell
    ? cellMap.get(`${hoveredCell.p}-${hoveredCell.i}`) ?? []
    : [];

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-2">
        {/* Y-axis label */}
        <div className="flex flex-col items-center justify-center w-8">
          <span
            className="text-xs text-slate-400 font-medium whitespace-nowrap"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
          >
            Probability
          </span>
        </div>

        <div className="flex-1">
          {/* Grid rows (probability 5 -> 1, top to bottom) */}
          <div className="grid grid-rows-5 gap-1">
            {[5, 4, 3, 2, 1].map((p) => (
              <div key={p} className="flex items-center gap-1">
                <span className="w-6 text-right text-xs text-slate-500 font-mono">
                  {p}
                </span>
                <div className="flex-1 grid grid-cols-5 gap-1">
                  {[1, 2, 3, 4, 5].map((i) => {
                    const cellRisks = cellMap.get(`${p}-${i}`) ?? [];
                    const count = cellRisks.length;
                    const isHovered = hoveredCell?.p === p && hoveredCell?.i === i;

                    return (
                      <motion.div
                        key={`${p}-${i}`}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{
                          delay: (p * 5 + i) * 0.02,
                          duration: 0.3,
                        }}
                        className={cn(
                          'relative flex items-center justify-center rounded-md border h-10 cursor-pointer transition-colors',
                          getCellColor(p, i),
                          isHovered && 'ring-2 ring-white/20',
                        )}
                        onMouseEnter={() => setHoveredCell({ p, i })}
                        onMouseLeave={() => setHoveredCell(null)}
                      >
                        {count > 0 && (
                          <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.5, type: 'spring' }}
                            className={cn(
                              'text-sm font-bold',
                              getCellTextColor(p, i),
                            )}
                          >
                            {count}
                          </motion.span>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* X-axis labels */}
          <div className="flex items-center gap-1 mt-1 ml-7">
            {AXIS_LABELS.map((label) => (
              <div key={label} className="flex-1 text-center text-xs text-slate-500 font-mono">
                {label}
              </div>
            ))}
          </div>
          <div className="text-center text-xs text-slate-400 font-medium mt-1 ml-7">
            Impact
          </div>
        </div>
      </div>

      {/* Hover tooltip */}
      <AnimatePresence>
        {hoveredCell && hoveredRisks.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="rounded-lg border border-slate-700 bg-slate-800 p-3 space-y-2"
          >
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>
                Probability: {PROBABILITY_LABELS[hoveredCell.p - 1]}
              </span>
              <span className="text-slate-600">|</span>
              <span>
                Impact: {IMPACT_LABELS[hoveredCell.i - 1]}
              </span>
            </div>
            {hoveredRisks.map((risk) => (
              <div key={risk.id} className="space-y-1">
                <p className="text-sm font-medium text-slate-200">
                  {risk.title}
                </p>
                <p className="text-xs text-slate-400">{risk.description}</p>
                <p className="text-xs text-blue-400">
                  Mitigation: {risk.mitigation}
                </p>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-slate-400">
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-sm bg-emerald-500/20 border border-emerald-500/30" />
          <span>Low</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-sm bg-amber-500/20 border border-amber-500/30" />
          <span>Medium</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-sm bg-orange-500/20 border border-orange-500/30" />
          <span>High</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-sm bg-rose-500/30 border border-rose-500/40" />
          <span>Critical</span>
        </div>
      </div>
    </div>
  );
}
