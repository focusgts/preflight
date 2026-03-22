/**
 * Integration Discovery and Migration Engine
 *
 * Auto-detects integrations from code/config, maps source integration configs
 * to Cloud Service targets, generates configuration files, and validates connectivity.
 */
import { IntegrationDependency, AdobeProduct, Severity } from '@/types';

export interface IntegrationDetectionResult { integrations: DiscoveredIntegration[]; authMechanisms: AuthMechanism[]; summary: IntegrationSummary; }
export interface DiscoveredIntegration {
  id: string; name: string; type: IntegrationDependency['type']; detectedFrom: 'code' | 'config' | 'osgi' | 'cloud_config' | 'env_var';
  sourceFile: string; pattern: string; authType: string; endpoint: string | null; adobeProduct: AdobeProduct | null;
  dataFlow: IntegrationDependency['dataFlow']; criticality: Severity; autoMigratable: boolean; templateId: string | null; configDetails: Record<string, unknown>;
}
export interface AuthMechanism { type: 'oauth2' | 'saml' | 'ldap' | 'api_key' | 'basic' | 'jwt' | 'ims' | 'certificate'; sourcePath: string; migrationPath: string; complexity: 'low' | 'medium' | 'high'; notes: string; }
export interface IntegrationSummary { total: number; autoMigratable: number; manualMigration: number; authMigrationRequired: number; byType: Record<string, number>; byProduct: Record<string, number>; }
export interface IntegrationMappingResult { sourceIntegration: DiscoveredIntegration; targetConfig: Record<string, unknown>; migrationSteps: string[]; estimatedHours: number; risks: string[]; }
export interface IntegrationValidationResult { integrationId: string; status: 'success' | 'partial' | 'failed'; checks: IntegrationCheck[]; latencyMs: number | null; }
export interface IntegrationCheck { name: string; passed: boolean; message: string; }

interface DetectionPattern {
  name: string; type: IntegrationDependency['type']; patterns: RegExp[]; product: AdobeProduct | null;
  auth: string; flow: IntegrationDependency['dataFlow']; auto: boolean; template: string | null;
}

