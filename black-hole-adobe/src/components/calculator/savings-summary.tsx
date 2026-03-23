'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface SavingsSummaryProps {
  costSaved: number;
  weeksSaved: number;
  riskReductionPercent: number;
}

function useAnimatedCounter(target: number, duration = 1500): number {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (target === 0) { setCurrent(0); return; }
    const startTime = performance.now();
    let frameId: number;

    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.round(target * eased));
      if (progress < 1) {
        frameId = requestAnimationFrame(tick);
      }
    }

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [target, duration]);

  return current;
}

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(amount % 1_000_000 === 0 ? 0 : 1)}M`;
  }
  if (amount >= 1_000) {
    return `$${(amount / 1_000).toFixed(0)}K`;
  }
  return `$${amount.toLocaleString()}`;
}

export function SavingsSummary({
  costSaved,
  weeksSaved,
  riskReductionPercent,
}: SavingsSummaryProps) {
  const animatedCost = useAnimatedCounter(costSaved);
  const animatedWeeks = useAnimatedCounter(weeksSaved, 1200);
  const animatedRisk = useAnimatedCounter(riskReductionPercent, 1000);

  const monthsSaved = Math.round(weeksSaved / 4.33);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/40 to-slate-900/80 p-8 text-center"
    >
      <p className="mb-2 text-sm font-medium uppercase tracking-widest text-emerald-400">
        Your estimated savings
      </p>

      {/* Big savings number */}
      <h2 className="bg-gradient-to-r from-emerald-400 to-cyan-300 bg-clip-text text-5xl font-black tracking-tight text-transparent sm:text-6xl lg:text-7xl">
        {formatCurrency(animatedCost)}
      </h2>

      <p className="mt-2 text-xl font-semibold text-slate-300 sm:text-2xl">
        and{' '}
        <span className="text-emerald-400">
          {animatedWeeks} weeks
        </span>{' '}
        ({monthsSaved} months) faster
      </p>

      {/* Risk reduction */}
      <div className="mt-6 flex items-center justify-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
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
              d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
            />
          </svg>
        </div>
        <p className="text-lg text-slate-300">
          <span className="font-bold text-emerald-400">{animatedRisk}%</span> lower overrun risk
        </p>
      </div>
    </motion.div>
  );
}
