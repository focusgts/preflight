'use client';

/**
 * Validation Results Display
 *
 * Shows errors, warnings, and success state for migration config validation.
 */

import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils/cn';
import type { ConfigValidationError, ConfigValidationWarning } from '@/lib/mac/schema';

interface ValidationResultsProps {
  valid: boolean | null;
  errors: ConfigValidationError[];
  warnings: ConfigValidationWarning[];
  className?: string;
}

export function ValidationResults({
  valid,
  errors,
  warnings,
  className,
}: ValidationResultsProps) {
  const [expandedErrors, setExpandedErrors] = useState(true);
  const [expandedWarnings, setExpandedWarnings] = useState(true);

  if (valid === null) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn('rounded-lg border', className)}
    >
      {/* Status header */}
      {valid ? (
        <div className="flex items-center gap-3 px-4 py-3 bg-emerald-500/10 border-b border-emerald-500/20 rounded-t-lg">
          <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-none" />
          <div>
            <p className="text-sm font-medium text-emerald-300">
              Configuration is valid
            </p>
            {warnings.length > 0 && (
              <p className="text-xs text-emerald-400/70 mt-0.5">
                {warnings.length} warning{warnings.length !== 1 ? 's' : ''} found
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 px-4 py-3 bg-rose-500/10 border-b border-rose-500/20 rounded-t-lg">
          <AlertCircle className="h-5 w-5 text-rose-400 flex-none" />
          <div>
            <p className="text-sm font-medium text-rose-300">
              Configuration has {errors.length} error{errors.length !== 1 ? 's' : ''}
            </p>
            <p className="text-xs text-rose-400/70 mt-0.5">
              Fix all errors before executing
            </p>
          </div>
        </div>
      )}

      <div className="bg-slate-900/50 rounded-b-lg">
        {/* Errors */}
        <AnimatePresence>
          {errors.length > 0 && (
            <div className="border-b border-slate-800 last:border-b-0">
              <button
                onClick={() => setExpandedErrors(!expandedErrors)}
                className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-rose-400 hover:bg-slate-800/50 transition-colors"
              >
                {expandedErrors ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <AlertCircle className="h-4 w-4" />
                <span className="font-medium">
                  Errors ({errors.length})
                </span>
              </button>
              {expandedErrors && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <ul className="px-4 pb-3 space-y-2">
                    {errors.map((err, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-sm"
                      >
                        <span className="text-rose-500 font-mono text-xs bg-rose-500/10 px-1.5 py-0.5 rounded flex-none mt-0.5">
                          {err.path || 'root'}
                        </span>
                        <span className="text-slate-300">{err.message}</span>
                        {err.line && (
                          <span className="text-slate-500 text-xs flex-none">
                            line {err.line}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )}
            </div>
          )}
        </AnimatePresence>

        {/* Warnings */}
        <AnimatePresence>
          {warnings.length > 0 && (
            <div className="border-b border-slate-800 last:border-b-0">
              <button
                onClick={() => setExpandedWarnings(!expandedWarnings)}
                className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-amber-400 hover:bg-slate-800/50 transition-colors"
              >
                {expandedWarnings ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <AlertTriangle className="h-4 w-4" />
                <span className="font-medium">
                  Warnings ({warnings.length})
                </span>
              </button>
              {expandedWarnings && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <ul className="px-4 pb-3 space-y-2">
                    {warnings.map((warn, i) => (
                      <li key={i} className="text-sm">
                        <div className="flex items-start gap-2">
                          <span className="text-amber-500 font-mono text-xs bg-amber-500/10 px-1.5 py-0.5 rounded flex-none mt-0.5">
                            {warn.path}
                          </span>
                          <span className="text-slate-300">{warn.message}</span>
                        </div>
                        {warn.suggestion && (
                          <div className="flex items-start gap-1.5 mt-1 ml-[calc(0.375rem+var(--path-width,4rem))]">
                            <Lightbulb className="h-3.5 w-3.5 text-cyan-400 flex-none mt-0.5" />
                            <span className="text-xs text-cyan-300/80">
                              {warn.suggestion}
                            </span>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )}
            </div>
          )}
        </AnimatePresence>

        {/* Success with no warnings */}
        {valid && errors.length === 0 && warnings.length === 0 && (
          <div className="px-4 py-3 text-sm text-slate-400">
            No issues found. Configuration is ready for execution.
          </div>
        )}
      </div>
    </motion.div>
  );
}
