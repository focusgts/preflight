'use client';

/**
 * Migration-as-Code Editor Page
 *
 * Full-featured YAML editor for defining migrations declaratively.
 * Supports templates, validation, dry-run, and execution.
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Code2,
  FileCheck,
  Play,
  Eye,
  Download,
  Upload,
  ChevronDown,
  ArrowLeft,
  Loader2,
  Rocket,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/button';
import { YAMLEditor } from '@/components/mac/yaml-editor';
import { ValidationResults } from '@/components/mac/validation-results';
import type {
  ConfigValidationError,
  ConfigValidationWarning,
  TemplateName,
} from '@/lib/mac/schema';

// ── Template list (matches backend) ─────────────────────────

const TEMPLATES: Array<{ name: TemplateName; label: string }> = [
  { name: 'aem-onprem-to-cloud', label: 'AEM 6.5 On-Prem to Cloud Service' },
  { name: 'aem-ams-to-cloud', label: 'AEM Managed Services to Cloud Service' },
  { name: 'wordpress-to-aem', label: 'WordPress to AEM Sites' },
  { name: 'sitecore-to-aem', label: 'Sitecore to AEM Sites' },
  { name: 'ga-to-cja', label: 'Google Analytics to CJA' },
  { name: 'campaign-std-to-v8', label: 'Campaign Standard to v8' },
  { name: 'aam-to-rtcdp', label: 'Audience Manager to RTCDP' },
];

// ── Component ────────────────────────────────────────────────

export default function MigrationAsCodePage() {
  const [yaml, setYaml] = useState('');
  const [templateOpen, setTemplateOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  // Validation state
  const [validationValid, setValidationValid] = useState<boolean | null>(null);
  const [validationErrors, setValidationErrors] = useState<ConfigValidationError[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<ConfigValidationWarning[]>([]);
  const [errorLines, setErrorLines] = useState<number[]>([]);

  // Action state
  const [loading, setLoading] = useState<string | null>(null);
  const [dryRunResult, setDryRunResult] = useState<Record<string, unknown> | null>(null);
  const [executionResult, setExecutionResult] = useState<Record<string, unknown> | null>(null);

  // ── Load template ──────────────────────────────────────────

  const loadTemplate = useCallback(async (type: TemplateName) => {
    setLoading('template');
    try {
      const res = await fetch(`/api/mac/template/${type}`);
      const json = await res.json();
      if (json.success && json.data?.template) {
        setYaml(json.data.template);
        setSelectedTemplate(type);
        setTemplateOpen(false);
        resetResults();
      }
    } catch {
      // Silently handle — user can retry
    } finally {
      setLoading(null);
    }
  }, []);

  // ── Validate ───────────────────────────────────────────────

  const handleValidate = useCallback(async () => {
    setLoading('validate');
    resetResults();

    try {
      const res = await fetch('/api/mac/validate', {
        method: 'POST',
        headers: { 'content-type': 'text/yaml' },
        body: yaml,
      });
      const json = await res.json();
      if (json.success && json.data) {
        setValidationValid(json.data.valid);
        setValidationErrors(json.data.errors ?? []);
        setValidationWarnings(json.data.warnings ?? []);
        // Try to extract line numbers from error paths
        setErrorLines(
          (json.data.errors ?? [])
            .filter((e: ConfigValidationError) => e.line)
            .map((e: ConfigValidationError) => e.line as number),
        );
      }
    } catch {
      setValidationValid(false);
      setValidationErrors([{ path: '', message: 'Network error — could not reach server' }]);
    } finally {
      setLoading(null);
    }
  }, [yaml]);

  // ── Dry Run ────────────────────────────────────────────────

  const handleDryRun = useCallback(async () => {
    setLoading('dryrun');
    setDryRunResult(null);
    setExecutionResult(null);

    try {
      const res = await fetch('/api/mac/execute?dryRun=true', {
        method: 'POST',
        headers: { 'content-type': 'text/yaml' },
        body: yaml,
      });
      const json = await res.json();
      if (json.success && json.data) {
        setDryRunResult(json.data);
      } else {
        setDryRunResult({
          error: json.error?.message ?? 'Dry run failed',
          details: json.error?.details,
        });
      }
    } catch {
      setDryRunResult({ error: 'Network error' });
    } finally {
      setLoading(null);
    }
  }, [yaml]);

  // ── Execute ────────────────────────────────────────────────

  const handleExecute = useCallback(async () => {
    if (!confirm('Start this migration? This will create a new migration project.')) {
      return;
    }

    setLoading('execute');
    setExecutionResult(null);

    try {
      const res = await fetch('/api/mac/execute', {
        method: 'POST',
        headers: { 'content-type': 'text/yaml' },
        body: yaml,
      });
      const json = await res.json();
      if (json.success && json.data) {
        setExecutionResult(json.data);
      } else {
        setExecutionResult({
          error: json.error?.message ?? 'Execution failed',
          details: json.error?.details,
        });
      }
    } catch {
      setExecutionResult({ error: 'Network error' });
    } finally {
      setLoading(null);
    }
  }, [yaml]);

  // ── Export existing ────────────────────────────────────────

  const handleDownload = useCallback(() => {
    const blob = new Blob([yaml], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'migration-config.yaml';
    a.click();
    URL.revokeObjectURL(url);
  }, [yaml]);

  const handleFileUpload = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.yaml,.yml,.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      setYaml(text);
      resetResults();
    };
    input.click();
  }, []);

  function resetResults() {
    setValidationValid(null);
    setValidationErrors([]);
    setValidationWarnings([]);
    setErrorLines([]);
    setDryRunResult(null);
    setExecutionResult(null);
  }

  const hasContent = yaml.trim().length > 0;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-screen-2xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/migrations"
                className="text-slate-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center">
                  <Code2 className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold">Migration as Code</h1>
                  <p className="text-xs text-slate-400">
                    Define your migration as a declarative YAML config
                  </p>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleFileUpload}
                title="Upload config file"
              >
                <Upload className="h-4 w-4" />
                Import
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDownload}
                disabled={!hasContent}
                title="Download config as YAML"
              >
                <Download className="h-4 w-4" />
                Export
              </Button>
              <div className="w-px h-6 bg-slate-700" />
              <Button
                variant="secondary"
                size="sm"
                onClick={handleValidate}
                disabled={!hasContent}
                loading={loading === 'validate'}
              >
                <FileCheck className="h-4 w-4" />
                Validate
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleDryRun}
                disabled={!hasContent}
                loading={loading === 'dryrun'}
              >
                <Eye className="h-4 w-4" />
                Dry Run
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleExecute}
                disabled={!hasContent}
                loading={loading === 'execute'}
              >
                <Rocket className="h-4 w-4" />
                Execute
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-screen-2xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Editor (2/3) */}
          <div className="xl:col-span-2 space-y-4">
            {/* Template selector */}
            <div className="relative">
              <button
                onClick={() => setTemplateOpen(!templateOpen)}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 hover:border-slate-600 hover:text-white transition-colors w-full"
              >
                <Play className="h-4 w-4 text-violet-400" />
                <span>
                  {selectedTemplate
                    ? TEMPLATES.find((t) => t.name === selectedTemplate)?.label
                    : 'Load a template to get started...'}
                </span>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 ml-auto transition-transform',
                    templateOpen && 'rotate-180',
                  )}
                />
              </button>

              <AnimatePresence>
                {templateOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="absolute z-10 mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden"
                  >
                    {TEMPLATES.map((t) => (
                      <button
                        key={t.name}
                        onClick={() => loadTemplate(t.name)}
                        disabled={loading === 'template'}
                        className={cn(
                          'flex items-center gap-3 w-full px-4 py-3 text-sm text-left hover:bg-slate-700/50 transition-colors',
                          selectedTemplate === t.name
                            ? 'text-cyan-400 bg-slate-700/30'
                            : 'text-slate-300',
                        )}
                      >
                        {loading === 'template' ? (
                          <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                        ) : (
                          <Code2 className="h-4 w-4 text-slate-500" />
                        )}
                        {t.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* YAML Editor */}
            <YAMLEditor
              value={yaml}
              onChange={(v) => {
                setYaml(v);
                if (validationValid !== null) {
                  resetResults();
                }
              }}
              errorLines={errorLines}
              minHeight="600px"
            />
          </div>

          {/* Sidebar (1/3) */}
          <div className="space-y-4">
            {/* Validation Results */}
            {validationValid !== null && (
              <ValidationResults
                valid={validationValid}
                errors={validationErrors}
                warnings={validationWarnings}
                className="border-slate-700"
              />
            )}

            {/* Dry Run Results */}
            <AnimatePresence>
              {dryRunResult && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="rounded-lg border border-slate-700 bg-slate-900/50"
                >
                  <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-2">
                    <Eye className="h-4 w-4 text-cyan-400" />
                    <span className="text-sm font-medium text-slate-200">
                      Dry Run Preview
                    </span>
                  </div>
                  <div className="p-4">
                    {'error' in dryRunResult ? (
                      <p className="text-sm text-rose-400">
                        {String(dryRunResult.error)}
                      </p>
                    ) : (
                      <div className="space-y-3 text-sm">
                        <InfoRow label="Migration" value={String(dryRunResult.migrationName ?? '')} />
                        <InfoRow label="Type" value={String(dryRunResult.migrationType ?? '')} />
                        <InfoRow
                          label="Products"
                          value={(dryRunResult.productsInScope as string[])?.join(', ') ?? ''}
                        />
                        <InfoRow
                          label="Phases"
                          value={`${(dryRunResult.phasesPlanned as unknown[])?.length ?? 0} planned`}
                        />
                        <InfoRow label="Rules" value={String(dryRunResult.rulesCount ?? 0)} />
                        <InfoRow
                          label="Rollback"
                          value={dryRunResult.rollbackEnabled ? 'Enabled' : 'Disabled'}
                        />
                        {(dryRunResult.warnings as string[])?.length > 0 && (
                          <div className="mt-3 space-y-1">
                            <p className="text-xs font-medium text-amber-400">Warnings:</p>
                            {(dryRunResult.warnings as string[]).map((w, i) => (
                              <p key={i} className="text-xs text-amber-300/70 pl-2">
                                - {w}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Execution Result */}
            <AnimatePresence>
              {executionResult && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="rounded-lg border border-slate-700 bg-slate-900/50"
                >
                  <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-2">
                    <Rocket className="h-4 w-4 text-emerald-400" />
                    <span className="text-sm font-medium text-slate-200">
                      Execution Result
                    </span>
                  </div>
                  <div className="p-4">
                    {'error' in executionResult ? (
                      <p className="text-sm text-rose-400">
                        {String(executionResult.error)}
                      </p>
                    ) : (
                      <div className="space-y-3 text-sm">
                        <InfoRow label="Migration ID" value={String(executionResult.migrationId ?? '')} />
                        <InfoRow label="Status" value="Created" />
                        <p className="text-xs text-slate-400">
                          {String(executionResult.message ?? '')}
                        </p>
                        <Link
                          href={`/migrations/${executionResult.migrationId}`}
                          className="inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 mt-2"
                        >
                          View Migration
                          <ChevronDown className="h-3 w-3 -rotate-90" />
                        </Link>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Help panel when empty */}
            {!hasContent && validationValid === null && !dryRunResult && !executionResult && (
              <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-6">
                <h3 className="text-sm font-medium text-slate-200 mb-3">
                  Getting Started
                </h3>
                <ul className="space-y-2 text-xs text-slate-400">
                  <li className="flex items-start gap-2">
                    <span className="text-violet-400 font-mono">1.</span>
                    Select a template from the dropdown above
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-violet-400 font-mono">2.</span>
                    Customize the YAML config for your environment
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-violet-400 font-mono">3.</span>
                    Click Validate to check for errors
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-violet-400 font-mono">4.</span>
                    Click Dry Run to preview what will happen
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-violet-400 font-mono">5.</span>
                    Click Execute to start the migration
                  </li>
                </ul>
                <div className="mt-4 p-3 rounded bg-slate-800/50 border border-slate-700">
                  <p className="text-xs text-slate-500">
                    Configs can be version-controlled in Git, reviewed in PRs,
                    and replayed. Never inline secrets -- use ${'{ENV_VAR}'} references.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Helper ───────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-200 font-mono text-xs">{value}</span>
    </div>
  );
}
