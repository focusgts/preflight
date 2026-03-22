'use client';

import { motion } from 'framer-motion';
import {
  CheckCircle2,
  PlayCircle,
  FileSearch,
  Cog,
  ArrowRight,
  Package,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import type { ActivityEntry } from '@/types';

function getActionIcon(action: string) {
  if (action.includes('completed')) return CheckCircle2;
  if (action.includes('started') || action.includes('initiated')) return PlayCircle;
  if (action.includes('Assessment') || action.includes('Scanning')) return FileSearch;
  if (action.includes('transformation') || action.includes('processing')) return Cog;
  if (action.includes('migrated') || action.includes('transferred')) return Package;
  return ArrowRight;
}

function getActionColor(action: string) {
  if (action.includes('completed')) return 'text-emerald-400 bg-emerald-500/10';
  if (action.includes('started') || action.includes('initiated')) return 'text-cyan-400 bg-cyan-500/10';
  if (action.includes('progress')) return 'text-amber-400 bg-amber-500/10';
  return 'text-violet-400 bg-violet-500/10';
}

function timeAgo(timestamp: string): string {
  const now = new Date('2026-03-21T10:00:00Z');
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface RecentActivityProps {
  activity: ActivityEntry[];
}

export function RecentActivity({ activity }: RecentActivityProps) {
  return (
    <Card
      header={
        <div>
          <h3 className="text-base font-semibold text-white">Recent Activity</h3>
          <p className="text-sm text-slate-400">Latest migration events</p>
        </div>
      }
    >
      <div className="space-y-1">
        {activity.map((entry, i) => {
          const Icon = getActionIcon(entry.action);
          const colorClass = getActionColor(entry.action);
          return (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.08 }}
              className="group flex gap-3 rounded-lg p-3 transition-colors hover:bg-slate-800/40"
            >
              {/* Timeline */}
              <div className="flex flex-col items-center">
                <div className={`rounded-lg p-1.5 ${colorClass}`}>
                  <Icon className="h-4 w-4" />
                </div>
                {i < activity.length - 1 && (
                  <div className="mt-1 h-full w-px bg-slate-800" />
                )}
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-white">{entry.action}</p>
                    <p className="text-xs text-slate-400">{entry.migrationName}</p>
                  </div>
                  <span className="shrink-0 text-xs text-slate-500">
                    {timeAgo(entry.timestamp)}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  {entry.details}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </Card>
  );
}
