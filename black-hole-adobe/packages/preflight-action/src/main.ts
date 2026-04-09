/**
 * Black Hole Pre-Flight GitHub Action -- Entry Point
 *
 * Runs the pre-flight engine against AEM project files in a PR,
 * emits annotations, posts a sticky comment, and optionally
 * generates SARIF output for GitHub Code Scanning.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as core from '@actions/core';
import * as github from '@actions/github';
import { PreFlightEngine } from '@blackhole/preflight-engine';
import type { PreFlightItem } from '@blackhole/preflight-engine';
import { parseInputs } from './inputs';
import { getChangedFiles } from './changed-files';
import { emitAnnotations } from './annotations';
import { postOrUpdateComment } from './comment';
import { writeSarifFile } from './sarif-upload';
import { countBySeverity, severityAtOrAbove, isSupportedFile } from './utils';

/**
 * Walk a directory recursively and collect supported files.
 */
function discoverAllFiles(dir: string): string[] {
  const skipDirs = new Set([
    'node_modules', '.git', '.svn', 'target', 'dist', '.next', '__pycache__',
  ]);
  const results: string[] = [];

  function walk(current: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!skipDirs.has(entry.name)) walk(fullPath);
      } else if (entry.isFile() && isSupportedFile(fullPath)) {
        results.push(fullPath);
      }
    }
  }

  walk(dir);
  return results;
}

/**
 * Read file contents from disk and return PreFlightItem entries.
 */
function readFiles(filePaths: string[], workspaceRoot: string): PreFlightItem[] {
  const items: PreFlightItem[] = [];
  for (const filePath of filePaths) {
    const absPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(workspaceRoot, filePath);
    try {
      const content = fs.readFileSync(absPath, 'utf-8');
      // Use relative path for findings so annotations map correctly
      const relPath = path.relative(workspaceRoot, absPath);
      items.push({ path: relPath, content });
    } catch {
      core.warning(`Could not read file: ${filePath}`);
    }
  }
  return items;
}

async function run(): Promise<void> {
  try {
    const inputs = parseInputs();
    const workspace = process.env.GITHUB_WORKSPACE || process.cwd();

    // Determine which files to scan
    let filePaths: string[];
    const isPR = !!github.context.payload.pull_request;

    if (inputs.scan === 'changed' && isPR) {
      core.info('Scanning changed files in pull request...');
      filePaths = await getChangedFiles(inputs.token);
      if (filePaths.length === 0) {
        core.info('No supported files changed in this PR.');
      }
    } else {
      core.info('Scanning all supported files in repository...');
      const absFiles = discoverAllFiles(workspace);
      filePaths = absFiles.map((f) => path.relative(workspace, f));
    }

    core.info(`Found ${filePaths.length} file(s) to scan.`);

    // Read file contents
    const items = readFiles(filePaths, workspace);

    // Run the engine
    const engine = new PreFlightEngine();
    const report = engine.runPreFlight(items);
    const counts = countBySeverity(report.findings);

    core.info(
      `Scan complete: ${report.findings.length} finding(s) ` +
      `(${counts.blocker} blocker, ${counts.critical} critical, ` +
      `${counts.major} major, ${counts.minor} minor)`
    );

    // Set outputs
    core.setOutput('total', report.findings.length.toString());
    core.setOutput('blocker', counts.blocker.toString());
    core.setOutput('critical', counts.critical.toString());
    core.setOutput('major', counts.major.toString());

    // Emit annotations
    if (inputs.annotations) {
      emitAnnotations(report.findings);
    }

    // Post/update PR comment
    if (inputs.comment && isPR) {
      await postOrUpdateComment(inputs.token, report.findings);
    }

    // Generate SARIF
    if (inputs.sarifUpload) {
      writeSarifFile(report);
    }

    // Fail the check if findings meet the threshold
    const failingFindings = report.findings.filter((f) =>
      severityAtOrAbove(f, inputs.failOn)
    );

    if (failingFindings.length > 0) {
      const failCounts = countBySeverity(failingFindings);
      core.setFailed(
        `Pre-flight found ${failingFindings.length} finding(s) at or above "${inputs.failOn}" severity ` +
        `(${failCounts.blocker} blocker, ${failCounts.critical} critical, ` +
        `${failCounts.major} major, ${failCounts.minor} minor). ` +
        `Fix these issues before merging.`
      );
    }
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('An unexpected error occurred');
    }
  }
}

run();
