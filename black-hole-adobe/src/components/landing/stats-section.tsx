'use client';

import { useEffect, useRef, useState } from 'react';

interface StatCardProps {
  value: string;
  numericValue: number;
  prefix?: string;
  suffix: string;
  label: string;
  sublabel: string;
}

function AnimatedCounter({ target, prefix = '', suffix }: { target: number; prefix?: string; suffix: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          const duration = 2000;
          const start = performance.now();

          function step(now: number) {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.floor(eased * target));
            if (progress < 1) requestAnimationFrame(step);
          }
          requestAnimationFrame(step);
        }
      },
      { threshold: 0.3 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [target]);

  return (
    <span ref={ref} className="text-gradient text-5xl font-bold tracking-tight sm:text-6xl">
      {prefix}{count.toLocaleString()}{suffix}
    </span>
  );
}

function StatCard({ numericValue, prefix, suffix, label, sublabel }: StatCardProps) {
  return (
    <div className="group relative rounded-2xl border border-slate-800 bg-slate-900/60 p-8 transition-all duration-300 hover:border-slate-700 hover:shadow-lg hover:shadow-violet-500/5">
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-500/5 to-cyan-500/5 opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="relative">
        <AnimatedCounter target={numericValue} prefix={prefix} suffix={suffix} />
        <p className="mt-3 text-lg font-semibold text-white">{label}</p>
        <p className="mt-1 text-sm text-slate-400">{sublabel}</p>
      </div>
    </div>
  );
}

const stats: StatCardProps[] = [
  {
    value: '14,000+',
    numericValue: 14000,
    suffix: '+',
    label: 'Organizations Must Migrate',
    sublabel: 'From AEM on-prem and AMS to Cloud Service before EOL',
  },
  {
    value: '50-100%',
    numericValue: 100,
    suffix: '%',
    label: 'Timeline Overruns Are the Norm',
    sublabel: 'Traditional SI migrations consistently miss deadlines',
  },
  {
    value: '$5M+',
    numericValue: 5,
    prefix: '$',
    suffix: 'M+',
    label: 'Per Migration with Traditional SIs',
    sublabel: 'Enterprise migrations average $500K-$5M+ with system integrators',
  },
];

export function StatsSection() {
  return (
    <section className="px-4 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-3xl font-bold text-white sm:text-4xl">
            The <span className="text-gradient">$12.5B</span> Migration Crisis
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-slate-400">
            Adobe is forcing the largest platform migration in enterprise history.
            Most organizations aren&apos;t ready.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {stats.map((stat) => (
            <StatCard key={stat.label} {...stat} />
          ))}
        </div>
      </div>
    </section>
  );
}
