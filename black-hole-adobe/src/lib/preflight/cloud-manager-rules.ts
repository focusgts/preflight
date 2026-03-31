/**
 * Cloud Manager Pre-Flight Simulation Engine (ADR-036)
 *
 * Validates code against Cloud Manager quality gate rules that BPA misses.
 * Covers SonarQube custom rules, OakPAL index validation, and Java runtime
 * compatibility checks for AEM as a Cloud Service deployments.
 */

// ============================================================
// Types
// ============================================================

export type PreFlightSeverity = 'blocker' | 'critical' | 'major' | 'minor';
export type PreFlightCategory = 'sonarqube' | 'oakpal' | 'java-compat';

export interface PreFlightFinding {
  ruleId: string;
  ruleName: string;
  severity: PreFlightSeverity;
  category: PreFlightCategory;
  filePath: string;
  line?: number;
  message: string;
  remediation: string;
}

export interface PreFlightItem {
  path: string;
  content: string;
}

export interface PreFlightReport {
  id: string;
  timestamp: string;
  totalRulesChecked: number;
  passCount: number;
  failCount: number;
  warningCount: number;
  findings: PreFlightFinding[];
  successProbability: number;
  bpaComparisonNote: string;
  summary: PreFlightSummary;
}

export interface PreFlightSummary {
  blockers: number;
  criticals: number;
  majors: number;
  minors: number;
  topBlockers: string[];
  topRemediations: string[];
}

// ============================================================
// Rule Definitions
// ============================================================

interface RuleDefinition {
  id: string;
  name: string;
  severity: PreFlightSeverity;
  category: PreFlightCategory;
  /** Return findings for the given file content, or empty array if clean. */
  check: (content: string, filePath: string) => PreFlightFinding[];
}

/**
 * Find the 1-based line number of the first match in content.
 * Returns undefined if no match found.
 */
function findLineNumber(content: string, pattern: RegExp): number | undefined {
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (pattern.test(lines[i])) {
      return i + 1;
    }
  }
  return undefined;
}

/**
 * Find all 1-based line numbers matching a pattern.
 */
function findAllLineNumbers(content: string, pattern: RegExp): number[] {
  const lines = content.split('\n');
  const results: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (pattern.test(lines[i])) {
      results.push(i + 1);
    }
  }
  return results;
}

// ── SonarQube Rules ──

