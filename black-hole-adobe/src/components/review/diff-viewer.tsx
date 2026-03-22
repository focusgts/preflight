'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils/cn';

interface DiffViewerProps {
  before: string;
  after: string;
  filePath: string;
  className?: string;
}

type ViewMode = 'unified' | 'split';

function computeDiffLines(
  before: string,
  after: string,
): Array<{ type: 'unchanged' | 'removed' | 'added'; content: string; lineNo: number | null }> {
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');
  const result: Array<{ type: 'unchanged' | 'removed' | 'added'; content: string; lineNo: number | null }> = [];

  // Simple LCS-based diff
  const m = beforeLines.length;
  const n = afterLines.length;

  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (beforeLines[i - 1] === afterLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to produce diff
  const diffOps: Array<{ type: 'unchanged' | 'removed' | 'added'; line: string }> = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && beforeLines[i - 1] === afterLines[j - 1]) {
      diffOps.unshift({ type: 'unchanged', line: beforeLines[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      diffOps.unshift({ type: 'added', line: afterLines[j - 1] });
      j--;
    } else {
      diffOps.unshift({ type: 'removed', line: beforeLines[i - 1] });
      i--;
    }
  }

  let lineNo = 1;
  for (const op of diffOps) {
    result.push({
      type: op.type,
      content: op.line,
      lineNo: op.type === 'added' ? null : lineNo,
    });
    if (op.type !== 'added') lineNo++;
  }

  return result;
}

function DiffLineNumber({ num }: { num: number | null }) {
  return (
    <span className="inline-block w-10 text-right pr-3 text-slate-600 select-none text-xs leading-6">
      {num ?? ' '}
    </span>
  );
}

export function DiffViewer({ before, after, filePath, className }: DiffViewerProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('unified');
  const diffLines = computeDiffLines(before, after);

  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');

  return (
    <div className={cn('rounded-lg border border-slate-700 overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-center justify-between bg-slate-800/80 px-4 py-2 border-b border-slate-700">
        <span className="text-xs text-slate-400 font-mono truncate max-w-[70%]">{filePath}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setViewMode('unified')}
            className={cn(
              'px-2 py-1 text-xs rounded transition-colors',
              viewMode === 'unified'
                ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                : 'text-slate-500 hover:text-slate-300',
            )}
          >
            Unified
          </button>
          <button
            onClick={() => setViewMode('split')}
            className={cn(
              'px-2 py-1 text-xs rounded transition-colors',
              viewMode === 'split'
                ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                : 'text-slate-500 hover:text-slate-300',
            )}
          >
            Split
          </button>
        </div>
      </div>

      {/* Diff Content */}
      {viewMode === 'unified' ? (
        <div className="overflow-x-auto max-h-96 overflow-y-auto bg-slate-950">
          <pre className="text-xs leading-6 font-mono">
            {diffLines.map((line, idx) => (
              <div
                key={idx}
                className={cn(
                  'px-2 min-w-fit',
                  line.type === 'removed' && 'bg-rose-500/10 text-rose-300',
                  line.type === 'added' && 'bg-emerald-500/10 text-emerald-300',
                  line.type === 'unchanged' && 'text-slate-400',
                )}
              >
                <DiffLineNumber num={line.lineNo} />
                <span className="inline-block w-4 text-center select-none">
                  {line.type === 'removed' ? '-' : line.type === 'added' ? '+' : ' '}
                </span>
                <span>{line.content}</span>
              </div>
            ))}
          </pre>
        </div>
      ) : (
        <div className="grid grid-cols-2 divide-x divide-slate-700">
          {/* Before */}
          <div className="overflow-x-auto max-h-96 overflow-y-auto bg-slate-950">
            <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-rose-400/60 border-b border-slate-800 bg-rose-500/5">
              Before
            </div>
            <pre className="text-xs leading-6 font-mono">
              {beforeLines.map((line, idx) => (
                <div key={idx} className="px-2 text-rose-300/70 bg-rose-500/5 min-w-fit">
                  <DiffLineNumber num={idx + 1} />
                  <span>{line}</span>
                </div>
              ))}
            </pre>
          </div>

          {/* After */}
          <div className="overflow-x-auto max-h-96 overflow-y-auto bg-slate-950">
            <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-emerald-400/60 border-b border-slate-800 bg-emerald-500/5">
              After
            </div>
            <pre className="text-xs leading-6 font-mono">
              {afterLines.map((line, idx) => (
                <div key={idx} className="px-2 text-emerald-300/70 bg-emerald-500/5 min-w-fit">
                  <DiffLineNumber num={idx + 1} />
                  <span>{line}</span>
                </div>
              ))}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
