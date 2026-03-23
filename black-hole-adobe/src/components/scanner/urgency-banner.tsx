'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Clock, ArrowRight } from 'lucide-react';
import type { MigrationUrgency } from '@/types/scanner';

interface UrgencyBannerProps {
  urgency: MigrationUrgency;
  aemVersion: string | null;
}

const URGENCY_STYLES: Record<
  string,
  { bg: string; border: string; icon: string; badge: string }
> = {
  critical: {
    bg: 'bg-rose-500/5',
    border: 'border-rose-500/30',
    icon: 'text-rose-400',
    badge: 'bg-rose-500/20 text-rose-300',
  },
  high: {
    bg: 'bg-orange-500/5',
    border: 'border-orange-500/30',
    icon: 'text-orange-400',
    badge: 'bg-orange-500/20 text-orange-300',
  },
  medium: {
    bg: 'bg-amber-500/5',
    border: 'border-amber-500/20',
    icon: 'text-amber-400',
    badge: 'bg-amber-500/20 text-amber-300',
  },
  low: {
    bg: 'bg-emerald-500/5',
    border: 'border-emerald-500/20',
    icon: 'text-emerald-400',
    badge: 'bg-emerald-500/20 text-emerald-300',
  },
  none: {
    bg: 'bg-slate-800/50',
    border: 'border-slate-700/50',
    icon: 'text-slate-400',
    badge: 'bg-slate-700/50 text-slate-400',
  },
};

function formatCountdown(days: number): {
  d: number;
  h: number;
  m: number;
  s: number;
} {
  const totalSeconds = days * 86400;
  return {
    d: Math.floor(totalSeconds / 86400),
    h: Math.floor((totalSeconds % 86400) / 3600),
    m: Math.floor((totalSeconds % 3600) / 60),
    s: totalSeconds % 60,
  };
}

export function UrgencyBanner({ urgency, aemVersion }: UrgencyBannerProps) {
  const [countdown, setCountdown] = useState(
    urgency.daysUntilDeadline
      ? formatCountdown(urgency.daysUntilDeadline)
      : null,
  );

  useEffect(() => {
    if (!urgency.daysUntilDeadline || urgency.daysUntilDeadline <= 0) return;
    const endTime = Date.now() + urgency.daysUntilDeadline * 86400000;
    const tick = () => {
      const remaining = Math.max(0, endTime - Date.now());
      const totalSec = Math.floor(remaining / 1000);
      setCountdown({
        d: Math.floor(totalSec / 86400),
        h: Math.floor((totalSec % 86400) / 3600),
        m: Math.floor((totalSec % 3600) / 60),
        s: totalSec % 60,
      });
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [urgency.daysUntilDeadline]);

  if (urgency.level === 'none' && !aemVersion) return null;

  const style = URGENCY_STYLES[urgency.level] ?? URGENCY_STYLES.none;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className={`rounded-xl border ${style.border} ${style.bg} p-5`}
    >
      <div className="flex items-start gap-4">
        <div className="shrink-0 pt-0.5">
          {urgency.level === 'critical' || urgency.level === 'high' ? (
            <AlertTriangle className={`h-6 w-6 ${style.icon}`} />
          ) : (
            <Clock className={`h-6 w-6 ${style.icon}`} />
          )}
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-white">
              Migration Urgency
            </h3>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${style.badge}`}
            >
              {urgency.level.toUpperCase()}
            </span>
          </div>

          <p className="mt-1.5 text-sm text-slate-400">{urgency.message}</p>

          {/* Countdown timer */}
          {countdown && urgency.daysUntilDeadline && urgency.daysUntilDeadline > 0 && (
            <div className="mt-4 flex items-center gap-3">
              {[
                { label: 'Days', value: countdown.d },
                { label: 'Hours', value: countdown.h },
                { label: 'Min', value: countdown.m },
                { label: 'Sec', value: countdown.s },
              ].map((unit) => (
                <div
                  key={unit.label}
                  className="flex flex-col items-center rounded-lg border border-slate-700/50 bg-slate-800/50 px-3 py-2 min-w-[52px]"
                >
                  <span className="text-lg font-bold text-white tabular-nums">
                    {String(unit.value).padStart(2, '0')}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-slate-500">
                    {unit.label}
                  </span>
                </div>
              ))}
              <span className="text-xs text-slate-500">
                until EOL
              </span>
            </div>
          )}

          {/* CTA */}
          {(urgency.level === 'critical' || urgency.level === 'high') && (
            <a
              href="#get-assessment"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-2 text-sm font-medium text-white transition-all hover:from-violet-500 hover:to-purple-500"
            >
              Get Full Assessment
              <ArrowRight className="h-4 w-4" />
            </a>
          )}
        </div>
      </div>
    </motion.div>
  );
}
