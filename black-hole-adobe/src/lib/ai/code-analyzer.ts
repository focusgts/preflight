/**
 * Black Hole - AI-Powered Code Analyzer
 *
 * Uses Claude Sonnet for code compatibility analysis and Opus for complex
 * refactoring. Falls back to the rule-based AssessmentEngine when AI
 * is unavailable.
 */

import type {
  MigrationItem,
  AssessmentFinding,
} from '@/types';
import { Severity, CompatibilityLevel } from '@/types';
import { ClaudeClient, type ClaudeResponse, type StreamCallbacks } from './claude-client';
import {
  ANALYZE_CODE_COMPATIBILITY,
  REFACTOR_OSGI_CONFIG,
  REFACTOR_DEPRECATED_API,
  GENERATE_TEST_CASES,
} from './prompts';

// ============================================================
// Types
// ============================================================

export interface CodeAnalysisOptions {
  /** Source AEM version (e.g., "6.5"). */
  sourceVersion: string;
  /** Target platform (e.g., "AEM Cloud Service"). */
  targetPlatform: string;
  /** Maximum concurrent analysis calls. */
  maxConcurrency: number;
  /** Progress callback. */
  onProgress?: (completed: number, total: number) => void;
}

export interface CodeCompatibilityResult {
  filePath: string;
  findings: AssessmentFinding[];
  overallCompatibility: CompatibilityLevel;
  summary: string;
  fromAI: boolean;
}

interface AICodeAnalysisResponse {
  findings: Array<{
    line: number | null;
    severity: string;
    compatibilityLevel: string;
    title: string;
    description: string;
    remediationGuide: string;
    autoFixAvailable: boolean;
    estimatedHours: number;
    bpaPatternCode: string | null;
  }>;
  overallCompatibility: string;
  summary: string;
}

export interface RefactorResult {
  refactoredCode: string;
  changesSummary: string[];
  importsAdded: string[];
  importsRemoved: string[];
  warnings: string[];
  fromAI: boolean;
}

interface AIRefactorResponse {
  refactoredCode: string;
  changesSummary: string[];
  importsAdded: string[];
  importsRemoved: string[];
  warnings: string[];
}

export interface OSGiConversionResult {
  cfgJson: Record<string, unknown>;
  targetPath: string;
  notes: string[];
  fromAI: boolean;
}

interface AIOSGiResponse {
  cfgJson: Record<string, unknown>;
  targetPath: string;
  notes: string[];
}

export interface TestCase {
  id: string;
  name: string;
  category: 'verification' | 'regression' | 'integration' | 'smoke';
  priority: string;
  relatedFinding: string | null;
  steps: string[];
  expectedResult: string;
  automatable: boolean;
}

export interface TestGenerationResult {
  testCases: TestCase[];
  testSummary: {
    total: number;
    automated: number;
    manual: number;
    estimatedHours: number;
  };
  fromAI: boolean;
}

interface AITestGenResponse {
  testCases: TestCase[];
  testSummary: {
    total: number;
    automated: number;
    manual: number;
    estimatedHours: number;
  };
}

const DEFAULT_OPTIONS: CodeAnalysisOptions = {
  sourceVersion: '6.5',
  targetPlatform: 'AEM Cloud Service',
  maxConcurrency: 3,
};

// ============================================================
// Analyzer
// ============================================================

export class AICodeAnalyzer {
  private readonly client: ClaudeClient;
  private readonly options: CodeAnalysisOptions;

  constructor(client: ClaudeClient, options?: Partial<CodeAnalysisOptions>) {
    this.client = client;
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  // ----------------------------------------------------------
  // Code Compatibility Analysis (Sonnet)
  // ----------------------------------------------------------

  /**
   * Analyze a single code file for AEM Cloud Service compatibility.
   * Returns AI-powered findings when available, otherwise returns
   * a basic heuristic result.
   */
  async analyzeFile(
    filePath: string,
    code: string,
    language: string = 'java',
  ): Promise<CodeCompatibilityResult> {
    if (!this.client.available) {
      return this.heuristicAnalysis(filePath, code);
    }

    try {
      const prompt = ANALYZE_CODE_COMPATIBILITY({
        code,
        filePath,
        language,
        sourceVersion: this.options.sourceVersion,
        targetPlatform: this.options.targetPlatform,
      });

      const response: ClaudeResponse<AICodeAnalysisResponse> | null =
        await this.client.analyzeCode<AICodeAnalysisResponse>(prompt);

      if (!response) return this.heuristicAnalysis(filePath, code);

      const data = response.data;
      const findings = data.findings.map((f) => this.toAssessmentFinding(f, filePath));

      return {
        filePath,
        findings,
        overallCompatibility: validateCompatibility(data.overallCompatibility),
        summary: data.summary || 'Analysis complete',
        fromAI: true,
      };
    } catch {
      return this.heuristicAnalysis(filePath, code);
    }
  }

  /**
   * Analyze multiple code files with controlled concurrency.
   */
  async analyzeFiles(
    files: Array<{ path: string; code: string; language?: string }>,
  ): Promise<CodeCompatibilityResult[]> {
    const results: CodeCompatibilityResult[] = [];
    const executing: Set<Promise<void>> = new Set();

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const promise = this.analyzeFile(
        file.path,
        file.code,
        file.language ?? 'java',
      ).then((result) => {
        results.push(result);
        this.options.onProgress?.(results.length, files.length);
      });

      const tracked = promise.then(() => {
        executing.delete(tracked);
      });
      executing.add(tracked);

      if (executing.size >= this.options.maxConcurrency) {
        await Promise.race(executing);
      }
    }

    await Promise.all(executing);
    return results;
  }

