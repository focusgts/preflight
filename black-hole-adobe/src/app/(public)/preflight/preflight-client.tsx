'use client';

/**
 * /preflight client — interactive UI for the public pre-flight page (ADR-064).
 *
 * Keeps everything stateful in one place:
 *   - Code input (textarea) + language selector
 *   - Sample snippet dropdown
 *   - Run button → POST /api/preflight
 *   - Loading / error / rate-limit / result states
 *   - Share link via URL hash fragment (base64-encoded)
 *   - Footer CTAs (placeholder URLs per ADR-064 §6)
 *
 * Presentation of the report itself is delegated to
 * <PreFlightReportView /> so we stay in sync with the migration flow.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Loader2,
  AlertTriangle,
  Zap,
  PlayCircle,
  Share2,
  FileCode2,
  Gauge,
  ListChecks,
  ArrowRight,
} from 'lucide-react';
import { PreFlightReportView } from '@/components/preflight/preflight-report-view';
import { PUBLIC_SAMPLES, type PublicSample } from '@/lib/preflight/public-samples';
import type { PreFlightReport } from '@/lib/preflight/cloud-manager-rules';
import { LeadCaptureModal } from './lead-capture-modal';

// ── Types ────────────────────────────────────────────────────────────────

type Language = 'java' | 'xml' | 'json' | 'htl';
type RunState =
  | { kind: 'idle' }
  | { kind: 'running' }
  | { kind: 'success'; report: PreFlightReport; durationMs: number }
  | { kind: 'error'; message: string; rateLimited?: boolean };

interface LanguageOption {
  value: Language;
  label: string;
  defaultPath: string;
}

const LANGUAGE_OPTIONS: LanguageOption[] = [
  { value: 'java', label: 'Java', defaultPath: 'src/main/java/Snippet.java' },
  {
    value: 'xml',
    label: 'XML / Oak Index',
    defaultPath: 'ui.apps/src/main/content/jcr_root/_oak_index/custom/.content.xml',
  },
  { value: 'json', label: 'OSGi Config', defaultPath: 'config/com.example.MyConfig.cfg.json' },
  { value: 'htl', label: 'HTL', defaultPath: 'ui.apps/src/main/content/jcr_root/apps/example/component.html' },
];

// ── Hash-fragment share encoding ─────────────────────────────────────────

interface SharedSnippet {
  lang: Language;
  path: string;
  code: string;
}

function encodeShare(snippet: SharedSnippet): string {
  try {
    const json = JSON.stringify(snippet);
    // Modern browsers expose a UTF-8-safe base64 encoder via btoa(unescape(encodeURIComponent()))
    const b64 = btoa(unescape(encodeURIComponent(json)));
    return `s=${b64}`;
  } catch {
    return '';
  }
}

function decodeShare(hash: string): SharedSnippet | null {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!raw.startsWith('s=')) return null;
  const b64 = raw.slice(2);
  try {
    const json = decodeURIComponent(escape(atob(b64)));
    const parsed = JSON.parse(json) as Partial<SharedSnippet>;
    if (
      parsed &&
      typeof parsed.code === 'string' &&
      typeof parsed.path === 'string' &&
      typeof parsed.lang === 'string' &&
      ['java', 'xml', 'json', 'htl'].includes(parsed.lang)
    ) {
      return parsed as SharedSnippet;
    }
    return null;
  } catch {
    return null;
  }
}

// ── Editor (lightweight monospace textarea) ──────────────────────────────

interface EditorProps {
  value: string;
  onChange: (v: string) => void;
  language: Language;
  disabled?: boolean;
}

function CodeEditor({ value, onChange, language, disabled }: EditorProps) {
  const lineCount = Math.max(1, value.split('\n').length);
  return (
    <div className="relative rounded-xl border border-slate-800 bg-slate-950/80 overflow-hidden focus-within:border-cyan-500/60 focus-within:ring-2 focus-within:ring-cyan-500/20 transition-colors">
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <FileCode2 className="h-3.5 w-3.5" />
          {language.toUpperCase()}
        </span>
        <span>
          {lineCount} line{lineCount !== 1 ? 's' : ''} &middot;{' '}
          {value.length} char{value.length !== 1 ? 's' : ''}
        </span>
      </div>
      <label className="sr-only" htmlFor="preflight-code-input">
        Code to check
      </label>
      <textarea
        id="preflight-code-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        placeholder="// Paste your Java, XML, OSGi config, or HTL here..."
        className="block w-full resize-y min-h-[280px] max-h-[600px] bg-transparent p-4 font-mono text-[13px] leading-6 text-slate-200 placeholder:text-slate-600 outline-none disabled:opacity-60"
      />
    </div>
  );
}

// ── Main client component ───────────────────────────────────────────────

/** Read and parse the URL hash before first render so we can seed
 *  state lazily without a setState-in-effect round-trip. */
function readInitialShare(): SharedSnippet | null {
  if (typeof window === 'undefined') return null;
  return decodeShare(window.location.hash);
}

