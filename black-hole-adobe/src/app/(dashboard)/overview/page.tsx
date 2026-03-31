'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { StatsCards } from '@/components/dashboard/stats-cards';
import { MigrationChart } from '@/components/dashboard/migration-chart';
import { RecentActivity } from '@/components/dashboard/recent-activity';
import { ReadinessOverview } from '@/components/dashboard/readiness-overview';
import type { DashboardStats, ActivityEntry } from '@/types';

interface ChartDataPoint {
  month: string;
  migrations: number;
  completed: number;
  items: number;
}

interface ReadinessItem {
  product: string;
  score: number;
}

interface DashboardData {
  stats: DashboardStats;
  chartData: ChartDataPoint[];
  activity: ActivityEntry[];
  readinessScores: ReadinessItem[];
}

const EMPTY_STATS: DashboardStats = {
  totalMigrations: 0,
  activeMigrations: 0,
  completedMigrations: 0,
  totalItemsMigrated: 0,
  averageTimeSavings: 0,
  averageCostSavings: 0,
  topMigrationTypes: [],
  recentActivity: [],
};

export default function OverviewPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/dashboard/stats');
      if (!res.ok) {
        throw new Error(`Failed to load dashboard data (${res.status})`);
      }
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error?.message ?? 'Unknown error');
      }
      setData(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-400">
            Overview of all migration activity across your organization.
          </p>
        </div>

        {/* Skeleton Stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-[120px] animate-pulse rounded-xl border border-slate-800 bg-slate-900/80"
            />
          ))}
        </div>

        {/* Skeleton Charts */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="h-[320px] animate-pulse rounded-xl border border-slate-800 bg-slate-900/80" />
          </div>
          <div>
            <div className="h-[320px] animate-pulse rounded-xl border border-slate-800 bg-slate-900/80" />
          </div>
        </div>

        {/* Skeleton Activity */}
        <div className="h-[280px] animate-pulse rounded-xl border border-slate-800 bg-slate-900/80" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-400">
            Overview of all migration activity across your organization.
          </p>
        </div>
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-slate-800 bg-slate-900/80 px-6 py-16 text-center">
          <AlertTriangle className="h-10 w-10 text-amber-400" />
          <p className="text-sm text-slate-300">{error}</p>
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  const stats = data?.stats ?? EMPTY_STATS;
  const chartData = data?.chartData ?? [];
  const activity = data?.activity ?? [];
  const readinessScores = data?.readinessScores ?? [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-400">
          Overview of all migration activity across your organization.
        </p>
      </motion.div>

      {/* Stats */}
      <StatsCards stats={stats} />

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <MigrationChart data={chartData} />
        </div>
        <div>
          <ReadinessOverview scores={readinessScores} />
        </div>
      </div>

      {/* Activity */}
      <RecentActivity activity={activity} />
    </div>
  );
}