  // ----------------------------------------------------------
  // OSGi Config Conversion (Sonnet)
  // ----------------------------------------------------------

  /**
   * Convert an OSGi XML config to .cfg.json format.
   */
  async convertOSGiConfig(
    xmlConfig: string,
    configPath: string,
    pid: string,
  ): Promise<OSGiConversionResult> {
    if (!this.client.available) {
      return this.heuristicOSGiConversion(xmlConfig, configPath, pid);
    }

    try {
      const prompt = REFACTOR_OSGI_CONFIG({ xmlConfig, configPath, pid });
      const response: ClaudeResponse<AIOSGiResponse> | null =
        await this.client.complete<AIOSGiResponse>('refactorCode', prompt, 'sonnet');

      if (!response) return this.heuristicOSGiConversion(xmlConfig, configPath, pid);

      return {
        cfgJson: response.data.cfgJson,
        targetPath: response.data.targetPath,
        notes: response.data.notes || [],
        fromAI: true,
      };
    } catch {
      return this.heuristicOSGiConversion(xmlConfig, configPath, pid);
    }
  }

  // ----------------------------------------------------------
  // Deprecated API Refactoring (Opus with streaming)
  // ----------------------------------------------------------

  /**
   * Refactor code to replace deprecated API usage.
   * Uses Opus with streaming for large files.
   */
  async refactorDeprecatedAPI(
    code: string,
    filePath: string,
    language: string,
    deprecatedApi: string,
    modernAlternative: string,
    callbacks: StreamCallbacks = {},
  ): Promise<RefactorResult> {
    if (!this.client.available) {
      return {
        refactoredCode: code,
        changesSummary: ['AI unavailable - no refactoring performed'],
        importsAdded: [],
        importsRemoved: [],
        warnings: ['Manual refactoring required: AI service is not configured'],
        fromAI: false,
      };
    }

    try {
      const prompt = REFACTOR_DEPRECATED_API({
        code,
        filePath,
        language,
        deprecatedApi,
        modernAlternative,
      });

      const response: ClaudeResponse<AIRefactorResponse> | null =
        await this.client.refactorCode<AIRefactorResponse>(prompt, callbacks);

      if (!response) {
        return {
          refactoredCode: code,
          changesSummary: ['Refactoring returned no result'],
          importsAdded: [],
          importsRemoved: [],
          warnings: ['Could not complete AI refactoring'],
          fromAI: false,
        };
      }

      return {
        ...response.data,
        fromAI: true,
      };
    } catch {
      return {
        refactoredCode: code,
        changesSummary: [],
        importsAdded: [],
        importsRemoved: [],
        warnings: ['AI refactoring failed - manual refactoring required'],
        fromAI: false,
      };
    }
  }

  // ----------------------------------------------------------
  // Test Generation (Sonnet)
  // ----------------------------------------------------------

  /**
   * Generate test cases from assessment findings.
   */
  async generateTestCases(
    findings: AssessmentFinding[],
    migrationType: string,
    targetPlatform: string = this.options.targetPlatform,
  ): Promise<TestGenerationResult> {
    if (!this.client.available || findings.length === 0) {
      return this.heuristicTestGeneration(findings);
    }

    try {
      const prompt = GENERATE_TEST_CASES({
        findings: findings.map((f) => ({
          title: f.title,
          severity: f.severity,
          remediationGuide: f.remediationGuide,
        })),
        migrationType,
        targetPlatform,
      });

      const response: ClaudeResponse<AITestGenResponse> | null =
        await this.client.complete<AITestGenResponse>('generateTestCases', prompt);

      if (!response) return this.heuristicTestGeneration(findings);

      return {
        testCases: response.data.testCases || [],
        testSummary: response.data.testSummary || {
          total: 0,
          automated: 0,
          manual: 0,
          estimatedHours: 0,
        },
        fromAI: true,
      };
    } catch {
      return this.heuristicTestGeneration(findings);
    }
  }

