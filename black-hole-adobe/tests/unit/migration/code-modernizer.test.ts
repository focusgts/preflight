/**
 * Tests for CodeModernizer
 *
 * Tests OSGi config conversion, deprecated API detection, Maven project
 * restructuring, dispatcher config conversion, workflow migration
 * patterns, and path mapping.
 */

import { describe, it, expect } from 'vitest';

// ---- CodeModernizer implementation (inline for testing) ----

interface ModernizationResult {
  originalPath: string;
  modernizedPath: string;
  changes: ModernizationChange[];
  isAutoFixable: boolean;
}

interface ModernizationChange {
  type: 'osgi_config' | 'deprecated_api' | 'path_mapping' | 'dispatcher' | 'workflow' | 'maven';
  description: string;
  severity: 'info' | 'warning' | 'error';
  originalValue: string;
  modernizedValue: string;
}

interface DeprecatedAPI {
  pattern: string;
  replacement: string;
  severity: 'warning' | 'error';
  documentation: string;
}

const DEPRECATED_APIS: DeprecatedAPI[] = [
  {
    pattern: 'javax.jcr.Session',
    replacement: 'org.apache.sling.api.resource.ResourceResolver',
    severity: 'error',
    documentation: 'https://experienceleague.adobe.com/docs/experience-manager-cloud-service/content/implementing/developer-tools/java-api-best-practices.html',
  },
  {
    pattern: 'com.day.cq.search.QueryBuilder',
    replacement: 'org.apache.sling.api.resource.ResourceResolver#getResource with Oak indexes',
    severity: 'warning',
    documentation: 'https://experienceleague.adobe.com/docs/experience-manager-cloud-service/content/implementing/developing/search.html',
  },
  {
    pattern: 'com.day.cq.wcm.api.PageManager',
    replacement: 'com.adobe.aem.wcm.api.PageManager (Cloud Service API)',
    severity: 'warning',
    documentation: 'https://experienceleague.adobe.com/docs/experience-manager-cloud-service/content/implementing/developing/aem-as-a-cloud-service-sdk.html',
  },
  {
    pattern: 'org.apache.jackrabbit.api',
    replacement: 'Sling Resource API',
    severity: 'error',
    documentation: 'https://experienceleague.adobe.com/docs/experience-manager-cloud-service/content/implementing/developing/apis.html',
  },
  {
    pattern: 'com.day.cq.replication',
    replacement: 'Sling Content Distribution',
    severity: 'warning',
    documentation: 'https://experienceleague.adobe.com/docs/experience-manager-cloud-service/content/implementing/developing/content-distribution.html',
  },
  {
    pattern: 'org.apache.sling.jcr.api.SlingRepository',
    replacement: 'org.apache.sling.api.resource.ResourceResolverFactory',
    severity: 'error',
    documentation: 'https://experienceleague.adobe.com/docs/experience-manager-cloud-service/content/implementing/developing/apis.html',
  },
];

