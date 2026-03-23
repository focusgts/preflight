'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { motion } from 'framer-motion';
import { Loader2, RefreshCw } from 'lucide-react';
import { ScoreResults } from '@/components/scanner/score-results';
import type { ScanResult } from '@/types/scanner';

interface PageProps {
  params: Promise<{ domain: string }>;
}

export default function SharedScorePage({ params }: PageProps) {
  const { domain } = use(params);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchScore = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/scanner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: domain }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error?.message ?? 'Failed to load score');
      }
      setResult(data.data as ScanResult);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load score results.',
      );
    } finally {
      setLoading(false);
    }
  }, [domain]);

  useEffect(() => {
    fetchScore();
  }, [fetchScore]);

  const handleScanAgain = useCallback(() => {
    fetchScore();
  }, [fetchScore]);

  // Update page title via effect
  useEffect(() => {
    if (result) {
      document.title = `${result.domain} scores ${result.overallScore}/100 - AEM Health Score | Black Hole`;
    } else {
      document.title = `AEM Health Score: ${domain} | Black Hole`;
    }
  }, [result, domain]);

  // Set OG tags dynamically
  useEffect(() => {
    if (!result) return;

    const setMeta = (property: string, content: string) => {
      let tag = document.querySelector(`meta[property="${property}"]`);
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute('property', property);
        document.head.appendChild(tag);
      }
      tag.setAttribute('content', content);
    };

    setMeta('og:title', `${result.domain} AEM Health Score: ${result.overallScore}/100`);
    setMeta(
      'og:description',
      `${result.domain} scored ${result.overallScore}/100 on the AEM Health Score. Grade: ${result.grade}. ${
        result.aemDetected
          ? `AEM ${result.aemVersion ?? ''} detected.`
          : 'Check your site now.'
      }`,
    );
    setMeta('og:type', 'website');
    setMeta('og:url', window.location.href);
  }, [result]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="relative mx-auto mb-6 h-24 w-24">
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-violet-500/30"
              animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <div className="absolute inset-3 flex items-center justify-center rounded-full bg-slate-800/80">
              <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
            </div>
          </div>
          <p className="text-sm text-slate-400">
            Loading score for{' '}
            <span className="font-medium text-white">{domain}</span>
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-rose-500/10">
            <span className="text-2xl text-rose-400">!</span>
          </div>
          <h2 className="text-lg font-semibold text-white">
            Could not load score
          </h2>
          <p className="mt-2 text-sm text-slate-400">{error}</p>
          <button
            onClick={fetchScore}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!result) return null;

  return (
    <div className="pt-8">
      <ScoreResults result={result} onScanAgain={handleScanAgain} />
    </div>
  );
}
