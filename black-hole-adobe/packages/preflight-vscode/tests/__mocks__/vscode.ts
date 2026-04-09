/**
 * Mock of the vscode module for testing outside VS Code runtime.
 */

export enum DiagnosticSeverity {
  Error = 0,
  Warning = 1,
  Information = 2,
  Hint = 3,
}

export class Position {
  constructor(
    public readonly line: number,
    public readonly character: number,
  ) {}
}

export class Range {
  public readonly start: Position;
  public readonly end: Position;
  constructor(
    startLineOrPos: number | Position,
    startCharOrEnd: number | Position,
    endLine?: number,
    endChar?: number,
  ) {
    if (startLineOrPos instanceof Position && startCharOrEnd instanceof Position) {
      this.start = startLineOrPos;
      this.end = startCharOrEnd;
    } else {
      this.start = new Position(startLineOrPos as number, startCharOrEnd as number);
      this.end = new Position(endLine as number, endChar as number);
    }
  }
}

export class Diagnostic {
  public source?: string;
  public code?: unknown;
  constructor(
    public readonly range: Range,
    public readonly message: string,
    public severity: DiagnosticSeverity = DiagnosticSeverity.Error,
  ) {}
}

export class Uri {
  private constructor(public readonly scheme: string, public readonly path: string) {}
  static parse(value: string): Uri {
    return new Uri('https', value);
  }
  static file(path: string): Uri {
    return new Uri('file', path);
  }
  static joinPath(base: Uri, ...segments: string[]): Uri {
    return new Uri(base.scheme, [base.path, ...segments].join('/'));
  }
  toString(): string {
    return `${this.scheme}://${this.path}`;
  }
}

export class WorkspaceEdit {
  private _edits: Array<{ uri: Uri; range: Range; newText: string }> = [];
  replace(uri: Uri, range: Range, newText: string): void {
    this._edits.push({ uri, range, newText });
  }
  insert(uri: Uri, position: Position, newText: string): void {
    this._edits.push({
      uri,
      range: new Range(position.line, position.character, position.line, position.character),
      newText,
    });
  }
  get edits() {
    return this._edits;
  }
}

export const CodeActionKind = {
  QuickFix: 'quickfix',
};

export class CodeAction {
  public edit?: WorkspaceEdit;
  public diagnostics?: Diagnostic[];
  public isPreferred?: boolean;
  constructor(
    public readonly title: string,
    public readonly kind?: string,
  ) {}
}

function createMockDiagnosticCollection() {
  const store = new Map<string, Diagnostic[]>();
  return {
    name: 'preflight',
    set(uri: Uri | string, diagnostics: Diagnostic[]): void {
      const key = typeof uri === 'string' ? uri : uri.toString();
      store.set(key, diagnostics);
    },
    delete(uri: Uri | string): void {
      const key = typeof uri === 'string' ? uri : uri.toString();
      store.delete(key);
    },
    clear(): void {
      store.clear();
    },
    get(uri: Uri | string): Diagnostic[] | undefined {
      const key = typeof uri === 'string' ? uri : uri.toString();
      return store.get(key);
    },
    dispose(): void {
      store.clear();
    },
    _store: store,
  };
}

const configValues: Record<string, unknown> = {};

export const workspace = {
  getConfiguration(section?: string) {
    return {
      get<T>(key: string, defaultValue?: T): T {
        const fullKey = section ? `${section}.${key}` : key;
        const val = configValues[fullKey];
        return (val !== undefined ? val : defaultValue) as T;
      },
    };
  },
  workspaceFolders: [
    { uri: Uri.file('/test-workspace'), name: 'test', index: 0 },
  ] as Array<{ uri: Uri; name: string; index: number }>,
  findFiles: async () => [] as Uri[],
  openTextDocument: async (uri: Uri) => createMockDocument('', uri.path),
  createFileSystemWatcher: () => ({
    onDidChange: () => ({ dispose: () => {} }),
    onDidCreate: () => ({ dispose: () => {} }),
    onDidDelete: () => ({ dispose: () => {} }),
    dispose: () => {},
  }),
  onDidChangeTextDocument: () => ({ dispose: () => {} }),
  onDidSaveTextDocument: () => ({ dispose: () => {} }),
  fs: {
    readFile: async () => new Uint8Array(),
  },
};

export const window = {
  createOutputChannel: () => ({
    appendLine: () => {},
    dispose: () => {},
  }),
  showInformationMessage: async (..._args: unknown[]) => undefined,
  showWarningMessage: async (..._args: unknown[]) => undefined,
  showQuickPick: async (items: unknown[]) => (items as Array<{ rule: unknown }>)[0],
  activeTextEditor: undefined as unknown,
  visibleTextEditors: [] as unknown[],
};

export const languages = {
  createDiagnosticCollection: (name?: string) => {
    const col = createMockDiagnosticCollection();
    if (name) (col as { name: string }).name = name;
    return col;
  },
  registerCodeActionsProvider: () => ({ dispose: () => {} }),
};

export const commands = {
  registerCommand: (_cmd: string, _handler: (...args: unknown[]) => unknown) => ({
    dispose: () => {},
  }),
};

export const env = {
  openExternal: async (_uri: Uri) => true,
};

export class RelativePattern {
  constructor(
    public readonly base: unknown,
    public readonly pattern: string,
  ) {}
}

// Helper to create mock TextDocument
export function createMockDocument(
  content: string,
  fileName: string = '/test/file.java',
  languageId?: string,
) {
  const lines = content.split('\n');
  const detectedLang =
    languageId ??
    (fileName.endsWith('.java')
      ? 'java'
      : fileName.endsWith('.xml')
        ? 'xml'
        : fileName.endsWith('.json') || fileName.endsWith('.cfg.json')
          ? 'json'
          : 'plaintext');

  return {
    fileName,
    languageId: detectedLang,
    uri: Uri.file(fileName),
    getText: () => content,
    lineAt: (line: number) => ({
      text: lines[Math.min(line, lines.length - 1)] ?? '',
      range: new Range(line, 0, line, (lines[line] ?? '').length),
    }),
    lineCount: lines.length,
  };
}

// Utility: set a mock config value for tests
export function __setConfigValue(key: string, value: unknown): void {
  configValues[key] = value;
}

export function __clearConfigValues(): void {
  for (const key of Object.keys(configValues)) {
    delete configValues[key];
  }
}