const sonarQubeRules: RuleDefinition[] = [
  {
    id: 'CQRules:ConnectionTimeoutMechanism',
    name: 'Connection Timeout Mechanism',
    severity: 'blocker',
    category: 'sonarqube',
    check(content, filePath) {
      const findings: PreFlightFinding[] = [];
      if (!isJavaFile(filePath)) return findings;

      // Detect HttpClient or URLConnection usage without timeout
      const httpClientPattern = /new\s+HttpClient\s*\(|HttpClients\.create(?:Default)?\s*\(|HttpClientBuilder\.create\s*\(/g;
      const urlConnectionPattern = /\.openConnection\s*\(/g;
      const timeoutPattern = /\.setConnectTimeout\s*\(|\.setSocketTimeout\s*\(|\.setConnectionRequestTimeout\s*\(|ConnectTimeoutException|RequestConfig\.custom\s*\(\s*\)[\s\S]{0,500}\.setConnectTimeout|\.setReadTimeout\s*\(|\.setConnectTimeout\s*\(/;

      const hasHttpClient = httpClientPattern.test(content);
      const hasUrlConnection = urlConnectionPattern.test(content);
      const hasTimeout = timeoutPattern.test(content);

      if (hasHttpClient && !hasTimeout) {
        findings.push({
          ruleId: 'CQRules:ConnectionTimeoutMechanism',
          ruleName: 'Connection Timeout Mechanism',
          severity: 'blocker',
          category: 'sonarqube',
          filePath,
          line: findLineNumber(content, /new\s+HttpClient\s*\(|HttpClients\.create|HttpClientBuilder/),
          message: 'HttpClient created without connection/socket timeout configuration. Cloud Manager requires all HTTP connections to have explicit timeouts.',
          remediation: 'Set connectTimeout, socketTimeout, and connectionRequestTimeout via RequestConfig.custom(). Recommended: 10s connect, 30s socket.',
        });
      }

      if (hasUrlConnection && !hasTimeout) {
        findings.push({
          ruleId: 'CQRules:ConnectionTimeoutMechanism',
          ruleName: 'Connection Timeout Mechanism',
          severity: 'blocker',
          category: 'sonarqube',
          filePath,
          line: findLineNumber(content, /\.openConnection\s*\(/),
          message: 'URLConnection opened without setConnectTimeout/setReadTimeout. Cloud Manager requires explicit timeouts on all connections.',
          remediation: 'Call setConnectTimeout() and setReadTimeout() immediately after openConnection(). Recommended: 10000ms connect, 30000ms read.',
        });
      }

      return findings;
    },
  },

  {
    id: 'CQRules:ResourceResolverAutoClose',
    name: 'ResourceResolver Auto-Close',
    severity: 'blocker',
    category: 'sonarqube',
    check(content, filePath) {
      const findings: PreFlightFinding[] = [];
      if (!isJavaFile(filePath)) return findings;

      // Detect ResourceResolver opened but not in try-with-resources or closed in finally
      const resolverCreation = /(?:getServiceResourceResolver|getResourceResolver|getAdministrativeResourceResolver)\s*\(/g;
      const tryWithResources = /try\s*\(\s*(?:final\s+)?ResourceResolver/;
      const finallyClose = /finally\s*\{[\s\S]{0,300}\.close\s*\(\s*\)/;

      if (resolverCreation.test(content)) {
        const hasTryWith = tryWithResources.test(content);
        const hasFinallyClose = finallyClose.test(content);

        if (!hasTryWith && !hasFinallyClose) {
          findings.push({
            ruleId: 'CQRules:ResourceResolverAutoClose',
            ruleName: 'ResourceResolver Auto-Close',
            severity: 'blocker',
            category: 'sonarqube',
            filePath,
            line: findLineNumber(content, /(?:getServiceResourceResolver|getResourceResolver)\s*\(/),
            message: 'ResourceResolver opened but not closed in finally block or try-with-resources. This causes resource leaks that crash AEMaaCS pods.',
            remediation: 'Wrap ResourceResolver in try-with-resources: try (ResourceResolver resolver = factory.getServiceResourceResolver(params)) { ... }',
          });
        }
      }

      return findings;
    },
  },

  {
    id: 'CQRules:CQBP-72',
    name: 'Custom Servlet Path Registration',
    severity: 'critical',
    category: 'sonarqube',
    check(content, filePath) {
      const findings: PreFlightFinding[] = [];
      if (!isJavaFile(filePath)) return findings;

      // Servlets must use resourceType, not path
      const pathBinding = /sling\.servlet\.paths\s*=|@SlingServlet\s*\([^)]*paths\s*=|property\s*=\s*"sling\.servlet\.paths/;

      if (pathBinding.test(content)) {
        findings.push({
          ruleId: 'CQRules:CQBP-72',
          ruleName: 'Custom Servlet Path Registration',
          severity: 'critical',
          category: 'sonarqube',
          filePath,
          line: findLineNumber(content, pathBinding),
          message: 'Servlet registered by path instead of resourceType. Path-bound servlets bypass AEM\'s security model and are blocked by Cloud Manager.',
          remediation: 'Register servlets by sling.servlet.resourceTypes and sling.servlet.selectors/extensions instead of sling.servlet.paths.',
        });
      }

      return findings;
    },
  },

  {
    id: 'CQRules:CQBP-84',
    name: 'ResourceResolver Lifecycle Management',
    severity: 'critical',
    category: 'sonarqube',
    check(content, filePath) {
      const findings: PreFlightFinding[] = [];
      if (!isJavaFile(filePath)) return findings;

      // Detect ResourceResolver stored as instance field (lifecycle anti-pattern)
      const fieldResolver = /(?:private|protected)\s+ResourceResolver\s+\w+\s*;/;
      // Detect resolver passed across method boundaries without close
      const resolverParam = /public\s+\w+\s+\w+\s*\([^)]*ResourceResolver\s+\w+[^)]*\)/;
      const classHasActivate = /@Activate|@PostConstruct/;

      if (fieldResolver.test(content) && classHasActivate.test(content)) {
        findings.push({
          ruleId: 'CQRules:CQBP-84',
          ruleName: 'ResourceResolver Lifecycle Management',
          severity: 'critical',
          category: 'sonarqube',
          filePath,
          line: findLineNumber(content, fieldResolver),
          message: 'ResourceResolver stored as instance field in an OSGi component. Resolvers must be request-scoped or opened/closed within a single method.',
          remediation: 'Open ResourceResolver in a try-with-resources block inside each method that needs it. Do not cache resolvers as instance fields.',
        });
      }

      // Detect multiple resolver opens without corresponding closes in same method
      const lines = content.split('\n');
      let openCount = 0;
      let closeCount = 0;
      for (const line of lines) {
        if (/getServiceResourceResolver|getResourceResolver/.test(line)) openCount++;
        if (/\.close\s*\(/.test(line) || /try\s*\(\s*(?:final\s+)?ResourceResolver/.test(line)) closeCount++;
      }

      if (openCount > 0 && openCount > closeCount + 1) {
        findings.push({
          ruleId: 'CQRules:CQBP-84',
          ruleName: 'ResourceResolver Lifecycle Management',
          severity: 'critical',
          category: 'sonarqube',
          filePath,
          message: `Found ${openCount} ResourceResolver opens but only ${closeCount} close/try-with-resources. Each open must have a corresponding close.`,
          remediation: 'Ensure every getServiceResourceResolver() / getResourceResolver() call has a matching close() in a finally block or uses try-with-resources.',
        });
      }

      return findings;
    },
  },

  {
    id: 'CQRules:ContentClassification',
    name: 'Content Classification — /libs Reference',
    severity: 'major',
    category: 'sonarqube',
    check(content, filePath) {
      const findings: PreFlightFinding[] = [];

      // Check Java, JSP, HTL, and XML files
      if (!isJavaFile(filePath) && !isContentFile(filePath)) return findings;

      // Direct /libs references are forbidden — must use overlays via /apps
      const libsRefPattern = /["'`]\/libs\/[^"'`]+["'`]/g;
      const matchLines = findAllLineNumbers(content, /["'`]\/libs\/[^"'`]+["'`]/);

      if (matchLines.length > 0) {
        findings.push({
          ruleId: 'CQRules:ContentClassification',
          ruleName: 'Content Classification — /libs Reference',
          severity: 'major',
          category: 'sonarqube',
          filePath,
          line: matchLines[0],
          message: `Direct /libs content reference found (${matchLines.length} occurrence${matchLines.length > 1 ? 's' : ''}). /libs is immutable in Cloud Service and may change without notice.`,
          remediation: 'Overlay the component into /apps and reference the overlay. Use sling:resourceSuperType for component inheritance instead of direct /libs paths.',
        });
      }

      return findings;
    },
  },

  {
    id: 'CQRules:AMSRT',
    name: 'Deprecated AMS-Specific Run Modes',
    severity: 'major',
    category: 'sonarqube',
    check(content, filePath) {
      const findings: PreFlightFinding[] = [];

      // Check OSGi config files, XML, and Java
      if (!isJavaFile(filePath) && !isConfigFile(filePath) && !isContentFile(filePath)) return findings;

      // AMS run modes that are not available in Cloud Service
      const amsRunModes = [
        'config.dev', 'config.stage', 'config.prod',
        'config.author.dev', 'config.author.stage', 'config.author.prod',
        'config.publish.dev', 'config.publish.stage', 'config.publish.prod',
      ];

      // Cloud Service uses different environment naming
      const deprecatedPattern = new RegExp(
        `(?:runmode|sling\\.run\\.modes?|config\\.)(?:${amsRunModes.map(m => m.replace('.', '\\.')).join('|')})`,
        'g',
      );

      const matchLine = findLineNumber(content, deprecatedPattern);
      if (matchLine !== undefined) {
        findings.push({
          ruleId: 'CQRules:AMSRT',
          ruleName: 'Deprecated AMS-Specific Run Modes',
          severity: 'major',
          category: 'sonarqube',
          filePath,
          line: matchLine,
          message: 'AMS-specific run mode detected. Cloud Service uses environment-specific run modes (dev, stage, prod) without the config. prefix pattern.',
          remediation: 'Replace AMS run modes with Cloud Service equivalents. Use config.author/config.publish for tier targeting and env-specific variables via Cloud Manager environment variables.',
        });
      }

      // Also check folder-based run mode configs
      if (filePath.includes('/config.') && amsRunModes.some(m => filePath.includes(`/${m}/`) || filePath.endsWith(`/${m}`))) {
        findings.push({
          ruleId: 'CQRules:AMSRT',
          ruleName: 'Deprecated AMS-Specific Run Modes',
          severity: 'major',
          category: 'sonarqube',
          filePath,
          message: 'OSGi config file in AMS-specific run mode folder. Cloud Service does not support AMS run mode folder conventions.',
          remediation: 'Restructure to config.author/, config.publish/, or config.author.dev/ (Cloud Service naming). Use Cloud Manager environment variables for environment-specific values.',
        });
      }

      return findings;
    },
  },
];

// ── OakPAL Rules ──

const oakpalRules: RuleDefinition[] = [
  {
    id: 'OakPAL:IndexTypeLucene',
    name: 'Index Type Must Be Lucene',
    severity: 'blocker',
    category: 'oakpal',
    check(content, filePath) {
      const findings: PreFlightFinding[] = [];
      if (!isIndexDefinition(filePath, content)) return findings;

      // Custom indexes must be lucene type, not property
      const hasPropertyType = /type\s*=\s*["']property["']/i.test(content) ||
        /jcr:primaryType\s*=\s*["']oak:QueryIndexDefinition["'][\s\S]*?type\s*=\s*["']property["']/i.test(content);

      if (hasPropertyType) {
        findings.push({
          ruleId: 'OakPAL:IndexTypeLucene',
          ruleName: 'Index Type Must Be Lucene',
          severity: 'blocker',
          category: 'oakpal',
          filePath,
          line: findLineNumber(content, /type\s*=\s*["']property["']/i),
          message: 'Custom Oak index uses type="property". Cloud Manager requires custom indexes to use type="lucene" for AEMaaCS.',
          remediation: 'Change index type from "property" to "lucene". Property indexes are managed by Adobe in Cloud Service and cannot be customized.',
        });
      }

      return findings;
    },
  },

  {
    id: 'OakPAL:AsyncFlag',
    name: 'Index Must Have Async Flag',
    severity: 'blocker',
    category: 'oakpal',
    check(content, filePath) {
      const findings: PreFlightFinding[] = [];
      if (!isIndexDefinition(filePath, content)) return findings;

      const isLucene = /type\s*=\s*["']lucene["']/i.test(content);
      const hasAsync = /async\s*=\s*["']\[?(?:async|nrt)/i.test(content);

      if (isLucene && !hasAsync) {
        findings.push({
          ruleId: 'OakPAL:AsyncFlag',
          ruleName: 'Index Must Have Async Flag',
          severity: 'blocker',
          category: 'oakpal',
          filePath,
          message: 'Lucene index definition missing async flag. Synchronous lucene indexes are not supported in AEMaaCS.',
          remediation: 'Add async="[async, nrt]" property to the index definition node. This ensures the index is updated asynchronously.',
        });
      }

      return findings;
    },
  },

  {
    id: 'OakPAL:TikaConfig',
    name: 'Full-Text Index Tika Configuration',
    severity: 'critical',
    category: 'oakpal',
    check(content, filePath) {
      const findings: PreFlightFinding[] = [];
      if (!isIndexDefinition(filePath, content)) return findings;

      // Check if this is a full-text index (has analyzers or evaluatePathRestrictions with full-text)
      const isFullText = /evaluatePathRestrictions\s*=\s*["']\{Boolean\}true["']/i.test(content) ||
        /analyzed\s*=\s*["']true["']/i.test(content) ||
        /nodeScopeIndex\s*=\s*["']true["']/i.test(content);

      const hasTikaConfig = /tika/i.test(content);

      if (isFullText && !hasTikaConfig) {
        findings.push({
          ruleId: 'OakPAL:TikaConfig',
          ruleName: 'Full-Text Index Tika Configuration',
          severity: 'critical',
          category: 'oakpal',
          filePath,
          message: 'Full-text index definition missing Tika configuration. Without explicit Tika config, binary extraction may fail or produce unexpected results in Cloud Service.',
          remediation: 'Add a tika child node with appropriate mime type configuration. Reference Adobe documentation for damAssetLucene Tika config structure.',
        });
      }

      return findings;
    },
  },

  {
    id: 'OakPAL:DamAssetLuceneNaming',
    name: 'damAssetLucene Naming Convention',
    severity: 'critical',
    category: 'oakpal',
    check(content, filePath) {
      const findings: PreFlightFinding[] = [];
      if (!isIndexDefinition(filePath, content)) return findings;

      // Custom damAssetLucene index must follow naming convention: damAssetLucene-{number}-custom-{number}
      const isDamIndex = /damAssetLucene/i.test(filePath) || /damAssetLucene/i.test(content);
      if (!isDamIndex) return findings;

      const validNaming = /damAssetLucene-\d+-custom-\d+/i;
      const hasValidName = validNaming.test(filePath) || validNaming.test(content);

      if (!hasValidName) {
        findings.push({
          ruleId: 'OakPAL:DamAssetLuceneNaming',
          ruleName: 'damAssetLucene Naming Convention',
          severity: 'critical',
          category: 'oakpal',
          filePath,
          message: 'damAssetLucene index does not follow required naming convention. Cloud Manager enforces the pattern: damAssetLucene-{version}-custom-{version}.',
          remediation: 'Rename the index to follow the pattern: damAssetLucene-8-custom-1 (where 8 is the base OOTB version and 1 is your custom version).',
        });
      }

      return findings;
    },
  },

  {
    id: 'OakPAL:CompatVersion',
    name: 'Index compatVersion >= 2',
    severity: 'major',
    category: 'oakpal',
    check(content, filePath) {
      const findings: PreFlightFinding[] = [];
      if (!isIndexDefinition(filePath, content)) return findings;

      const isLucene = /type\s*=\s*["']lucene["']/i.test(content);
      if (!isLucene) return findings;

      const compatMatch = content.match(/compatVersion\s*=\s*["']\{(?:Long|long)\}(\d+)["']/i);
      const compatVersion = compatMatch ? parseInt(compatMatch[1], 10) : 0;

      if (compatVersion < 2) {
        findings.push({
          ruleId: 'OakPAL:CompatVersion',
          ruleName: 'Index compatVersion >= 2',
          severity: 'major',
          category: 'oakpal',
          filePath,
          line: compatMatch ? findLineNumber(content, /compatVersion/) : undefined,
          message: `Index compatVersion is ${compatVersion || 'not set'}. Cloud Service requires compatVersion >= 2 for Lucene indexes.`,
          remediation: 'Add or update: compatVersion="{Long}2" on the index definition node.',
        });
      }

      return findings;
    },
  },

  {
    id: 'OakPAL:IncludedExcludedPaths',
    name: 'Index Path Restrictions Validation',
    severity: 'major',
    category: 'oakpal',
    check(content, filePath) {
      const findings: PreFlightFinding[] = [];
      if (!isIndexDefinition(filePath, content)) return findings;

      // Check for includedPaths / excludedPaths that reference invalid locations
      const pathPatterns = [
        { pattern: /includedPaths\s*=\s*["'][^"']*["']/gi, name: 'includedPaths' },
        { pattern: /excludedPaths\s*=\s*["'][^"']*["']/gi, name: 'excludedPaths' },
        { pattern: /queryPaths\s*=\s*["'][^"']*["']/gi, name: 'queryPaths' },
      ];

      for (const { pattern, name } of pathPatterns) {
        const match = content.match(pattern);
        if (!match) continue;

        for (const m of match) {
          const pathValue = m.match(/=\s*["']([^"']+)["']/)?.[1] ?? '';

          // Must start with / and not reference /tmp, /var/eventing, etc.
          const invalidPrefixes = ['/tmp', '/var/eventing', '/etc/'];
          for (const invalid of invalidPrefixes) {
            if (pathValue.startsWith(invalid)) {
              findings.push({
                ruleId: 'OakPAL:IncludedExcludedPaths',
                ruleName: 'Index Path Restrictions Validation',
                severity: 'major',
                category: 'oakpal',
                filePath,
                line: findLineNumber(content, new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))),
                message: `Index ${name} references "${pathValue}" which is invalid or volatile in Cloud Service.`,
                remediation: `Remove or update ${name} to reference /content, /apps, or /oak:index paths only.`,
              });
            }
          }
        }
      }

      return findings;
    },
  },
];

// ── Java Compatibility Rules ──

const javaCompatRules: RuleDefinition[] = [
  {
    id: 'JavaCompat:SunPackages',
    name: 'sun.* Package Usage',
    severity: 'blocker',
    category: 'java-compat',
    check(content, filePath) {
      const findings: PreFlightFinding[] = [];
      if (!isJavaFile(filePath)) return findings;

      // sun.* internal packages removed/encapsulated in Java 17+
      const sunImportPattern = /import\s+sun\.\w+/g;
      const sunUsagePattern = /sun\.(misc|reflect|security|nio|net|awt|font|util)\.\w+/;

      const importLines = findAllLineNumbers(content, /import\s+sun\.\w+/);
      const usageLines = findAllLineNumbers(content, sunUsagePattern);
      const allLines = [...new Set([...importLines, ...usageLines])];

      if (allLines.length > 0) {
        const importMatch = content.match(sunImportPattern);
        findings.push({
          ruleId: 'JavaCompat:SunPackages',
          ruleName: 'sun.* Package Usage',
          severity: 'blocker',
          category: 'java-compat',
          filePath,
          line: allLines[0],
          message: `Uses internal sun.* packages (${importMatch?.join(', ') ?? 'sun.* reference'}) which are removed/encapsulated in Java 17+. AEMaaCS runs Java 11/17/21.`,
          remediation: 'Replace sun.misc.Unsafe with VarHandle, sun.reflect.* with java.lang.invoke.*, sun.security.* with java.security.*. See JEP 403 for migration guidance.',
        });
      }

      return findings;
    },
  },

  {
    id: 'JavaCompat:JavaxToJakarta',
    name: 'javax.* to jakarta.* Migration',
    severity: 'critical',
    category: 'java-compat',
    check(content, filePath) {
      const findings: PreFlightFinding[] = [];
      if (!isJavaFile(filePath)) return findings;

      // javax.servlet, javax.annotation, etc. migrated to jakarta namespace
      const javaxPatterns: Array<{ pattern: RegExp; jakarta: string }> = [
        { pattern: /import\s+javax\.servlet\./g, jakarta: 'jakarta.servlet' },
        { pattern: /import\s+javax\.annotation\./g, jakarta: 'jakarta.annotation' },
        { pattern: /import\s+javax\.inject\./g, jakarta: 'jakarta.inject' },
        { pattern: /import\s+javax\.json\./g, jakarta: 'jakarta.json' },
        { pattern: /import\s+javax\.ws\.rs\./g, jakarta: 'jakarta.ws.rs' },
      ];

      for (const { pattern, jakarta } of javaxPatterns) {
        pattern.lastIndex = 0;
        const match = content.match(pattern);
        if (match && match.length > 0) {
          findings.push({
            ruleId: 'JavaCompat:JavaxToJakarta',
            ruleName: 'javax.* to jakarta.* Migration',
            severity: 'critical',
            category: 'java-compat',
            filePath,
            line: findLineNumber(content, pattern),
            message: `Uses ${match[0].replace('import ', '').trim()} namespace. AEMaaCS SDK 2024.x+ uses the jakarta namespace.`,
            remediation: `Replace ${match[0].replace('import ', '').trim()} imports with ${jakarta}.* equivalents. Update corresponding Maven dependencies.`,
          });
        }
      }

      return findings;
    },
  },

  {
    id: 'JavaCompat:ReflectionUsage',
    name: 'Reflection-Based Code Risk',
    severity: 'major',
    category: 'java-compat',
    check(content, filePath) {
      const findings: PreFlightFinding[] = [];
      if (!isJavaFile(filePath)) return findings;

      // Reflection that may break under strong encapsulation (Java 17+)
      const reflectionPatterns = [
        { pattern: /\.setAccessible\s*\(\s*true\s*\)/g, desc: 'setAccessible(true)' },
        { pattern: /\.getDeclaredField\s*\([^)]+\)[\s\S]{0,100}\.setAccessible/g, desc: 'reflective field access' },
        { pattern: /\.getDeclaredMethod\s*\([^)]+\)[\s\S]{0,100}\.invoke/g, desc: 'reflective method invocation' },
        { pattern: /Class\.forName\s*\([^)]*\)[\s\S]{0,200}\.getDeclaredConstructor/g, desc: 'reflective constructor access' },
      ];

      for (const { pattern, desc } of reflectionPatterns) {
        pattern.lastIndex = 0;
        if (pattern.test(content)) {
          findings.push({
            ruleId: 'JavaCompat:ReflectionUsage',
            ruleName: 'Reflection-Based Code Risk',
            severity: 'major',
            category: 'java-compat',
            filePath,
            line: findLineNumber(content, /\.setAccessible|\.getDeclaredField|\.getDeclaredMethod/),
            message: `Uses ${desc} which may fail under Java 17+ strong encapsulation (JEP 403). Cloud Service JVM does not permit --add-opens overrides.`,
            remediation: 'Replace reflective access with public APIs, MethodHandles, or VarHandles. If accessing AEM internals, use the official Sling/OSGi APIs instead.',
          });
        }
      }

      return findings;
    },
  },

  {
    id: 'JavaCompat:NativeLibrary',
    name: 'Native Library Dependency',
    severity: 'critical',
    category: 'java-compat',
    check(content, filePath) {
      const findings: PreFlightFinding[] = [];
      if (!isJavaFile(filePath) && !isPomFile(filePath)) return findings;

      // Detect native library loading (x86 binaries fail on ARM Cloud Service VMs)
      const nativePatterns = [
        { pattern: /System\.loadLibrary\s*\(/g, desc: 'System.loadLibrary()' },
        { pattern: /System\.load\s*\(/g, desc: 'System.load()' },
        { pattern: /Runtime\.getRuntime\(\)\.loadLibrary/g, desc: 'Runtime.loadLibrary()' },
      ];

      for (const { pattern, desc } of nativePatterns) {
        pattern.lastIndex = 0;
        if (pattern.test(content)) {
          findings.push({
            ruleId: 'JavaCompat:NativeLibrary',
            ruleName: 'Native Library Dependency',
            severity: 'critical',
            category: 'java-compat',
            filePath,
            line: findLineNumber(content, pattern),
            message: `${desc} detected. Native libraries compiled for x86-64 will fail on ARM-based Cloud Service VMs.`,
            remediation: 'Replace native library dependencies with pure Java alternatives. If unavoidable, provide both x86-64 and aarch64 binaries and use architecture detection at load time.',
          });
        }
      }

      // Check POM for JNI / native dependencies
      if (isPomFile(filePath)) {
        const jniPattern = /jni|native|jna/i;
        if (jniPattern.test(content)) {
          findings.push({
            ruleId: 'JavaCompat:NativeLibrary',
            ruleName: 'Native Library Dependency',
            severity: 'critical',
            category: 'java-compat',
            filePath,
            line: findLineNumber(content, jniPattern),
            message: 'POM references JNI/JNA/native dependency. Native dependencies require ARM compatibility for AEMaaCS.',
            remediation: 'Verify the native dependency provides aarch64 (ARM) binaries. Consider a pure Java alternative if ARM support is missing.',
          });
        }
      }

      return findings;
    },
  },
];

// ============================================================
// Utility Functions
// ============================================================

function isJavaFile(path: string): boolean {
  return /\.(java|jsp|jspx)$/i.test(path);
}

function isContentFile(path: string): boolean {
  return /\.(xml|html|htl|jsp|jspx)$/i.test(path);
}

function isConfigFile(path: string): boolean {
  return /\.(cfg\.json|config|xml|properties|yaml|yml)$/i.test(path);
}

function isPomFile(path: string): boolean {
  return /pom\.xml$/i.test(path) || /\.pom$/i.test(path);
}

function isIndexDefinition(path: string, content: string): boolean {
  const pathHint = /oak[_:]index|_oak_index|index-definition/i.test(path);
  const contentHint = /oak:QueryIndexDefinition|type\s*=\s*["'](?:lucene|property)["']/i.test(content);
  return pathHint || contentHint;
}

// ============================================================
// Pre-Flight Engine
// ============================================================

const ALL_RULES: RuleDefinition[] = [
  ...sonarQubeRules,
  ...oakpalRules,
  ...javaCompatRules,
];

export class PreFlightEngine {
  private rules: RuleDefinition[];

  constructor(rules?: RuleDefinition[]) {
    this.rules = rules ?? ALL_RULES;
  }

  /**
   * Run all pre-flight checks against a set of files.
   */
  runPreFlight(items: PreFlightItem[]): PreFlightReport {
    const allFindings: PreFlightFinding[] = [];

    for (const item of items) {
      allFindings.push(
        ...this.runSonarQubeRules(item.content, item.path),
        ...this.runOakPALRules(item.content, item.path),
        ...this.runJavaCompatRules(item.content, item.path),
      );
    }

    return this.buildReport(allFindings, items.length);
  }

  /**
   * Run only SonarQube quality gate rules against a single file.
   */
  runSonarQubeRules(code: string, filePath: string): PreFlightFinding[] {
    const findings: PreFlightFinding[] = [];
    for (const rule of sonarQubeRules) {
      findings.push(...rule.check(code, filePath));
    }
    return findings;
  }

  /**
   * Run only OakPAL index validation rules against an index definition.
   */
  runOakPALRules(indexDef: string, indexPath: string): PreFlightFinding[] {
    const findings: PreFlightFinding[] = [];
    for (const rule of oakpalRules) {
      findings.push(...rule.check(indexDef, indexPath));
    }
    return findings;
  }

  /**
   * Run only Java compatibility rules against a source file.
   */
  runJavaCompatRules(code: string, filePath: string): PreFlightFinding[] {
    const findings: PreFlightFinding[] = [];
    for (const rule of javaCompatRules) {
      findings.push(...rule.check(code, filePath));
    }
    return findings;
  }

  /**
   * Compute estimated Cloud Manager success probability based on findings.
   * Blockers make success highly unlikely; criticals reduce confidence significantly.
   */
  private computeSuccessProbability(findings: PreFlightFinding[]): number {
    let probability = 1.0;

    const blockers = findings.filter(f => f.severity === 'blocker').length;
    const criticals = findings.filter(f => f.severity === 'critical').length;
    const majors = findings.filter(f => f.severity === 'major').length;

    // Each blocker reduces probability by 25% (multiplicative)
    for (let i = 0; i < blockers; i++) {
      probability *= 0.75;
    }
    // Each critical reduces by 10%
    for (let i = 0; i < criticals; i++) {
      probability *= 0.90;
    }
    // Each major reduces by 3%
    for (let i = 0; i < majors; i++) {
      probability *= 0.97;
    }

    // Floor at 0.01 (never say 0% — we can't be 100% sure)
    return Math.max(0.01, Math.round(probability * 100) / 100);
  }

  /**
   * Build the final pre-flight report from collected findings.
   */
  private buildReport(findings: PreFlightFinding[], filesScanned: number): PreFlightReport {
    const blockers = findings.filter(f => f.severity === 'blocker').length;
    const criticals = findings.filter(f => f.severity === 'critical').length;
    const majors = findings.filter(f => f.severity === 'major').length;
    const minors = findings.filter(f => f.severity === 'minor').length;

    const failCount = blockers + criticals;
    const warningCount = majors;
    const totalRulesChecked = this.rules.length * filesScanned;
    const passCount = Math.max(0, totalRulesChecked - failCount - warningCount - minors);

    const successProbability = this.computeSuccessProbability(findings);

    // Collect unique blocker descriptions and remediations
    const topBlockers = findings
      .filter(f => f.severity === 'blocker')
      .map(f => `${f.ruleId}: ${f.message}`)
      .slice(0, 5);

    const topRemediations = findings
      .filter(f => f.severity === 'blocker' || f.severity === 'critical')
      .map(f => f.remediation)
      .filter((v, i, a) => a.indexOf(v) === i)
      .slice(0, 5);

    const bpaComparisonNote = findings.length > 0
      ? `Pre-flight found ${findings.length} issue${findings.length > 1 ? 's' : ''} (${blockers} blocker${blockers !== 1 ? 's' : ''}, ${criticals} critical) that BPA does not check. These would cause Cloud Manager pipeline failure.`
      : 'No additional issues found beyond BPA coverage. Cloud Manager pipeline is likely to pass.';

    return {
      id: `preflight-${Date.now()}`,
      timestamp: new Date().toISOString(),
      totalRulesChecked,
      passCount,
      failCount,
      warningCount,
      findings,
      successProbability,
      bpaComparisonNote,
      summary: {
        blockers,
        criticals,
        majors,
        minors,
        topBlockers,
        topRemediations,
      },
    };
  }
}