export function PreflightClient() {
  const [language, setLanguage] = useState<Language>(
    () => readInitialShare()?.lang ?? 'java',
  );
  const [code, setCode] = useState<string>(
    () => readInitialShare()?.code ?? '',
  );
  const [state, setState] = useState<RunState>({ kind: 'idle' });
  const [shareCopied, setShareCopied] = useState(false);
  const [selectedSampleId, setSelectedSampleId] = useState<string>('');
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const leadModalShownRef = useRef(false);

  const currentPath = useMemo(() => {
    const opt = LANGUAGE_OPTIONS.find((l) => l.value === language);
    return opt?.defaultPath ?? 'Snippet.java';
  }, [language]);

  // ── Emit page.view analytics event once on mount ───────────────────────
  const viewEmittedRef = useRef(false);
  useEffect(() => {
    if (viewEmittedRef.current) return;
    viewEmittedRef.current = true;
    void emitAnalytics('preflight.page.view', {});
  }, []);

  // ── Actions ────────────────────────────────────────────────────────────

  const loadSample = useCallback((sample: PublicSample) => {
    setLanguage(sample.language);
    setCode(sample.code);
    setSelectedSampleId(sample.id);
    setState({ kind: 'idle' });
    void emitAnalytics('preflight.sample.load', { id: sample.id });
  }, []);

  const handleSampleChange = useCallback(
    (id: string) => {
      if (!id) {
        setSelectedSampleId('');
        return;
      }
      const sample = PUBLIC_SAMPLES.find((s) => s.id === id);
      if (sample) loadSample(sample);
    },
    [loadSample],
  );

  const runPreflight = useCallback(async () => {
    if (!code.trim()) {
      setState({ kind: 'error', message: 'Paste some code first, or load a sample.' });
      return;
    }

    setState({ kind: 'running' });
    const started = Date.now();

    void emitAnalytics('preflight.run.submit', {
      language,
      codeLength: code.length,
    });

    try {
      const res = await fetch('/api/preflight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: [{ path: currentPath, content: code }],
        }),
      });

      const body = await res.json().catch(() => null) as
        | { success?: boolean; data?: PreFlightReport; error?: { code?: string; message?: string } }
        | null;

      if (res.status === 429) {
        setState({
          kind: 'error',
          message:
            body?.error?.message ??
            'Rate limit reached. Try again in an hour, or sign up for unlimited runs.',
          rateLimited: true,
        });
        return;
      }

      if (!res.ok || !body?.success || !body.data) {
        setState({
          kind: 'error',
          message:
            body?.error?.message ??
            `Pre-flight request failed (status ${res.status}).`,
        });
        return;
      }

      const durationMs = Date.now() - started;
      setState({ kind: 'success', report: body.data, durationMs });

      // Open the lead-capture modal once per session, after the first
      // successful run. The modal itself further gates on sessionStorage.
      if (!leadModalShownRef.current) {
        leadModalShownRef.current = true;
        setLeadModalOpen(true);
      }

      void emitAnalytics('preflight.run.result', {
        durationMs,
        blockers: body.data.summary.blockers,
        criticals: body.data.summary.criticals,
        majors: body.data.summary.majors,
        minors: body.data.summary.minors,
        successProbability: body.data.successProbability,
      });
    } catch (err) {
      setState({
        kind: 'error',
        message:
          err instanceof Error
            ? err.message
            : 'Network error — could not reach the pre-flight API.',
      });
    }
  }, [code, language, currentPath]);

  // ── Share link ─────────────────────────────────────────────────────────
  const copyShareLink = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const hash = encodeShare({ lang: language, path: currentPath, code });
    if (!hash) return;
    const url = `${window.location.origin}${window.location.pathname}#${hash}`;
    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      window.history.replaceState(null, '', `#${hash}`);
      setTimeout(() => setShareCopied(false), 2000);
      void emitAnalytics('preflight.share.click', { codeLength: code.length });
    } catch {
      // Clipboard blocked — fall back to just updating the hash so the user
      // can copy from the address bar manually.
      window.history.replaceState(null, '', `#${hash}`);
    }
  }, [language, currentPath, code]);

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-5xl px-6 pt-20 pb-16">
        {/* Hero */}
        <section className="text-center mb-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/5 px-3 py-1 text-xs font-medium text-cyan-300 mb-5">
            <Zap className="h-3.5 w-3.5" />
            Free &middot; No login &middot; No setup
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight">
            Check your AEM code against Cloud Manager gates
            <span className="block text-cyan-400 mt-1">in under a second.</span>
          </h1>
          <p className="mt-5 text-base text-slate-400 max-w-2xl mx-auto">
            Paste Java, XML, OSGi config, or HTL. We run the same SonarQube
            CQRules, OakPAL index checks, and Java-compatibility rules that
            Adobe Cloud Manager uses to gate your deployments.
          </p>
        </section>

        {/* Feature chips */}
        <section className="mb-8 flex flex-wrap justify-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-900/60 px-3 py-1.5">
            <Gauge className="h-3.5 w-3.5 text-cyan-400" />
            16 Cloud Manager rules
          </span>
          <span className="flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-900/60 px-3 py-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            Zero false positives (verified)
          </span>
          <span className="flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-900/60 px-3 py-1.5">
            <ListChecks className="h-3.5 w-3.5 text-violet-400" />
            SonarQube &middot; OakPAL &middot; Java compat
          </span>
        </section>

        {/* Editor panel */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
            <div className="flex-1 flex flex-col sm:flex-row gap-3">
              <div className="flex-shrink-0">
                <label
                  htmlFor="preflight-language"
                  className="block text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-1"
                >
                  Language
                </label>
                <select
                  id="preflight-language"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as Language)}
                  className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/20 outline-none"
                >
                  {LANGUAGE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex-1 min-w-0">
                <label
                  htmlFor="preflight-sample"
                  className="block text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-1"
                >
                  Try a failing example
                </label>
                <select
                  id="preflight-sample"
                  value={selectedSampleId}
                  onChange={(e) => handleSampleChange(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/20 outline-none"
                >
                  <option value="">-- Select a sample --</option>
                  {PUBLIC_SAMPLES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <CodeEditor
            value={code}
            onChange={(v) => {
              setCode(v);
              if (selectedSampleId) setSelectedSampleId('');
            }}
            language={language}
            disabled={state.kind === 'running'}
          />

          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <button
              type="button"
              onClick={runPreflight}
              disabled={state.kind === 'running' || !code.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {state.kind === 'running' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <PlayCircle className="h-4 w-4" />
                  Run Pre-Flight
                </>
              )}
            </button>

            <button
              type="button"
              onClick={copyShareLink}
              disabled={!code.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-40 transition-colors"
            >
              <Share2 className="h-4 w-4" />
              {shareCopied ? 'Link copied!' : 'Share link'}
            </button>
          </div>
        </section>

        {/* Results */}
        <section className="mt-8">
          {state.kind === 'idle' && (
            <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 p-8 text-center text-sm text-slate-500">
              Your results will appear here. Runs are ephemeral — nothing is
              saved on our servers.
            </div>
          )}

          {state.kind === 'running' && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 text-cyan-400 animate-spin" />
              <p className="text-sm text-slate-300">
                Running all 16 Cloud Manager quality gates...
              </p>
            </div>
          )}

          {state.kind === 'error' && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-300">
                    {state.rateLimited ? 'Rate limit reached' : 'Pre-flight failed'}
                  </p>
                  <p className="mt-1 text-sm text-red-300/80">{state.message}</p>
                  {state.rateLimited && (
                    <Link
                      href="#"
                      onClick={() =>
                        void emitAnalytics('preflight.cta.upgrade.click', {
                          source: 'rate-limit',
                        })
                      }
                      className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-cyan-300 hover:text-cyan-200"
                    >
                      Run unlimited with a team plan
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              </div>
            </div>
          )}

          {state.kind === 'success' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Zap className="h-3.5 w-3.5 text-cyan-400" />
                Checked in {state.durationMs} ms &middot; {state.report.findings.length}{' '}
                finding{state.report.findings.length !== 1 ? 's' : ''}
              </div>
              <PreFlightReportView
                report={state.report}
                hideTimestamp
                showHeading
              />
            </div>
          )}
        </section>

        {/* Footer CTAs */}
        <section className="mt-16 grid gap-4 md:grid-cols-2">
          <Link
            href="#"
            onClick={() =>
              void emitAnalytics('preflight.cta.upgrade.click', { source: 'footer-cli' })
            }
            className="group rounded-2xl border border-slate-800 bg-slate-900/60 p-5 hover:border-cyan-500/40 hover:bg-slate-900/80 transition-colors"
          >
            <p className="text-sm font-semibold text-white group-hover:text-cyan-300">
              Need this in CI?
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Install the Black Hole CLI and run pre-flight on every commit.
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-cyan-400">
              Install the CLI
              <ArrowRight className="h-3 w-3" />
            </span>
          </Link>
          <Link
            href="#"
            onClick={() =>
              void emitAnalytics('preflight.cta.upgrade.click', { source: 'footer-team' })
            }
            className="group rounded-2xl border border-slate-800 bg-slate-900/60 p-5 hover:border-cyan-500/40 hover:bg-slate-900/80 transition-colors"
          >
            <p className="text-sm font-semibold text-white group-hover:text-cyan-300">
              Unlimited runs with teams
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Remove the hourly limit and plug pre-flight into your org.
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-cyan-400">
              See team plans
              <ArrowRight className="h-3 w-3" />
            </span>
          </Link>
        </section>
      </div>

      <LeadCaptureModal
        open={leadModalOpen}
        onClose={() => setLeadModalOpen(false)}
        onSubmitted={() => void emitAnalytics('preflight.lead.capture', {})}
      />
    </div>
  );
}

// ── Analytics emitter (best-effort, non-blocking) ────────────────────────

async function emitAnalytics(
  event: string,
  properties: Record<string, unknown>,
): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    await fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        event,
        properties,
        timestamp: new Date().toISOString(),
        path: window.location.pathname,
      }),
    });
  } catch {
    // Analytics must never break the user's experience.
  }
}
