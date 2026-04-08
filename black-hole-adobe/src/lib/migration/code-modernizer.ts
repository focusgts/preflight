/**
 * AEM Code Modernization Engine
 *
 * Transforms AEM 6.x on-premise code to AEM as a Cloud Service format.
 * Handles OSGi configs, Maven structure, Dispatcher configs, deprecated APIs,
 * workflow process steps, and Oak index definitions.
 */
import { AssessmentFinding, CompatibilityLevel, Severity } from '@/types';

export interface ModernizationReport {
  id: string;
  timestamp: string;
  findings: ModernizationFinding[];
  summary: ModernizationSummary;
}
export interface ModernizationFinding {
  filePath: string;
  category: ModernizationCategory;
  severity: Severity;
  compatibilityLevel: CompatibilityLevel;
  title: string;
  description: string;
  beforeCode: string;
  afterCode: string | null;
  autoFixApplied: boolean;
  remediationGuide: string;
}
export interface ModernizationSummary {
  totalFindings: number;
  autoFixed: number;
  manualFixRequired: number;
  blockers: number;
  scoreBeforeModernization: number;
  scoreAfterModernization: number;
}
export type ModernizationCategory =
  | 'osgi_config' | 'maven_structure' | 'dispatcher'
  | 'deprecated_api' | 'workflow' | 'index_definition' | 'bundle_compatibility';
export interface OsgiConfigInput { path: string; xml: string; runMode?: string; }
export interface MavenModule { artifactId: string; packaging: string; path: string; dependencies: string[]; }
export interface DispatcherRule { type: 'farm' | 'vhost' | 'filter' | 'rewrite' | 'cache'; path: string; content: string; }
export interface BundleAnalysis { bundleName: string; exportedPackages: string[]; importedPackages: string[]; issues: AssessmentFinding[]; compatibilityScore: number; }

/** Maps /etc paths to their Cloud Service counterparts. */
const PATH_MAPPINGS: Record<string, string> = {
  '/etc/designs': '/apps/{project}/components', '/etc/clientlibs': '/apps/{project}/clientlibs',
  '/etc/cloudservices': '/conf/{project}/settings/cloudconfigs', '/etc/blueprints': '/libs/msm',
  '/etc/tags': '/content/cq:tags', '/etc/workflow/models': '/var/workflow/models',
  '/etc/workflow/launcher': '/libs/settings/workflow/launcher',
  '/etc/dam/video': '/libs/settings/dam/video', '/etc/notification/email': '/libs/settings/notification/email',
};

