'use client';

import { motion } from 'framer-motion';
import { Share2, RefreshCw, ArrowRight, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { ScoreRing } from '@/components/ui/score-ring';
import { CategoryCard } from './category-card';
import { UrgencyBanner } from './urgency-banner';
import type { ScanResult } from '@/types/scanner';

interface ScoreResultsProps {
  result: ScanResult;
  onScanAgain: () => void;
}

const GRADE_COLORS: Record<string, string> = {
  A: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  B: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  C: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  D: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
  F: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
};

export function ScoreResults({ result, onScanAgain }: ScoreResultsProps) {
  const gradeClass = GRADE_COLORS[result.grade] ?? GRADE_COLORS.C;
  const benchmark = result.industryBenchmark;

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/score/${result.domain}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      alert('Score URL copied to clipboard!');
    } catch {
      window.open(shareUrl, '_blank');
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 pb-20 sm:px-6">
      {/* Score Header */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="text-center"
      >
        <p className="text-sm text-slate-500">Results for</p>
        <h2 className="mt-1 text-xl font-bold text-white">{result.domain}</h2>

        {/* Large score ring */}
        <div className="mt-8 flex justify-center">
          <ScoreRing score={result.overallScore} size={180} strokeWidth={12} />
        </div>

        {/* Grade badge */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="mt-4 flex items-center justify-center gap-3"
        >
          <span
            className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border text-lg font-bold ${gradeClass}`}
          >
            {result.grade}
          </span>
          <span className="text-slate-400">
            {result.overallScore >= 75
              ? 'Good health'
              : result.overallScore >= 50
                ? 'Needs improvement'
                : 'Critical issues found'}
          </span>
        </motion.div>

        {/* Industry comparison */}
        {benchmark && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 }}
            className="mt-4 inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/80 px-4 py-2 text-sm"
          >
            {benchmark.comparison === 'above' ? (
              <TrendingUp className="h-4 w-4 text-emerald-400" />
            ) : benchmark.comparison === 'below' ? (
              <TrendingDown className="h-4 w-4 text-rose-400" />
            ) : (
              <Minus className="h-4 w-4 text-slate-400" />
            )}
            <span className="text-slate-400">
              Your site scores{' '}
              <span className="font-medium text-white">{result.overallScore}/100</span>
              {' '}&mdash;{' '}
              {benchmark.comparison === 'above'
                ? `above the ${benchmark.industry} average of ${benchmark.averageScore}`
                : benchmark.comparison === 'below'
                  ? `below the ${benchmark.industry} average of ${benchmark.averageScore}`
                  : `at the ${benchmark.industry} average of ${benchmark.averageScore}`}
            </span>
          </motion.div>
        )}

        {benchmark && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.1 }}
            className="mt-2 text-sm text-slate-500"
          >
            You are in the{' '}
            <span className="font-medium text-slate-300">
              {benchmark.percentile < 50
                ? `bottom ${benchmark.percentile}%`
                : `top ${100 - benchmark.percentile}%`}
            </span>{' '}
            of {benchmark.industry} companies
          </motion.p>
        )}
      </motion.div>

      {/* AEM Platform Detection */}
      {result.aemDetected && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mt-8 rounded-xl border border-violet-500/20 bg-violet-500/5 p-4"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/20">
              <span className="text-sm font-bold text-violet-300">AEM</span>
            </div>
            <div>
              <p className="text-sm font-medium text-white">
                Adobe Experience Manager {result.aemVersion ?? ''} Detected
              </p>
              <p className="text-xs text-slate-400">
                Deployment: {result.platformDetails.deployment.replace('-', ' ')}
                {result.platformDetails.indicators.length > 0 && (
                  <> &middot; {result.platformDetails.indicators.length} indicators found</>
                )}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Urgency Banner */}
      {result.aemDetected && (
        <div className="mt-6">
          <UrgencyBanner
            urgency={result.migrationUrgency}
            aemVersion={result.aemVersion}
          />
        </div>
      )}

      {/* Category Cards Grid */}
      <div className="mt-8">
        <h3 className="mb-4 text-base font-semibold text-white">
          Category Breakdown
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <CategoryCard category={result.categories.performance} index={0} />
          <CategoryCard category={result.categories.seo} index={1} />
          <CategoryCard category={result.categories.security} index={2} />
          <CategoryCard category={result.categories.accessibility} index={3} />
          {result.aemDetected && (
            <CategoryCard category={result.categories.migration} index={4} />
          )}
        </div>
      </div>

      {/* Recommendations */}
      {result.recommendations.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="mt-8"
        >
          <h3 className="mb-4 text-base font-semibold text-white">
            Top Recommendations
          </h3>
          <div className="space-y-3">
            {result.recommendations.slice(0, 6).map((finding, i) => (
              <div
                key={i}
                className="rounded-lg border border-slate-800 bg-slate-900/80 p-4"
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-1 inline-block h-2 w-2 shrink-0 rounded-full ${
                      finding.severity === 'critical'
                        ? 'bg-rose-400'
                        : finding.severity === 'high'
                          ? 'bg-orange-400'
                          : finding.severity === 'medium'
                            ? 'bg-amber-400'
                            : 'bg-slate-500'
                    }`}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white">
                        {finding.title}
                      </p>
                      <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] uppercase tracking-wider text-slate-500">
                        {finding.category}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {finding.description}
                    </p>
                    <p className="mt-1 text-xs text-violet-400">
                      {finding.recommendation}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* CTA Section */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1 }}
        id="get-assessment"
        className="mt-10 rounded-2xl border border-violet-500/20 bg-gradient-to-b from-violet-500/10 to-transparent p-8 text-center"
      >
        <h3 className="text-xl font-bold text-white">Get the Full Assessment</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
          This free scan covers the surface. A full Black Hole assessment digs deep
          into your codebase, content structure, integrations, and custom
          components.
        </p>
        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <a
            href="/login"
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-purple-900/30 transition-all hover:from-violet-500 hover:to-purple-500"
          >
            Start Full Assessment
            <ArrowRight className="h-4 w-4" />
          </a>
          <button
            onClick={handleShare}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/50 px-6 py-3 text-sm font-medium text-slate-300 transition-all hover:bg-slate-800 hover:text-white"
          >
            <Share2 className="h-4 w-4" />
            Share Your Score
          </button>
        </div>
      </motion.div>

      {/* Actions bar */}
      <div className="mt-6 flex items-center justify-between">
        <button
          onClick={onScanAgain}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-300 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Scan another site
        </button>
        <p className="text-xs text-slate-600">
          Scanned {new Date(result.scannedAt).toLocaleString()}
        </p>
      </div>
    </div>
  );
}