const PATH_MAPPINGS: Array<{ from: RegExp; to: string; description: string }> = [
  { from: /^\/etc\/designs\//, to: '/apps/', description: 'Design configs moved from /etc/designs to /apps' },
  { from: /^\/etc\/clientlibs\//, to: '/apps/', description: 'Client libraries moved from /etc/clientlibs to /apps' },
  { from: /^\/etc\/tags\//, to: '/content/cq:tags/', description: 'Tags moved from /etc/tags to /content/cq:tags' },
  { from: /^\/etc\/cloudservices\//, to: '/conf/', description: 'Cloud services moved from /etc to /conf' },
  { from: /^\/etc\/blueprints\//, to: '/libs/msm/', description: 'MSM blueprints moved from /etc to /libs/msm' },
  { from: /^\/etc\/workflow\/models\//, to: '/var/workflow/models/', description: 'Workflow models restructured' },
  { from: /^\/etc\/maps\//, to: '/conf/sling/', description: 'Sling mappings moved from /etc/maps to /conf/sling' },
];

function convertOSGiConfig(xmlContent: string, pid: string): { json: string; filename: string } {
  const properties: Record<string, unknown> = {};

  const propRegex = /<property\s+name="([^"]+)"\s+(?:value="([^"]*)"(?:\s+type="([^"]*)")?|type="([^"]*)")\s*\/?>(?:([\s\S]*?)<\/property>)?/gi;
  let match: RegExpExecArray | null;

  while ((match = propRegex.exec(xmlContent)) !== null) {
    const name = match[1];
    const value = match[2] ?? match[5]?.trim() ?? '';
    const type = match[3] ?? match[4] ?? 'String';

    switch (type) {
      case 'Long':
      case 'Integer':
        properties[name] = parseInt(value, 10);
        break;
      case 'Boolean':
        properties[name] = value === 'true';
        break;
      case 'Double':
      case 'Float':
        properties[name] = parseFloat(value);
        break;
      default:
        properties[name] = value;
    }
  }

  // Fallback: try simple key=value format
  if (Object.keys(properties).length === 0) {
    const lines = xmlContent.split('\n');
    for (const line of lines) {
      const kv = line.match(/^\s*(\S+)\s*=\s*"?([^"]*)"?\s*$/);
      if (kv) {
        properties[kv[1]] = kv[2];
      }
    }
  }

  const filename = `${pid}.cfg.json`;
  return {
    json: JSON.stringify(properties, null, 2),
    filename,
  };
}

function detectDeprecatedAPIs(sourceCode: string): DeprecatedAPI[] {
  const found: DeprecatedAPI[] = [];
  for (const api of DEPRECATED_APIS) {
    if (sourceCode.includes(api.pattern)) {
      found.push(api);
    }
  }
  return found;
}

function analyzeMavenStructure(
  modules: string[],
): { restructured: string[]; recommendations: string[] } {
  const restructured: string[] = [];
  const recommendations: string[] = [];

  for (const mod of modules) {
    if (mod === 'ui.apps') {
      restructured.push('ui.apps');
      recommendations.push('Ensure ui.apps contains only immutable content');
    }
    if (mod === 'ui.content') {
      restructured.push('ui.content');
      recommendations.push('Move mutable content to ui.content.sample for Cloud Manager');
    }
    if (mod === 'core') {
      restructured.push('core');
    }
    if (mod === 'all') {
      restructured.push('all');
      recommendations.push('Verify all package embeds are Cloud Service compatible');
    }
  }

  // Required modules for Cloud Service
  if (!modules.includes('ui.config')) {
    restructured.push('ui.config');
    recommendations.push('Add ui.config module for OSGi configurations');
  }
  if (!modules.includes('ui.frontend')) {
    recommendations.push('Consider adding ui.frontend for webpack/npm based frontend builds');
  }

  return { restructured, recommendations };
}

function convertDispatcherConfig(
  legacyRules: Array<{ type: string; glob: string }>,
): { sdkRules: Array<{ type: string; glob: string; comment: string }> } {
  const sdkRules = legacyRules.map((rule) => {
    let comment = '';
    if (rule.glob.includes('/libs/')) {
      comment = 'AEM libs - allowed by default in Cloud Service SDK';
    } else if (rule.glob.includes('/content/dam/')) {
      comment = 'DAM content - ensure Cloud Service CDN handles caching';
    } else if (rule.glob === '*') {
      comment = 'Wildcard rule - review for Cloud Service compatibility';
    } else {
      comment = 'Custom rule - validate against Cloud Service dispatcher SDK';
    }

    return { ...rule, comment };
  });

  return { sdkRules };
}

function mapWorkflowPattern(
  legacyWorkflow: { model: string; steps: string[] },
): { modernized: string; changes: string[] } {
  const changes: string[] = [];
  let modernized = legacyWorkflow.model;

  if (legacyWorkflow.model.includes('dam-update-asset')) {
    modernized = 'asset-processing-service';
    changes.push('DAM Update Asset workflow replaced by Asset Processing Service');
  }
  if (legacyWorkflow.model.includes('request-for-activation')) {
    modernized = 'content-approval-workflow';
    changes.push('Request for Activation replaced by Content Approval workflow');
  }

  for (const step of legacyWorkflow.steps) {
    if (step.includes('com.day.cq.dam')) {
      changes.push(`Step "${step}" uses deprecated DAM API - needs Cloud Service migration`);
    }
    if (step.includes('com.adobe.granite.workflow')) {
      changes.push(`Step "${step}" should use Sling workflow API`);
    }
  }

  return { modernized, changes };
}

function mapPath(originalPath: string): { newPath: string; mapping: string | null } {
  for (const mapping of PATH_MAPPINGS) {
    if (mapping.from.test(originalPath)) {
      const newPath = originalPath.replace(mapping.from, mapping.to);
      return { newPath, mapping: mapping.description };
    }
  }
  return { newPath: originalPath, mapping: null };
}

// ============================================================
// Tests
// ============================================================

describe('CodeModernizer', () => {

  // ----------------------------------------------------------
  // OSGi Config Conversion
  // ----------------------------------------------------------

  describe('OSGi config conversion (XML to .cfg.json)', () => {
    it('should convert XML properties to JSON', () => {
      const xml = `
        <jcr:root>
          <property name="maxCacheSize" value="1024" type="Long" />
          <property name="enabled" value="true" type="Boolean" />
          <property name="label" value="My Service" />
        </jcr:root>
      `;
      const result = convertOSGiConfig(xml, 'com.example.MyService');

      const parsed = JSON.parse(result.json);
      expect(parsed.maxCacheSize).toBe(1024);
      expect(parsed.enabled).toBe(true);
      expect(parsed.label).toBe('My Service');
    });

    it('should produce correct .cfg.json filename', () => {
      const result = convertOSGiConfig('<root/>', 'com.adobe.cq.dam.Handler');
      expect(result.filename).toBe('com.adobe.cq.dam.Handler.cfg.json');
    });

    it('should handle Double/Float types', () => {
      const xml = '<root><property name="ratio" value="0.75" type="Double" /></root>';
      const result = convertOSGiConfig(xml, 'test');
      const parsed = JSON.parse(result.json);

      expect(parsed.ratio).toBe(0.75);
    });

    it('should handle Integer types', () => {
      const xml = '<root><property name="timeout" value="30" type="Integer" /></root>';
      const result = convertOSGiConfig(xml, 'test');
      const parsed = JSON.parse(result.json);

      expect(parsed.timeout).toBe(30);
    });

    it('should default to String type', () => {
      const xml = '<root><property name="path" value="/content/dam" /></root>';
      const result = convertOSGiConfig(xml, 'test');
      const parsed = JSON.parse(result.json);

      expect(parsed.path).toBe('/content/dam');
    });

    it('should handle empty properties', () => {
      const xml = '<root><property name="empty" value="" /></root>';
      const result = convertOSGiConfig(xml, 'test');
      const parsed = JSON.parse(result.json);

      expect(parsed.empty).toBe('');
    });

    it('should produce valid JSON output', () => {
      const xml = '<root><property name="a" value="1" type="Long" /><property name="b" value="text" /></root>';
      const result = convertOSGiConfig(xml, 'test');

      expect(() => JSON.parse(result.json)).not.toThrow();
    });
  });

  // ----------------------------------------------------------
  // Deprecated API Detection
  // ----------------------------------------------------------

  describe('deprecated API detection', () => {
    it('should detect javax.jcr.Session usage', () => {
      const code = `
        import javax.jcr.Session;
        public class MyService {
          private Session session;
        }
      `;
      const found = detectDeprecatedAPIs(code);

      expect(found).toHaveLength(1);
      expect(found[0].pattern).toBe('javax.jcr.Session');
      expect(found[0].severity).toBe('error');
    });

    it('should detect org.apache.jackrabbit.api usage', () => {
      const code = 'import org.apache.jackrabbit.api.JackrabbitSession;';
      const found = detectDeprecatedAPIs(code);

      expect(found.some((a) => a.pattern === 'org.apache.jackrabbit.api')).toBe(true);
    });

    it('should detect com.day.cq.replication usage', () => {
      const code = 'import com.day.cq.replication.ReplicationService;';
      const found = detectDeprecatedAPIs(code);

      expect(found.some((a) => a.pattern === 'com.day.cq.replication')).toBe(true);
      expect(found[0].replacement).toContain('Content Distribution');
    });

    it('should detect multiple deprecated APIs in same file', () => {
      const code = `
        import javax.jcr.Session;
        import org.apache.jackrabbit.api.JackrabbitSession;
        import com.day.cq.replication.Replicator;
      `;
      const found = detectDeprecatedAPIs(code);

      expect(found.length).toBeGreaterThanOrEqual(3);
    });

    it('should return empty array for clean code', () => {
      const code = `
        import org.apache.sling.api.resource.ResourceResolver;
        public class ModernService {}
      `;
      const found = detectDeprecatedAPIs(code);

      expect(found).toHaveLength(0);
    });

    it('should include documentation links for each deprecated API', () => {
      const code = 'import javax.jcr.Session;';
      const found = detectDeprecatedAPIs(code);

      expect(found[0].documentation).toContain('experienceleague.adobe.com');
    });

    it('should detect SlingRepository usage', () => {
      const code = 'import org.apache.sling.jcr.api.SlingRepository;';
      const found = detectDeprecatedAPIs(code);

      expect(found.some((a) => a.pattern === 'org.apache.sling.jcr.api.SlingRepository')).toBe(true);
    });
  });

  // ----------------------------------------------------------
  // Maven Project Restructuring
  // ----------------------------------------------------------

  describe('Maven project restructuring analysis', () => {
    it('should recommend ui.config module when missing', () => {
      const analysis = analyzeMavenStructure(['core', 'ui.apps', 'ui.content', 'all']);

      expect(analysis.restructured).toContain('ui.config');
      expect(analysis.recommendations.some((r) => r.includes('ui.config'))).toBe(true);
    });

    it('should recommend ui.frontend consideration when missing', () => {
      const analysis = analyzeMavenStructure(['core', 'ui.apps']);

      expect(analysis.recommendations.some((r) => r.includes('ui.frontend'))).toBe(true);
    });

    it('should flag ui.content for Cloud Manager compatibility', () => {
      const analysis = analyzeMavenStructure(['ui.content']);

      expect(analysis.recommendations.some((r) => r.includes('mutable content'))).toBe(true);
    });

    it('should flag all package embeds for compatibility', () => {
      const analysis = analyzeMavenStructure(['all', 'core']);

      expect(analysis.recommendations.some((r) => r.includes('embeds'))).toBe(true);
    });

    it('should include all existing modules in restructured list', () => {
      const modules = ['core', 'ui.apps', 'ui.content', 'all'];
      const analysis = analyzeMavenStructure(modules);

      for (const mod of modules) {
        expect(analysis.restructured).toContain(mod);
      }
    });
  });

  // ----------------------------------------------------------
  // Dispatcher Config Conversion
  // ----------------------------------------------------------

  describe('dispatcher config conversion', () => {
    it('should annotate libs rules', () => {
      const rules = [{ type: 'allow', glob: '/libs/*' }];
      const result = convertDispatcherConfig(rules);

      expect(result.sdkRules[0].comment).toContain('Cloud Service SDK');
    });

    it('should annotate DAM rules', () => {
      const rules = [{ type: 'allow', glob: '/content/dam/*' }];
      const result = convertDispatcherConfig(rules);

      expect(result.sdkRules[0].comment).toContain('CDN');
    });

    it('should flag wildcard rules for review', () => {
      const rules = [{ type: 'allow', glob: '*' }];
      const result = convertDispatcherConfig(rules);

      expect(result.sdkRules[0].comment).toContain('review');
    });

    it('should annotate custom rules for validation', () => {
      const rules = [{ type: 'deny', glob: '/custom/path/*' }];
      const result = convertDispatcherConfig(rules);

      expect(result.sdkRules[0].comment).toContain('validate');
    });

    it('should preserve original rule type and glob', () => {
      const rules = [
        { type: 'allow', glob: '/content/*' },
        { type: 'deny', glob: '/admin/*' },
      ];
      const result = convertDispatcherConfig(rules);

      expect(result.sdkRules[0].type).toBe('allow');
      expect(result.sdkRules[0].glob).toBe('/content/*');
      expect(result.sdkRules[1].type).toBe('deny');
      expect(result.sdkRules[1].glob).toBe('/admin/*');
    });
  });

  // ----------------------------------------------------------
  // Workflow Migration Patterns
  // ----------------------------------------------------------

  describe('workflow migration patterns', () => {
    it('should modernize DAM Update Asset workflow', () => {
      const result = mapWorkflowPattern({
        model: '/var/workflow/models/dam-update-asset',
        steps: [],
      });

      expect(result.modernized).toBe('asset-processing-service');
      expect(result.changes).toHaveLength(1);
    });

    it('should modernize Request for Activation workflow', () => {
      const result = mapWorkflowPattern({
        model: '/var/workflow/models/request-for-activation',
        steps: [],
      });

      expect(result.modernized).toBe('content-approval-workflow');
    });

    it('should detect deprecated DAM API in workflow steps', () => {
      const result = mapWorkflowPattern({
        model: '/var/workflow/models/custom',
        steps: ['com.day.cq.dam.core.process.CreateThumbnailProcess'],
      });

      expect(result.changes.some((c) => c.includes('deprecated DAM API'))).toBe(true);
    });

    it('should detect granite workflow API in steps', () => {
      const result = mapWorkflowPattern({
        model: '/var/workflow/models/custom',
        steps: ['com.adobe.granite.workflow.exec.WorkflowProcess'],
      });

      expect(result.changes.some((c) => c.includes('Sling workflow API'))).toBe(true);
    });

    it('should not change unknown workflows', () => {
      const result = mapWorkflowPattern({
        model: '/var/workflow/models/my-custom-workflow',
        steps: ['com.mycompany.CustomStep'],
      });

      expect(result.modernized).toBe('/var/workflow/models/my-custom-workflow');
      expect(result.changes).toHaveLength(0);
    });
  });

  // ----------------------------------------------------------
  // Path Mapping (/etc to /conf, /apps)
  // ----------------------------------------------------------

  describe('path mapping', () => {
    it('should map /etc/designs/ to /apps/', () => {
      const result = mapPath('/etc/designs/mysite/clientlibs/main.css');
      expect(result.newPath).toBe('/apps/mysite/clientlibs/main.css');
      expect(result.mapping).toContain('/etc/designs');
    });

    it('should map /etc/clientlibs/ to /apps/', () => {
      const result = mapPath('/etc/clientlibs/mysite/js/main.js');
      expect(result.newPath).toBe('/apps/mysite/js/main.js');
    });

    it('should map /etc/tags/ to /content/cq:tags/', () => {
      const result = mapPath('/etc/tags/mysite/categories');
      expect(result.newPath).toBe('/content/cq:tags/mysite/categories');
    });

    it('should map /etc/cloudservices/ to /conf/', () => {
      const result = mapPath('/etc/cloudservices/analytics/myconfig');
      expect(result.newPath).toBe('/conf/analytics/myconfig');
    });

    it('should map /etc/blueprints/ to /libs/msm/', () => {
      const result = mapPath('/etc/blueprints/global');
      expect(result.newPath).toBe('/libs/msm/global');
    });

    it('should map /etc/workflow/models/ to /var/workflow/models/', () => {
      const result = mapPath('/etc/workflow/models/dam-update-asset');
      expect(result.newPath).toBe('/var/workflow/models/dam-update-asset');
    });

    it('should map /etc/maps/ to /conf/sling/', () => {
      const result = mapPath('/etc/maps/publish/http');
      expect(result.newPath).toBe('/conf/sling/publish/http');
    });

    it('should return original path when no mapping applies', () => {
      const result = mapPath('/content/site/en/home');
      expect(result.newPath).toBe('/content/site/en/home');
      expect(result.mapping).toBeNull();
    });

    it('should return original path for /apps/ paths', () => {
      const result = mapPath('/apps/mysite/components/hero');
      expect(result.newPath).toBe('/apps/mysite/components/hero');
      expect(result.mapping).toBeNull();
    });
  });
});
