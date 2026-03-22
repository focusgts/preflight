'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils/cn';

interface ScoreRingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  className?: string;
}

function getScoreColor(score: number): string {
  if (score < 40) return '#f43f5e';
  if (score < 70) return '#f59e0b';
  return '#10b981';
}

function getScoreGlow(score: number): string {
  if (score < 40) return 'drop-shadow(0 0 6px rgba(244, 63, 94, 0.4))';
  if (score < 70) return 'drop-shadow(0 0 6px rgba(245, 158, 11, 0.4))';
  return 'drop-shadow(0 0 6px rgba(16, 185, 129, 0.4))';
}

export function ScoreRing({
  score,
  size = 120,
  strokeWidth = 8,
  label,
  className,
}: ScoreRingProps) {
  const [mounted, setMounted] = useState(false);
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (score / 100) * circumference;
  const color = getScoreColor(score);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          className="-rotate-90"
          style={{ filter: getScoreGlow(score) }}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="rgb(30 41 59)"
            strokeWidth={strokeWidth}
            fill="none"
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: mounted ? offset : circumference }}
            transition={{ duration: 1.2, ease: 'easeOut', delay: 0.2 }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.span
            className="text-2xl font-bold text-white"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            style={{ fontSize: size * 0.22 }}
          >
            {score}
          </motion.span>
        </div>
      </div>
      {label && (
        <span className="text-sm text-slate-400">{label}</span>
      )}
    </div>
  );
}
