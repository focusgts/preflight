'use client';

import { motion } from 'framer-motion';
import {
  CheckCircle2,
  Circle,
  PlayCircle,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Card } from '@/components/ui/card';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Badge } from '@/components/ui/badge';
import type { MigrationPhase } from '@/types';
import { MigrationStatus } from '@/types';

interface ProgressTrackerProps {
  phases: MigrationPhase[];
  overallProgress: number;
  estimatedTimeRemaining?: string;
}

function getPhaseIcon(status: MigrationStatus) {
  switch (status) {
    case MigrationStatus.COMPLETED:
      return CheckCircle2;
    case MigrationStatus.EXECUTING:
    case MigrationStatus.TRANSFORMING:
      return PlayCircle;
    case MigrationStatus.FAILED:
      return AlertTriangle;
    default:
      return Circle;
  }
}

function getPhaseColor(status: MigrationStatus) {
  switch (status) {
    case MigrationStatus.COMPLETED:
      return 'text-emerald-400';
    case MigrationStatus.EXECUTING:
    case MigrationStatus.TRANSFORMING:
      return 'text-cyan-400';
    case MigrationStatus.FAILED:
      return 'text-rose-400';
    default:
      return 'text-slate-600';
  }
}

function getLineColor(status: MigrationStatus) {
  switch (status) {
    case MigrationStatus.COMPLETED:
      return 'bg-emerald-500';
    case MigrationStatus.EXECUTING:
    case MigrationStatus.TRANSFORMING:
      return 'bg-cyan-500';
    default:
      return 'bg-slate-800';
  }
}

export function ProgressTracker({ phases, overallProgress, estimatedTimeRemaining }: ProgressTrackerProps) {
  return (
    <Card
      header={
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-white">Migration Progress</h3>
            <p className="text-sm text-slate-400">Real-time phase tracking</p>
          </div>
          {estimatedTimeRemaining && (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Clock className="h-4 w-4" />
              <span>{estimatedTimeRemaining} remaining</span>
            </div>
          )}
        </div>
      }
    >
      {/* Overall progress */}
      <div className="mb-6">
        <ProgressBar value={overallProgress} showPercentage size="lg" label="Overall Progress" active={overallProgress < 100} />
      </div>

      {/* Phase timeline */}
      <div className="space-y-0">
        {phases.map((phase, i) => {
          const Icon = getPhaseIcon(phase.status);
          const color = getPhaseColor(phase.status);
          const isActive = phase.status === MigrationStatus.EXECUTING || phase.status === MigrationStatus.TRANSFORMING;

          return (
            <motion.div
              key={phase.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="flex gap-4"
            >
              {/* Timeline column */}
              <div className="flex flex-col items-center">
                <div className={cn('rounded-full p-0.5', isActive && 'animate-pulse')}>
                  <Icon className={cn('h-5 w-5', color)} />
                </div>
                {i < phases.length - 1 && (
                  <div className={cn('mt-1 w-0.5 flex-1', getLineColor(phase.status))} />
                )}
              </div>

              {/* Phase content */}
              <div className={cn('mb-6 flex-1 rounded-lg border p-4', isActive ? 'border-cyan-500/20 bg-cyan-500/5' : 'border-transparent')}>
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-white">{phase.name}</h4>
                  <Badge
                    variant={
                      phase.status === MigrationStatus.COMPLETED ? 'success' :
                      isActive ? 'info' :
                      phase.status === MigrationStatus.FAILED ? 'error' : 'default'
                    }
                    dot
                  >
                    {phase.status === MigrationStatus.COMPLETED ? 'Done' :
                     isActive ? 'In Progress' :
                     phase.status === MigrationStatus.FAILED ? 'Failed' : 'Pending'}
                  </Badge>
                </div>
                {(isActive || phase.status === MigrationStatus.COMPLETED) && (
                  <div className="mt-3">
                    <ProgressBar
                      value={phase.progress}
                      showPercentage
                      size="sm"
                      active={isActive}
                    />
                  </div>
                )}
                {phase.estimatedDuration > 0 && (
                  <p className="mt-2 text-xs text-slate-500">
                    Est. {phase.estimatedDuration}h
                    {phase.actualDuration != null && ` / Actual: ${phase.actualDuration}h`}
                  </p>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </Card>
  );
}