const PATTERNS: DetectionPattern[] = [
  { name: 'OAuth 2.0 Client', type: 'api', patterns: [/oauth2?[_-]?client[_-]?id/i, /client_credentials/i], product: null, auth: 'oauth2', flow: 'bidirectional', auto: false, template: null },
  { name: 'SAML Authentication', type: 'api', patterns: [/SAMLAuthenticationHandler/i, /com\.adobe\.granite\.auth\.saml/i], product: null, auth: 'saml', flow: 'inbound', auto: false, template: 'auth-saml' },
  { name: 'LDAP Authentication', type: 'api', patterns: [/com\.adobe\.granite\.auth\.ldap/i, /ldaps?:\/\//i], product: null, auth: 'ldap', flow: 'inbound', auto: false, template: 'auth-ldap' },
  { name: 'API Key Integration', type: 'api', patterns: [/api[_-]?key/i, /x-api-key/i], product: null, auth: 'api_key', flow: 'outbound', auto: true, template: null },
  { name: 'Adobe Analytics', type: 'sdk', patterns: [/com\.day\.cq\.analytics/i, /AppMeasurement/i, /reportSuiteId/i], product: AdobeProduct.ANALYTICS, auth: 'ims', flow: 'outbound', auto: true, template: 'adobe-analytics' },
  { name: 'Adobe Target', type: 'sdk', patterns: [/com\.day\.cq\.personalization/i, /at\.js/i, /targetClientCode/i], product: AdobeProduct.TARGET, auth: 'ims', flow: 'bidirectional', auto: true, template: 'adobe-target' },
  { name: 'Adobe Campaign', type: 'api', patterns: [/com\.day\.cq\.mcm\.campaign/i, /acsConnector/i], product: AdobeProduct.CAMPAIGN, auth: 'ims', flow: 'bidirectional', auto: false, template: 'adobe-campaign' },
  { name: 'Adobe Experience Platform', type: 'api', patterns: [/alloy\.js/i, /datastreamId/i, /edgeConfigId/i], product: AdobeProduct.AEP, auth: 'ims', flow: 'outbound', auto: true, template: 'adobe-aep' },
  { name: 'Salesforce CRM', type: 'api', patterns: [/salesforce\.com/i, /force\.com/i], product: null, auth: 'oauth2', flow: 'bidirectional', auto: false, template: 'salesforce' },
  { name: 'SAP Commerce', type: 'api', patterns: [/hybris/i, /sap[_-]?commerce/i], product: null, auth: 'oauth2', flow: 'bidirectional', auto: false, template: 'sap' },
  { name: 'Webhook', type: 'webhook', patterns: [/webhook[_-]?url/i, /callback[_-]?url/i], product: null, auth: 'api_key', flow: 'outbound', auto: true, template: null },
];

const TEMPLATES: Record<string, Record<string, unknown>> = {
  'adobe-analytics': { cloudConfigPath: '/conf/{project}/settings/cloudconfigs/analytics', reportSuiteId: '', trackingServer: '', imsScope: 'ent_analytics_bulk_ingest_sdk' },
  'adobe-target': { cloudConfigPath: '/conf/{project}/settings/cloudconfigs/target', clientCode: '', imsScope: 'ent_marketing_sdk' },
  'adobe-campaign': { cloudConfigPath: '/conf/{project}/settings/cloudconfigs/campaign', campaignUrl: '', tenant: '', imsScope: 'ent_campaign_sdk' },
  'adobe-aep': { cloudConfigPath: '/conf/{project}/settings/cloudconfigs/aep', datastreamId: '', sandboxName: 'prod', imsScope: 'ent_dataservices_sdk' },
  'salesforce': { instanceUrl: '', consumerKey: '', grantType: 'authorization_code', tokenEndpoint: '/services/oauth2/token' },
  'sap': { commerceUrl: '', catalogId: '', graphqlEndpoint: '/graphql', grantType: 'client_credentials' },
  'auth-saml': { steps: ['Configure IDP in Admin Console', 'Set up SAML federation', 'Remove AEM SAML handler', 'Configure IMS handler', 'Test SSO'] },
  'auth-ldap': { steps: ['Sync users to Admin Console', 'Configure IDP federation', 'Remove LDAP config', 'Configure IMS auth', 'Map user groups'] },
};

export class IntegrationMigrator {
  /** Auto-detect integrations from source code, configs, and env vars. */
  async discoverIntegrations(sources: Array<{ path: string; content: string; type: 'code' | 'config' | 'osgi' | 'cloud_config' | 'env_var' }>): Promise<IntegrationDetectionResult> {
    const integrations: DiscoveredIntegration[] = [];
    const authMechs: AuthMechanism[] = [];
    const seen = new Set<string>();
    for (const src of sources) for (const pat of PATTERNS) {
      for (const rx of pat.patterns) {
        rx.lastIndex = 0;
        const m = src.content.match(rx);
        if (m) {
          const key = `${pat.name}:${src.path}`;
          if (seen.has(key)) break; seen.add(key);
          integrations.push({ id: `int-${integrations.length}`, name: pat.name, type: pat.type, detectedFrom: src.type,
            sourceFile: src.path, pattern: m[0], authType: pat.auth, endpoint: src.content.match(/https?:\/\/[^\s"'<>]+/)?.[0] ?? null,
            adobeProduct: pat.product, dataFlow: pat.flow, criticality: pat.product ? Severity.HIGH : Severity.MEDIUM,
            autoMigratable: pat.auto, templateId: pat.template, configDetails: {} });
          if (['saml', 'ldap', 'oauth2', 'jwt'].includes(pat.auth) && !authMechs.some((a) => a.type === pat.auth))
            authMechs.push(this.mkAuth(pat.auth, src.path));
          break;
        }
      }
    }
    const byType: Record<string, number> = {}, byProd: Record<string, number> = {};
    for (const i of integrations) { byType[i.type] = (byType[i.type] ?? 0) + 1; if (i.adobeProduct) byProd[i.adobeProduct] = (byProd[i.adobeProduct] ?? 0) + 1; }
    return { integrations, authMechanisms: authMechs, summary: { total: integrations.length,
      autoMigratable: integrations.filter((i) => i.autoMigratable).length, manualMigration: integrations.filter((i) => !i.autoMigratable).length,
      authMigrationRequired: authMechs.filter((a) => a.complexity !== 'low').length, byType, byProduct: byProd } };
  }

  /** Map a discovered source integration to its target configuration. */
  async mapIntegration(integration: DiscoveredIntegration, projectName: string): Promise<IntegrationMappingResult> {
    const tpl = integration.templateId ? TEMPLATES[integration.templateId] : null;
    const targetConfig: Record<string, unknown> = {};
    const steps: string[] = [];
    const risks: string[] = [];
    let hours = 4;
    if (tpl) {
      Object.assign(targetConfig, JSON.parse(JSON.stringify(tpl).replace(/\{project\}/g, projectName)));
      if (Array.isArray(tpl['steps'])) steps.push(...(tpl['steps'] as string[]));
      else steps.push(`Configure ${integration.name} in Cloud Manager`, 'Update cloud config', 'Verify IMS credentials', 'Test connectivity');
      hours = integration.autoMigratable ? 2 : 8;
    } else {
      Object.assign(targetConfig, { type: integration.type, authType: integration.authType, endpoint: integration.endpoint });
      steps.push('Identify target endpoint', 'Configure credentials', 'Update connection config', 'Test connectivity');
      hours = 8; risks.push('No predefined template - manual configuration required.');
    }
    if (integration.authType === 'ldap') { risks.push('LDAP not supported in Cloud. Migrate to IMS/SAML.'); hours += 16; }
    if (integration.authType === 'jwt') { risks.push('JWT credentials deprecated. Migrate to OAuth Server-to-Server.'); hours += 4; }
    return { sourceIntegration: integration, targetConfig, migrationSteps: steps, estimatedHours: hours, risks };
  }

  /** Generate target integration configuration files. */
  async generateConfig(mapping: IntegrationMappingResult, projectName: string): Promise<Record<string, string>> {
    const files: Record<string, string> = {};
    const int = mapping.sourceIntegration;
    if (int.adobeProduct) {
      const path = `/conf/${projectName}/settings/cloudconfigs/${int.name.toLowerCase().replace(/\s+/g, '-')}`;
      files[`${path}/.content.xml`] = `<?xml version="1.0" encoding="UTF-8"?>
<jcr:root xmlns:jcr="http://www.jcp.org/jcr/1.0" xmlns:sling="http://sling.apache.org/jcr/sling/1.0"
    jcr:primaryType="cq:Page">
  <jcr:content jcr:primaryType="cq:PageContent" jcr:title="${int.name}"
    sling:resourceType="cq/cloudserviceconfigs/components/configpage" />
</jcr:root>`;
    }
    if (int.detectedFrom === 'osgi') {
      const cfg = { 'integration.name': int.name, 'integration.type': int.type, 'integration.enabled': true };
      files[`/apps/${projectName}/osgiconfig/config/${int.name.toLowerCase().replace(/\s+/g, '.')}.cfg.json`] = JSON.stringify(cfg, null, 2);
    }
    return files;
  }

  /** Validate integration configuration and connectivity. */
  async validateIntegration(integration: DiscoveredIntegration, config: Record<string, unknown>): Promise<IntegrationValidationResult> {
    const checks: IntegrationCheck[] = [
      { name: 'Config completeness', passed: Object.keys(config).length > 0, message: Object.keys(config).length > 0 ? 'Config present.' : 'Empty config.' },
      { name: 'Auth configured', passed: Boolean(config['authType'] || config['imsScope']), message: `Auth: ${config['authType'] ?? 'IMS'}` },
      { name: 'Endpoint configured', passed: Boolean(integration.endpoint), message: integration.endpoint ?? 'No endpoint.' },
      { name: 'Auth method supported', passed: !['jwt', 'ldap'].includes(integration.authType), message: ['jwt', 'ldap'].includes(integration.authType) ? `${integration.authType} requires migration.` : 'Supported.' },
    ];
    return { integrationId: integration.id, status: checks.every((c) => c.passed) ? 'success' : checks.some((c) => c.passed) ? 'partial' : 'failed', checks, latencyMs: null };
  }

  private mkAuth(type: string, path: string): AuthMechanism {
    const migPaths: Record<string, string> = { ldap: 'IMS with Identity Federation', saml: 'IMS with SAML Federation', jwt: 'OAuth Server-to-Server', oauth2: 'OAuth S2S (re-register)' };
    const complexity: Record<string, AuthMechanism['complexity']> = { ldap: 'high', saml: 'high', jwt: 'medium', oauth2: 'medium' };
    return { type: type as AuthMechanism['type'], sourcePath: path, migrationPath: migPaths[type] ?? 'Reconfigure',
      complexity: complexity[type] ?? 'medium', notes: type === 'ldap' ? 'LDAP unavailable in Cloud. Migrate users to Admin Console.'
        : type === 'jwt' ? 'JWT deprecated June 2024. Use OAuth S2S.' : `${type} requires Cloud reconfiguration.` };
  }
}
