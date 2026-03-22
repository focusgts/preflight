/**
 * Demo seed data for SQLite database.
 *
 * Mirrors the original in-memory store.ts data exactly so that
 * the dashboard looks identical on first run.
 */

import {
  MigrationStatus,
  MigrationType,
  AdobeProduct,
  ComplianceFramework,
  Severity,
  CompatibilityLevel,
  PhaseType,
} from '@/types';
import type {
  MigrationProject,
  AssessmentResult,
  ConnectorConfig,
} from '@/types';
import type { DatabaseWrapper } from './database';

const NOW = '2026-03-21T10:00:00.000Z';

export function seedDatabase(db: DatabaseWrapper): void {
  db.transaction(() => {
    seedConnectors(db);
    seedAssessmentsAndMigrations(db);
  });
}

// -----------------------------------------------------------------------
// Connectors
// -----------------------------------------------------------------------

function seedConnectors(db: DatabaseWrapper): void {
  const connectors: ConnectorConfig[] = [
    {
      id: 'conn-aem-prod',
      type: 'aem',
      name: 'AEM 6.5 Production',
      connectionDetails: {
        host: 'https://author.acmecorp.com',
        port: 4502,
        protocol: 'https',
      },
      status: 'connected',
      lastTestedAt: '2026-03-20T14:30:00.000Z',
      capabilities: ['content-read', 'package-export', 'code-scan'],
    },
    {
      id: 'conn-aem-cloud',
      type: 'aem-cloud',
      name: 'AEM Cloud Service (Target)',
      connectionDetails: {
        orgId: 'ACME@AdobeOrg',
        programId: 'p-42',
        environmentId: 'e-prod-1',
      },
      status: 'connected',
      lastTestedAt: '2026-03-20T14:32:00.000Z',
      capabilities: ['content-write', 'package-import', 'cloud-manager-api'],
    },
    {
      id: 'conn-ga4',
      type: 'google-analytics',
      name: 'Google Analytics 4',
      connectionDetails: {
        propertyId: '123456789',
        serviceAccountEmail: 'bh-reader@acme-analytics.iam.gserviceaccount.com',
      },
      status: 'connected',
      lastTestedAt: '2026-03-19T09:00:00.000Z',
      capabilities: ['report-read', 'config-read', 'audience-read'],
    },
    {
      id: 'conn-sfmc',
      type: 'salesforce-mc',
      name: 'Salesforce Marketing Cloud',
      connectionDetails: {
        subdomain: 'mc-acme',
        businessUnitId: 'BU-100',
      },
      status: 'disconnected',
      lastTestedAt: null,
      capabilities: ['email-read', 'journey-read', 'automation-read'],
    },
  ];

  for (const c of connectors) {
    db.createConnector(c);
  }
}

// -----------------------------------------------------------------------
// Assessments & Migrations
// -----------------------------------------------------------------------

