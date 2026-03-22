'use client';

import { useState, useCallback } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface DownloadReportProps {
  /** Assessment or migration ID used to fetch the PDF. */
  assessmentId: string;
  /** Optional CSS class for the button. */
  className?: string;
}

export function DownloadReport({ assessmentId, className }: DownloadReportProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleDownload = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const response = await fetch(`/api/reports/${assessmentId}/pdf`);

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(
          body?.error?.message ?? `Failed to generate report (${response.status})`,
        );
      }

      const blob = await response.blob();

      // Extract filename from Content-Disposition header if available
      const disposition = response.headers.get('Content-Disposition');
      let filename = `assessment-report-${assessmentId}.pdf`;
      if (disposition) {
        const match = disposition.match(/filename="?([^";\n]+)"?/);
        if (match?.[1]) {
          filename = match[1];
        }
      }

      // Create a temporary download link
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();

      // Cleanup
      setTimeout(() => {
        URL.revokeObjectURL(url);
        document.body.removeChild(anchor);
      }, 100);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Download failed';
      setErrorMsg(message);
      console.error('[DownloadReport] Error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [assessmentId]);

  return (
    <div className="inline-flex flex-col items-start">
      <button
        type="button"
        onClick={handleDownload}
        disabled={isLoading}
        className={cn(
          'inline-flex items-center gap-2 rounded-lg px-4 py-2.5',
          'bg-gradient-to-r from-violet-600 to-cyan-500',
          'text-sm font-medium text-white shadow-md',
          'transition-all hover:shadow-lg hover:brightness-110',
          'disabled:cursor-not-allowed disabled:opacity-60',
          'focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 focus:ring-offset-slate-900',
          className,
        )}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        {isLoading ? 'Generating Report...' : 'Download PDF Report'}
      </button>
      {errorMsg && (
        <p className="mt-1.5 text-xs text-rose-400">{errorMsg}</p>
      )}
    </div>
  );
}
