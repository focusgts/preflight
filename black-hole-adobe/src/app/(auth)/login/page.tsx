'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error?.message ?? 'Login failed');
        setLoading(false);
        return;
      }

      router.push('/overview');
    } catch {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      {/* Background gradient orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-purple-900/20 blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-blue-900/20 blur-[120px]" />
        <div className="absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-800/10 blur-[100px]" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 opacity-80 blur-sm" />
            <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 via-purple-600 to-indigo-700 shadow-lg shadow-purple-900/50">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-8 w-8 text-white"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="6" />
                <circle cx="12" cy="12" r="2" fill="currentColor" />
              </svg>
            </div>
          </div>
          <h1 className="bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-2xl font-bold text-transparent">
            Black Hole
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Adobe Marketing Cloud Migration Platform
          </p>
        </div>

        {/* Login Card */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-8 shadow-2xl shadow-black/40 backdrop-blur-xl">
          <h2 className="mb-6 text-lg font-semibold text-slate-200">
            Sign in to your account
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-slate-400"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 outline-none transition-colors focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30"
                placeholder="admin@blackhole.io"
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-slate-400"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 outline-none transition-colors focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30"
                placeholder="Enter your password"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-purple-900/30 transition-all hover:from-violet-500 hover:to-purple-500 hover:shadow-purple-900/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="h-4 w-4 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeDasharray="60"
                      strokeLinecap="round"
                      className="opacity-25"
                    />
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeDasharray="15 45"
                      strokeLinecap="round"
                    />
                  </svg>
                  Signing in...
                </span>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          {/* Demo credentials hint — hidden in production builds */}
          {process.env.NEXT_PUBLIC_SHOW_DEMO_CREDS === 'true' ||
          process.env.NODE_ENV !== 'production' ? (
            <div className="mt-6 rounded-lg border border-slate-800/50 bg-slate-900/50 px-4 py-3">
              <p className="text-xs font-medium text-slate-500">Demo credentials</p>
              <p className="mt-1 font-mono text-xs text-slate-400">
                admin@blackhole.io / admin123
              </p>
            </div>
          ) : (
            <div className="mt-6 rounded-lg border border-slate-800/50 bg-slate-900/50 px-4 py-3">
              <p className="text-xs font-medium text-slate-500">
                Enter your credentials to sign in
              </p>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-slate-600">
          Black Hole v0.1.0
        </p>
      </div>
    </div>
  );
}