function seedAssessmentsAndMigrations(db: DatabaseWrapper): void {
  const assessment1: AssessmentResult = {
    id: 'assess-001',
    migrationProjectId: 'mig-001',
    overallScore: 72,
    codeCompatibilityScore: 65,
    contentReadinessScore: 88,
    integrationComplexityScore: 55,
    configurationReadinessScore: 78,
    complianceScore: 90,
    findings: [
      {
        id: 'f-001',
        category: 'Code Compatibility',
        subCategory: 'Deprecated API Usage',
        severity: Severity.HIGH,
        compatibilityLevel: CompatibilityLevel.MANUAL_FIX,
        title: 'SlingAdaptable interface usage in 12 bundles',
        description:
          'The deprecated SlingAdaptable interface is used across 12 OSGi bundles. AEM Cloud Service requires migration to the Adaptable interface.',
        affectedPath: '/apps/acme/core/bundles',
        remediationGuide:
          'Replace org.apache.sling.api.adapter.SlingAdaptable with org.apache.sling.api.adapter.Adaptable. Update all usages of adaptTo() accordingly.',
        autoFixAvailable: true,
        estimatedHours: 8,
        bpaPatternCode: 'SLING-API-001',
      },
      {
        id: 'f-002',
        category: 'Code Compatibility',
        subCategory: 'Custom Search Index',
        severity: Severity.MEDIUM,
        compatibilityLevel: CompatibilityLevel.AUTO_FIXABLE,
        title: 'Custom Oak index definitions need migration',
        description:
          '4 custom Oak index definitions found that require conversion to Cloud Service compatible format.',
        affectedPath: '/oak:index',
        remediationGuide:
          'Use the Index Converter tool to migrate oak:index definitions to Cloud Service compatible format.',
        autoFixAvailable: true,
        estimatedHours: 4,
        bpaPatternCode: 'OAK-IDX-001',
      },
      {
        id: 'f-003',
        category: 'Content',
        subCategory: 'Broken References',
        severity: Severity.LOW,
        compatibilityLevel: CompatibilityLevel.AUTO_FIXABLE,
        title: '23 broken internal references detected',
        description:
          'Content pages reference assets or pages that no longer exist. These should be cleaned up before migration.',
        affectedPath: '/content/acme',
        remediationGuide:
          'Run the reference checker and either update or remove broken links.',
        autoFixAvailable: true,
        estimatedHours: 2,
        bpaPatternCode: null,
      },
      {
        id: 'f-004',
        category: 'Infrastructure',
        subCategory: 'Replication Agents',
        severity: Severity.CRITICAL,
        compatibilityLevel: CompatibilityLevel.BLOCKER,
        title: 'Custom replication agents will not function in Cloud Service',
        description:
          'Two custom replication agents are configured. AEM Cloud Service uses Sling Content Distribution; custom replication agents are not supported.',
        affectedPath: '/etc/replication/agents.author',
        remediationGuide:
          'Redesign content distribution strategy using Sling Content Distribution. Consider using publish queues and forward replication.',
        autoFixAvailable: false,
        estimatedHours: 24,
        bpaPatternCode: 'REPL-001',
      },
    ],
    contentHealth: {
      totalPages: 1247,
      totalAssets: 8432,
      totalContentFragments: 156,
      totalExperienceFragments: 34,
      duplicatesDetected: 89,
      brokenReferences: 23,
      metadataCompleteness: 74,
      structuralIssues: 5,
      totalSizeGB: 42.7,
      publishedPercentage: 82,
    },
    integrationMap: [
      {
        id: 'int-001',
        name: 'SAP Commerce Integration',
        type: 'api',
        sourceConfig: { endpoint: '/api/sap-commerce/v2', method: 'REST' },
        targetConfig: null,
        adobeProduct: AdobeProduct.AEM_SITES,
        authType: 'oauth2',
        dataFlow: 'bidirectional',
        criticality: Severity.HIGH,
        autoMigratable: false,
        migrationNotes:
          'Requires re-implementation using AEM Cloud Service service credentials and Adobe I/O Runtime.',
      },
      {
        id: 'int-002',
        name: 'Adobe Analytics Tag',
        type: 'sdk',
        sourceConfig: { trackingServer: 's.acmecorp.com', rsid: 'acmeprod' },
        targetConfig: { dataStreamId: 'ds-12345' },
        adobeProduct: AdobeProduct.ANALYTICS,
        authType: 'api_key',
        dataFlow: 'outbound',
        criticality: Severity.MEDIUM,
        autoMigratable: true,
        migrationNotes:
          'Migrate from AppMeasurement to Web SDK. Data stream already configured.',
      },
    ],
    riskFactors: [
      {
        id: 'risk-001',
        severity: Severity.HIGH,
        category: 'Technical',
        description: 'Custom replication agents block cloud deployment',
        probability: 0.95,
        impact: 'Migration cannot proceed until replication strategy is redesigned',
        mitigation:
          'Engage Adobe solution architect to design Sling Content Distribution strategy before migration begins.',
      },
      {
        id: 'risk-002',
        severity: Severity.MEDIUM,
        category: 'Timeline',
        description: 'SAP integration re-implementation may extend timeline',
        probability: 0.6,
        impact: 'Potential 3-week delay if SAP Commerce API changes are needed',
        mitigation:
          'Begin SAP integration analysis in parallel with code modernisation phase.',
      },
      {
        id: 'risk-003',
        severity: Severity.LOW,
        category: 'Data',
        description: 'Large DAM repository may slow content transfer',
        probability: 0.4,
        impact: 'Content migration phase could take 2x longer than estimated',
        mitigation:
          'Use incremental content transfer tool with delta sync. Archive unused assets before migration.',
      },
    ],
    estimatedTimeline: {
      totalWeeks: 14,
      phases: [
        { phase: PhaseType.ASSESSMENT, durationWeeks: 1, startWeek: 1, endWeek: 1, parallelizable: false },
        { phase: PhaseType.PLANNING, durationWeeks: 1, startWeek: 2, endWeek: 2, parallelizable: false },
        { phase: PhaseType.CODE_MODERNIZATION, durationWeeks: 4, startWeek: 3, endWeek: 6, parallelizable: true },
        { phase: PhaseType.CONTENT_MIGRATION, durationWeeks: 3, startWeek: 5, endWeek: 7, parallelizable: true },
        { phase: PhaseType.INTEGRATION_RECONNECTION, durationWeeks: 3, startWeek: 7, endWeek: 9, parallelizable: false },
        { phase: PhaseType.TESTING, durationWeeks: 3, startWeek: 10, endWeek: 12, parallelizable: false },
        { phase: PhaseType.CUTOVER, durationWeeks: 1, startWeek: 13, endWeek: 13, parallelizable: false },
        { phase: PhaseType.MONITORING, durationWeeks: 1, startWeek: 14, endWeek: 14, parallelizable: false },
      ],
      confidenceLevel: 0.78,
    },
    estimatedCost: {
      platformFee: 15000,
      estimatedSIHours: 320,
      estimatedSICost: 64000,
      totalEstimate: 79000,
      currency: 'USD',
    },
    traditionalEstimate: {
      durationWeeks: 36,
      cost: 245000,
      timeSavingsPercent: 61,
      costSavingsPercent: 68,
    },
    recommendations: [
      'Resolve custom replication agent blocker before starting code modernisation.',
      'Archive 89 duplicate assets in DAM to reduce transfer volume.',
      'Begin SAP Commerce integration analysis during assessment phase.',
      'Migrate Oak index definitions using the automated Index Converter tool.',
      'Update deprecated SlingAdaptable references using the automated code fixer.',
    ],
    createdAt: '2026-03-18T09:00:00.000Z',
  };

  const assessment2: AssessmentResult = {
    id: 'assess-002',
    migrationProjectId: 'mig-002',
    overallScore: 85,
    codeCompatibilityScore: 90,
    contentReadinessScore: 80,
    integrationComplexityScore: 82,
    configurationReadinessScore: 88,
    complianceScore: 85,
    findings: [
      {
        id: 'f-010',
        category: 'Analytics Configuration',
        subCategory: 'Custom Dimensions',
        severity: Severity.MEDIUM,
        compatibilityLevel: CompatibilityLevel.AUTO_FIXABLE,
        title: '18 custom dimensions require XDM mapping',
        description:
          'Google Analytics custom dimensions need to be mapped to Adobe XDM schema fields.',
        affectedPath: 'GA4 Property 123456789',
        remediationGuide:
          'Use the Black Hole dimension mapper to automatically create XDM field groups for each GA4 custom dimension.',
        autoFixAvailable: true,
        estimatedHours: 3,
        bpaPatternCode: null,
      },
      {
        id: 'f-011',
        category: 'Analytics Configuration',
        subCategory: 'Audiences',
        severity: Severity.LOW,
        compatibilityLevel: CompatibilityLevel.COMPATIBLE,
        title: '7 GA4 audiences map directly to CJA filters',
        description:
          'Most GA4 audiences can be recreated as CJA filters with minimal changes.',
        affectedPath: 'GA4 Audiences',
        remediationGuide: 'Review automated filter suggestions and approve.',
        autoFixAvailable: true,
        estimatedHours: 1,
        bpaPatternCode: null,
      },
    ],
    contentHealth: {
      totalPages: 0, totalAssets: 0, totalContentFragments: 0,
      totalExperienceFragments: 0, duplicatesDetected: 0,
      brokenReferences: 0, metadataCompleteness: 100,
      structuralIssues: 0, totalSizeGB: 0.8, publishedPercentage: 100,
    },
    integrationMap: [
      {
        id: 'int-010',
        name: 'BigQuery Export',
        type: 'feed',
        sourceConfig: { project: 'acme-analytics', dataset: 'ga4_events' },
        targetConfig: { connectionId: 'aep-bq-conn-01' },
        adobeProduct: AdobeProduct.CJA,
        authType: 'service_account',
        dataFlow: 'inbound',
        criticality: Severity.MEDIUM,
        autoMigratable: true,
        migrationNotes:
          'BigQuery export can be redirected to AEP via source connector.',
      },
    ],
    riskFactors: [
      {
        id: 'risk-010',
        severity: Severity.LOW,
        category: 'Data',
        description: 'Historical data backfill may take extended time',
        probability: 0.3,
        impact: '2 years of GA4 data to ingest into AEP datasets',
        mitigation: 'Use batch ingestion with parallel processing.',
      },
    ],
    estimatedTimeline: {
      totalWeeks: 6,
      phases: [
        { phase: PhaseType.ASSESSMENT, durationWeeks: 1, startWeek: 1, endWeek: 1, parallelizable: false },
        { phase: PhaseType.PLANNING, durationWeeks: 1, startWeek: 2, endWeek: 2, parallelizable: false },
        { phase: PhaseType.CONTENT_MIGRATION, durationWeeks: 2, startWeek: 3, endWeek: 4, parallelizable: true },
        { phase: PhaseType.TESTING, durationWeeks: 1, startWeek: 5, endWeek: 5, parallelizable: false },
        { phase: PhaseType.MONITORING, durationWeeks: 1, startWeek: 6, endWeek: 6, parallelizable: false },
      ],
      confidenceLevel: 0.92,
    },
    estimatedCost: {
      platformFee: 8000, estimatedSIHours: 80,
      estimatedSICost: 16000, totalEstimate: 24000, currency: 'USD',
    },
    traditionalEstimate: {
      durationWeeks: 16, cost: 72000,
      timeSavingsPercent: 63, costSavingsPercent: 67,
    },
    recommendations: [
      'Use automated XDM mapper for GA4 custom dimensions.',
      'Set up BigQuery source connector in AEP before data migration.',
      'Validate audience/filter parity with A/B comparison dashboards.',
    ],
    createdAt: '2026-03-15T11:00:00.000Z',
  };

  // --- Migrations ---

  const migrations: MigrationProject[] = [
    {
      id: 'mig-001',
      name: 'ACME Corp AEM Cloud Migration',
      organizationId: 'org-acme',
      organizationName: 'ACME Corporation',
      migrationType: MigrationType.AEM_ONPREM_TO_CLOUD,
      status: MigrationStatus.ASSESSED,
      productsInScope: [AdobeProduct.AEM_SITES, AdobeProduct.AEM_ASSETS, AdobeProduct.ANALYTICS],
      complianceRequirements: [ComplianceFramework.GDPR, ComplianceFramework.SOX],
      sourceEnvironment: {
        platform: 'aem_6x', version: '6.5.17',
        url: 'https://author.acmecorp.com', connectionType: 'api',
        credentials: null,
        metadata: { javaVersion: '11', osgiBundle: 47, customComponents: 156 },
      },
      targetEnvironment: {
        platform: 'aem_cloud', organizationId: 'ACME@AdobeOrg',
        programId: 'p-42', environmentId: 'e-prod-1',
        url: 'https://author-p42-e1.adobeaemcloud.com',
        credentials: null, metadata: { tier: 'production' },
      },
      assessment: assessment1,
      phases: [
        {
          id: 'phase-001-assess', type: PhaseType.ASSESSMENT,
          name: 'Assessment', status: MigrationStatus.COMPLETED, progress: 100,
          items: [], startedAt: '2026-03-17T08:00:00.000Z',
          completedAt: '2026-03-18T09:00:00.000Z',
          estimatedDuration: 24, actualDuration: 25,
        },
        {
          id: 'phase-001-plan', type: PhaseType.PLANNING,
          name: 'Planning', status: MigrationStatus.DRAFT, progress: 0,
          items: [], startedAt: null, completedAt: null,
          estimatedDuration: 40, actualDuration: null,
        },
      ],
      riskScore: 0.42, estimatedDurationWeeks: 14, estimatedCost: 79000,
      actualCost: null, progress: 12,
      createdAt: '2026-03-15T10:00:00.000Z', updatedAt: NOW,
      targetCompletionDate: '2026-06-30T00:00:00.000Z', completedAt: null,
    },
    {
      id: 'mig-002',
      name: 'ACME Analytics to CJA',
      organizationId: 'org-acme',
      organizationName: 'ACME Corporation',
      migrationType: MigrationType.GA_TO_CJA,
      status: MigrationStatus.TRANSFORMING,
      productsInScope: [AdobeProduct.CJA, AdobeProduct.AEP],
      complianceRequirements: [ComplianceFramework.GDPR, ComplianceFramework.CCPA],
      sourceEnvironment: {
        platform: 'ga4', version: '4', url: null, connectionType: 'api',
        credentials: null,
        metadata: { propertyId: '123456789', dataStreams: 3, customDimensions: 18 },
      },
      targetEnvironment: {
        platform: 'cja', organizationId: 'ACME@AdobeOrg',
        programId: null, environmentId: null,
        url: 'https://experience.adobe.com',
        credentials: null, metadata: { sandboxName: 'prod' },
      },
      assessment: assessment2,
      phases: [
        {
          id: 'phase-002-assess', type: PhaseType.ASSESSMENT,
          name: 'Assessment', status: MigrationStatus.COMPLETED, progress: 100,
          items: [], startedAt: '2026-03-10T08:00:00.000Z',
          completedAt: '2026-03-10T16:00:00.000Z',
          estimatedDuration: 8, actualDuration: 8,
        },
        {
          id: 'phase-002-transform', type: PhaseType.CONTENT_MIGRATION,
          name: 'Data Migration', status: MigrationStatus.TRANSFORMING, progress: 64,
          items: [
            {
              id: 'item-020', type: 'dimension-mapping',
              name: 'Custom Dimension Mapping',
              sourcePath: 'ga4://dimensions/custom',
              targetPath: 'xdm://fieldgroups/acme-analytics',
              status: 'completed', compatibilityLevel: CompatibilityLevel.AUTO_FIXABLE,
              autoFixed: true,
              validationResult: { passed: true, checks: [], score: 95 },
              error: null, processedAt: '2026-03-19T10:00:00.000Z',
            },
            {
              id: 'item-021', type: 'audience-migration',
              name: 'Audience to CJA Filter Migration',
              sourcePath: 'ga4://audiences', targetPath: 'cja://filters',
              status: 'processing', compatibilityLevel: CompatibilityLevel.COMPATIBLE,
              autoFixed: false, validationResult: null,
              error: null, processedAt: null,
            },
          ],
          startedAt: '2026-03-18T09:00:00.000Z', completedAt: null,
          estimatedDuration: 80, actualDuration: null,
        },
      ],
      riskScore: 0.18, estimatedDurationWeeks: 6, estimatedCost: 24000,
      actualCost: 11200, progress: 64,
      createdAt: '2026-03-08T14:00:00.000Z', updatedAt: NOW,
      targetCompletionDate: '2026-04-18T00:00:00.000Z', completedAt: null,
    },
    {
      id: 'mig-003',
      name: 'GlobalRetail WordPress to AEM',
      organizationId: 'org-globalretail',
      organizationName: 'GlobalRetail Inc.',
      migrationType: MigrationType.WORDPRESS_TO_AEM,
      status: MigrationStatus.COMPLETED,
      productsInScope: [AdobeProduct.AEM_SITES, AdobeProduct.AEM_ASSETS, AdobeProduct.AEM_EDS],
      complianceRequirements: [ComplianceFramework.CCPA, ComplianceFramework.PCI_DSS],
      sourceEnvironment: {
        platform: 'wordpress', version: '6.4',
        url: 'https://www.globalretail.com', connectionType: 'api',
        credentials: null, metadata: { posts: 3420, plugins: 42, theme: 'custom' },
      },
      targetEnvironment: {
        platform: 'aem_cloud', organizationId: 'GLOBALRETAIL@AdobeOrg',
        programId: 'p-88', environmentId: 'e-prod-1',
        url: 'https://author-p88-e1.adobeaemcloud.com',
        credentials: null, metadata: { tier: 'production' },
      },
      assessment: null, phases: [],
      riskScore: 0.12, estimatedDurationWeeks: 10, estimatedCost: 52000,
      actualCost: 48500, progress: 100,
      createdAt: '2025-12-01T09:00:00.000Z',
      updatedAt: '2026-02-28T17:00:00.000Z',
      targetCompletionDate: '2026-03-01T00:00:00.000Z',
      completedAt: '2026-02-28T17:00:00.000Z',
    },
    {
      id: 'mig-004',
      name: 'FinServ Campaign Classic to v8',
      organizationId: 'org-finserv',
      organizationName: 'FinServ Partners',
      migrationType: MigrationType.CAMPAIGN_CLASSIC_TO_V8,
      status: MigrationStatus.DRAFT,
      productsInScope: [AdobeProduct.CAMPAIGN, AdobeProduct.AJO],
      complianceRequirements: [
        ComplianceFramework.GDPR, ComplianceFramework.PCI_DSS, ComplianceFramework.SOX,
      ],
      sourceEnvironment: {
        platform: 'campaign_classic', version: '7.3.5', url: null,
        connectionType: 'package', credentials: null,
        metadata: { workflows: 234, deliveryTemplates: 89, schemas: 56 },
      },
      targetEnvironment: {
        platform: 'campaign_v8', organizationId: 'FINSERV@AdobeOrg',
        programId: null, environmentId: null, url: null,
        credentials: null, metadata: {},
      },
      assessment: null, phases: [],
      riskScore: 0.65, estimatedDurationWeeks: 20, estimatedCost: 135000,
      actualCost: null, progress: 0,
      createdAt: '2026-03-20T16:00:00.000Z', updatedAt: NOW,
      targetCompletionDate: null, completedAt: null,
    },
    {
      id: 'mig-005',
      name: 'MedTech AAM to RTCDP',
      organizationId: 'org-medtech',
      organizationName: 'MedTech Solutions',
      migrationType: MigrationType.AAM_TO_RTCDP,
      status: MigrationStatus.EXECUTING,
      productsInScope: [AdobeProduct.RTCDP, AdobeProduct.AEP, AdobeProduct.TARGET],
      complianceRequirements: [ComplianceFramework.HIPAA, ComplianceFramework.GDPR],
      sourceEnvironment: {
        platform: 'aam', version: 'current', url: null,
        connectionType: 'api', credentials: null,
        metadata: { traits: 450, segments: 120, destinations: 18 },
      },
      targetEnvironment: {
        platform: 'rtcdp', organizationId: 'MEDTECH@AdobeOrg',
        programId: null, environmentId: null,
        url: 'https://experience.adobe.com',
        credentials: null, metadata: { sandboxName: 'prod', edition: 'B2C' },
      },
      assessment: null,
      phases: [
        {
          id: 'phase-005-exec', type: PhaseType.CONTENT_MIGRATION,
          name: 'Segment Migration', status: MigrationStatus.EXECUTING, progress: 78,
          items: [
            {
              id: 'item-050', type: 'segment-migration',
              name: 'Trait to Schema Migration',
              sourcePath: 'aam://traits', targetPath: 'aep://schemas/profile',
              status: 'completed', compatibilityLevel: CompatibilityLevel.AUTO_FIXABLE,
              autoFixed: true,
              validationResult: { passed: true, checks: [], score: 98 },
              error: null, processedAt: '2026-03-19T14:00:00.000Z',
            },
            {
              id: 'item-051', type: 'segment-migration',
              name: 'Segment to AEP Audience Migration',
              sourcePath: 'aam://segments', targetPath: 'aep://audiences',
              status: 'processing', compatibilityLevel: CompatibilityLevel.COMPATIBLE,
              autoFixed: false, validationResult: null,
              error: null, processedAt: null,
            },
          ],
          startedAt: '2026-03-18T10:00:00.000Z', completedAt: null,
          estimatedDuration: 60, actualDuration: null,
        },
      ],
      riskScore: 0.35, estimatedDurationWeeks: 8, estimatedCost: 45000,
      actualCost: 28000, progress: 78,
      createdAt: '2026-03-01T10:00:00.000Z', updatedAt: NOW,
      targetCompletionDate: '2026-04-25T00:00:00.000Z', completedAt: null,
    },
  ];

  for (const m of migrations) {
    db.createMigration(m);
  }
}
