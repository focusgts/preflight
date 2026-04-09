/**
 * Parse and validate GitHub Action inputs.
 */

import * as core from '@actions/core';
import type { PreFlightSeverity } from '@blackhole/preflight-engine';
import type { FailOnLevel } from './utils';

export interface ActionInputs {
  failOn: FailOnLevel;
  scan: 'changed' | 'all';
  configFile: string;
  comment: boolean;
  annotations: boolean;
  sarifUpload: boolean;
  token: string;
}

const VALID_FAIL_ON: ReadonlySet<string> = new Set([
  'blocker',
  'critical',
  'major',
  'minor',
  'none',
]);

const VALID_SCAN: ReadonlySet<string> = new Set(['changed', 'all']);

function parseBooleanInput(value: string): boolean {
  return value.toLowerCase() === 'true';
}

/**
 * Read and validate all action inputs from the GitHub Actions environment.
 */
export function parseInputs(): ActionInputs {
  const failOn = core.getInput('fail-on') || 'critical';
  if (!VALID_FAIL_ON.has(failOn)) {
    throw new Error(
      `Invalid fail-on value "${failOn}". Must be one of: blocker, critical, major, minor, none`
    );
  }

  const scan = core.getInput('scan') || 'changed';
  if (!VALID_SCAN.has(scan)) {
    throw new Error(
      `Invalid scan value "${scan}". Must be one of: changed, all`
    );
  }

  const configFile = core.getInput('config-file') || '.preflightrc.json';
  const comment = parseBooleanInput(core.getInput('comment') || 'true');
  const annotations = parseBooleanInput(core.getInput('annotations') || 'true');
  const sarifUpload = parseBooleanInput(core.getInput('sarif-upload') || 'false');
  const token = core.getInput('token') || '';

  return {
    failOn: failOn as FailOnLevel,
    scan: scan as 'changed' | 'all',
    configFile,
    comment,
    annotations,
    sarifUpload,
    token,
  };
}
