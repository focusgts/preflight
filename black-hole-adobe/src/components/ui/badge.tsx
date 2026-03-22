'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils/cn';
import type { MigrationStatus, Severity, CompatibilityLevel } from '@/types';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-slate-800 text-slate-300 border border-slate-700',
        success: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
        warning: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
        error: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
        info: 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20',
        purple: 'bg-violet-500/10 text-violet-400 border border-violet-500/20',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

interface BadgeProps extends VariantProps<typeof badgeVariants> {
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}

export function Badge({ children, variant, className, dot }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)}>
      {dot && (
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            variant === 'success' && 'bg-emerald-400',
            variant === 'warning' && 'bg-amber-400',
            variant === 'error' && 'bg-rose-400',
            variant === 'info' && 'bg-cyan-400',
            variant === 'purple' && 'bg-violet-400',
            (!variant || variant === 'default') && 'bg-slate-400'
          )}
        />
      )}
      {children}
    </span>
  );
}

const statusVariantMap: Record<MigrationStatus, 'default' | 'success' | 'warning' | 'error' | 'info' | 'purple'> = {
  draft: 'default',
  assessing: 'info',
  assessed: 'info',
  planning: 'purple',
  planned: 'purple',
  transforming: 'warning',
  executing: 'warning',
  validating: 'info',
  completed: 'success',
  failed: 'error',
  cancelled: 'default',
};

const statusLabelMap: Record<MigrationStatus, string> = {
  draft: 'Draft',
  assessing: 'Assessing',
  assessed: 'Assessed',
  planning: 'Planning',
  planned: 'Planned',
  transforming: 'Transforming',
  executing: 'Executing',
  validating: 'Validating',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

export function StatusBadge({ status, className }: { status: MigrationStatus; className?: string }) {
  return (
    <Badge variant={statusVariantMap[status]} dot className={className}>
      {statusLabelMap[status]}
    </Badge>
  );
}

const severityVariantMap: Record<Severity, 'default' | 'success' | 'warning' | 'error' | 'info' | 'purple'> = {
  critical: 'error',
  high: 'warning',
  medium: 'purple',
  low: 'info',
  info: 'default',
};

export function SeverityBadge({ severity, className }: { severity: Severity; className?: string }) {
  return (
    <Badge variant={severityVariantMap[severity]} className={className}>
      {severity.charAt(0).toUpperCase() + severity.slice(1)}
    </Badge>
  );
}

const compatVariantMap: Record<CompatibilityLevel, 'default' | 'success' | 'warning' | 'error' | 'info' | 'purple'> = {
  compatible: 'success',
  auto_fixable: 'info',
  manual_fix: 'warning',
  blocker: 'error',
};

const compatLabelMap: Record<CompatibilityLevel, string> = {
  compatible: 'Compatible',
  auto_fixable: 'Auto-fixable',
  manual_fix: 'Manual Fix',
  blocker: 'Blocker',
};

export function CompatibilityBadge({ level, className }: { level: CompatibilityLevel; className?: string }) {
  return (
    <Badge variant={compatVariantMap[level]} className={className}>
      {compatLabelMap[level]}
    </Badge>
  );
}
