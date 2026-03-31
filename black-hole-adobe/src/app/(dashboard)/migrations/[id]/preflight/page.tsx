'use client';

/**
 * Migration Pre-Flight Page (ADR-036)
 *
 * Cloud Manager quality gate validation for a migration.
 * Accessible at /migrations/[id]/preflight.
 */

import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import { PreFlightReport } from '@/components/migration/preflight-report';

export default function PreFlightPage() {
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
            <ShieldCheck className="h-5 w-5 text-cyan-400" />
            <h1 className="text-xl font-semibold">Cloud Manager Pre-Flight</h1>
          </div>
          <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-400 border border-cyan-500/20">
            QUALITY GATE
          </span>
        </div>

        {/* Description */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-sm text-slate-400 mb-8 max-w-2xl"
        >
          Validate your migration code against Cloud Manager quality gate rules
          that Adobe Best Practice Analyzer does not check. Covers SonarQube
          custom rules, OakPAL content-package index validation, and Java
          runtime compatibility for AEM as a Cloud Service.
        </motion.p>

        {/* Report */}
        <PreFlightReport migrationId={migrationId} />
      </div>
    </div>
  );
}
