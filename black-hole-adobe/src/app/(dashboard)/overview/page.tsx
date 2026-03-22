'use client';

import { motion } from 'framer-motion';
import { StatsCards } from '@/components/dashboard/stats-cards';
import { MigrationChart } from '@/components/dashboard/migration-chart';
import { RecentActivity } from '@/components/dashboard/recent-activity';
import { ReadinessOverview } from '@/components/dashboard/readiness-overview';
import {
  mockDashboardStats,
  mockChartData,
  mockActivity,
  mockReadinessScores,
} from '@/config/mock-data';

export default function OverviewPage() {
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
      <StatsCards stats={mockDashboardStats} />

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <MigrationChart data={mockChartData} />
        </div>
        <div>
          <ReadinessOverview scores={mockReadinessScores} />
        </div>
      </div>

      {/* Activity */}
      <RecentActivity activity={mockActivity} />
    </div>
  );
}
