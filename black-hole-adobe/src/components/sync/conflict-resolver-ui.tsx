'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils/cn';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Conflict } from '@/types/sync';
import { ConflictType, ConflictStrategy } from '@/types/sync';

interface ConflictResolverUIProps {
  conflicts: Conflict[];
  onResolve: (conflictId: string, strategy: ConflictStrategy, notes?: string) => void;
  onAutoResolveAll: () => void;
  resolving?: boolean;
}

const conflictTypeLabels: Record<ConflictType, string> = {
  [ConflictType.BOTH_MODIFIED]: 'Both Modified',
  [ConflictType.SOURCE_DELETED_TARGET_MODIFIED]: 'Source Deleted',
  [ConflictType.TARGET_DELETED_SOURCE_MODIFIED]: 'Target Deleted',
  [ConflictType.BOTH_CREATED_SAME_PATH]: 'Both Created',
};

const conflictTypeVariant: Record<ConflictType, 'warning' | 'error' | 'info' | 'purple'> = {
  [ConflictType.BOTH_MODIFIED]: 'warning',
  [ConflictType.SOURCE_DELETED_TARGET_MODIFIED]: 'error',
  [ConflictType.TARGET_DELETED_SOURCE_MODIFIED]: 'error',
  [ConflictType.BOTH_CREATED_SAME_PATH]: 'purple',
};

export function ConflictResolverUI({
  conflicts,
  onResolve,
  onAutoResolveAll,
  resolving = false,
}: ConflictResolverUIProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (conflicts.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="rounded-xl border border-slate-800 bg-slate-900/80 p-6 text-center"
      >
        <div className="text-emerald-400 text-sm font-medium mb-1">No Conflicts</div>
        <div className="text-xs text-slate-500">All content changes are in sync</div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-slate-800 bg-slate-900/80 backdrop-blur-sm"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-200">Conflicts</h3>
          <Badge variant="warning" dot>
            {conflicts.length}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onAutoResolveAll}
          disabled={resolving}
          className="text-xs"
        >
          Auto-resolve All
        </Button>
      </div>

      {/* Conflict list */}
      <div className="divide-y divide-slate-800">
        <AnimatePresence>
          {conflicts.map((conflict) => (
            <motion.div
              key={conflict.id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              {/* Conflict header */}
              <button
                type="button"
                onClick={() => setExpandedId(expandedId === conflict.id ? null : conflict.id)}
                className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-800/50 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Badge variant={conflictTypeVariant[conflict.type]}>
                    {conflictTypeLabels[conflict.type]}
                  </Badge>
                  <span className="text-xs text-slate-400 truncate font-mono">
                    {conflict.sourceChange.path}
                  </span>
                </div>
                <svg
                  className={cn(
                    'h-4 w-4 text-slate-500 transition-transform shrink-0',
                    expandedId === conflict.id && 'rotate-180',
                  )}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Expanded diff */}
              <AnimatePresence>
                {expandedId === conflict.id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="px-4 pb-4"
                  >
                    <ConflictDiff conflict={conflict} />

                    {/* Resolution buttons */}
                    <div className="flex items-center gap-2 mt-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onResolve(conflict.id, ConflictStrategy.SOURCE_WINS)}
                        disabled={resolving}
                        className="text-xs border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/10"
                      >
                        Accept Source
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onResolve(conflict.id, ConflictStrategy.TARGET_WINS)}
                        disabled={resolving}
                        className="text-xs border border-violet-500/20 text-violet-400 hover:bg-violet-500/10"
                      >
                        Accept Target
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onResolve(conflict.id, ConflictStrategy.MERGE)}
                        disabled={resolving}
                        className="text-xs border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10"
                      >
                        Merge
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function ConflictDiff({ conflict }: { conflict: Conflict }) {
  const sourceData = conflict.sourceChange.after ?? conflict.sourceChange.before ?? {};
  const targetData = conflict.targetChange.after ?? conflict.targetChange.before ?? {};

  const allKeys = Array.from(
    new Set([...Object.keys(sourceData), ...Object.keys(targetData)]),
  ).filter((k) => k !== 'path' && k !== 'hash');

  return (
    <div className="grid grid-cols-2 gap-2 text-xs">
      <div className="rounded-lg bg-cyan-500/5 border border-cyan-500/10 p-3">
        <div className="text-cyan-400 font-medium mb-2">Source</div>
        {allKeys.map((key) => {
          const val = sourceData[key];
          const differs = JSON.stringify(val) !== JSON.stringify(targetData[key]);
          return (
            <div key={key} className="flex justify-between py-0.5">
              <span className="text-slate-500">{key}:</span>
              <span className={cn('font-mono truncate ml-2', differs ? 'text-cyan-300' : 'text-slate-400')}>
                {typeof val === 'object' ? JSON.stringify(val) : String(val ?? '-')}
              </span>
            </div>
          );
        })}
      </div>
      <div className="rounded-lg bg-violet-500/5 border border-violet-500/10 p-3">
        <div className="text-violet-400 font-medium mb-2">Target</div>
        {allKeys.map((key) => {
          const val = targetData[key];
          const differs = JSON.stringify(val) !== JSON.stringify(sourceData[key]);
          return (
            <div key={key} className="flex justify-between py-0.5">
              <span className="text-slate-500">{key}:</span>
              <span className={cn('font-mono truncate ml-2', differs ? 'text-violet-300' : 'text-slate-400')}>
                {typeof val === 'object' ? JSON.stringify(val) : String(val ?? '-')}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
