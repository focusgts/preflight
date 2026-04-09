/**
 * Configuration management for Pre-Flight VS Code extension.
 *
 * Merges VS Code user/workspace settings with .preflightrc.json,
 * giving .preflightrc.json priority for team consistency.
 */

import * as vscode from 'vscode';

export interface PreFlightConfig {
  enable: boolean;
  runOnType: boolean;
  runOnSave: boolean;
  severityThreshold: string;
  rules: Record<string, string>;
}

const DEFAULT_CONFIG: PreFlightConfig = {
  enable: true,
  runOnType: true,
  runOnSave: true,
  severityThreshold: 'info',
  rules: {},
};

const KNOWN_KEYS = new Set([
  'enable',
  'runOnType',
  'runOnSave',
  'severityThreshold',
  'rules',
]);

let cachedRcConfig: Partial<PreFlightConfig> | null = null;
let outputChannel: vscode.OutputChannel | null = null;

function getOutputChannel(): vscode.OutputChannel {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel('Pre-Flight');
  }
  return outputChannel;
}

/**
 * Load .preflightrc.json from workspace root.
 * Returns partial config or null if not found.
 */
export async function loadRcConfig(): Promise<Partial<PreFlightConfig> | null> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    cachedRcConfig = null;
    return null;
  }

  const rcUri = vscode.Uri.joinPath(workspaceFolders[0].uri, '.preflightrc.json');
  try {
    const raw = await vscode.workspace.fs.readFile(rcUri);
    const text = new TextDecoder().decode(raw);
    const parsed = JSON.parse(text) as Record<string, unknown>;

    // Warn on unknown keys
    const channel = getOutputChannel();
    for (const key of Object.keys(parsed)) {
      if (!KNOWN_KEYS.has(key)) {
        channel.appendLine(`[Pre-Flight] Unknown config key in .preflightrc.json: "${key}"`);
      }
    }

    cachedRcConfig = parsed as Partial<PreFlightConfig>;
    return cachedRcConfig;
  } catch {
    cachedRcConfig = null;
    return null;
  }
}

/**
 * Get merged configuration.
 * Priority: .preflightrc.json > VS Code workspace settings > defaults.
 */
export function getConfig(): PreFlightConfig {
  const vsConfig = vscode.workspace.getConfiguration('preflight');

  const base: PreFlightConfig = {
    enable: vsConfig.get<boolean>('enable', DEFAULT_CONFIG.enable),
    runOnType: vsConfig.get<boolean>('runOnType', DEFAULT_CONFIG.runOnType),
    runOnSave: vsConfig.get<boolean>('runOnSave', DEFAULT_CONFIG.runOnSave),
    severityThreshold: vsConfig.get<string>(
      'severityThreshold',
      DEFAULT_CONFIG.severityThreshold,
    ),
    rules: vsConfig.get<Record<string, string>>('rules', DEFAULT_CONFIG.rules),
  };

  // .preflightrc.json overrides VS Code settings
  if (cachedRcConfig) {
    if (cachedRcConfig.enable !== undefined) base.enable = cachedRcConfig.enable;
    if (cachedRcConfig.runOnType !== undefined) base.runOnType = cachedRcConfig.runOnType;
    if (cachedRcConfig.runOnSave !== undefined) base.runOnSave = cachedRcConfig.runOnSave;
    if (cachedRcConfig.severityThreshold !== undefined) {
      base.severityThreshold = cachedRcConfig.severityThreshold;
    }
    if (cachedRcConfig.rules !== undefined) {
      base.rules = { ...base.rules, ...cachedRcConfig.rules };
    }
  }

  return base;
}

/**
 * Create a file system watcher for .preflightrc.json changes.
 */
export function watchRcConfig(
  onReload: () => void,
): vscode.FileSystemWatcher | undefined {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return undefined;
  }

  const pattern = new vscode.RelativePattern(
    workspaceFolders[0],
    '.preflightrc.json',
  );
  const watcher = vscode.workspace.createFileSystemWatcher(pattern);

  const reload = async () => {
    await loadRcConfig();
    onReload();
  };

  watcher.onDidChange(reload);
  watcher.onDidCreate(reload);
  watcher.onDidDelete(reload);

  return watcher;
}

/**
 * Dispose the output channel (call on extension deactivate).
 */
export function disposeOutputChannel(): void {
  if (outputChannel) {
    outputChannel.dispose();
    outputChannel = null;
  }
}
