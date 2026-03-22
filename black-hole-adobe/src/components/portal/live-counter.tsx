'use client';

/**
 * LiveCounter — Animated counter that smoothly rolls up to a target number.
 *
 * Features:
 * - Smooth animation from 0 to target using requestAnimationFrame
 * - Locale-formatted numbers with commas
 * - Optional suffix (e.g. "/ 1,200,000")
 * - Pulse animation on value change
 * - Dark theme
 */

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

// ── Props ──────────────────────────────────────────────────

interface LiveCounterProps {
  value: number;
  suffix?: string;
  label: string;
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'stable';
  className?: string;
}

// ── Formatter ──────────────────────────────────────────────

function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

// ── Animation Hook ─────────────────────────────────────────

function useAnimatedNumber(target: number, duration = 800): number {
  const [display, setDisplay] = useState(0);
  const frameRef = useRef<number>(0);
  const startRef = useRef<number>(0);
  const fromRef = useRef<number>(0);

  useEffect(() => {
    fromRef.current = display;
    startRef.current = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(fromRef.current + (target - fromRef.current) * eased);
      setDisplay(current);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      }
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frameRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);

  return display;
}

// ── Component ──────────────────────────────────────────────

export function LiveCounter({
  value,
  suffix,
  label,
  icon,
  trend,
  className,
}: LiveCounterProps) {
  const animatedValue = useAnimatedNumber(value);
  const [pulse, setPulse] = useState(false);
  const prevValueRef = useRef(value);

  useEffect(() => {
    if (prevValueRef.current !== value && prevValueRef.current > 0) {
      setPulse(true);
      const timer = setTimeout(() => setPulse(false), 600);
      prevValueRef.current = value;
      return () => clearTimeout(timer);
    }
    prevValueRef.current = value;
  }, [value]);

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-rose-400' : 'text-slate-500';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border border-slate-700/50 bg-slate-800/50 p-4',
        'transition-shadow duration-300',
        pulse && 'shadow-lg shadow-violet-500/10',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <div className="text-slate-400">{icon}</div>
        {trend && (
          <AnimatePresence mode="wait">
            <motion.div
              key={trend}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
            >
              <TrendIcon className={cn('h-4 w-4', trendColor)} />
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      <div className="mt-3">
        <span
          className={cn(
            'text-xl font-bold tabular-nums text-white transition-all duration-300',
            pulse && 'text-violet-300',
          )}
        >
          {formatNumber(animatedValue)}
        </span>
        {suffix && (
          <span className="ml-1 text-sm text-slate-500">{suffix}</span>
        )}
      </div>

      <p className="mt-1 text-xs text-slate-400">{label}</p>
    </motion.div>
  );
}
