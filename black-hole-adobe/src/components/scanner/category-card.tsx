'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Zap,
  Search,
  Shield,
  Eye,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { CategoryScore } from '@/types/scanner';

interface CategoryCardProps {
  category: CategoryScore;
  index: number;
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  Performance: Zap,
  SEO: Search,
  Security: Shield,
  Accessibility: Eye,
  'Migration Risk': ArrowUpRight,
};

const GRADE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  A: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  B: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
  C: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  D: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30' },
  F: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30' },
};

function scoreBarColor(score: number): string {
  if (score >= 75) return 'from-emerald-500 to-emerald-400';
  if (score >= 60) return 'from-amber-500 to-amber-400';
  return 'from-rose-500 to-rose-400';
}

export function CategoryCard({ category, index }: CategoryCardProps) {
  const [expanded, setExpanded] = useState(false);
  const Icon = CATEGORY_ICONS[category.name] ?? Zap;
  const gradeStyle = GRADE_COLORS[category.grade] ?? GRADE_COLORS.C;
  const topFindings = category.findings.slice(0, 3);
  const remainingFindings = category.findings.slice(3);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + index * 0.08 }}
      className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 backdrop-blur-sm transition-all hover:border-slate-700"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800">
            <Icon className="h-4.5 w-4.5 text-slate-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">{category.name}</h3>
            <p className="text-xs text-slate-500">Weight: {Math.round(category.weight * 100)}%</p>
          </div>
        </div>
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${gradeStyle.bg} ${gradeStyle.border} border`}
        >
          <span className={`text-sm font-bold ${gradeStyle.text}`}>
            {category.grade}
          </span>
        </div>
      </div>

      {/* Score bar */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">Score</span>
          <span className="font-medium text-white">{category.score}/100</span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-800">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${category.score}%` }}
            transition={{ duration: 1, ease: 'easeOut', delay: 0.3 + index * 0.1 }}
            className={`h-full rounded-full bg-gradient-to-r ${scoreBarColor(category.score)}`}
          />
        </div>
      </div>

      {/* Top findings */}
      {topFindings.length > 0 && (
        <div className="mt-4 space-y-2">
          {topFindings.map((finding, i) => (
            <div
              key={i}
              className="flex items-start gap-2 text-xs"
            >
              <span
                className={`mt-0.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                  finding.severity === 'critical'
                    ? 'bg-rose-400'
                    : finding.severity === 'high'
                      ? 'bg-orange-400'
                      : finding.severity === 'medium'
                        ? 'bg-amber-400'
                        : 'bg-slate-500'
                }`}
              />
              <span className="text-slate-400">{finding.title}</span>
            </div>
          ))}
        </div>
      )}

      {/* Expandable remaining findings */}
      {remainingFindings.length > 0 && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-3 flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 transition-colors"
          >
            {expanded ? (
              <>
                Hide details <ChevronUp className="h-3 w-3" />
              </>
            ) : (
              <>
                +{remainingFindings.length} more findings <ChevronDown className="h-3 w-3" />
              </>
            )}
          </button>

          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-2 space-y-2 overflow-hidden"
            >
              {remainingFindings.map((finding, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span
                    className={`mt-0.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
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
                    <span className="text-slate-400">{finding.title}</span>
                    <p className="mt-0.5 text-slate-600">{finding.recommendation}</p>
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </>
      )}
    </motion.div>
  );
}
