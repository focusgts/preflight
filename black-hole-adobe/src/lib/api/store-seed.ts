/**
 * In-Memory Seed Data (fallback)
 *
 * Used only when SQLite is unavailable and the store falls back
 * to in-memory Maps. Imports the same data from db/seed module.
 */

import type {
  MigrationProject,
  AssessmentResult,
  ConnectorConfig,
} from '@/types';
import {
  MigrationStatus,
  MigrationType,
  AdobeProduct,
  ComplianceFramework,
  Severity,
  CompatibilityLevel,
  PhaseType,
} from '@/types';

const NOW = '2026-03-21T10:00:00.000Z';

export function seedInMemory(
  migrations: Map<string, MigrationProject>,
  assessments: Map<string, AssessmentResult>,
  connectors: Map<string, ConnectorConfig>,
): void {
  // Connectors
  const demoConnectors: ConnectorConfig[] = [
    {
      id: 'conn-aem-prod', type: 'aem', name: 'AEM 6.5 Production',
      connectionDetails: { host: 'https://author.acmecorp.com', port: 4502, protocol: 'https' },
      status: 'connected', lastTestedAt: '2026-03-20T14:30:00.000Z',
      capabilities: ['content-read', 'package-export', 'code-scan'],
    },
    {
      id: 'conn-aem-cloud', type: 'aem-cloud', name: 'AEM Cloud Service (Target)',
      connectionDetails: { orgId: 'ACME@AdobeOrg', programId: 'p-42', environmentId: 'e-prod-1' },
      status: 'connected', lastTestedAt: '2026-03-20T14:32:00.000Z',
      capabilities: ['content-write', 'package-import', 'cloud-manager-api'],
    },
    {
      id: 'conn-ga4', type: 'google-analytics', name: 'Google Analytics 4',
      connectionDetails: { propertyId: '123456789', serviceAccountEmail: 'bh-reader@acme-analytics.iam.gserviceaccount.com' },
      status: 'connected', lastTestedAt: '2026-03-19T09:00:00.000Z',
      capabilities: ['report-read', 'config-read', 'audience-read'],
    },
    {
      id: 'conn-sfmc', type: 'salesforce-mc', name: 'Salesforce Marketing Cloud',
      connectionDetails: { subdomain: 'mc-acme', businessUnitId: 'BU-100' },
      status: 'disconnected', lastTestedAt: null,
      capabilities: ['email-read', 'journey-read', 'automation-read'],
    },
  ];
  demoConnectors.forEach((c) => connectors.set(c.id, c));

  // Assessment 1
  const assessment1: AssessmentResult = {
    id: 'assess-001', migrationProjectId: 'mig-001', overallScore: 72,
    codeCompatibilityScore: 65, contentReadinessScore: 88,
    integrationComplexityScore: 55, configurationReadinessScore: 78, complianceScore: 90,
    findings: [
      { id: 'f-001', category: 'Code Compatibility', subCategory: 'Deprecated API Usage', severity: Severity.HIGH, compatibilityLevel: CompatibilityLevel.MANUAL_FIX, title: 'SlingAdaptable interface usage in 12 bundles', description: 'The deprecated SlingAdaptable interface is used across 12 OSGi bundles.', affectedPath: '/apps/acme/core/bundles', remediationGuide: 'Replace SlingAdaptable with Adaptable.', autoFixAvailable: true, estimatedHours: 8, bpaPatternCode: 'SLING-API-001' },
      { id: 'f-002', category: 'Code Compatibility', subCategory: 'Custom Search Index', severity: Severity.MEDIUM, compatibilityLevel: CompatibilityLevel.AUTO_FIXABLE, title: 'Custom Oak index definitions need migration', description: '4 custom Oak index definitions found.', affectedPath: '/oak:index', remediationGuide: 'Use the Index Converter tool.', autoFixAvailable: true, estimatedHours: 4, bpaPatternCode: 'OAK-IDX-001' },
      { id: 'f-003', category: 'Content', subCategory: 'Broken References', severity: Severity.LOW, compatibilityLevel: CompatibilityLevel.AUTO_FIXABLE, title: '23 broken internal references detected', description: 'Content pages reference missing assets.', affectedPath: '/content/acme', remediationGuide: 'Run the reference checker.', autoFixAvailable: true, estimatedHours: 2, bpaPatternCode: null },
      { id: 'f-004', category: 'Infrastructure', subCategory: 'Replication Agents', severity: Severity.CRITICAL, compatibilityLevel: CompatibilityLevel.BLOCKER, title: 'Custom replication agents will not function in Cloud Service', description: 'Two custom replication agents are configured.', affectedPath: '/etc/replication/agents.author', remediationGuide: 'Redesign using Sling Content Distribution.', autoFixAvailable: false, estimatedHours: 24, bpaPatternCode: 'REPL-001' },
    ],
    contentHealth: { totalPages: 1247, totalAssets: 8432, totalContentFragments: 156, totalExperienceFragments: 34, duplicatesDetected: 89, brokenReferences: 23, metadataCompleteness: 74, structuralIssues: 5, totalSizeGB: 42.7, publishedPercentage: 82 },
    integrationMap: [], riskFactors: [],
    estimatedTimeline: { totalWeeks: 14, phases: [], confidenceLevel: 0.78 },
    estimatedCost: { platformFee: 15000, estimatedSIHours: 320, estimatedSICost: 64000, totalEstimate: 79000, currency: 'USD' },
    traditionalEstimate: { durationWeeks: 36, cost: 245000, timeSavingsPercent: 61, costSavingsPercent: 68 },
    recommendations: ['Resolve custom replication agent blocker.'],
    createdAt: '2026-03-18T09:00:00.000Z',
  };
  assessments.set(assessment1.id, assessment1);

  // Assessment 2
  const assessment2: AssessmentResult = {
    id: 'assess-002', migrationProjectId: 'mig-002', overallScore: 85,
    codeCompatibilityScore: 90, contentReadinessScore: 80,
    integrationComplexityScore: 82, configurationReadinessScore: 88, complianceScore: 85,
    findings: [
      { id: 'f-010', category: 'Analytics Configuration', subCategory: 'Custom Dimensions', severity: Severity.MEDIUM, compatibilityLevel: CompatibilityLevel.AUTO_FIXABLE, title: '18 custom dimensions require XDM mapping', description: 'GA4 custom dimensions need XDM mapping.', affectedPath: 'GA4 Property 123456789', remediationGuide: 'Use the dimension mapper.', autoFixAvailable: true, estimatedHours: 3, bpaPatternCode: null },
    ],
    contentHealth: { totalPages: 0, totalAssets: 0, totalContentFragments: 0, totalExperienceFragments: 0, duplicatesDetected: 0, brokenReferences: 0, metadataCompleteness: 100, structuralIssues: 0, totalSizeGB: 0.8, publishedPercentage: 100 },
    integrationMap: [], riskFactors: [],
    estimatedTimeline: { totalWeeks: 6, phases: [], confidenceLevel: 0.92 },
    estimatedCost: { platformFee: 8000, estimatedSIHours: 80, estimatedSICost: 16000, totalEstimate: 24000, currency: 'USD' },
    traditionalEstimate: { durationWeeks: 16, cost: 72000, timeSavingsPercent: 63, costSavingsPercent: 67 },
    recommendations: ['Use automated XDM mapper.'],
    createdAt: '2026-03-15T11:00:00.000Z',
  };
  assessments.set(assessment2.id, assessment2);

  // Migrations (abbreviated for fallback - same IDs)
  const demoMigrations: MigrationProject[] = [
    {
      id: 'mig-001', name: 'ACME Corp AEM Cloud Migration',
      organizationId: 'org-acme', organizationName: 'ACME Corporation',
      migrationType: MigrationType.AEM_ONPREM_TO_CLOUD, status: MigrationStatus.ASSESSED,
      productsInScope: [AdobeProduct.AEM_SITES, AdobeProduct.AEM_ASSETS, AdobeProduct.ANALYTICS],
      complianceRequirements: [ComplianceFramework.GDPR, ComplianceFramework.SOX],
      sourceEnvironment: { platform: 'aem_6x', version: '6.5.17', url: 'https://author.acmecorp.com', connectionType: 'api', credentials: null, metadata: {} },
      targetEnvironment: { platform: 'aem_cloud', organizationId: 'ACME@AdobeOrg', programId: 'p-42', environmentId: 'e-prod-1', url: 'https://author-p42-e1.adobeaemcloud.com', credentials: null, metadata: {} },
      assessment: assessment1, phases: [], riskScore: 0.42, estimatedDurationWeeks: 14,
      estimatedCost: 79000, actualCost: null, progress: 12,
      createdAt: '2026-03-15T10:00:00.000Z', updatedAt: NOW,
      targetCompletionDate: '2026-06-30T00:00:00.000Z', completedAt: null,
    },
    {
      id: 'mig-002', name: 'ACME Analytics to CJA',
      organizationId: 'org-acme', organizationName: 'ACME Corporation',
      migrationType: MigrationType.GA_TO_CJA, status: MigrationStatus.TRANSFORMING,
      productsInScope: [AdobeProduct.CJA, AdobeProduct.AEP],
      complianceRequirements: [ComplianceFramework.GDPR, ComplianceFramework.CCPA],
      sourceEnvironment: { platform: 'ga4', version: '4', url: null, connectionType: 'api', credentials: null, metadata: {} },
      targetEnvironment: { platform: 'cja', organizationId: 'ACME@AdobeOrg', programId: null, environmentId: null, url: 'https://experience.adobe.com', credentials: null, metadata: {} },
      assessment: assessment2, phases: [], riskScore: 0.18, estimatedDurationWeeks: 6,
      estimatedCost: 24000, actualCost: 11200, progress: 64,
      createdAt: '2026-03-08T14:00:00.000Z', updatedAt: NOW,
      targetCompletionDate: '2026-04-18T00:00:00.000Z', completedAt: null,
    },
    {
      id: 'mig-003', name: 'GlobalRetail WordPress to AEM',
      organizationId: 'org-globalretail', organizationName: 'GlobalRetail Inc.',
      migrationType: MigrationType.WORDPRESS_TO_AEM, status: MigrationStatus.COMPLETED,
      productsInScope: [AdobeProduct.AEM_SITES, AdobeProduct.AEM_ASSETS, AdobeProduct.AEM_EDS],
      complianceRequirements: [ComplianceFramework.CCPA, ComplianceFramework.PCI_DSS],
      sourceEnvironment: { platform: 'wordpress', version: '6.4', url: 'https://www.globalretail.com', connectionType: 'api', credentials: null, metadata: {} },
      targetEnvironment: { platform: 'aem_cloud', organizationId: 'GLOBALRETAIL@AdobeOrg', programId: 'p-88', environmentId: 'e-prod-1', url: null, credentials: null, metadata: {} },
      assessment: null, phases: [], riskScore: 0.12, estimatedDurationWeeks: 10,
      estimatedCost: 52000, actualCost: 48500, progress: 100,
      createdAt: '2025-12-01T09:00:00.000Z', updatedAt: '2026-02-28T17:00:00.000Z',
      targetCompletionDate: '2026-03-01T00:00:00.000Z', completedAt: '2026-02-28T17:00:00.000Z',
    },
    {
      id: 'mig-004', name: 'FinServ Campaign Classic to v8',
      organizationId: 'org-finserv', organizationName: 'FinServ Partners',
      migrationType: MigrationType.CAMPAIGN_CLASSIC_TO_V8, status: MigrationStatus.DRAFT,
      productsInScope: [AdobeProduct.CAMPAIGN, AdobeProduct.AJO],
      complianceRequirements: [ComplianceFramework.GDPR, ComplianceFramework.PCI_DSS, ComplianceFramework.SOX],
      sourceEnvironment: { platform: 'campaign_classic', version: '7.3.5', url: null, connectionType: 'package', credentials: null, metadata: {} },
      targetEnvironment: { platform: 'campaign_v8', organizationId: 'FINSERV@AdobeOrg', programId: null, environmentId: null, url: null, credentials: null, metadata: {} },
      assessment: null, phases: [], riskScore: 0.65, estimatedDurationWeeks: 20,
      estimatedCost: 135000, actualCost: null, progress: 0,
      createdAt: '2026-03-20T16:00:00.000Z', updatedAt: NOW,
      targetCompletionDate: null, completedAt: null,
    },
    {
      id: 'mig-005', name: 'MedTech AAM to RTCDP',
      organizationId: 'org-medtech', organizationName: 'MedTech Solutions',
      migrationType: MigrationType.AAM_TO_RTCDP, status: MigrationStatus.EXECUTING,
      productsInScope: [AdobeProduct.RTCDP, AdobeProduct.AEP, AdobeProduct.TARGET],
      complianceRequirements: [ComplianceFramework.HIPAA, ComplianceFramework.GDPR],
      sourceEnvironment: { platform: 'aam', version: 'current', url: null, connectionType: 'api', credentials: null, metadata: {} },
      targetEnvironment: { platform: 'rtcdp', organizationId: 'MEDTECH@AdobeOrg', programId: null, environmentId: null, url: 'https://experience.adobe.com', credentials: null, metadata: {} },
      assessment: null, phases: [], riskScore: 0.35, estimatedDurationWeeks: 8,
      estimatedCost: 45000, actualCost: 28000, progress: 78,
      createdAt: '2026-03-01T10:00:00.000Z', updatedAt: NOW,
      targetCompletionDate: '2026-04-25T00:00:00.000Z', completedAt: null,
    },
  ];
  demoMigrations.forEach((m) => migrations.set(m.id, m));
}
