'use client';

/**
 * Migration Pre-Flight Page (ADR-036)
 *
 * Cloud Manager quality gate validation for a migration.
 * Accessible at /migrations/[id]/preflight.
 */

import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ShieldCheck,
  AlertCircle,
  List,
  Code2,
} from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { PreFlightReport } from '@/components/migration/preflight-report';

// A migration ID is invalid if it is missing, still a template placeholder,
// or has obvious garbage characters. We keep this loose — the API will do
// the real "does this migration exist" check.
function isValidMigrationId(id: string | undefined): boolean {
  if (!id) return false;
  if (id === '{id}' || id === '[id]' || id === 'undefined' || id === 'null') return false;
  if (id.startsWith('{') || id.startsWith('[')) return false;
  return /^[a-zA-Z0-9_-]+$/.test(id);
}

export default function PreFlightPage() {
  const params = useParams();
  const router = useRouter();
  const migrationId = params.id as string;
  const validId = isValidMigrationId(migrationId);

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

        {/* Invalid migration ID — show guidance instead of a generic error */}
        {!validId ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8"
          >
            <div className="flex flex-col items-center text-center max-w-md mx-auto">
              <div className="rounded-full bg-amber-500/10 p-3 mb-4">
                <AlertCircle className="h-6 w-6 text-amber-400" />
              </div>
              <h2 className="text-lg font-semibold text-white mb-2">
                Select a migration to run pre-flight
              </h2>
              <p className="text-sm text-slate-400 mb-6">
                Pre-flight analysis runs against a specific migration&apos;s code.
                You can either choose an existing migration from the list, or
                run a standalone check with code you paste directly.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 w-full">
                <Link
                  href="/migrations"
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-700 transition-colors"
                >
                  <List className="h-4 w-4" />
                  Choose a migration
                </Link>
                <Link
                  href="/migrations/new/code"
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-2.5 text-sm font-medium text-cyan-300 hover:bg-cyan-500/20 transition-colors"
                >
                  <Code2 className="h-4 w-4" />
                  Run standalone check
                </Link>
              </div>
              {migrationId && !validId && (
                <p className="mt-4 text-xs text-slate-500 font-mono">
                  Invalid migration ID in URL:{' '}
                  <span className="text-slate-400">{migrationId}</span>
                </p>
              )}
            </div>
          </motion.div>
        ) : (
          <PreFlightReport migrationId={migrationId} />
        )}
      </div>
    </div>
  );
}
