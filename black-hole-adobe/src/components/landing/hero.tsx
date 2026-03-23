'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

function CountdownTimer() {
  const deadline = new Date('2027-02-28T00:00:00Z').getTime();
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, mins: 0 });

  useEffect(() => {
    function calc() {
      const now = Date.now();
      const diff = Math.max(0, deadline - now);
      setTimeLeft({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        mins: Math.floor((diff % 3600000) / 60000),
      });
    }
    calc();
    const id = setInterval(calc, 60000);
    return () => clearInterval(id);
  }, [deadline]);

  return (
    <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-300">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
      </span>
      AEM 6.5 support ends Feb 2027 &mdash;{' '}
      <span className="font-mono font-bold text-amber-200">
        {timeLeft.days}d {timeLeft.hours}h {timeLeft.mins}m
      </span>{' '}
      remaining
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative flex min-h-[90vh] items-center justify-center overflow-hidden px-4">
      {/* Grid background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(139,92,246,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.3) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
        {/* Radial glow */}
        <div className="absolute left-1/2 top-1/3 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-500/10 blur-[120px]" />
        <div className="absolute right-1/4 top-1/2 h-[400px] w-[400px] rounded-full bg-cyan-500/8 blur-[100px]" />
      </div>

      {/* Animated particles (CSS-only) */}
      <div className="pointer-events-none absolute inset-0">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="absolute h-1 w-1 rounded-full bg-violet-400/30"
            style={{
              left: `${(i * 5.3 + 7) % 100}%`,
              top: `${(i * 7.1 + 13) % 100}%`,
              animation: `float-particle ${6 + (i % 4) * 2}s ease-in-out ${i * 0.3}s infinite alternate`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 mx-auto max-w-4xl text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-4 py-1.5 text-sm text-violet-300">
          AI-Powered Migration Platform
        </div>

        <h1 className="mb-6 text-5xl font-bold leading-tight tracking-tight sm:text-6xl lg:text-7xl">
          <span className="text-gradient">Your Adobe Migration.</span>
          <br />
          <span className="text-white">Weeks, Not Months.</span>
        </h1>

        <p className="mx-auto mb-8 max-w-2xl text-lg text-slate-400 sm:text-xl">
          AI-powered migration platform that&apos;s 10x faster than any SI.
          Free assessment in 24 hours.
        </p>

        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button
            size="lg"
            className="min-w-[200px] text-base"
            onClick={() => {
              document.getElementById('cta-form')?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            Get Free Assessment
          </Button>
          <Button
            variant="secondary"
            size="lg"
            className="min-w-[200px] text-base"
            onClick={() => {
              window.location.href = '/score';
            }}
          >
            Try Health Score
          </Button>
        </div>

        <CountdownTimer />
      </div>

      {/* Float particle animation */}
      <style jsx>{`
        @keyframes float-particle {
          0% {
            transform: translateY(0) translateX(0) scale(1);
            opacity: 0.3;
          }
          100% {
            transform: translateY(-30px) translateX(15px) scale(1.5);
            opacity: 0.1;
          }
        }
      `}</style>
    </section>
  );
}