  // ----------------------------------------------------------
  // Heuristic Fallbacks
  // ----------------------------------------------------------

  private heuristicAnalysis(
    filePath: string,
    code: string,
  ): CodeCompatibilityResult {
    const findings: AssessmentFinding[] = [];
    const lines = code.split('\n');
    let worstLevel = CompatibilityLevel.COMPATIBLE;

    // Simple pattern matching for common issues
    const patterns: Array<{
      pattern: RegExp;
      title: string;
      severity: Severity;
      compat: CompatibilityLevel;
      remediation: string;
      autoFix: boolean;
      hours: number;
      bpa: string | null;
    }> = [
      {
        pattern: /javax\.jcr\./,
        title: 'Direct JCR API usage detected',
        severity: Severity.HIGH,
        compat: CompatibilityLevel.MANUAL_FIX,
        remediation: 'Replace javax.jcr imports with Sling Resource API.',
        autoFix: true,
        hours: 6,
        bpa: 'BPA-004',
      },
      {
        pattern: /org\.apache\.jackrabbit\./,
        title: 'Jackrabbit API usage detected',
        severity: Severity.HIGH,
        compat: CompatibilityLevel.MANUAL_FIX,
        remediation: 'Replace Jackrabbit API with Sling Resource API.',
        autoFix: true,
        hours: 6,
        bpa: 'BPA-004',
      },
      {
        pattern: /cq:widgets|ExtJS|CQ\.Ext/i,
        title: 'Classic UI / ExtJS usage detected',
        severity: Severity.CRITICAL,
        compat: CompatibilityLevel.BLOCKER,
        remediation: 'Replace with Coral UI 3 / Granite UI components.',
        autoFix: true,
        hours: 4,
        bpa: 'BPA-001',
      },
      {
        pattern: /ReplicationAgent|replication\.agent/i,
        title: 'Custom replication agent detected',
        severity: Severity.CRITICAL,
        compat: CompatibilityLevel.BLOCKER,
        remediation: 'Replace with Sling Content Distribution.',
        autoFix: false,
        hours: 16,
        bpa: 'BPA-003',
      },
      {
        pattern: /SlingServlet.*paths\s*=/i,
        title: 'Path-bound servlet detected',
        severity: Severity.MEDIUM,
        compat: CompatibilityLevel.MANUAL_FIX,
        remediation: 'Convert to resource-type-bound servlet.',
        autoFix: false,
        hours: 4,
        bpa: 'BPA-009',
      },
      {
        pattern: /LoginModule|AbstractLoginModule/,
        title: 'Custom login module detected',
        severity: Severity.CRITICAL,
        compat: CompatibilityLevel.BLOCKER,
        remediation: 'Use IMS-based authentication instead.',
        autoFix: false,
        hours: 24,
        bpa: 'BPA-006',
      },
    ];

    for (const { pattern, title, severity, compat, remediation, autoFix, hours, bpa } of patterns) {
      for (let i = 0; i < lines.length; i++) {
        if (pattern.test(lines[i])) {
          findings.push({
            id: `heuristic-${filePath}-${i}`,
            category: 'code',
            subCategory: 'compatibility',
            severity,
            compatibilityLevel: compat,
            title,
            description: `Found at line ${i + 1}: ${lines[i].trim().slice(0, 100)}`,
            affectedPath: filePath,
            remediationGuide: remediation,
            autoFixAvailable: autoFix,
            estimatedHours: hours,
            bpaPatternCode: bpa,
          });
          worstLevel = worseCompatibility(worstLevel, compat);
          break; // One finding per pattern per file
        }
      }
    }

    return {
      filePath,
      findings,
      overallCompatibility: worstLevel,
      summary: findings.length > 0
        ? `Found ${findings.length} compatibility issue(s) via heuristic analysis`
        : 'No compatibility issues detected via heuristic analysis',
      fromAI: false,
    };
  }

