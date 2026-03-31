'use client';

/**
 * Migration Regression Page (ADR-034)
 *
 * Content-based visual regression testing for a migration.
 * Accessible at /migrations/[id]/regression.
 */

import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Gauge } from 'lucide-react';
import { motion } from 'framer-motion';
import { RegressionReport } from '@/components/migration/regression-report';

export default function RegressionPage() {
  const params = useParams();
  const router = useRouter();
  const migrationId = params.id as string;

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
            <Gauge className="h-5 w-5 text-cyan-400" />
            <h1 className="text-xl font-semibold">Visual Regression</h1>
          </div>
          <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-400 border border-cyan-500/20">
            VALIDATION
          </span>
        </div>

        {/* Description */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-sm text-slate-400 mb-8 max-w-2xl"
        >
          Compare your source and target environments to detect content
          regressions. Checks page inventory, SEO metadata, content integrity,
          and response performance across all crawled pages.
        </motion.p>

        {/* Report */}
        <RegressionReport migrationId={migrationId} />
      </div>
    </div>
  );
}
