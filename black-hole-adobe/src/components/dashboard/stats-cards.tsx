'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRightLeft,
  Zap,
  CheckCircle2,
  Clock,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { DashboardStats } from '@/types';

interface StatCardData {
  label: string;
  value: number;
  suffix?: string;
  icon: React.ElementType;
  trend: number;
  color: string;
}

function useAnimatedCounter(target: number, duration = 1200): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let start = 0;
    const startTime = performance.now();
    function step(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(start + (target - start) * eased));
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }, [target, duration]);
  return count;
}

function StatCard({ label, value, suffix, icon: Icon, trend, color, index }: StatCardData & { index: number }) {
  const animatedValue = useAnimatedCounter(value);
  const isPositive = trend >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
      className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 backdrop-blur-sm transition-all duration-200 hover:border-slate-700 hover:shadow-lg hover:shadow-violet-500/5"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-400">{label}</p>
          <p className="mt-2 text-3xl font-bold text-white">
            {animatedValue.toLocaleString()}
            {suffix && <span className="ml-1 text-lg text-slate-400">{suffix}</span>}
          </p>
        </div>
        <div className={cn('rounded-lg p-2.5', color)}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-1.5 text-xs">
        {isPositive ? (
          <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
        ) : (
          <TrendingDown className="h-3.5 w-3.5 text-rose-400" />
        )}
        <span className={isPositive ? 'text-emerald-400' : 'text-rose-400'}>
          {isPositive ? '+' : ''}{trend}%
        </span>
        <span className="text-slate-500">vs last month</span>
      </div>
    </motion.div>
  );
}

interface StatsCardsProps {
  stats: DashboardStats;
}

export function StatsCards({ stats }: StatsCardsProps) {
  const cards: StatCardData[] = [
    {
      label: 'Total Migrations',
      value: stats.totalMigrations,
      icon: ArrowRightLeft,
      trend: 18,
      color: 'bg-violet-500/20',
    },
    {
      label: 'Active Now',
      value: stats.activeMigrations,
      icon: Zap,
      trend: 25,
      color: 'bg-cyan-500/20',
    },
    {
      label: 'Completed',
      value: stats.completedMigrations,
      icon: CheckCircle2,
      trend: 12,
      color: 'bg-emerald-500/20',
    },
    {
      label: 'Avg Time Saved',
      value: stats.averageTimeSavings,
      suffix: '%',
      icon: Clock,
      trend: 5,
      color: 'bg-amber-500/20',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card, i) => (
        <StatCard key={card.label} {...card} index={i} />
      ))}
    </div>
  );
}
