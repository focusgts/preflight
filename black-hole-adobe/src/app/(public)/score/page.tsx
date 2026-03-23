'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { ScoreHero } from '@/components/scanner/score-hero';
import { ScoreResults } from '@/components/scanner/score-results';
import type { ScanResult, ScanPhase } from '@/types/scanner';

// ── Scan Phase Config ─────────────────────────────────────
const PHASES: { phase: ScanPhase; label: string; duration: number }[] = [
  { phase: 'detecting', label: 'Detecting Platform', duration: 800 },
  { phase: 'performance', label: 'Checking Performance', duration: 600 },
  { phase: 'seo', label: 'Analyzing SEO', duration: 500 },
  { phase: 'security', label: 'Testing Security', duration: 500 },
  { phase: 'accessibility', label: 'Checking Accessibility', duration: 400 },
  { phase: 'scoring', label: 'Calculating Score', duration: 300 },
];

export default function ScorePage() {
  const [scanning, setScanning] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<ScanPhase>('detecting');
  const [scanUrl, setScanUrl] = useState('');
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState('');

  const runScan = useCallback(async (url: string) => {
    setScanning(true);
    setScanUrl(url);
    setResult(null);
    setError('');

    // Animate through phases while the real request runs
    const phasePromise = (async () => {
      for (const { phase, duration } of PHASES) {
        setCurrentPhase(phase);
        await new Promise((r) => setTimeout(r, duration));
      }
    })();

    const fetchPromise = fetch('/api/scanner', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    }).then(async (res) => {
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message ?? 'Scan failed');
      }
      return data.data as ScanResult;
    });

    try {
      const [, scanResult] = await Promise.all([phasePromise, fetchPromise]);
      setCurrentPhase('complete');
      setResult(scanResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed. Please try again.');
    } finally {
      setScanning(false);
    }
  }, []);

  const handleScanAgain = useCallback(() => {
    setResult(null);
    setError('');
    setScanUrl('');
    setCurrentPhase('detecting');
  }, []);

  return (
    <div>
      <AnimatePresence mode="wait">
        {/* Hero + Input (show when no results) */}
        {!result && !scanning && (
          <motion.div
            key="hero"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <ScoreHero
              onScan={runScan}
              isScanning={scanning}
            />

            {error && (
              <div className="mx-auto max-w-xl px-4">
                <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-center text-sm text-rose-400">
                  {error}
                </div>
              </div>
            )}

            {/* How it works */}
            <div className="mx-auto max-w-4xl px-4 pb-20 sm:px-6">
              <div className="grid gap-6 sm:grid-cols-3">
                {[
                  {
                    step: '01',
                    title: 'Enter Your URL',
                    desc: 'Just paste your website address. No login, no credentials, no setup.',
                  },
                  {
                    step: '02',
                    title: 'Instant Analysis',
                    desc: 'We scan performance, SEO, security, accessibility, and detect your AEM version.',
                  },
                  {
                    step: '03',
                    title: 'Get Your Score',
                    desc: 'Receive a detailed health report with prioritized recommendations.',
                  },
                ].map((item) => (
                  <motion.div
                    key={item.step}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 + parseInt(item.step) * 0.1 }}
                    className="rounded-xl border border-slate-800/50 bg-slate-900/40 p-6 text-center"
                  >
                    <span className="text-xs font-bold text-violet-500">
                      {item.step}
                    </span>
                    <h3 className="mt-2 text-sm font-semibold text-white">
                      {item.title}
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">{item.desc}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Scanning Progress */}
        {scanning && (
          <motion.div
            key="scanning"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex min-h-[60vh] items-center justify-center px-4"
          >
            <div className="text-center">
              {/* Animated scanner visual */}
              <div className="relative mx-auto mb-8 h-32 w-32">
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-violet-500/30"
                  animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                <motion.div
                  className="absolute inset-2 rounded-full border-2 border-cyan-500/30"
                  animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity, delay: 0.3 }}
                />
                <div className="absolute inset-4 flex items-center justify-center rounded-full bg-slate-800/80 backdrop-blur-sm">
                  <Loader2 className="h-10 w-10 animate-spin text-violet-400" />
                </div>
              </div>

              <p className="text-lg font-medium text-white">
                Scanning{' '}
                <span className="text-violet-400">{scanUrl}</span>
              </p>

              {/* Phase indicators */}
              <div className="mx-auto mt-8 max-w-sm space-y-2">
                {PHASES.map(({ phase, label }, i) => {
                  const phaseIndex = PHASES.findIndex(
                    (p) => p.phase === currentPhase,
                  );
                  const isComplete = i < phaseIndex;
                  const isActive = i === phaseIndex;

                  return (
                    <div
                      key={phase}
                      className="flex items-center gap-3 text-sm"
                    >
                      <div
                        className={`h-2 w-2 rounded-full transition-colors ${
                          isComplete
                            ? 'bg-emerald-400'
                            : isActive
                              ? 'animate-pulse bg-violet-400'
                              : 'bg-slate-700'
                        }`}
                      />
                      <span
                        className={`transition-colors ${
                          isComplete
                            ? 'text-slate-500'
                            : isActive
                              ? 'font-medium text-white'
                              : 'text-slate-600'
                        }`}
                      >
                        {label}
                      </span>
                      {isComplete && (
                        <span className="text-xs text-emerald-500">Done</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}

        {/* Results */}
        {result && !scanning && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="pt-8"
          >
            <ScoreResults result={result} onScanAgain={handleScanAgain} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
