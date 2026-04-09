'use client';

/**
 * Lead capture modal for the public pre-flight page (ADR-064 §4).
 *
 * Appears after the first successful run of the session. Email-only,
 * dismissible, non-blocking. Uses sessionStorage so users who dismiss
 * or submit are not re-prompted within the same tab session.
 */

import { useCallback, useState } from 'react';
import { X, Mail, CheckCircle2 } from 'lucide-react';

const SESSION_KEY = 'bh_preflight_lead_modal_state';

type ModalLifecycleState = 'idle' | 'submitting' | 'submitted' | 'error';

type PersistedState = 'dismissed' | 'submitted';

function readPersisted(): PersistedState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (raw === 'dismissed' || raw === 'submitted') return raw;
    return null;
  } catch {
    return null;
  }
}

function writePersisted(value: PersistedState): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(SESSION_KEY, value);
  } catch {
    /* ignore — storage blocked */
  }
}

interface LeadCaptureModalProps {
  /** Trigger: set to true after the first successful pre-flight run. */
  open: boolean;
  onClose: () => void;
  onSubmitted?: () => void;
}

export function LeadCaptureModal({ open, onClose, onSubmitted }: LeadCaptureModalProps) {
  // sessionStorage gate is read lazily on first render — no setState-in-effect.
  const [persistedOnMount] = useState<PersistedState | null>(() => readPersisted());
  const [state, setState] = useState<ModalLifecycleState>('idle');
  const [email, setEmail] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleClose = useCallback(() => {
    if (state !== 'submitted') {
      writePersisted('dismissed');
    }
    setState('idle');
    onClose();
  }, [state, onClose]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setErrorMsg(null);

      const trimmed = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        setErrorMsg('Please enter a valid email address.');
        return;
      }

      setState('submitting');
      try {
        const res = await fetch('/api/leads/preflight', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: trimmed, source: 'preflight-public' }),
        });
        if (!res.ok) {
          setState('error');
          setErrorMsg('Something went wrong. Please try again.');
          return;
        }
        writePersisted('submitted');
        setState('submitted');
        onSubmitted?.();
      } catch {
        setState('error');
        setErrorMsg('Network error. Please try again.');
      }
    },
    [email, onSubmitted],
  );

  // Visibility is derived, not stored. The modal mounts when the parent
  // signals `open` AND the user hasn't already dismissed/submitted in
  // this session.
  if (!open || persistedOnMount !== null) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="preflight-lead-title"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close"
          className="absolute top-3 right-3 rounded-lg p-1.5 text-slate-500 hover:bg-slate-800 hover:text-slate-200 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {state === 'submitted' ? (
          <div className="flex flex-col items-center text-center py-4">
            <div className="rounded-full bg-emerald-500/10 p-3 mb-3">
              <CheckCircle2 className="h-6 w-6 text-emerald-400" />
            </div>
            <p className="text-base font-semibold text-white">You&apos;re on the list</p>
            <p className="mt-1 text-sm text-slate-400">
              We&apos;ll send you the Black Hole pre-flight digest. No spam.
            </p>
            <button
              type="button"
              onClick={handleClose}
              className="mt-5 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700"
            >
              Back to pre-flight
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-1">
              <Mail className="h-4 w-4 text-cyan-400" />
              <h3 id="preflight-lead-title" className="text-base font-semibold text-white">
                Get the pre-flight digest
              </h3>
            </div>
            <p className="text-sm text-slate-400 mb-4">
              Weekly email with new Cloud Manager rules, failure patterns, and
              remediation tips. No marketing fluff.
            </p>
            <form onSubmit={handleSubmit} className="space-y-3">
              <label className="block">
                <span className="sr-only">Email address</span>
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={state === 'submitting'}
                  placeholder="you@company.com"
                  className="block w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/20 outline-none"
                />
              </label>
              {errorMsg && (
                <p className="text-xs text-red-400">{errorMsg}</p>
              )}
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-lg px-3 py-2 text-xs text-slate-400 hover:text-slate-200"
                >
                  No thanks
                </button>
                <button
                  type="submit"
                  disabled={state === 'submitting'}
                  className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-50"
                >
                  {state === 'submitting' ? 'Sending...' : 'Subscribe'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
