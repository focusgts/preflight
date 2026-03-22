'use client';

/**
 * TransferSpeed — Live throughput indicator with sparkline chart and ETA.
 *
 * Features:
 * - Current throughput (items/min)
 * - Sparkline SVG of last 60 data points
 * - ETA countdown
 * - Color-coded status: green (on track), amber (slowing), red (stalled)
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Activity, Timer } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

// ── Props ──────────────────────────────────────────────────

interface TransferSpeedProps {
  throughput: number;
  throughputHistory: number[];
  etaFormatted: string;
  className?: string;
}

// ── Status Logic ───────────────────────────────────────────

function getSpeedStatus(throughput: number): {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  sparkColor: string;
} {
  if (throughput < 100) {
    return {
      label: 'Stalled',
      color: 'text-rose-400',
      bgColor: 'bg-rose-500/5',
      borderColor: 'border-rose-500/20',
      sparkColor: '#f43f5e',
    };
  }
  if (throughput < 400) {
    return {
      label: 'Slowing',
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/5',
      borderColor: 'border-amber-500/20',
      sparkColor: '#f59e0b',
    };
  }
  return {
    label: 'On Track',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/5',
    borderColor: 'border-emerald-500/20',
    sparkColor: '#10b981',
  };
}

// ── Sparkline ──────────────────────────────────────────────

function Sparkline({
  data,
  color,
  width = 200,
  height = 40,
}: {
  data: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  const path = useMemo(() => {
    if (data.length < 2) return '';

    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const range = max - min || 1;
    const stepX = width / (data.length - 1);

    const points = data.map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    });

    return `M${points.join(' L')}`;
  }, [data, width, height]);

  const areaPath = useMemo(() => {
    if (data.length < 2) return '';
    return `${path} L${width},${height} L0,${height} Z`;
  }, [path, data.length, width, height]);

  if (data.length < 2) {
    return (
      <svg width={width} height={height} className="opacity-30">
        <line x1={0} y1={height / 2} x2={width} y2={height / 2} stroke={color} strokeWidth={1} strokeDasharray="4 4" />
      </svg>
    );
  }

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id="sparkGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#sparkGradient)" />
      <motion.path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      />
      {/* Current value dot */}
      {data.length > 0 && (() => {
        const max = Math.max(...data, 1);
        const min = Math.min(...data, 0);
        const range = max - min || 1;
        const lastVal = data[data.length - 1];
        const cx = width;
        const cy = height - ((lastVal - min) / range) * (height - 4) - 2;
        return (
          <>
            <circle cx={cx} cy={cy} r={3} fill={color} />
            <circle cx={cx} cy={cy} r={6} fill={color} opacity={0.3}>
              <animate attributeName="r" values="3;8;3" dur="2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.4;0;0.4" dur="2s" repeatCount="indefinite" />
            </circle>
          </>
        );
      })()}
    </svg>
  );
}

// ── Component ──────────────────────────────────────────────

export function TransferSpeed({
  throughput,
  throughputHistory,
  etaFormatted,
  className,
}: TransferSpeedProps) {
  const status = getSpeedStatus(throughput);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border border-slate-700/50 bg-slate-800/50 p-5',
        className,
      )}
    >
      <div className="flex items-start justify-between">
        {/* Left: Speed */}
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-slate-400" />
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Transfer Speed
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tabular-nums text-white">
              {throughput.toLocaleString('en-US')}
            </span>
            <span className="text-sm text-slate-500">items/min</span>
          </div>
          <div
            className={cn(
              'mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
              status.bgColor,
              status.borderColor,
              status.color,
              'border',
            )}
          >
            <div className={cn(
              'h-1.5 w-1.5 rounded-full',
              throughput >= 400 ? 'bg-emerald-400' : throughput >= 100 ? 'bg-amber-400' : 'bg-rose-400',
              'animate-pulse',
            )} />
            {status.label}
          </div>
        </div>

        {/* Right: ETA */}
        <div className="text-right">
          <div className="flex items-center justify-end gap-2">
            <Timer className="h-4 w-4 text-slate-400" />
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
              ETA
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-white">
            {etaFormatted}
          </p>
          <p className="mt-1 text-xs text-slate-500">estimated remaining</p>
        </div>
      </div>

      {/* Sparkline */}
      <div className="mt-4">
        <Sparkline
          data={throughputHistory}
          color={status.sparkColor}
          width={480}
          height={48}
        />
      </div>
    </motion.div>
  );
}
