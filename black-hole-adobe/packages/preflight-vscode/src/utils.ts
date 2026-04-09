/**
 * Utility functions for the Pre-Flight VS Code extension.
 */

import * as vscode from 'vscode';
import type { PreFlightSeverity } from '@blackhole/preflight-engine';

export const SUPPORTED_LANGUAGES = ['java', 'xml', 'json'] as const;

const SUPPORTED_EXTENSIONS = [
  '.java',
  '.jsp',
  '.jspx',
  '.xml',
  '.content.xml',
  '.cfg.json',
];

/**
 * Standard debounce: delays fn execution until ms have elapsed since last call.
 */
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  ms: number,
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: Parameters<T>) => {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = undefined;
      fn(...args);
    }, ms);
  };
}

/**
 * Map PreFlightSeverity to VS Code DiagnosticSeverity.
 * blocker/critical -> Error, major -> Warning, minor -> Information, info -> Hint.
 */
export function severityToVscode(
  severity: PreFlightSeverity | 'info',
): vscode.DiagnosticSeverity {
  switch (severity) {
    case 'blocker':
    case 'critical':
      return vscode.DiagnosticSeverity.Error;
    case 'major':
      return vscode.DiagnosticSeverity.Warning;
    case 'minor':
      return vscode.DiagnosticSeverity.Information;
    default:
      return vscode.DiagnosticSeverity.Hint;
  }
}

/**
 * Check whether a TextDocument is a supported file type.
 */
export function isSupported(document: vscode.TextDocument): boolean {
  const langId = document.languageId;
  if (SUPPORTED_LANGUAGES.includes(langId as typeof SUPPORTED_LANGUAGES[number])) {
    return true;
  }
  const filePath = document.fileName;
  return SUPPORTED_EXTENSIONS.some((ext) => filePath.endsWith(ext));
}

/**
 * Severity ordering for threshold filtering.
 * Lower index = higher severity.
 */
const SEVERITY_ORDER: ReadonlyArray<string> = [
  'blocker',
  'critical',
  'major',
  'minor',
  'info',
];

/**
 * Check if a finding severity meets or exceeds the threshold.
 */
export function meetsThreshold(
  severity: PreFlightSeverity | 'info',
  threshold: string,
): boolean {
  const findingIdx = SEVERITY_ORDER.indexOf(severity);
  const thresholdIdx = SEVERITY_ORDER.indexOf(threshold);
  if (findingIdx === -1 || thresholdIdx === -1) return true;
  return findingIdx <= thresholdIdx;
}
