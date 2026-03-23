'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Search, Loader2, ArrowRight } from 'lucide-react';

interface ScoreHeroProps {
  onScan: (url: string) => void;
  isScanning: boolean;
  initialUrl?: string;
}

export function ScoreHero({ onScan, isScanning, initialUrl }: ScoreHeroProps) {
  const [url, setUrl] = useState(initialUrl ?? '');
  const [scanCount, setScanCount] = useState(14247);
  const [validationError, setValidationError] = useState('');

  // Animated counter
  useEffect(() => {
    const interval = setInterval(() => {
      setScanCount((c) => c + Math.floor(Math.random() * 3));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setValidationError('');
      const trimmed = url.trim();
      if (!trimmed) {
        setValidationError('Please enter a URL');
        return;
      }
      if (!/^[a-zA-Z0-9]/.test(trimmed)) {
        setValidationError('Please enter a valid domain');
        return;
      }
      onScan(trimmed);
    },
    [url, onScan],
  );

  return (
    <div className="relative overflow-hidden">
      {/* Animated gradient background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-60 -top-60 h-[600px] w-[600px] animate-pulse rounded-full bg-violet-900/20 blur-[150px]" />
        <div className="absolute -bottom-40 -right-40 h-[500px] w-[500px] animate-pulse rounded-full bg-cyan-900/15 blur-[130px]" />
        <div className="absolute left-1/3 top-1/4 h-[400px] w-[400px] rounded-full bg-purple-800/10 blur-[120px]" />
        {/* Star particles */}
        {Array.from({ length: 20 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute h-1 w-1 rounded-full bg-white/20"
            style={{
              left: `${(i * 37) % 100}%`,
              top: `${(i * 53) % 100}%`,
            }}
            animate={{
              opacity: [0.1, 0.6, 0.1],
              scale: [0.8, 1.2, 0.8],
            }}
            transition={{
              duration: 3 + (i % 4),
              repeat: Infinity,
              delay: i * 0.3,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 mx-auto max-w-3xl px-4 pb-16 pt-20 text-center sm:px-6 sm:pb-24 sm:pt-28">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-4 py-1.5 text-sm text-violet-300"
        >
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          Free AEM Migration Readiness Tool
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl"
        >
          <span className="bg-gradient-to-r from-white via-violet-200 to-cyan-200 bg-clip-text text-transparent">
            AEM Health Score
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mx-auto mt-4 max-w-xl text-lg text-slate-400 sm:text-xl"
        >
          Find out if your AEM site is ready for the future.
          <br className="hidden sm:block" />
          <span className="text-slate-300">
            Free. Instant. No credentials needed.
          </span>
        </motion.p>

        {/* URL Input */}
        <motion.form
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          onSubmit={handleSubmit}
          className="mx-auto mt-10 max-w-xl"
        >
          <div className="relative flex items-center">
            <div className="absolute left-4 text-slate-500">
              <Search className="h-5 w-5" />
            </div>
            <input
              type="text"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setValidationError('');
              }}
              placeholder="Enter your website URL (e.g. acme.com)"
              disabled={isScanning}
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] py-4 pl-12 pr-36 text-base text-slate-200 placeholder-slate-600 outline-none backdrop-blur-sm transition-all focus:border-violet-500/40 focus:ring-2 focus:ring-violet-500/20 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isScanning}
              className="absolute right-2 flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-purple-900/30 transition-all hover:from-violet-500 hover:to-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isScanning ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  Scan Now
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>

          {validationError && (
            <p className="mt-2 text-sm text-rose-400">{validationError}</p>
          )}
        </motion.form>

        {/* Social proof */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-6 text-sm text-slate-500"
        >
          <span className="font-medium text-slate-400">
            {scanCount.toLocaleString()}
          </span>{' '}
          sites scanned worldwide
        </motion.p>
      </div>
    </div>
  );
}
