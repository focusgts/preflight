'use client';

import { useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Circle,
  ExternalLink,
  Loader2,
  Package,
  Sparkles,
  TicketCheck,
  BookOpen,
  TrendingUp,
  Brain,
  Database,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { HandoffSummary } from '@/components/migration/handoff-summary';
import type { ExportResult } from '@/lib/bridge';
import type { HandoffReport } from '@/lib/bridge';

// ── Types ─────────────────────────────────────────────────────

interface ExportStep {
  id: string;
  label: string;
  icon: typeof Building2;
  count?: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

interface ExportResponse {
  success: boolean;
  data: {
    exportResult: ExportResult;
    handoffReport: HandoffReport;
  } | null;
  error: { message: string } | null;
}

// ── Component ─────────────────────────────────────────────────

export default function HandoffPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const migrationId = params.id;

  const [exporting, setExporting] = useState(false);
  const [exportDone, setExportDone] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [result, setResult] = useState<ExportResult | null>(null);
  const [report, setReport] = useState<HandoffReport | null>(null);

  const [steps, setSteps] = useState<ExportStep[]>([
    { id: 'org', label: 'Creating organization', icon: Building2, status: 'pending' },
    { id: 'tickets', label: 'Exporting tickets', icon: TicketCheck, status: 'pending' },
    { id: 'kb', label: 'Generating KB articles', icon: BookOpen, status: 'pending' },
    { id: 'roi', label: 'Importing ROI data', icon: TrendingUp, status: 'pending' },
    { id: 'memories', label: 'Storing Navi memories', icon: Brain, status: 'pending' },
    { id: 'ruvector', label: 'Indexing in RuVector', icon: Database, status: 'pending' },
  ]);

  const updateStep = useCallback(
    (id: string, status: ExportStep['status'], count?: number) => {
      setSteps((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, status, count: count ?? s.count } : s,
        ),
      );
    },
    [],
  );

  const runExport = useCallback(async () => {
    setExporting(true);
    setExportError(null);

    // Animate steps sequentially for visual feedback
    const stepIds = ['org', 'tickets', 'kb', 'roi', 'memories', 'ruvector'];
    let currentStep = 0;

    const progressInterval = setInterval(() => {
      if (currentStep < stepIds.length) {
        if (currentStep > 0) {
          updateStep(stepIds[currentStep - 1], 'completed');
        }
        updateStep(stepIds[currentStep], 'in_progress');
        currentStep++;
      }
    }, 800);

    try {
      const res = await fetch(`/api/migrations/${migrationId}/export`, {
        method: 'POST',
      });
      const json: ExportResponse = await res.json();

      clearInterval(progressInterval);

      if (!json.success || !json.data) {
        throw new Error(json.error?.message ?? 'Export failed');
      }

      // Mark all steps completed with counts
      const er = json.data.exportResult;
      updateStep('org', 'completed');
      updateStep('tickets', er.tickets.failed > 0 ? 'failed' : 'completed', er.tickets.exported);
      updateStep('kb', er.knowledgeArticles.failed > 0 ? 'failed' : 'completed', er.knowledgeArticles.exported);
      updateStep('roi', er.roiEntries.failed > 0 ? 'failed' : 'completed', er.roiEntries.exported);
      updateStep('memories', er.memories.failed > 0 ? 'failed' : 'completed', er.memories.exported);
      updateStep('ruvector', er.ruVectorEntries.failed > 0 ? 'failed' : 'completed', er.ruVectorEntries.exported);

      setResult(er);
      setReport(json.data.handoffReport);
      setExportDone(true);
    } catch (err) {
      clearInterval(progressInterval);
      const message = err instanceof Error ? err.message : 'Export failed';
      setExportError(message);
      // Mark remaining steps as failed
      stepIds.forEach((id) => {
        setSteps((prev) =>
          prev.map((s) =>
            s.id === id && s.status !== 'completed'
              ? { ...s, status: 'failed' }
              : s,
          ),
        );
      });
    } finally {
      setExporting(false);
    }
  }, [migrationId, updateStep]);

  const navigatorUrl = result
    ? `https://navigator-portal-api-yfokmdhikq-uc.a.run.app/organizations/${result.organizationId}`
    : null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Navigator Handoff</h1>
          <p className="mt-1 text-sm text-slate-400">
            Export completed migration data to the Navigator Portal for ongoing managed services.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/migrations')}
        >
          Back to Migrations
        </Button>
      </div>

      {/* Export progress card */}
      <Card
        gradient
        header={
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10">
              <Package className="h-5 w-5 text-violet-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Export to Navigator</h2>
              <p className="text-sm text-slate-400">
                {exportDone
                  ? `Completed in ${((result?.durationMs ?? 0) / 1000).toFixed(1)}s (${result?.mode ?? 'demo'} mode)`
                  : 'Transfer migration data, KB articles, and context to Navigator'}
              </p>
            </div>
          </div>
        }
      >
        {/* Steps list */}
        <div className="space-y-3">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className={cn(
                  'flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors',
                  step.status === 'completed'
                    ? 'border-emerald-500/20 bg-emerald-500/5'
                    : step.status === 'in_progress'
                    ? 'border-cyan-500/30 bg-cyan-500/5'
                    : step.status === 'failed'
                    ? 'border-rose-500/20 bg-rose-500/5'
                    : 'border-slate-800 bg-slate-900/50',
                )}
              >
                <Icon
                  className={cn(
                    'h-5 w-5',
                    step.status === 'completed'
                      ? 'text-emerald-400'
                      : step.status === 'in_progress'
                      ? 'text-cyan-400'
                      : step.status === 'failed'
                      ? 'text-rose-400'
                      : 'text-slate-600',
                  )}
                />
                <span
                  className={cn(
                    'flex-1 text-sm',
                    step.status === 'completed'
                      ? 'text-emerald-300'
                      : step.status === 'in_progress'
                      ? 'text-cyan-300'
                      : step.status === 'failed'
                      ? 'text-rose-300'
                      : 'text-slate-400',
                  )}
                >
                  {step.label}
                  {step.count !== undefined && step.status === 'completed' && (
                    <span className="ml-1 text-slate-500">({step.count})</span>
                  )}
                </span>
                <StepIndicator status={step.status} />
              </motion.div>
            );
          })}
        </div>

        {/* Action buttons */}
        <div className="mt-6 flex items-center gap-3">
          {!exportDone && !exporting && (
            <Button onClick={runExport} size="lg">
              <ArrowRight className="h-4 w-4" />
              Export to Navigator
            </Button>
          )}
          {exporting && (
            <Button disabled size="lg">
              <Loader2 className="h-4 w-4 animate-spin" />
              Exporting...
            </Button>
          )}
          {exportError && (
            <div className="flex items-center gap-2 rounded-lg border border-rose-500/20 bg-rose-500/5 px-4 py-2 text-sm text-rose-300">
              <AlertTriangle className="h-4 w-4" />
              {exportError}
            </div>
          )}
        </div>
      </Card>

      {/* Success state */}
      <AnimatePresence>
        {exportDone && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Success banner */}
            <Card gradient>
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
                  <Sparkles className="h-6 w-6 text-emerald-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white">
                    Migration Complete — Customer Ready for Navigator
                  </h3>
                  <p className="mt-1 text-sm text-slate-400">
                    All data has been exported. The customer environment is set up in Navigator with
                    full context from this migration.
                  </p>
                </div>
                {navigatorUrl && (
                  <Button
                    variant="secondary"
                    onClick={() => window.open(navigatorUrl, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open in Navigator
                  </Button>
                )}
              </div>
            </Card>

            {/* Handoff summary component */}
            {report && <HandoffSummary report={report} result={result} />}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────

function StepIndicator({ status }: { status: ExportStep['status'] }) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-5 w-5 text-emerald-400" />;
    case 'in_progress':
      return <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />;
    case 'failed':
      return <AlertTriangle className="h-5 w-5 text-rose-400" />;
    default:
      return <Circle className="h-5 w-5 text-slate-700" />;
  }
}
