'use client';

import { useEffect, useRef, useState } from 'react';

interface Step {
  number: string;
  title: string;
  description: string;
  icon: string;
}

const steps: Step[] = [
  {
    number: '01',
    title: 'Run Free Assessment',
    description:
      'Connect your AEM instance or upload a content package. Our AI analyzes your codebase, content, integrations, and configurations. Get a full readiness report in 24 hours.',
    icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  },
  {
    number: '02',
    title: 'Review Your Report',
    description:
      'Receive a comprehensive 9-page PDF with scores across every dimension: code compatibility, content health, integration complexity, risk factors, timeline, and cost comparison.',
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  },
  {
    number: '03',
    title: 'Start Migration',
    description:
      'AI handles the heavy lifting: code modernization, content sync, integration reconnection. You review and approve at every stage. Average migration: 4-8 weeks.',
    icon: 'M13 10V3L4 14h7v7l9-11h-7z',
  },
];

function StepCard({ step, index }: { step: Step; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { threshold: 0.3 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="relative flex flex-col items-center text-center"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(20px)',
        transition: `all 0.6s ease-out ${index * 200}ms`,
      }}
    >
      {/* Connector line */}
      {index < steps.length - 1 && (
        <div className="absolute left-[calc(50%+40px)] top-8 hidden h-0.5 w-[calc(100%-80px)] bg-gradient-to-r from-violet-500/30 to-cyan-500/30 lg:block" />
      )}

      {/* Number circle */}
      <div className="relative mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-cyan-500/20 ring-1 ring-violet-500/20">
        <svg className="h-7 w-7 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d={step.icon} />
        </svg>
        <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-violet-500 text-xs font-bold text-white">
          {step.number}
        </span>
      </div>

      <h3 className="mb-3 text-xl font-semibold text-white">{step.title}</h3>
      <p className="max-w-xs text-sm leading-relaxed text-slate-400">{step.description}</p>
    </div>
  );
}

export function HowItWorks() {
  return (
    <section className="px-4 py-24">
      <div className="mx-auto max-w-5xl">
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-3xl font-bold text-white sm:text-4xl">
            How It <span className="text-gradient">Works</span>
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-slate-400">
            Three steps from assessment to migration. No long contracts, no surprise costs.
          </p>
        </div>
        <div className="grid gap-12 lg:grid-cols-3 lg:gap-8">
          {steps.map((step, i) => (
            <StepCard key={step.number} step={step} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
