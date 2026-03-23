'use client';

/**
 * Migration Simulation Page
 *
 * Lets customers run the full migration in dry-run mode.
 * Shows live progress, risk matrix, issues, and timeline predictions.
 */

import { useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Play,
  Loader2,
  FlaskConical,
  Gauge,
  Zap,
  Search,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { SimulationReportDisplay } from '@/components/simulation/simulation-report';
import type { SimulationReport, SimulationDepth, SimulationProgress } from '@/types/simulation';

// ── Depth Options ────────────────────────────────────────────────────────

interface DepthOption {
  value: SimulationDepth;
  label: string;
  description: string;
  duration: string;
  icon: typeof Zap;
}

const DEPTH_OPTIONS: DepthOption[] = [
  {
    value: 'quick',
    label: 'Quick Scan',
    description: 'Fast overview of major risks',
    duration: '~2 min',
    icon: Zap,
  },
  {
    value: 'standard',
    label: 'Standard',
    description: 'Balanced analysis with risk matrix',
    duration: '~10 min',
    icon: Gauge,
  },
  {
    value: 'thorough',
    label: 'Thorough',
    description: 'Deep analysis with edge case detection',
    duration: '~30 min',
    icon: Search,
  },
];

const PHASE_LABELS: Record<string, string> = {
  assessment: 'Assessment',
  code_modernization: 'Code Modernization',
  content_migration: 'Content Migration',
  integration_reconnection: 'Integration Reconnection',
  validation: 'Validation',
};

// ── Page Component ───────────────────────────────────────────────────────

export default function SimulatePage() {
  const params = useParams();
  const router = useRouter();
  const migrationId = params.id as string;

  const [depth, setDepth] = useState<SimulationDepth>('standard');
  const [showDepthMenu, setShowDepthMenu] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<SimulationProgress | null>(null);
  const [report, setReport] = useState<SimulationReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'results' | 'compare'>('results');

  const selectedDepth = DEPTH_OPTIONS.find((d) => d.value === depth)!;

  const runSimulation = useCallback(async () => {
    setIsRunning(true);
    setError(null);
    setReport(null);
    setProgress({
      currentPhase: 'assessment',
      completedPhases: [],
      overallPercent: 0,
      phasePercents: {
        assessment: 0,
        code_modernization: 0,
        content_migration: 0,
        integration_reconnection: 0,
        validation: 0,
      },
      startedAt: new Date().toISOString(),
      estimatedRemainingMs: null,
    });

    try {
      const res = await fetch('/api/simulations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          migrationId,
          depth,
          generateDiffs: true,
          validateIntegrations: true,
        }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error?.message ?? 'Simulation failed');
      }

      const body = await res.json();
      setReport(body.data.report);
      setProgress((prev) => prev ? { ...prev, overallPercent: 100, currentPhase: null } : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsRunning(false);
    }
  }, [migrationId, depth]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <div className="h-4 w-px bg-slate-700" />
          <div className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-purple-400" />
            <h1 className="text-xl font-semibold">Migration Simulation</h1>
          </div>
          <span className="rounded-full bg-purple-500/10 px-3 py-1 text-xs font-medium text-purple-400 border border-purple-500/20">
            DRY RUN
          </span>
        </div>

        {/* Description */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-sm text-slate-400 mb-8 max-w-2xl"
        >
          Run the entire migration in a sandbox without touching production.
          See exactly what would happen, identify risks before they occur,
          and get a confidence score for your migration.
        </motion.p>

        {/* Controls */}
        {!report && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-slate-700 bg-slate-800/50 p-6 mb-8"
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              {/* Depth Selector */}
              <div className="relative">
                <button
                  onClick={() => setShowDepthMenu(!showDepthMenu)}
                  disabled={isRunning}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border border-slate-600 bg-slate-700/50 px-4 py-3 text-left transition-colors min-w-[240px]',
                    isRunning ? 'opacity-50 cursor-not-allowed' : 'hover:border-slate-500',
                  )}
                >
                  <selectedDepth.icon className="h-4 w-4 text-purple-400" />
                  <div className="flex-1">
                    <span className="block text-sm font-medium text-slate-200">
                      {selectedDepth.label}
                    </span>
                    <span className="block text-xs text-slate-400">
                      {selectedDepth.duration}
                    </span>
                  </div>
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                </button>

                <AnimatePresence>
                  {showDepthMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="absolute z-10 mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 shadow-xl"
                    >
                      {DEPTH_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => {
                            setDepth(opt.value);
                            setShowDepthMenu(false);
                          }}
                          className={cn(
                            'w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-700/50 transition-colors first:rounded-t-lg last:rounded-b-lg',
                            depth === opt.value && 'bg-slate-700/30',
                          )}
                        >
                          <opt.icon className="h-4 w-4 text-purple-400" />
                          <div className="flex-1">
                            <span className="block text-sm font-medium text-slate-200">
                              {opt.label}
                            </span>
                            <span className="block text-xs text-slate-400">
                              {opt.description} - {opt.duration}
                            </span>
                          </div>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Run Button */}
              <button
                onClick={runSimulation}
                disabled={isRunning}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-medium transition-all',
                  isRunning
                    ? 'bg-purple-500/20 text-purple-300 cursor-not-allowed'
                    : 'bg-purple-600 text-white hover:bg-purple-500 shadow-lg shadow-purple-500/20',
                )}
              >
                {isRunning ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Running Simulation...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    Run Simulation
                  </>
                )}
              </button>
            </div>

            {/* Progress */}
            <AnimatePresence>
              {isRunning && progress && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-6 space-y-3"
                >
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>
                      {progress.currentPhase
                        ? PHASE_LABELS[progress.currentPhase] ?? progress.currentPhase
                        : 'Preparing...'}
                    </span>
                    <span>{progress.overallPercent}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-purple-500 to-blue-500"
                      initial={{ width: '0%' }}
                      animate={{ width: `${progress.overallPercent}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                  <div className="flex gap-2">
                    {Object.entries(progress.phasePercents).map(([phase, pct]) => (
                      <div
                        key={phase}
                        className={cn(
                          'flex-1 h-1 rounded-full transition-colors',
                          pct === 100
                            ? 'bg-emerald-500'
                            : phase === progress.currentPhase
                              ? 'bg-purple-500 animate-pulse'
                              : 'bg-slate-700',
                        )}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error */}
            {error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-4 text-sm text-rose-400"
              >
                {error}
              </motion.p>
            )}
          </motion.div>
        )}

        {/* Results */}
        <AnimatePresence>
          {report && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              {/* Tab bar */}
              <div className="flex items-center gap-1 mb-6 border-b border-slate-700">
                <button
                  onClick={() => setActiveTab('results')}
                  className={cn(
                    'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                    activeTab === 'results'
                      ? 'border-purple-500 text-purple-400'
                      : 'border-transparent text-slate-400 hover:text-slate-200',
                  )}
                >
                  Simulation Results
                </button>
                <button
                  onClick={() => setActiveTab('compare')}
                  className={cn(
                    'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                    activeTab === 'compare'
                      ? 'border-purple-500 text-purple-400'
                      : 'border-transparent text-slate-400 hover:text-slate-200',
                  )}
                >
                  Compare
                  {report.comparisonData && (
                    <span className="ml-1.5 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-400">
                      available
                    </span>
                  )}
                </button>
                <div className="flex-1" />
                <button
                  onClick={() => {
                    setReport(null);
                    setProgress(null);
                  }}
                  className="text-xs text-slate-400 hover:text-slate-200 px-3 py-2"
                >
                  Run Again
                </button>
              </div>

              {activeTab === 'results' && (
                <SimulationReportDisplay report={report} />
              )}

              {activeTab === 'compare' && (
                <div className="text-center py-16">
                  {report.comparisonData ? (
                    <SimulationReportDisplay report={report} />
                  ) : (
                    <div className="space-y-3">
                      <p className="text-slate-400 text-sm">
                        Comparison data is available after the real migration completes.
                      </p>
                      <p className="text-slate-500 text-xs">
                        Run the migration, then return here to see how the simulation
                        predictions compared to actual results.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