  private heuristicOSGiConversion(
    xmlConfig: string,
    configPath: string,
    pid: string,
  ): OSGiConversionResult {
    // Basic XML-to-JSON extraction for simple configs
    const cfgJson: Record<string, unknown> = {};

    // Extract simple property="value" patterns from XML
    const propRegex = /(\w[\w.]*)\s*=\s*"([^"]*)"/g;
    let match: RegExpExecArray | null;
    while ((match = propRegex.exec(xmlConfig)) !== null) {
      const [, key, value] = match;
      // Attempt type coercion
      if (value === 'true' || value === 'false') {
        cfgJson[key] = value === 'true';
      } else if (/^\d+$/.test(value)) {
        cfgJson[key] = parseInt(value, 10);
      } else {
        cfgJson[key] = value;
      }
    }

    // Derive target path
    const targetPath = configPath
      .replace(/\.xml$/, '.cfg.json')
      .replace(/\/config\//, '/config.author/');

    return {
      cfgJson,
      targetPath,
      notes: [
        'Heuristic conversion - AI was unavailable.',
        'Review property types and run-mode folder placement manually.',
        `Original PID: ${pid}`,
      ],
      fromAI: false,
    };
  }

  private heuristicTestGeneration(
    findings: AssessmentFinding[],
  ): TestGenerationResult {
    const testCases: TestCase[] = [];
    let id = 1;

    for (const finding of findings) {
      testCases.push({
        id: `TC-${String(id++).padStart(3, '0')}`,
        name: `Verify fix: ${finding.title}`,
        category: 'verification',
        priority: finding.severity,
        relatedFinding: finding.id,
        steps: [
          `Navigate to ${finding.affectedPath}`,
          `Verify the issue "${finding.title}" has been resolved`,
          'Run the component/service and confirm no errors',
        ],
        expectedResult: `The ${finding.title} issue is resolved and no related errors occur`,
        automatable: finding.autoFixAvailable,
      });
    }

    // Add standard smoke tests
    testCases.push({
      id: `TC-${String(id++).padStart(3, '0')}`,
      name: 'Smoke test: Author instance login',
      category: 'smoke',
      priority: 'critical',
      relatedFinding: null,
      steps: [
        'Navigate to AEM Cloud Service author URL',
        'Log in with IMS credentials',
        'Verify Sites console loads',
      ],
      expectedResult: 'Author instance is accessible and Sites console renders correctly',
      automatable: true,
    });

    testCases.push({
      id: `TC-${String(id++).padStart(3, '0')}`,
      name: 'Smoke test: Publish instance content rendering',
      category: 'smoke',
      priority: 'critical',
      relatedFinding: null,
      steps: [
        'Navigate to a published page on the publish instance',
        'Verify page renders without errors',
        'Check browser console for JavaScript errors',
      ],
      expectedResult: 'Published pages render correctly without errors',
      automatable: true,
    });

    return {
      testCases,
      testSummary: {
        total: testCases.length,
        automated: testCases.filter((t) => t.automatable).length,
        manual: testCases.filter((t) => !t.automatable).length,
        estimatedHours: testCases.length * 0.5,
      },
      fromAI: false,
    };
  }

  // ----------------------------------------------------------
  // Helpers
  // ----------------------------------------------------------

  private toAssessmentFinding(
    raw: AICodeAnalysisResponse['findings'][number],
    filePath: string,
  ): AssessmentFinding {
    return {
      id: `ai-${filePath}-${raw.line ?? 0}-${Date.now()}`,
      category: 'code',
      subCategory: 'compatibility',
      severity: validateSeverity(raw.severity),
      compatibilityLevel: validateCompatibility(raw.compatibilityLevel),
      title: raw.title,
      description: raw.description,
      affectedPath: filePath,
      remediationGuide: raw.remediationGuide,
      autoFixAvailable: Boolean(raw.autoFixAvailable),
      estimatedHours: typeof raw.estimatedHours === 'number' ? raw.estimatedHours : 4,
      bpaPatternCode: raw.bpaPatternCode ?? null,
    };
  }
}

// ============================================================
// Validation Helpers
// ============================================================

const SEVERITY_VALUES = new Set(Object.values(Severity));
const COMPAT_VALUES = new Set(Object.values(CompatibilityLevel));

function validateSeverity(value: string): Severity {
  if (SEVERITY_VALUES.has(value as Severity)) return value as Severity;
  return Severity.MEDIUM;
}

function validateCompatibility(value: string): CompatibilityLevel {
  if (COMPAT_VALUES.has(value as CompatibilityLevel)) return value as CompatibilityLevel;
  return CompatibilityLevel.COMPATIBLE;
}

const COMPAT_ORDER: Record<CompatibilityLevel, number> = {
  [CompatibilityLevel.COMPATIBLE]: 0,
  [CompatibilityLevel.AUTO_FIXABLE]: 1,
  [CompatibilityLevel.MANUAL_FIX]: 2,
  [CompatibilityLevel.BLOCKER]: 3,
};

function worseCompatibility(
  a: CompatibilityLevel,
  b: CompatibilityLevel,
): CompatibilityLevel {
  return COMPAT_ORDER[a] >= COMPAT_ORDER[b] ? a : b;
}
