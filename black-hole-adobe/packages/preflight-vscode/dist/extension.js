"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// ../preflight-engine/dist/rules.js
var require_rules = __commonJS({
  "../preflight-engine/dist/rules.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.javaCompatRules = exports2.oakpalRules = exports2.sonarQubeRules = exports2.ALL_RULES = void 0;
    exports2.isJavaFile = isJavaFile;
    exports2.isContentFile = isContentFile;
    exports2.isConfigFile = isConfigFile;
    exports2.isPomFile = isPomFile;
    exports2.isIndexDefinition = isIndexDefinition;
    function findLineNumber(content, pattern) {
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (pattern.test(lines[i])) {
          return i + 1;
        }
      }
      return void 0;
    }
    function findAllLineNumbers(content, pattern) {
      const lines = content.split("\n");
      const results = [];
      for (let i = 0; i < lines.length; i++) {
        if (pattern.test(lines[i])) {
          results.push(i + 1);
        }
      }
      return results;
    }
    function isJavaFile(path) {
      return /\.(java|jsp|jspx)$/i.test(path);
    }
    function isContentFile(path) {
      return /\.(xml|html|htl|jsp|jspx)$/i.test(path);
    }
    function isConfigFile(path) {
      return /\.(cfg\.json|config|xml|properties|yaml|yml)$/i.test(path);
    }
    function isPomFile(path) {
      return /pom\.xml$/i.test(path) || /\.pom$/i.test(path);
    }
    function isIndexDefinition(path, content) {
      const pathHint = /oak[_:]index|_oak_index|index-definition/i.test(path);
      const contentHint = /oak:QueryIndexDefinition|type\s*=\s*["'](?:lucene|property)["']/i.test(content);
      return pathHint || contentHint;
    }
    var sonarQubeRules = [
      {
        id: "CQRules:ConnectionTimeoutMechanism",
        name: "Connection Timeout Mechanism",
        severity: "blocker",
        category: "sonarqube",
        description: "HttpClient or URLConnection created without connection/socket timeout configuration. Cloud Manager requires all HTTP connections to have explicit timeouts.",
        remediation: "Set connectTimeout, socketTimeout, and connectionRequestTimeout via RequestConfig.custom(). Recommended: 10s connect, 30s socket.",
        check(content, filePath) {
          const findings = [];
          if (!isJavaFile(filePath))
            return findings;
          const httpClientPattern = /new\s+HttpClient\s*\(|HttpClients\.create(?:Default)?\s*\(|HttpClientBuilder\.create\s*\(/g;
          const urlConnectionPattern = /\.openConnection\s*\(/g;
          const timeoutPattern = /\.setConnectTimeout\s*\(|\.setSocketTimeout\s*\(|\.setConnectionRequestTimeout\s*\(|ConnectTimeoutException|RequestConfig\.custom\s*\(\s*\)[\s\S]{0,500}\.setConnectTimeout|\.setReadTimeout\s*\(|\.setConnectTimeout\s*\(/;
          const hasHttpClient = httpClientPattern.test(content);
          const hasUrlConnection = urlConnectionPattern.test(content);
          const hasTimeout = timeoutPattern.test(content);
          if (hasHttpClient && !hasTimeout) {
            findings.push({
              ruleId: "CQRules:ConnectionTimeoutMechanism",
              ruleName: "Connection Timeout Mechanism",
              severity: "blocker",
              category: "sonarqube",
              filePath,
              line: findLineNumber(content, /new\s+HttpClient\s*\(|HttpClients\.create|HttpClientBuilder/),
              message: "HttpClient created without connection/socket timeout configuration. Cloud Manager requires all HTTP connections to have explicit timeouts.",
              remediation: "Set connectTimeout, socketTimeout, and connectionRequestTimeout via RequestConfig.custom(). Recommended: 10s connect, 30s socket."
            });
          }
          if (hasUrlConnection && !hasTimeout) {
            findings.push({
              ruleId: "CQRules:ConnectionTimeoutMechanism",
              ruleName: "Connection Timeout Mechanism",
              severity: "blocker",
              category: "sonarqube",
              filePath,
              line: findLineNumber(content, /\.openConnection\s*\(/),
              message: "URLConnection opened without setConnectTimeout/setReadTimeout. Cloud Manager requires explicit timeouts on all connections.",
              remediation: "Call setConnectTimeout() and setReadTimeout() immediately after openConnection(). Recommended: 10000ms connect, 30000ms read."
            });
          }
          return findings;
        }
      },
      {
        id: "CQRules:ResourceResolverAutoClose",
        name: "ResourceResolver Auto-Close",
        severity: "blocker",
        category: "sonarqube",
        description: "ResourceResolver opened but not closed in finally block or try-with-resources. This causes resource leaks that crash AEMaaCS pods.",
        remediation: "Wrap ResourceResolver in try-with-resources: try (ResourceResolver resolver = factory.getServiceResourceResolver(params)) { ... }",
        check(content, filePath) {
          const findings = [];
          if (!isJavaFile(filePath))
            return findings;
          const resolverCreation = /(?:getServiceResourceResolver|getResourceResolver|getAdministrativeResourceResolver)\s*\(/g;
          const tryWithResources = /try\s*\(\s*(?:final\s+)?ResourceResolver/;
          const finallyClose = /finally\s*\{[\s\S]{0,300}\.close\s*\(\s*\)/;
          if (resolverCreation.test(content)) {
            const hasTryWith = tryWithResources.test(content);
            const hasFinallyClose = finallyClose.test(content);
            if (!hasTryWith && !hasFinallyClose) {
              findings.push({
                ruleId: "CQRules:ResourceResolverAutoClose",
                ruleName: "ResourceResolver Auto-Close",
                severity: "blocker",
                category: "sonarqube",
                filePath,
                line: findLineNumber(content, /(?:getServiceResourceResolver|getResourceResolver)\s*\(/),
                message: "ResourceResolver opened but not closed in finally block or try-with-resources. This causes resource leaks that crash AEMaaCS pods.",
                remediation: "Wrap ResourceResolver in try-with-resources: try (ResourceResolver resolver = factory.getServiceResourceResolver(params)) { ... }"
              });
            }
          }
          return findings;
        }
      },
      {
        id: "CQRules:CQBP-72",
        name: "Custom Servlet Path Registration",
        severity: "critical",
        category: "sonarqube",
        description: "Servlet registered by path instead of resourceType. Path-bound servlets bypass AEM's security model and are blocked by Cloud Manager.",
        remediation: "Register servlets by sling.servlet.resourceTypes and sling.servlet.selectors/extensions instead of sling.servlet.paths.",
        check(content, filePath) {
          const findings = [];
          if (!isJavaFile(filePath))
            return findings;
          const pathBinding = /sling\.servlet\.paths\s*=|@SlingServlet\s*\([^)]*paths\s*=|property\s*=\s*"sling\.servlet\.paths/;
          if (pathBinding.test(content)) {
            findings.push({
              ruleId: "CQRules:CQBP-72",
              ruleName: "Custom Servlet Path Registration",
              severity: "critical",
              category: "sonarqube",
              filePath,
              line: findLineNumber(content, pathBinding),
              message: "Servlet registered by path instead of resourceType. Path-bound servlets bypass AEM's security model and are blocked by Cloud Manager.",
              remediation: "Register servlets by sling.servlet.resourceTypes and sling.servlet.selectors/extensions instead of sling.servlet.paths."
            });
          }
          return findings;
        }
      },
      {
        id: "CQRules:CQBP-84",
        name: "ResourceResolver Lifecycle Management",
        severity: "critical",
        category: "sonarqube",
        description: "ResourceResolver stored as instance field in an OSGi component. Resolvers must be request-scoped or opened/closed within a single method.",
        remediation: "Open ResourceResolver in a try-with-resources block inside each method that needs it. Do not cache resolvers as instance fields.",
        check(content, filePath) {
          const findings = [];
          if (!isJavaFile(filePath))
            return findings;
          const fieldResolver = /(?:private|protected)\s+ResourceResolver\s+\w+\s*;/;
          const classHasActivate = /@Activate|@PostConstruct/;
          if (fieldResolver.test(content) && classHasActivate.test(content)) {
            findings.push({
              ruleId: "CQRules:CQBP-84",
              ruleName: "ResourceResolver Lifecycle Management",
              severity: "critical",
              category: "sonarqube",
              filePath,
              line: findLineNumber(content, fieldResolver),
              message: "ResourceResolver stored as instance field in an OSGi component. Resolvers must be request-scoped or opened/closed within a single method.",
              remediation: "Open ResourceResolver in a try-with-resources block inside each method that needs it. Do not cache resolvers as instance fields."
            });
          }
          const lines = content.split("\n");
          let openCount = 0;
          let closeCount = 0;
          for (const line of lines) {
            if (/getServiceResourceResolver|getResourceResolver/.test(line))
              openCount++;
            if (/\.close\s*\(/.test(line) || /try\s*\(\s*(?:final\s+)?ResourceResolver/.test(line))
              closeCount++;
          }
          if (openCount > 0 && openCount > closeCount + 1) {
            findings.push({
              ruleId: "CQRules:CQBP-84",
              ruleName: "ResourceResolver Lifecycle Management",
              severity: "critical",
              category: "sonarqube",
              filePath,
              message: `Found ${openCount} ResourceResolver opens but only ${closeCount} close/try-with-resources. Each open must have a corresponding close.`,
              remediation: "Ensure every getServiceResourceResolver() / getResourceResolver() call has a matching close() in a finally block or uses try-with-resources."
            });
          }
          return findings;
        }
      },
      {
        id: "CQRules:ContentClassification",
        name: "Content Classification -- /libs Reference",
        severity: "major",
        category: "sonarqube",
        description: "Direct /libs content reference found. /libs is immutable in Cloud Service and may change without notice.",
        remediation: "Overlay the component into /apps and reference the overlay. Use sling:resourceSuperType for component inheritance instead of direct /libs paths.",
        check(content, filePath) {
          const findings = [];
          if (!isJavaFile(filePath) && !isContentFile(filePath))
            return findings;
          const matchLines = findAllLineNumbers(content, /["'`]\/libs\/[^"'`]+["'`]/);
          if (matchLines.length > 0) {
            findings.push({
              ruleId: "CQRules:ContentClassification",
              ruleName: "Content Classification -- /libs Reference",
              severity: "major",
              category: "sonarqube",
              filePath,
              line: matchLines[0],
              message: `Direct /libs content reference found (${matchLines.length} occurrence${matchLines.length > 1 ? "s" : ""}). /libs is immutable in Cloud Service and may change without notice.`,
              remediation: "Overlay the component into /apps and reference the overlay. Use sling:resourceSuperType for component inheritance instead of direct /libs paths."
            });
          }
          return findings;
        }
      },
      {
        id: "CQRules:AMSRT",
        name: "Deprecated AMS-Specific Run Modes",
        severity: "major",
        category: "sonarqube",
        description: "AMS-specific run mode detected. Cloud Service uses environment-specific run modes without the config. prefix pattern.",
        remediation: "Replace AMS run modes with Cloud Service equivalents. Use config.author/config.publish for tier targeting and env-specific variables via Cloud Manager environment variables.",
        check(content, filePath) {
          const findings = [];
          if (!isJavaFile(filePath) && !isConfigFile(filePath) && !isContentFile(filePath))
            return findings;
          const amsRunModes = [
            "config.dev",
            "config.stage",
            "config.prod",
            "config.author.dev",
            "config.author.stage",
            "config.author.prod",
            "config.publish.dev",
            "config.publish.stage",
            "config.publish.prod"
          ];
          const deprecatedPattern = new RegExp(`(?:runmode|sling\\.run\\.modes?|config\\.)(?:${amsRunModes.map((m) => m.replace(".", "\\.")).join("|")})`, "g");
          const matchLine = findLineNumber(content, deprecatedPattern);
          if (matchLine !== void 0) {
            findings.push({
              ruleId: "CQRules:AMSRT",
              ruleName: "Deprecated AMS-Specific Run Modes",
              severity: "major",
              category: "sonarqube",
              filePath,
              line: matchLine,
              message: "AMS-specific run mode detected. Cloud Service uses environment-specific run modes (dev, stage, prod) without the config. prefix pattern.",
              remediation: "Replace AMS run modes with Cloud Service equivalents. Use config.author/config.publish for tier targeting and env-specific variables via Cloud Manager environment variables."
            });
          }
          if (filePath.includes("/config.") && amsRunModes.some((m) => filePath.includes(`/${m}/`) || filePath.endsWith(`/${m}`))) {
            findings.push({
              ruleId: "CQRules:AMSRT",
              ruleName: "Deprecated AMS-Specific Run Modes",
              severity: "major",
              category: "sonarqube",
              filePath,
              message: "OSGi config file in AMS-specific run mode folder. Cloud Service does not support AMS run mode folder conventions.",
              remediation: "Restructure to config.author/, config.publish/, or config.author.dev/ (Cloud Service naming). Use Cloud Manager environment variables for environment-specific values."
            });
          }
          return findings;
        }
      }
    ];
    exports2.sonarQubeRules = sonarQubeRules;
    var oakpalRules = [
      {
        id: "OakPAL:IndexTypeLucene",
        name: "Index Type Must Be Lucene",
        severity: "blocker",
        category: "oakpal",
        description: 'Custom Oak index uses type="property". Cloud Manager requires custom indexes to use type="lucene" for AEMaaCS.',
        remediation: 'Change index type from "property" to "lucene". Property indexes are managed by Adobe in Cloud Service and cannot be customized.',
        check(content, filePath) {
          const findings = [];
          if (!isIndexDefinition(filePath, content))
            return findings;
          const hasPropertyType = /type\s*=\s*["']property["']/i.test(content) || /jcr:primaryType\s*=\s*["']oak:QueryIndexDefinition["'][\s\S]*?type\s*=\s*["']property["']/i.test(content);
          if (hasPropertyType) {
            findings.push({
              ruleId: "OakPAL:IndexTypeLucene",
              ruleName: "Index Type Must Be Lucene",
              severity: "blocker",
              category: "oakpal",
              filePath,
              line: findLineNumber(content, /type\s*=\s*["']property["']/i),
              message: 'Custom Oak index uses type="property". Cloud Manager requires custom indexes to use type="lucene" for AEMaaCS.',
              remediation: 'Change index type from "property" to "lucene". Property indexes are managed by Adobe in Cloud Service and cannot be customized.'
            });
          }
          return findings;
        }
      },
      {
        id: "OakPAL:AsyncFlag",
        name: "Index Must Have Async Flag",
        severity: "blocker",
        category: "oakpal",
        description: "Lucene index definition missing async flag. Synchronous lucene indexes are not supported in AEMaaCS.",
        remediation: 'Add async="[async, nrt]" property to the index definition node. This ensures the index is updated asynchronously.',
        check(content, filePath) {
          const findings = [];
          if (!isIndexDefinition(filePath, content))
            return findings;
          const isLucene = /type\s*=\s*["']lucene["']/i.test(content);
          const hasAsync = /async\s*=\s*["']\[?(?:async|nrt)/i.test(content);
          if (isLucene && !hasAsync) {
            findings.push({
              ruleId: "OakPAL:AsyncFlag",
              ruleName: "Index Must Have Async Flag",
              severity: "blocker",
              category: "oakpal",
              filePath,
              message: "Lucene index definition missing async flag. Synchronous lucene indexes are not supported in AEMaaCS.",
              remediation: 'Add async="[async, nrt]" property to the index definition node. This ensures the index is updated asynchronously.'
            });
          }
          return findings;
        }
      },
      {
        id: "OakPAL:TikaConfig",
        name: "Full-Text Index Tika Configuration",
        severity: "critical",
        category: "oakpal",
        description: "Full-text index definition missing Tika configuration. Without explicit Tika config, binary extraction may fail or produce unexpected results in Cloud Service.",
        remediation: "Add a tika child node with appropriate mime type configuration. Reference Adobe documentation for damAssetLucene Tika config structure.",
        check(content, filePath) {
          const findings = [];
          if (!isIndexDefinition(filePath, content))
            return findings;
          const isFullText = /evaluatePathRestrictions\s*=\s*["']\{Boolean\}true["']/i.test(content) || /analyzed\s*=\s*["']true["']/i.test(content) || /nodeScopeIndex\s*=\s*["']true["']/i.test(content);
          const hasTikaConfig = /tika/i.test(content);
          if (isFullText && !hasTikaConfig) {
            findings.push({
              ruleId: "OakPAL:TikaConfig",
              ruleName: "Full-Text Index Tika Configuration",
              severity: "critical",
              category: "oakpal",
              filePath,
              message: "Full-text index definition missing Tika configuration. Without explicit Tika config, binary extraction may fail or produce unexpected results in Cloud Service.",
              remediation: "Add a tika child node with appropriate mime type configuration. Reference Adobe documentation for damAssetLucene Tika config structure."
            });
          }
          return findings;
        }
      },
      {
        id: "OakPAL:DamAssetLuceneNaming",
        name: "damAssetLucene Naming Convention",
        severity: "critical",
        category: "oakpal",
        description: "damAssetLucene index does not follow required naming convention. Cloud Manager enforces the pattern: damAssetLucene-{version}-custom-{version}.",
        remediation: "Rename the index to follow the pattern: damAssetLucene-8-custom-1 (where 8 is the base OOTB version and 1 is your custom version).",
        check(content, filePath) {
          const findings = [];
          if (!isIndexDefinition(filePath, content))
            return findings;
          const isDamIndex = /damAssetLucene/i.test(filePath) || /damAssetLucene/i.test(content);
          if (!isDamIndex)
            return findings;
          const validNaming = /damAssetLucene-\d+-custom-\d+/i;
          const hasValidName = validNaming.test(filePath) || validNaming.test(content);
          if (!hasValidName) {
            findings.push({
              ruleId: "OakPAL:DamAssetLuceneNaming",
              ruleName: "damAssetLucene Naming Convention",
              severity: "critical",
              category: "oakpal",
              filePath,
              message: "damAssetLucene index does not follow required naming convention. Cloud Manager enforces the pattern: damAssetLucene-{version}-custom-{version}.",
              remediation: "Rename the index to follow the pattern: damAssetLucene-8-custom-1 (where 8 is the base OOTB version and 1 is your custom version)."
            });
          }
          return findings;
        }
      },
      {
        id: "OakPAL:CompatVersion",
        name: "Index compatVersion >= 2",
        severity: "major",
        category: "oakpal",
        description: "Index compatVersion is below 2. Cloud Service requires compatVersion >= 2 for Lucene indexes.",
        remediation: 'Add or update: compatVersion="{Long}2" on the index definition node.',
        check(content, filePath) {
          const findings = [];
          if (!isIndexDefinition(filePath, content))
            return findings;
          const isLucene = /type\s*=\s*["']lucene["']/i.test(content);
          if (!isLucene)
            return findings;
          const compatMatch = content.match(/compatVersion\s*=\s*["']\{(?:Long|long)\}(\d+)["']/i);
          const compatVersion = compatMatch ? parseInt(compatMatch[1], 10) : 0;
          if (compatVersion < 2) {
            findings.push({
              ruleId: "OakPAL:CompatVersion",
              ruleName: "Index compatVersion >= 2",
              severity: "major",
              category: "oakpal",
              filePath,
              line: compatMatch ? findLineNumber(content, /compatVersion/) : void 0,
              message: `Index compatVersion is ${compatVersion || "not set"}. Cloud Service requires compatVersion >= 2 for Lucene indexes.`,
              remediation: 'Add or update: compatVersion="{Long}2" on the index definition node.'
            });
          }
          return findings;
        }
      },
      {
        id: "OakPAL:IncludedExcludedPaths",
        name: "Index Path Restrictions Validation",
        severity: "major",
        category: "oakpal",
        description: "Index path restrictions reference volatile or invalid locations in Cloud Service.",
        remediation: "Remove or update path restrictions to reference /content, /apps, or /oak:index paths only.",
        check(content, filePath) {
          const findings = [];
          if (!isIndexDefinition(filePath, content))
            return findings;
          const pathPatterns = [
            {
              pattern: /includedPaths\s*=\s*["'][^"']*["']/gi,
              name: "includedPaths"
            },
            {
              pattern: /excludedPaths\s*=\s*["'][^"']*["']/gi,
              name: "excludedPaths"
            },
            { pattern: /queryPaths\s*=\s*["'][^"']*["']/gi, name: "queryPaths" }
          ];
          for (const { pattern, name } of pathPatterns) {
            const match = content.match(pattern);
            if (!match)
              continue;
            for (const m of match) {
              const pathValue = m.match(/=\s*["']([^"']+)["']/)?.[1] ?? "";
              const invalidPrefixes = ["/tmp", "/var/eventing", "/etc/"];
              for (const invalid of invalidPrefixes) {
                if (pathValue.startsWith(invalid)) {
                  findings.push({
                    ruleId: "OakPAL:IncludedExcludedPaths",
                    ruleName: "Index Path Restrictions Validation",
                    severity: "major",
                    category: "oakpal",
                    filePath,
                    line: findLineNumber(content, new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))),
                    message: `Index ${name} references "${pathValue}" which is invalid or volatile in Cloud Service.`,
                    remediation: `Remove or update ${name} to reference /content, /apps, or /oak:index paths only.`
                  });
                }
              }
            }
          }
          return findings;
        }
      }
    ];
    exports2.oakpalRules = oakpalRules;
    var javaCompatRules = [
      {
        id: "JavaCompat:SunPackages",
        name: "sun.* Package Usage",
        severity: "blocker",
        category: "java-compat",
        description: "Uses internal sun.* packages which are removed/encapsulated in Java 17+. AEMaaCS runs Java 11/17/21.",
        remediation: "Replace sun.misc.Unsafe with VarHandle, sun.reflect.* with java.lang.invoke.*, sun.security.* with java.security.*. See JEP 403 for migration guidance.",
        check(content, filePath) {
          const findings = [];
          if (!isJavaFile(filePath))
            return findings;
          const sunImportPattern = /import\s+sun\.\w+/g;
          const sunUsagePattern = /sun\.(misc|reflect|security|nio|net|awt|font|util)\.\w+/;
          const importLines = findAllLineNumbers(content, /import\s+sun\.\w+/);
          const usageLines = findAllLineNumbers(content, sunUsagePattern);
          const allLines = [.../* @__PURE__ */ new Set([...importLines, ...usageLines])];
          if (allLines.length > 0) {
            const importMatch = content.match(sunImportPattern);
            findings.push({
              ruleId: "JavaCompat:SunPackages",
              ruleName: "sun.* Package Usage",
              severity: "blocker",
              category: "java-compat",
              filePath,
              line: allLines[0],
              message: `Uses internal sun.* packages (${importMatch?.join(", ") ?? "sun.* reference"}) which are removed/encapsulated in Java 17+. AEMaaCS runs Java 11/17/21.`,
              remediation: "Replace sun.misc.Unsafe with VarHandle, sun.reflect.* with java.lang.invoke.*, sun.security.* with java.security.*. See JEP 403 for migration guidance."
            });
          }
          return findings;
        }
      },
      {
        id: "JavaCompat:JavaxToJakarta",
        name: "javax.* to jakarta.* Migration",
        severity: "critical",
        category: "java-compat",
        description: "Uses the old javax.* namespace. AEMaaCS SDK 2024.x+ uses the jakarta namespace.",
        remediation: "Replace javax.* imports with jakarta.* equivalents. Update corresponding Maven dependencies.",
        check(content, filePath) {
          const findings = [];
          if (!isJavaFile(filePath))
            return findings;
          const javaxPatterns = [
            { pattern: /import\s+javax\.servlet\./g, jakarta: "jakarta.servlet" },
            {
              pattern: /import\s+javax\.annotation\./g,
              jakarta: "jakarta.annotation"
            },
            { pattern: /import\s+javax\.inject\./g, jakarta: "jakarta.inject" },
            { pattern: /import\s+javax\.json\./g, jakarta: "jakarta.json" },
            { pattern: /import\s+javax\.ws\.rs\./g, jakarta: "jakarta.ws.rs" }
          ];
          for (const { pattern, jakarta } of javaxPatterns) {
            pattern.lastIndex = 0;
            const match = content.match(pattern);
            if (match && match.length > 0) {
              findings.push({
                ruleId: "JavaCompat:JavaxToJakarta",
                ruleName: "javax.* to jakarta.* Migration",
                severity: "critical",
                category: "java-compat",
                filePath,
                line: findLineNumber(content, pattern),
                message: `Uses ${match[0].replace("import ", "").trim()} namespace. AEMaaCS SDK 2024.x+ uses the jakarta namespace.`,
                remediation: `Replace ${match[0].replace("import ", "").trim()} imports with ${jakarta}.* equivalents. Update corresponding Maven dependencies.`
              });
            }
          }
          return findings;
        }
      },
      {
        id: "JavaCompat:ReflectionUsage",
        name: "Reflection-Based Code Risk",
        severity: "major",
        category: "java-compat",
        description: "Uses reflection which may fail under Java 17+ strong encapsulation (JEP 403). Cloud Service JVM does not permit --add-opens overrides.",
        remediation: "Replace reflective access with public APIs, MethodHandles, or VarHandles. If accessing AEM internals, use the official Sling/OSGi APIs instead.",
        check(content, filePath) {
          const findings = [];
          if (!isJavaFile(filePath))
            return findings;
          const reflectionPatterns = [
            {
              pattern: /\.setAccessible\s*\(\s*true\s*\)/g,
              desc: "setAccessible(true)"
            },
            {
              pattern: /\.getDeclaredField\s*\([^)]+\)[\s\S]{0,100}\.setAccessible/g,
              desc: "reflective field access"
            },
            {
              pattern: /\.getDeclaredMethod\s*\([^)]+\)[\s\S]{0,200}\.invoke/g,
              desc: "reflective method invocation"
            },
            {
              pattern: /Class\.forName\s*\([^)]*\)[\s\S]{0,200}\.getDeclaredConstructor/g,
              desc: "reflective constructor access"
            }
          ];
          for (const { pattern, desc } of reflectionPatterns) {
            pattern.lastIndex = 0;
            if (pattern.test(content)) {
              findings.push({
                ruleId: "JavaCompat:ReflectionUsage",
                ruleName: "Reflection-Based Code Risk",
                severity: "major",
                category: "java-compat",
                filePath,
                line: findLineNumber(content, /\.setAccessible|\.getDeclaredField|\.getDeclaredMethod/),
                message: `Uses ${desc} which may fail under Java 17+ strong encapsulation (JEP 403). Cloud Service JVM does not permit --add-opens overrides.`,
                remediation: "Replace reflective access with public APIs, MethodHandles, or VarHandles. If accessing AEM internals, use the official Sling/OSGi APIs instead."
              });
            }
          }
          return findings;
        }
      },
      {
        id: "JavaCompat:NativeLibrary",
        name: "Native Library Dependency",
        severity: "critical",
        category: "java-compat",
        description: "Native library loading detected. Native libraries compiled for x86-64 will fail on ARM-based Cloud Service VMs.",
        remediation: "Replace native library dependencies with pure Java alternatives. If unavoidable, provide both x86-64 and aarch64 binaries.",
        check(content, filePath) {
          const findings = [];
          if (!isJavaFile(filePath) && !isPomFile(filePath))
            return findings;
          const nativePatterns = [
            {
              pattern: /System\.loadLibrary\s*\(/g,
              desc: "System.loadLibrary()"
            },
            { pattern: /System\.load\s*\(/g, desc: "System.load()" },
            {
              pattern: /Runtime\.getRuntime\(\)\.loadLibrary/g,
              desc: "Runtime.loadLibrary()"
            }
          ];
          for (const { pattern, desc } of nativePatterns) {
            pattern.lastIndex = 0;
            if (pattern.test(content)) {
              findings.push({
                ruleId: "JavaCompat:NativeLibrary",
                ruleName: "Native Library Dependency",
                severity: "critical",
                category: "java-compat",
                filePath,
                line: findLineNumber(content, pattern),
                message: `${desc} detected. Native libraries compiled for x86-64 will fail on ARM-based Cloud Service VMs.`,
                remediation: "Replace native library dependencies with pure Java alternatives. If unavoidable, provide both x86-64 and aarch64 binaries and use architecture detection at load time."
              });
            }
          }
          if (isPomFile(filePath)) {
            const jniPattern = /jni|native|jna/i;
            if (jniPattern.test(content)) {
              findings.push({
                ruleId: "JavaCompat:NativeLibrary",
                ruleName: "Native Library Dependency",
                severity: "critical",
                category: "java-compat",
                filePath,
                line: findLineNumber(content, jniPattern),
                message: "POM references JNI/JNA/native dependency. Native dependencies require ARM compatibility for AEMaaCS.",
                remediation: "Verify the native dependency provides aarch64 (ARM) binaries. Consider a pure Java alternative if ARM support is missing."
              });
            }
          }
          return findings;
        }
      }
    ];
    exports2.javaCompatRules = javaCompatRules;
    exports2.ALL_RULES = [
      ...sonarQubeRules,
      ...oakpalRules,
      ...javaCompatRules
    ];
  }
});

// ../preflight-engine/dist/engine.js
var require_engine = __commonJS({
  "../preflight-engine/dist/engine.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.PreFlightEngine = void 0;
    var rules_1 = require_rules();
    var PreFlightEngine3 = class {
      rules;
      constructor(rules) {
        this.rules = rules ?? rules_1.ALL_RULES;
      }
      /**
       * Run all pre-flight checks against a set of files.
       */
      runPreFlight(items) {
        const allFindings = [];
        for (const item of items) {
          allFindings.push(...this.runSonarQubeRules(item.content, item.path), ...this.runOakPALRules(item.content, item.path), ...this.runJavaCompatRules(item.content, item.path));
        }
        return this.buildReport(allFindings, items.length);
      }
      /**
       * Run only SonarQube quality gate rules against a single file.
       */
      runSonarQubeRules(code, filePath) {
        const findings = [];
        for (const rule of rules_1.sonarQubeRules) {
          findings.push(...rule.check(code, filePath));
        }
        return findings;
      }
      /**
       * Run only OakPAL index validation rules against an index definition.
       */
      runOakPALRules(indexDef, indexPath) {
        const findings = [];
        for (const rule of rules_1.oakpalRules) {
          findings.push(...rule.check(indexDef, indexPath));
        }
        return findings;
      }
      /**
       * Run only Java compatibility rules against a source file.
       */
      runJavaCompatRules(code, filePath) {
        const findings = [];
        for (const rule of rules_1.javaCompatRules) {
          findings.push(...rule.check(code, filePath));
        }
        return findings;
      }
      /**
       * Get all registered rules (for list-rules command).
       */
      getRules() {
        return this.rules;
      }
      /**
       * Get a single rule by ID (for explain command).
       */
      getRule(ruleId) {
        return this.rules.find((r) => r.id === ruleId);
      }
      /**
       * Search for rules with similar IDs (fuzzy).
       */
      findSimilarRules(query) {
        const lower = query.toLowerCase();
        return this.rules.filter((r) => r.id.toLowerCase().includes(lower) || r.name.toLowerCase().includes(lower));
      }
      /**
       * Compute estimated Cloud Manager success probability based on findings.
       */
      computeSuccessProbability(findings) {
        let probability = 1;
        const blockers = findings.filter((f) => f.severity === "blocker").length;
        const criticals = findings.filter((f) => f.severity === "critical").length;
        const majors = findings.filter((f) => f.severity === "major").length;
        for (let i = 0; i < blockers; i++) {
          probability *= 0.75;
        }
        for (let i = 0; i < criticals; i++) {
          probability *= 0.9;
        }
        for (let i = 0; i < majors; i++) {
          probability *= 0.97;
        }
        return Math.max(0.01, Math.round(probability * 100) / 100);
      }
      /**
       * Build the final pre-flight report from collected findings.
       */
      buildReport(findings, filesScanned) {
        const blockers = findings.filter((f) => f.severity === "blocker").length;
        const criticals = findings.filter((f) => f.severity === "critical").length;
        const majors = findings.filter((f) => f.severity === "major").length;
        const minors = findings.filter((f) => f.severity === "minor").length;
        const failCount = blockers + criticals;
        const warningCount = majors;
        const totalRulesChecked = this.rules.length * filesScanned;
        const passCount = Math.max(0, totalRulesChecked - failCount - warningCount - minors);
        const successProbability = this.computeSuccessProbability(findings);
        const topBlockers = findings.filter((f) => f.severity === "blocker").map((f) => `${f.ruleId}: ${f.message}`).slice(0, 5);
        const topRemediations = findings.filter((f) => f.severity === "blocker" || f.severity === "critical").map((f) => f.remediation).filter((v, i, a) => a.indexOf(v) === i).slice(0, 5);
        const bpaComparisonNote = findings.length > 0 ? `Pre-flight found ${findings.length} issue${findings.length > 1 ? "s" : ""} (${blockers} blocker${blockers !== 1 ? "s" : ""}, ${criticals} critical) that BPA does not check. These would cause Cloud Manager pipeline failure.` : "No additional issues found beyond BPA coverage. Cloud Manager pipeline is likely to pass.";
        return {
          id: `preflight-${Date.now()}`,
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
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
            topRemediations
          }
        };
      }
    };
    exports2.PreFlightEngine = PreFlightEngine3;
  }
});

// ../preflight-engine/dist/index.js
var require_dist = __commonJS({
  "../preflight-engine/dist/index.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.isIndexDefinition = exports2.isPomFile = exports2.isConfigFile = exports2.isContentFile = exports2.isJavaFile = exports2.javaCompatRules = exports2.oakpalRules = exports2.sonarQubeRules = exports2.ALL_RULES = exports2.PreFlightEngine = void 0;
    var engine_1 = require_engine();
    Object.defineProperty(exports2, "PreFlightEngine", { enumerable: true, get: function() {
      return engine_1.PreFlightEngine;
    } });
    var rules_1 = require_rules();
    Object.defineProperty(exports2, "ALL_RULES", { enumerable: true, get: function() {
      return rules_1.ALL_RULES;
    } });
    Object.defineProperty(exports2, "sonarQubeRules", { enumerable: true, get: function() {
      return rules_1.sonarQubeRules;
    } });
    Object.defineProperty(exports2, "oakpalRules", { enumerable: true, get: function() {
      return rules_1.oakpalRules;
    } });
    Object.defineProperty(exports2, "javaCompatRules", { enumerable: true, get: function() {
      return rules_1.javaCompatRules;
    } });
    Object.defineProperty(exports2, "isJavaFile", { enumerable: true, get: function() {
      return rules_1.isJavaFile;
    } });
    Object.defineProperty(exports2, "isContentFile", { enumerable: true, get: function() {
      return rules_1.isContentFile;
    } });
    Object.defineProperty(exports2, "isConfigFile", { enumerable: true, get: function() {
      return rules_1.isConfigFile;
    } });
    Object.defineProperty(exports2, "isPomFile", { enumerable: true, get: function() {
      return rules_1.isPomFile;
    } });
    Object.defineProperty(exports2, "isIndexDefinition", { enumerable: true, get: function() {
      return rules_1.isIndexDefinition;
    } });
  }
});

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode6 = __toESM(require("vscode"));

// src/diagnostics.ts
var vscode3 = __toESM(require("vscode"));
var import_preflight_engine = __toESM(require_dist());

// src/config.ts
var vscode = __toESM(require("vscode"));
var DEFAULT_CONFIG = {
  enable: true,
  runOnType: true,
  runOnSave: true,
  severityThreshold: "info",
  rules: {}
};
var KNOWN_KEYS = /* @__PURE__ */ new Set([
  "enable",
  "runOnType",
  "runOnSave",
  "severityThreshold",
  "rules"
]);
var cachedRcConfig = null;
var outputChannel = null;
function getOutputChannel() {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel("Pre-Flight");
  }
  return outputChannel;
}
async function loadRcConfig() {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    cachedRcConfig = null;
    return null;
  }
  const rcUri = vscode.Uri.joinPath(workspaceFolders[0].uri, ".preflightrc.json");
  try {
    const raw = await vscode.workspace.fs.readFile(rcUri);
    const text = new TextDecoder().decode(raw);
    const parsed = JSON.parse(text);
    const channel = getOutputChannel();
    for (const key of Object.keys(parsed)) {
      if (!KNOWN_KEYS.has(key)) {
        channel.appendLine(`[Pre-Flight] Unknown config key in .preflightrc.json: "${key}"`);
      }
    }
    cachedRcConfig = parsed;
    return cachedRcConfig;
  } catch {
    cachedRcConfig = null;
    return null;
  }
}
function getConfig() {
  const vsConfig = vscode.workspace.getConfiguration("preflight");
  const base = {
    enable: vsConfig.get("enable", DEFAULT_CONFIG.enable),
    runOnType: vsConfig.get("runOnType", DEFAULT_CONFIG.runOnType),
    runOnSave: vsConfig.get("runOnSave", DEFAULT_CONFIG.runOnSave),
    severityThreshold: vsConfig.get(
      "severityThreshold",
      DEFAULT_CONFIG.severityThreshold
    ),
    rules: vsConfig.get("rules", DEFAULT_CONFIG.rules)
  };
  if (cachedRcConfig) {
    if (cachedRcConfig.enable !== void 0)
      base.enable = cachedRcConfig.enable;
    if (cachedRcConfig.runOnType !== void 0)
      base.runOnType = cachedRcConfig.runOnType;
    if (cachedRcConfig.runOnSave !== void 0)
      base.runOnSave = cachedRcConfig.runOnSave;
    if (cachedRcConfig.severityThreshold !== void 0) {
      base.severityThreshold = cachedRcConfig.severityThreshold;
    }
    if (cachedRcConfig.rules !== void 0) {
      base.rules = { ...base.rules, ...cachedRcConfig.rules };
    }
  }
  return base;
}
function watchRcConfig(onReload) {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return void 0;
  }
  const pattern = new vscode.RelativePattern(
    workspaceFolders[0],
    ".preflightrc.json"
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
function disposeOutputChannel() {
  if (outputChannel) {
    outputChannel.dispose();
    outputChannel = null;
  }
}

// src/utils.ts
var vscode2 = __toESM(require("vscode"));
var SUPPORTED_LANGUAGES = ["java", "xml", "json"];
var SUPPORTED_EXTENSIONS = [
  ".java",
  ".jsp",
  ".jspx",
  ".xml",
  ".content.xml",
  ".cfg.json"
];
function debounce(fn, ms) {
  let timer;
  return (...args) => {
    if (timer !== void 0) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = void 0;
      fn(...args);
    }, ms);
  };
}
function severityToVscode(severity) {
  switch (severity) {
    case "blocker":
    case "critical":
      return vscode2.DiagnosticSeverity.Error;
    case "major":
      return vscode2.DiagnosticSeverity.Warning;
    case "minor":
      return vscode2.DiagnosticSeverity.Information;
    default:
      return vscode2.DiagnosticSeverity.Hint;
  }
}
function isSupported(document) {
  const langId = document.languageId;
  if (SUPPORTED_LANGUAGES.includes(langId)) {
    return true;
  }
  const filePath = document.fileName;
  return SUPPORTED_EXTENSIONS.some((ext) => filePath.endsWith(ext));
}
var SEVERITY_ORDER = [
  "blocker",
  "critical",
  "major",
  "minor",
  "info"
];
function meetsThreshold(severity, threshold) {
  const findingIdx = SEVERITY_ORDER.indexOf(severity);
  const thresholdIdx = SEVERITY_ORDER.indexOf(threshold);
  if (findingIdx === -1 || thresholdIdx === -1)
    return true;
  return findingIdx <= thresholdIdx;
}

// src/diagnostics.ts
var engine = new import_preflight_engine.PreFlightEngine();
function applyOverride(finding, rules) {
  const override = rules[finding.ruleId];
  if (override === "off") {
    return { skip: true, severity: vscode3.DiagnosticSeverity.Error };
  }
  if (override === "warn") {
    return { skip: false, severity: vscode3.DiagnosticSeverity.Information };
  }
  return { skip: false, severity: severityToVscode(finding.severity) };
}
function computeDiagnostics(document) {
  if (!isSupported(document)) {
    return [];
  }
  const config = getConfig();
  if (!config.enable) {
    return [];
  }
  const start = Date.now();
  const report = engine.runPreFlight([
    { path: document.fileName, content: document.getText() }
  ]);
  const elapsed = Date.now() - start;
  if (elapsed > 50) {
    console.warn(
      `[Pre-Flight] Scan of ${document.fileName} took ${elapsed}ms (>50ms threshold)`
    );
  }
  const diagnostics = [];
  for (const finding of report.findings) {
    const { skip, severity } = applyOverride(finding, config.rules);
    if (skip)
      continue;
    if (!meetsThreshold(finding.severity, config.severityThreshold)) {
      continue;
    }
    const line = finding.line ? finding.line - 1 : 0;
    const lineText = document.lineAt(Math.min(line, document.lineCount - 1)).text;
    const range = new vscode3.Range(
      new vscode3.Position(line, 0),
      new vscode3.Position(line, lineText.length)
    );
    const diag = new vscode3.Diagnostic(range, finding.message, severity);
    diag.source = finding.ruleId;
    diag.code = {
      value: finding.ruleId,
      target: vscode3.Uri.parse(
        `https://experienceleague.adobe.com/docs/experience-manager-cloud-service/content/implementing/using-cloud-manager/test-results/code-quality-testing.html`
      )
    };
    diagnostics.push(diag);
  }
  return diagnostics;
}
function updateDiagnostics(document, collection) {
  const diagnostics = computeDiagnostics(document);
  collection.set(document.uri, diagnostics);
}

// src/code-actions.ts
var vscode4 = __toESM(require("vscode"));
var JAVAX_TO_JAKARTA = {
  "javax.servlet": "jakarta.servlet",
  "javax.annotation": "jakarta.annotation",
  "javax.inject": "jakarta.inject",
  "javax.json": "jakarta.json",
  "javax.ws.rs": "jakarta.ws.rs"
};
var SUN_REPLACEMENTS = {
  "sun.misc.BASE64Encoder": "java.util.Base64.getEncoder()",
  "sun.misc.BASE64Decoder": "java.util.Base64.getDecoder()"
};
var PreFlightCodeActionProvider = class {
  static providedCodeActionKinds = [vscode4.CodeActionKind.QuickFix];
  provideCodeActions(document, _range, context) {
    const actions = [];
    for (const diagnostic of context.diagnostics) {
      if (!diagnostic.source || typeof diagnostic.source !== "string") {
        continue;
      }
      const ruleId = diagnostic.source;
      const line = diagnostic.range.start.line;
      const lineText = document.lineAt(line).text;
      if (ruleId === "JavaCompat:JavaxToJakarta") {
        actions.push(...this.javaxToJakartaActions(document, diagnostic, lineText, line));
      } else if (ruleId === "JavaCompat:SunPackages") {
        actions.push(...this.sunPackageActions(document, diagnostic, lineText, line));
      } else if (ruleId === "CQRules:ResourceResolverAutoClose") {
        actions.push(...this.resourceResolverActions(document, diagnostic, line));
      } else if (ruleId === "OakPAL:AsyncFlag") {
        actions.push(...this.asyncFlagActions(document, diagnostic));
      }
    }
    return actions;
  }
  javaxToJakartaActions(document, diagnostic, lineText, line) {
    const actions = [];
    for (const [javax, jakarta] of Object.entries(JAVAX_TO_JAKARTA)) {
      if (lineText.includes(javax)) {
        const newText = lineText.replace(javax, jakarta);
        const action = new vscode4.CodeAction(
          `Replace ${javax} with ${jakarta}`,
          vscode4.CodeActionKind.QuickFix
        );
        action.edit = new vscode4.WorkspaceEdit();
        action.edit.replace(
          document.uri,
          new vscode4.Range(line, 0, line, lineText.length),
          newText
        );
        action.diagnostics = [diagnostic];
        action.isPreferred = true;
        actions.push(action);
      }
    }
    return actions;
  }
  sunPackageActions(document, diagnostic, lineText, line) {
    const actions = [];
    for (const [sunPkg, replacement] of Object.entries(SUN_REPLACEMENTS)) {
      if (lineText.includes(sunPkg)) {
        const action = new vscode4.CodeAction(
          `Replace ${sunPkg} with ${replacement}`,
          vscode4.CodeActionKind.QuickFix
        );
        action.edit = new vscode4.WorkspaceEdit();
        action.edit.replace(
          document.uri,
          new vscode4.Range(line, 0, line, lineText.length),
          lineText.replace(sunPkg, replacement)
        );
        action.diagnostics = [diagnostic];
        action.isPreferred = true;
        actions.push(action);
      }
    }
    return actions;
  }
  resourceResolverActions(document, diagnostic, line) {
    const action = new vscode4.CodeAction(
      "Add TODO: wrap in try-with-resources",
      vscode4.CodeActionKind.QuickFix
    );
    action.edit = new vscode4.WorkspaceEdit();
    action.edit.insert(
      document.uri,
      new vscode4.Position(line, 0),
      "    // TODO: wrap in try-with-resources\n"
    );
    action.diagnostics = [diagnostic];
    action.isPreferred = true;
    return [action];
  }
  asyncFlagActions(document, diagnostic) {
    const text = document.getText();
    const lines = text.split("\n");
    let insertLine = diagnostic.range.start.line;
    for (let i = 0; i < lines.length; i++) {
      if (/jcr:primaryType/.test(lines[i]) || /<property\b/.test(lines[i])) {
        insertLine = i + 1;
        break;
      }
    }
    const action = new vscode4.CodeAction(
      'Add async="[async, nrt]" property',
      vscode4.CodeActionKind.QuickFix
    );
    action.edit = new vscode4.WorkspaceEdit();
    action.edit.insert(
      document.uri,
      new vscode4.Position(insertLine, 0),
      '    async="[async, nrt]"\n'
    );
    action.diagnostics = [diagnostic];
    action.isPreferred = true;
    return [action];
  }
};

// src/commands.ts
var vscode5 = __toESM(require("vscode"));
var import_preflight_engine2 = __toESM(require_dist());
var engine2 = new import_preflight_engine2.PreFlightEngine();
var DASHBOARD_URL = "https://blackhole.focusgts.com/preflight";
async function runWorkspace(collection) {
  const files = await vscode5.workspace.findFiles(
    "**/*.{java,xml,cfg.json,jsp,jspx,content.xml}",
    "**/node_modules/**"
  );
  if (files.length === 0) {
    vscode5.window.showInformationMessage("Pre-Flight: No supported files found in workspace.");
    return;
  }
  let scanned = 0;
  for (const fileUri of files) {
    try {
      const document = await vscode5.workspace.openTextDocument(fileUri);
      if (isSupported(document)) {
        updateDiagnostics(document, collection);
        scanned++;
      }
    } catch {
    }
  }
  vscode5.window.showInformationMessage(
    `Pre-Flight: Scanned ${scanned} file${scanned !== 1 ? "s" : ""}.`
  );
}
function runFile(collection) {
  const editor = vscode5.window.activeTextEditor;
  if (!editor) {
    vscode5.window.showWarningMessage("Pre-Flight: No active editor.");
    return;
  }
  if (!isSupported(editor.document)) {
    vscode5.window.showWarningMessage(
      "Pre-Flight: Current file is not a supported type (java, xml, cfg.json)."
    );
    return;
  }
  updateDiagnostics(editor.document, collection);
  vscode5.window.showInformationMessage("Pre-Flight: Scan complete.");
}
async function explainRule() {
  const rules = engine2.getRules();
  const items = rules.map((rule2) => ({
    label: rule2.id,
    description: `[${rule2.severity}] ${rule2.category}`,
    detail: rule2.name,
    rule: rule2
  }));
  const selected = await vscode5.window.showQuickPick(items, {
    placeHolder: "Select a rule to see its details",
    matchOnDescription: true,
    matchOnDetail: true
  });
  if (!selected)
    return;
  const { rule } = selected;
  const message = [
    `Rule: ${rule.id} - ${rule.name}`,
    `Severity: ${rule.severity}`,
    `Category: ${rule.category}`,
    ``,
    rule.description,
    ``,
    `Remediation: ${rule.remediation}`
  ].join("\n");
  vscode5.window.showInformationMessage(message, { modal: true });
}
function openDashboard() {
  vscode5.env.openExternal(vscode5.Uri.parse(DASHBOARD_URL));
}

// src/extension.ts
var subscriptions = [];
async function activate(context) {
  const diagnosticCollection = vscode6.languages.createDiagnosticCollection("preflight");
  context.subscriptions.push(diagnosticCollection);
  await loadRcConfig();
  const rcWatcher = watchRcConfig(() => {
    for (const editor of vscode6.window.visibleTextEditors) {
      if (isSupported(editor.document)) {
        updateDiagnostics(editor.document, diagnosticCollection);
      }
    }
  });
  if (rcWatcher) {
    context.subscriptions.push(rcWatcher);
  }
  const debouncedUpdate = debounce(
    (document) => {
      const config = getConfig();
      if (config.enable && config.runOnType && isSupported(document)) {
        updateDiagnostics(document, diagnosticCollection);
      }
    },
    500
  );
  const onChangeDisposable = vscode6.workspace.onDidChangeTextDocument(
    (event) => {
      debouncedUpdate(event.document);
    }
  );
  subscriptions.push(onChangeDisposable);
  context.subscriptions.push(onChangeDisposable);
  const onSaveDisposable = vscode6.workspace.onDidSaveTextDocument(
    (document) => {
      const config = getConfig();
      if (config.enable && config.runOnSave && isSupported(document)) {
        updateDiagnostics(document, diagnosticCollection);
      }
    }
  );
  subscriptions.push(onSaveDisposable);
  context.subscriptions.push(onSaveDisposable);
  for (const editor of vscode6.window.visibleTextEditors) {
    if (isSupported(editor.document)) {
      updateDiagnostics(editor.document, diagnosticCollection);
    }
  }
  const codeActionDisposable = vscode6.languages.registerCodeActionsProvider(
    [{ language: "java" }, { language: "xml" }, { language: "json" }],
    new PreFlightCodeActionProvider(),
    { providedCodeActionKinds: PreFlightCodeActionProvider.providedCodeActionKinds }
  );
  subscriptions.push(codeActionDisposable);
  context.subscriptions.push(codeActionDisposable);
  context.subscriptions.push(
    vscode6.commands.registerCommand(
      "preflight.runWorkspace",
      () => runWorkspace(diagnosticCollection)
    ),
    vscode6.commands.registerCommand(
      "preflight.runFile",
      () => runFile(diagnosticCollection)
    ),
    vscode6.commands.registerCommand("preflight.explainRule", explainRule),
    vscode6.commands.registerCommand("preflight.openDashboard", openDashboard)
  );
}
function deactivate() {
  for (const sub of subscriptions) {
    sub.dispose();
  }
  subscriptions.length = 0;
  disposeOutputChannel();
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
