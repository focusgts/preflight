'use client';

import { useEffect, useRef, useState } from 'react';

interface ComparisonRow {
  label: string;
  traditional: string;
  blackHole: string;
  traditionalPercent: number;
  blackHolePercent: number;
}

const rows: ComparisonRow[] = [
  {
    label: 'Timeline',
    traditional: '6-18 months',
    blackHole: '4-8 weeks',
    traditionalPercent: 90,
    blackHolePercent: 25,
  },
  {
    label: 'Cost',
    traditional: '$1M - $5M',
    blackHole: '$300K - $1M',
    traditionalPercent: 85,
    blackHolePercent: 30,
  },
  {
    label: 'Risk of Overrun',
    traditional: '50-100% overrun',
    blackHole: '<15% overrun',
    traditionalPercent: 80,
    blackHolePercent: 15,
  },
  {
    label: 'Content Freeze',
    traditional: '8-12 weeks',
    blackHole: '12 minutes',
    traditionalPercent: 75,
    blackHolePercent: 5,
  },
  {
    label: 'Code Automation',
    traditional: '0-10% automated',
    blackHole: '50-60% automated',
    traditionalPercent: 10,
    blackHolePercent: 60,
  },
];

function AnimatedBar({ percent, color, delay }: { percent: number; color: string; delay: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setWidth(percent);
      },
      { threshold: 0.3 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [percent]);

  return (
    <div ref={ref} className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
      <div
        className="h-full rounded-full transition-all duration-1000 ease-out"
        style={{
          width: `${width}%`,
          background: color,
          transitionDelay: `${delay}ms`,
        }}
      />
    </div>
  );
}

export function ComparisonTable() {
  return (
    <section className="px-4 py-24">
      <div className="mx-auto max-w-5xl">
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-3xl font-bold text-white sm:text-4xl">
            The Difference Is <span className="text-gradient">Dramatic</span>
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-slate-400">
            Traditional system integrators vs. AI-powered migration. The numbers speak for themselves.
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
          {/* Header */}
          <div className="grid grid-cols-3 border-b border-slate-800 px-6 py-4">
            <div className="text-sm font-medium text-slate-400" />
            <div className="text-center text-sm font-semibold text-rose-400">
              Traditional SI
            </div>
            <div className="text-center text-sm font-semibold text-emerald-400">
              Black Hole
            </div>
          </div>

          {/* Rows */}
          {rows.map((row, i) => (
            <div
              key={row.label}
              className="grid grid-cols-3 items-center gap-4 border-b border-slate-800/50 px-6 py-5 last:border-0"
            >
              <div className="text-sm font-medium text-slate-300">{row.label}</div>

              <div className="space-y-2 text-center">
                <span className="text-sm text-rose-300">{row.traditional}</span>
                <AnimatedBar
                  percent={row.traditionalPercent}
                  color="linear-gradient(90deg, #f43f5e, #e11d48)"
                  delay={i * 150}
                />
              </div>

              <div className="space-y-2 text-center">
                <span className="text-sm text-emerald-300">{row.blackHole}</span>
                <AnimatedBar
                  percent={row.blackHolePercent}
                  color="linear-gradient(90deg, #8b5cf6, #22d3ee)"
                  delay={i * 150 + 100}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Savings callout */}
        <div className="mt-8 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6 text-center">
          <p className="text-lg font-semibold text-emerald-300">
            Average savings: <span className="text-2xl font-bold text-emerald-200">70% cost reduction</span> and{' '}
            <span className="text-2xl font-bold text-emerald-200">5x faster</span> delivery
          </p>
        </div>
      </div>
    </section>
  );
}