/** Deprecated AEM APIs and their replacements. */
const API_RULES: Array<{ pattern: RegExp; replacement: string; desc: string; severity: Severity }> = [
  { pattern: /SlingRepository\.loginAdministrative\s*\(/g, replacement: 'SlingRepository.loginService(', desc: 'loginAdministrative is removed in AEMaaCS. Use loginService with a configured service user.', severity: Severity.CRITICAL },
  { pattern: /(?<!SlingRepository\.)\bloginAdministrative\s*\(/g, replacement: 'loginService(', desc: 'loginAdministrative is removed in AEMaaCS. Use loginService with a configured service user.', severity: Severity.CRITICAL },
  { pattern: /ResourceResolverFactory\.getAdministrativeResourceResolver\s*\(/g, replacement: 'ResourceResolverFactory.getServiceResourceResolver(', desc: 'Administrative resource resolvers are forbidden. Use service resource resolvers.', severity: Severity.CRITICAL },
  { pattern: /(?<!ResourceResolverFactory\.)\bgetAdministrativeResourceResolver\s*\(/g, replacement: 'getServiceResourceResolver(', desc: 'getAdministrativeResourceResolver is removed in AEMaaCS. Use getServiceResourceResolver with a service user mapping.', severity: Severity.HIGH },
  { pattern: /session\.impersonate\s*\(/g, replacement: '/* Use service users instead */', desc: 'Session impersonation is restricted. Use service user mappings.', severity: Severity.HIGH },
  { pattern: /javax\.jcr\.observation\.EventListener/g, replacement: 'org.apache.sling.api.resource.observation.ResourceChangeListener', desc: 'JCR EventListener deprecated. Use Sling ResourceChangeListener.', severity: Severity.MEDIUM },
  { pattern: /com\.day\.cq\.replication\.ReplicationAction/g, replacement: 'com.adobe.granite.replication.api', desc: 'Legacy replication API deprecated. Use Granite Replication API.', severity: Severity.MEDIUM },
  { pattern: /com\.day\.cq\.search\.QueryBuilder/g, replacement: 'com.adobe.cq.search.QueryBuilder', desc: 'Day CQ QueryBuilder deprecated. Use com.adobe.cq.search.', severity: Severity.LOW },
  { pattern: /com\.day\.cq\.wcm\.api\.PageManager/g, replacement: 'com.adobe.cq.wcm.api.PageManager', desc: 'Day CQ PageManager deprecated. Use com.adobe.cq.wcm.api.', severity: Severity.LOW },
  { pattern: /com\.day\.cq\.dam\.api\.AssetManager/g, replacement: 'com.adobe.cq.dam.api.AssetManager', desc: 'Day CQ DAM AssetManager deprecated. Use Adobe CQ DAM API.', severity: Severity.LOW },
];

const DISPATCHER_RULES: Array<{ pat: RegExp; repl: string }> = [
  { pat: /\/allowedClients\s*\{[^}]*\}/gs, repl: '# allowedClients removed - managed by Cloud CDN' },
  { pat: /\/statistics\s*\{[^}]*\}/gs, repl: '# statistics removed - Cloud handles load balancing' },
  { pat: /\/health_check\s*\{[^}]*\}/gs, repl: '# health_check removed - Cloud has built-in monitoring' },
  { pat: /\/retryDelay\s+"?\d+"?/g, repl: '# retryDelay removed - managed by Cloud CDN' },
  { pat: /\/unavailablePenalty\s+"?\d+"?/g, repl: '# unavailablePenalty removed - managed by Cloud CDN' },
];

export class CodeModernizer {
  private findings: ModernizationFinding[] = [];

  /** Convert sling:OsgiConfig XML nodes to .cfg.json format. */
  async modernizeOSGiConfigs(configs: OsgiConfigInput[]): Promise<ModernizationReport> {
    this.findings = [];
    for (const c of configs) this.findings.push(this.convertOsgiXmlToJson(c));
    return this.buildReport();
  }

  /** Restructure Maven project to Cloud Service Archetype 35+. */
  async modernizeMavenProject(modules: MavenModule[], projectName: string): Promise<ModernizationReport> {
    this.findings = [];
    const required = ['ui.apps', 'ui.apps.structure', 'ui.config', 'ui.content', 'ui.frontend', 'ui.tests', 'it.tests', 'all', 'core'];
    const existing = new Set(modules.map((m) => m.artifactId));
    for (const r of required) {
      if (!existing.has(r)) {
        this.addFinding('pom.xml', 'maven_structure', r === 'all' ? Severity.CRITICAL : Severity.MEDIUM,
          r === 'all' ? CompatibilityLevel.BLOCKER : CompatibilityLevel.MANUAL_FIX,
          `Missing module: ${r}`, `Archetype 35+ requires "${r}".`, `<!-- ${r} not found -->`,
          `<artifactId>${projectName}.${r}</artifactId>`, false);
      }
    }
    for (const mod of modules) {
      if (mod.artifactId === 'ui.apps' && mod.packaging !== 'content-package') {
        this.addFinding(`${mod.path}/pom.xml`, 'maven_structure', Severity.HIGH, CompatibilityLevel.MANUAL_FIX,
          'ui.apps must use content-package', `Has "${mod.packaging}" packaging.`,
          `<packaging>${mod.packaging}</packaging>`, '<packaging>content-package</packaging>', false);
      }
      for (const [oldPath, newPath] of Object.entries(PATH_MAPPINGS)) {
        this.addFinding(mod.path, 'maven_structure', Severity.MEDIUM, CompatibilityLevel.AUTO_FIXABLE,
          `Path migration: ${oldPath}`, `Relocate to ${newPath.replace('{project}', projectName)}.`,
          oldPath, newPath.replace('{project}', projectName), true);
      }
    }
    return this.buildReport();
  }

  /** Convert on-premise Dispatcher config to Cloud CDN format. */
  async modernizeDispatcherConfig(rules: DispatcherRule[]): Promise<ModernizationReport> {
    this.findings = [];
    for (const rule of rules) {
      let transformed = rule.content, modified = false;
      for (const dr of DISPATCHER_RULES) {
        dr.pat.lastIndex = 0;
        if (dr.pat.test(transformed)) { dr.pat.lastIndex = 0; transformed = transformed.replace(dr.pat, dr.repl); modified = true; }
        dr.pat.lastIndex = 0;
      }
      if (/\/docroot\s+"\/[^"]+"/g.test(transformed)) {
        transformed = transformed.replace(/\/docroot\s+"\/[^"]+"/g, '/docroot "${DOCROOT}"'); modified = true;
      }
      if (modified) {
        this.addFinding(rule.path, 'dispatcher', Severity.MEDIUM, CompatibilityLevel.AUTO_FIXABLE,
          `Dispatcher modernized: ${rule.type}`, 'Converted to Cloud Service format.', rule.content, transformed, true);
      }
    }
    return this.buildReport();
  }

  /** Detect and replace deprecated AEM APIs in source code. */
  async replaceDeprecatedAPIs(files: Array<{ path: string; content: string }>): Promise<ModernizationReport> {
    this.findings = [];
    for (const file of files) {
      for (const rule of API_RULES) {
        rule.pattern.lastIndex = 0;
        const matches = file.content.match(rule.pattern);
        rule.pattern.lastIndex = 0;
        if (matches) {
          this.addFinding(file.path, 'deprecated_api', rule.severity,
            rule.severity === Severity.CRITICAL ? CompatibilityLevel.BLOCKER : CompatibilityLevel.AUTO_FIXABLE,
            `Deprecated API: ${matches[0].trim()}`, rule.desc, matches[0], rule.replacement,
            rule.severity !== Severity.CRITICAL);
        }
      }
      if (file.path.startsWith('/apps/') && /\.content\.xml/.test(file.path)) {
        const mutable = file.content.match(/jcr:primaryType="nt:unstructured"/g);
        if (mutable) {
          this.addFinding(file.path, 'deprecated_api', Severity.HIGH, CompatibilityLevel.MANUAL_FIX,
            'Mutable content in /apps', '/apps is read-only in Cloud Service.',
            `${mutable.length} mutable node(s)`, null, false);
        }
      }
    }
    return this.buildReport();
  }

  /** Convert custom workflow process steps to Cloud Service format. */
  async modernizeWorkflows(models: Array<{ path: string; xml: string }>): Promise<ModernizationReport> {
    this.findings = [];
    for (const wf of models) {
      const ecma = wf.xml.match(/impl="\/etc\/workflow\/scripts\/[^"]+\.ecma"/g);
      if (ecma) for (const m of ecma) {
        this.addFinding(wf.path, 'workflow', Severity.CRITICAL, CompatibilityLevel.BLOCKER,
          'ECMA script workflow step', 'Not supported in Cloud. Convert to Java.', m, null, false);
      }
      if (wf.path.includes('dam/update_asset') || wf.path.includes('dam_update_asset')) {
        this.addFinding(wf.path, 'workflow', Severity.HIGH, CompatibilityLevel.MANUAL_FIX,
          'Custom DAM Update Asset workflow', 'Use Asset Compute or Processing Profiles.',
          'Custom DAM workflow', '// Use Asset microservices instead', false);
      }
      if (/jcr:primaryType="cq:WorkflowLauncher"/.test(wf.xml)) {
        this.addFinding(wf.path, 'workflow', Severity.MEDIUM, CompatibilityLevel.AUTO_FIXABLE,
          'Workflow launcher config', 'Relocate to /libs/settings/workflow/launcher.',
          '/etc/workflow/launcher/config/*', '/libs/settings/workflow/launcher/config/*', true);
      }
    }
    return this.buildReport();
  }

  /** Convert index definitions to Cloud Service format. */
  async convertIndexes(defs: Array<{ path: string; xml: string }>): Promise<ModernizationReport> {
    this.findings = [];
    for (const idx of defs) {
      if (/type="property"/i.test(idx.xml))
        this.addFinding(idx.path, 'index_definition', Severity.MEDIUM, CompatibilityLevel.AUTO_FIXABLE,
          'Property index should be Lucene', 'Convert for Cloud performance.', 'type="property"', 'type="lucene"', true);
      if (!/async="async"/i.test(idx.xml) && /type="lucene"/i.test(idx.xml))
        this.addFinding(idx.path, 'index_definition', Severity.HIGH, CompatibilityLevel.AUTO_FIXABLE,
          'Missing async config', 'Cloud requires async mode.', '<!-- no async -->', 'async="[async, nrt]"', true);
      if (idx.path.startsWith('/content/') || idx.path.startsWith('/etc/'))
        this.addFinding(idx.path, 'index_definition', Severity.CRITICAL, CompatibilityLevel.MANUAL_FIX,
          'Index in non-standard location', 'Must be under /apps or /oak:index.',
          idx.path, idx.path.replace(/^\/(content|etc)\//, '/apps/_oak_index/'), false);
      if (!/compatVersion/i.test(idx.xml))
        this.addFinding(idx.path, 'index_definition', Severity.LOW, CompatibilityLevel.AUTO_FIXABLE,
          'Missing compatVersion', 'Should declare compatVersion=2.', '<!-- none -->', 'compatVersion="{Long}2"', true);
    }
    return this.buildReport();
  }

  /** Analyze an OSGi bundle for Cloud Service compatibility. */
  async analyzeBundle(bundleName: string, exported: string[], imported: string[], source?: string): Promise<BundleAnalysis> {
    const issues: AssessmentFinding[] = [];
    let score = 100;
    const forbidden = ['com.day.cq.dam.handler.gibson', 'com.day.cq.dam.s7dam', 'com.day.cq.analytics.sitecatalyst',
      'com.day.cq.searchpromote', 'com.day.cq.mcm', 'org.apache.jackrabbit.oak.plugins.segment'];
    const restricted = ['javax.mail', 'javax.activation', 'com.sun.', 'sun.'];
    for (const imp of imported) {
      for (const f of forbidden) if (imp.startsWith(f)) {
        score -= 15;
        issues.push({ id: `b-${imp}`, category: 'bundle_compatibility', subCategory: 'forbidden', severity: Severity.CRITICAL,
          compatibilityLevel: CompatibilityLevel.BLOCKER, title: `Forbidden: ${imp}`, description: `${imp} not available in Cloud.`,
          affectedPath: bundleName, remediationGuide: `Remove ${imp}.`, autoFixAvailable: false, estimatedHours: 8, bpaPatternCode: null });
      }
      for (const r of restricted) if (imp.startsWith(r)) {
        score -= 5;
        issues.push({ id: `b-${imp}`, category: 'bundle_compatibility', subCategory: 'restricted', severity: Severity.HIGH,
          compatibilityLevel: CompatibilityLevel.MANUAL_FIX, title: `Restricted: ${imp}`, description: `${imp} may not be available.`,
          affectedPath: bundleName, remediationGuide: `Verify ${imp} availability.`, autoFixAvailable: false, estimatedHours: 4, bpaPatternCode: null });
      }
    }
    if (source) for (const rule of API_RULES) {
      rule.pattern.lastIndex = 0;
      if (rule.pattern.test(source)) { score -= 10; rule.pattern.lastIndex = 0; }
    }
    return { bundleName, exportedPackages: exported, importedPackages: imported, issues, compatibilityScore: Math.max(0, score) };
  }

  private addFinding(path: string, cat: ModernizationCategory, sev: Severity, compat: CompatibilityLevel,
    title: string, desc: string, before: string, after: string | null, autoFix: boolean) {
    this.findings.push({ filePath: path, category: cat, severity: sev, compatibilityLevel: compat,
      title, description: desc, beforeCode: before, afterCode: after, autoFixApplied: autoFix, remediationGuide: desc });
  }

  private convertOsgiXmlToJson(config: OsgiConfigInput): ModernizationFinding {
    const props = this.parseOsgiXml(config.xml);
    const pid = config.xml.match(/service\.pid="([^"]+)"/)?.[1] ?? config.path.split('/').pop()?.replace(/\.xml$/, '') ?? 'unknown';
    const suffix = config.runMode ? `-${config.runMode}` : '';
    return { filePath: config.path, category: 'osgi_config', severity: Severity.MEDIUM,
      compatibilityLevel: CompatibilityLevel.AUTO_FIXABLE, title: `Convert to .cfg.json: ${pid}`,
      description: `Target: ${pid}${suffix}.cfg.json`, beforeCode: config.xml,
      afterCode: JSON.stringify(props, null, 2), autoFixApplied: true,
      remediationGuide: `Place in ui.config/osgiconfig/config${suffix}/` };
  }

  private parseOsgiXml(xml: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    let m: RegExpExecArray | null;
    const typed = /(\w[\w.:-]*)="\{(Boolean|Long|Double|Float|String)\}([^"]*)"/g;
    while ((m = typed.exec(xml)) !== null) {
      if (!m[1].startsWith('jcr:') && !m[1].startsWith('sling:') && !m[1].startsWith('xmlns:'))
        result[m[1]] = m[2] === 'Boolean' ? m[3] === 'true' : ['Long', 'Float', 'Double'].includes(m[2]) ? Number(m[3]) : m[3];
    }
    const arrays = /(\w[\w.:-]*)="\{(Boolean|Long|Double|Float|String)\}\[([^\]]*)\]"/g;
    while ((m = arrays.exec(xml)) !== null) {
      result[m[1]] = m[3].split(',').map((v) => m![2] === 'Boolean' ? v.trim() === 'true' : ['Long', 'Float', 'Double'].includes(m![2]) ? Number(v.trim()) : v.trim());
    }
    const strings = /(\w[\w.:-]*)="([^{][^"]*)"/g;
    while ((m = strings.exec(xml)) !== null) {
      if (!m[1].startsWith('jcr:') && !m[1].startsWith('sling:') && !m[1].startsWith('xmlns:') && result[m[1]] === undefined)
        result[m[1]] = m[2];
    }
    return result;
  }

  private buildReport(): ModernizationReport {
    const auto = this.findings.filter((f) => f.autoFixApplied).length;
    const blockers = this.findings.filter((f) => f.compatibilityLevel === CompatibilityLevel.BLOCKER).length;
    const manual = this.findings.filter((f) => !f.autoFixApplied && f.compatibilityLevel !== CompatibilityLevel.BLOCKER).length;
    return { id: `mod-${Date.now()}`, timestamp: new Date().toISOString(), findings: [...this.findings],
      summary: { totalFindings: this.findings.length, autoFixed: auto, manualFixRequired: manual, blockers,
        scoreBeforeModernization: Math.max(0, 100 - this.findings.length * 5),
        scoreAfterModernization: Math.max(0, 100 - blockers * 15 - manual * 5) } };
  }
}
