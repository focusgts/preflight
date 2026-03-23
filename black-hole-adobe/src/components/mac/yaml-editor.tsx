'use client';

/**
 * YAML Editor Component
 *
 * A monospace textarea with line numbers, basic syntax highlighting,
 * tab support, auto-indent, and error line highlighting.
 */

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type KeyboardEvent,
  type ChangeEvent,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/utils/cn';

interface YAMLEditorProps {
  value: string;
  onChange: (value: string) => void;
  errorLines?: number[];
  readOnly?: boolean;
  className?: string;
  minHeight?: string;
}

export function YAMLEditor({
  value,
  onChange,
  errorLines = [],
  readOnly = false,
  className,
  minHeight = '500px',
}: YAMLEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  const lines = value.split('\n');
  const lineCount = lines.length;
  const errorLineSet = new Set(errorLines);

  // Sync scroll between textarea, line numbers, and highlight overlay
  const handleScroll = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textarea.scrollTop;
    }
    if (highlightRef.current) {
      highlightRef.current.scrollTop = textarea.scrollTop;
      highlightRef.current.scrollLeft = textarea.scrollLeft;
    }
  }, []);

  // Handle tab key to insert 2 spaces
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (readOnly) return;

      const textarea = e.currentTarget;
      const { selectionStart, selectionEnd } = textarea;

      if (e.key === 'Tab') {
        e.preventDefault();
        const before = value.slice(0, selectionStart);
        const after = value.slice(selectionEnd);
        const newValue = before + '  ' + after;
        onChange(newValue);
        // Restore cursor position after React re-render
        requestAnimationFrame(() => {
          textarea.selectionStart = selectionStart + 2;
          textarea.selectionEnd = selectionStart + 2;
        });
      }

      // Auto-indent on Enter
      if (e.key === 'Enter') {
        e.preventDefault();
        const before = value.slice(0, selectionStart);
        const after = value.slice(selectionEnd);
        const currentLine = before.split('\n').pop() ?? '';
        const indent = currentLine.match(/^(\s*)/)?.[1] ?? '';
        // Add extra indent if line ends with ':'
        const extra = currentLine.trimEnd().endsWith(':') ? '  ' : '';
        const newValue = before + '\n' + indent + extra + after;
        const newPos = selectionStart + 1 + indent.length + extra.length;
        onChange(newValue);
        requestAnimationFrame(() => {
          textarea.selectionStart = newPos;
          textarea.selectionEnd = newPos;
        });
      }
    },
    [value, onChange, readOnly],
  );

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value);
    },
    [onChange],
  );

  // Highlight YAML syntax
  const highlightedLines = lines.map((line, i) => {
    const isError = errorLineSet.has(i + 1);
    return (
      <div
        key={i}
        className={cn(
          'px-4 whitespace-pre',
          isError && 'bg-rose-500/15',
        )}
      >
        {highlightSyntax(line)}
      </div>
    );
  });

  return (
    <div className={cn('relative rounded-lg overflow-hidden border border-slate-700', className)}>
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
        <span className="text-xs text-slate-400 font-mono">YAML</span>
        <span className="text-xs text-slate-500">
          {lineCount} line{lineCount !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="relative flex" style={{ minHeight }}>
        {/* Line numbers */}
        <div
          ref={lineNumbersRef}
          className="flex-none w-12 bg-slate-900 text-right pr-3 py-3 select-none overflow-hidden border-r border-slate-800"
          aria-hidden="true"
        >
          {lines.map((_, i) => (
            <div
              key={i}
              className={cn(
                'text-xs leading-[1.625rem] font-mono',
                errorLineSet.has(i + 1)
                  ? 'text-rose-400 font-bold'
                  : 'text-slate-600',
              )}
            >
              {i + 1}
            </div>
          ))}
        </div>

        {/* Syntax highlight overlay (behind textarea) */}
        <div
          ref={highlightRef}
          className="absolute left-12 right-0 top-[41px] bottom-0 overflow-hidden pointer-events-none py-3 font-mono text-sm leading-[1.625rem]"
          aria-hidden="true"
        >
          {highlightedLines}
        </div>

        {/* Textarea (transparent text, caret visible) */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onScroll={handleScroll}
          readOnly={readOnly}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          className={cn(
            'flex-1 bg-transparent text-transparent caret-cyan-400 font-mono text-sm',
            'leading-[1.625rem] px-4 py-3 resize-none outline-none',
            'selection:bg-violet-500/30',
            readOnly && 'cursor-default',
          )}
          style={{ minHeight }}
        />
      </div>
    </div>
  );
}

// ── Syntax Highlighting ────────────────────────────────────

function highlightSyntax(line: string): ReactNode {
  // Comment
  if (line.trimStart().startsWith('#')) {
    return <span className="text-slate-500 italic">{line}</span>;
  }

  // Empty line
  if (line.trim() === '') {
    return <span>{'\u00A0'}</span>;
  }

  // Key-value pairs
  const kvMatch = line.match(/^(\s*)([\w.-]+)(\s*:\s*)(.*)/);
  if (kvMatch) {
    const [, indent, key, colon, val] = kvMatch;
    return (
      <span>
        {indent}
        <span className="text-cyan-400">{key}</span>
        <span className="text-slate-500">{colon}</span>
        {highlightValue(val)}
      </span>
    );
  }

  // List items
  const listMatch = line.match(/^(\s*)(- )(.*)/);
  if (listMatch) {
    const [, indent, dash, val] = listMatch;
    return (
      <span>
        {indent}
        <span className="text-violet-400">{dash}</span>
        {highlightValue(val)}
      </span>
    );
  }

  return <span className="text-slate-300">{line}</span>;
}

function highlightValue(val: string): ReactNode {
  if (!val) return <span />;

  // Inline comment
  const commentIdx = val.indexOf(' #');
  if (commentIdx >= 0) {
    const before = val.slice(0, commentIdx);
    const comment = val.slice(commentIdx);
    return (
      <span>
        {highlightScalar(before)}
        <span className="text-slate-500 italic">{comment}</span>
      </span>
    );
  }

  return highlightScalar(val);
}

function highlightScalar(val: string): ReactNode {
  const trimmed = val.trim();

  // Boolean
  if (/^(true|false)$/i.test(trimmed)) {
    return <span className="text-amber-400">{val}</span>;
  }

  // Number
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return <span className="text-emerald-400">{val}</span>;
  }

  // Quoted string
  if (/^["'].*["']$/.test(trimmed)) {
    return <span className="text-orange-300">{val}</span>;
  }

  // Env var reference
  if (/\$\{[A-Z_]+\}/.test(trimmed)) {
    return <span className="text-violet-300">{val}</span>;
  }

  return <span className="text-slate-300">{val}</span>;
}
