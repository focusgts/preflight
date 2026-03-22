/**
 * Black Hole - AI Prompt Templates
 *
 * All prompt templates for Claude API calls across the migration lifecycle.
 * Each prompt is a function that accepts structured inputs and returns
 * a formatted system/user message pair.
 */

export interface PromptPair {
  system: string;
  user: string;
}

// ============================================================
// Classification Prompts (Haiku)
// ============================================================

export function CLASSIFY_MIGRATION_ITEM(input: {
  name: string;
  type: string;
  sourcePath: string;
  metadata?: Record<string, unknown>;
}): PromptPair {
  return {
    system: `You are a migration classification engine for Adobe Experience Cloud.
Given a migration item, classify it by:
1. Adobe product(s) it belongs to (aem-sites, aem-assets, aem-forms, aem-screens, aem-eds, aem-cloud-mgr, analytics, cja, target, campaign, ajo, aep, rtcdp, aam, commerce, marketo, workfront, genstudio, mix-modeler)
2. SEA category: "support" (auto-migratable), "enhance" (needs guided work), or "advise" (needs expert review)
3. Compatibility level: "compatible", "auto_fixable", "manual_fix", or "blocker"
4. Estimated effort in hours
5. Risk score from 0.0 to 1.0
6. Confidence score from 0.0 to 1.0

Respond ONLY with valid JSON matching this schema:
{
  "adobeProducts": string[],
  "seaCategory": "support" | "enhance" | "advise",
  "compatibilityLevel": "compatible" | "auto_fixable" | "manual_fix" | "blocker",
  "effortHours": number,
  "riskScore": number,
  "confidence": number,
  "tags": string[],
  "reasoning": string
}`,
    user: `Classify this migration item:
- Name: ${input.name}
- Type: ${input.type}
- Source Path: ${input.sourcePath}
${input.metadata ? `- Metadata: ${JSON.stringify(input.metadata)}` : ''}`,
  };
}

// ============================================================
// Code Analysis Prompts (Sonnet)
// ============================================================

export function ANALYZE_CODE_COMPATIBILITY(input: {
  code: string;
  filePath: string;
  language: string;
  sourceVersion: string;
  targetPlatform: string;
}): PromptPair {
  return {
    system: `You are an AEM Cloud Service migration expert. Analyze the provided code for compatibility issues when migrating from ${input.sourceVersion} to ${input.targetPlatform}.

Check for:
1. Deprecated API usage (javax.jcr, Jackrabbit, Classic UI, ExtJS)
2. Restricted APIs in Cloud Service (direct repository access, custom replication)
3. OSGi configuration issues (run-mode structure, factory configs)
4. Sling model compatibility
5. Servlet registration method (path-bound vs resource-type-bound)
6. Custom workflow step compatibility
7. Oak index definition compliance
8. Content path restrictions (/apps immutability)

For each finding, provide severity, a description, and a specific remediation guide.

Respond ONLY with valid JSON matching this schema:
{
  "findings": [{
    "line": number | null,
    "severity": "critical" | "high" | "medium" | "low" | "info",
    "compatibilityLevel": "compatible" | "auto_fixable" | "manual_fix" | "blocker",
    "title": string,
    "description": string,
    "remediationGuide": string,
    "autoFixAvailable": boolean,
    "estimatedHours": number,
    "bpaPatternCode": string | null
  }],
  "overallCompatibility": "compatible" | "auto_fixable" | "manual_fix" | "blocker",
  "summary": string
}`,
    user: `Analyze this ${input.language} file for AEM Cloud Service compatibility:

File: ${input.filePath}

\`\`\`${input.language}
${input.code}
\`\`\``,
  };
}

export function REFACTOR_OSGI_CONFIG(input: {
  xmlConfig: string;
  configPath: string;
  pid: string;
}): PromptPair {
  return {
    system: `You are an AEM Cloud Service migration tool. Convert the provided OSGi XML configuration to the modern .cfg.json format required by AEM as a Cloud Service.

Rules:
1. Convert XML properties to JSON key-value pairs
2. Preserve property types (String, Long, Boolean, String[])
3. Include the service.pid or factory PID
4. Follow AEM Cloud Service naming conventions
5. Map run-mode folders correctly (config.author, config.publish, etc.)

Respond ONLY with valid JSON:
{
  "cfgJson": object,
  "targetPath": string,
  "notes": string[]
}`,
    user: `Convert this OSGi XML config to .cfg.json:

PID: ${input.pid}
Path: ${input.configPath}

\`\`\`xml
${input.xmlConfig}
\`\`\``,
  };
}

export function REFACTOR_DEPRECATED_API(input: {
  code: string;
  filePath: string;
  language: string;
  deprecatedApi: string;
  modernAlternative: string;
}): PromptPair {
  return {
    system: `You are an AEM code modernization tool. Refactor the provided code to replace the deprecated API with its modern equivalent.

Requirements:
1. Replace ${input.deprecatedApi} with ${input.modernAlternative}
2. Preserve all existing functionality
3. Update import statements
4. Add proper error handling for the new API
5. Follow AEM Cloud Service best practices
6. Add inline comments explaining significant changes

Respond ONLY with valid JSON:
{
  "refactoredCode": string,
  "changesSummary": string[],
  "importsAdded": string[],
  "importsRemoved": string[],
  "warnings": string[]
}`,
    user: `Refactor this ${input.language} file to replace deprecated API usage:

File: ${input.filePath}
Deprecated API: ${input.deprecatedApi}
Replacement: ${input.modernAlternative}

\`\`\`${input.language}
${input.code}
\`\`\``,
  };
}

// ============================================================
// Schema Mapping Prompts (Sonnet)
// ============================================================

export function MAP_SCHEMA_FIELDS(input: {
  sourceSchema: Record<string, unknown>;
  targetSchemaType: string;
  sourceType: string;
}): PromptPair {
  return {
    system: `You are an Adobe Experience Platform schema mapping expert. Map the provided source schema fields to the target ${input.targetSchemaType} XDM schema.

Rules:
1. Map each source field to the closest XDM field group and field
2. Identify fields that require transformation (data type conversion, format changes)
3. Flag unmapped fields that have no XDM equivalent
4. Suggest custom field group definitions for unmapped fields
5. Note any data loss risks

Respond ONLY with valid JSON:
{
  "mappings": [{
    "sourceField": string,
    "sourceType": string,
    "targetField": string,
    "targetFieldGroup": string,
    "transformation": string | null,
    "confidence": number
  }],
  "unmappedFields": [{
    "sourceField": string,
    "reason": string,
    "suggestion": string
  }],
  "customFieldGroups": [{
    "name": string,
    "fields": [{ "name": string, "type": string, "description": string }]
  }],
  "warnings": string[]
}`,
    user: `Map these ${input.sourceType} fields to ${input.targetSchemaType} XDM schema:

Source Schema:
\`\`\`json
${JSON.stringify(input.sourceSchema, null, 2)}
\`\`\``,
  };
}

// ============================================================
// Content Analysis Prompts (Sonnet)
// ============================================================

export function ANALYZE_CONTENT_QUALITY(input: {
  contentSample: Array<{
    path: string;
    title: string;
    type: string;
    metadata: Record<string, unknown>;
    size?: number;
  }>;
  totalItems: number;
}): PromptPair {
  return {
    system: `You are a content health analyst for AEM migration projects. Analyze the provided content sample and assess overall content quality, identifying issues that could affect migration success.

Evaluate:
1. Metadata completeness and consistency
2. Content structure quality (nesting depth, naming conventions)
3. Potential duplicate content patterns
4. Content that may need restructuring for the target platform
5. SEO metadata presence (title, description, keywords)
6. Accessibility concerns
7. Content freshness (staleness indicators)

Respond ONLY with valid JSON:
{
  "qualityScore": number,
  "metadataScore": number,
  "structureScore": number,
  "issues": [{
    "severity": "critical" | "high" | "medium" | "low",
    "category": string,
    "description": string,
    "affectedPaths": string[],
    "recommendation": string
  }],
  "duplicateGroups": [{
    "paths": string[],
    "similarity": number,
    "recommendation": string
  }],
  "recommendations": string[]
}`,
    user: `Analyze content quality for migration (sample of ${input.contentSample.length} items from ${input.totalItems} total):

\`\`\`json
${JSON.stringify(input.contentSample, null, 2)}
\`\`\``,
  };
}

// ============================================================
// Migration Planning Prompts (Opus)
// ============================================================

export function GENERATE_MIGRATION_PLAN(input: {
  projectName: string;
  migrationType: string;
  sourceVersion: string;
  targetPlatform: string;
  itemCount: number;
  criticalFindings: number;
  contentSizeGB: number;
  integrationCount: number;
  complianceRequirements: string[];
  overallScore: number;
}): PromptPair {
  return {
    system: `You are a senior Adobe migration architect. Generate a detailed, phased migration plan based on the assessment results provided.

The plan must include:
1. Pre-migration phase (environment setup, tool installation, team onboarding)
2. Code modernization phase (prioritized by blocker severity)
3. Content migration phase (strategy based on volume and complexity)
4. Integration reconnection phase
5. Testing phase (unit, integration, UAT, performance)
6. Cutover phase (go-live checklist, rollback plan)
7. Post-migration monitoring

For each phase, specify:
- Duration in weeks
- Key activities and deliverables
- Dependencies on other phases
- Risk mitigations
- Go/no-go criteria

Respond ONLY with valid JSON:
{
  "phases": [{
    "name": string,
    "type": string,
    "durationWeeks": number,
    "startWeek": number,
    "activities": string[],
    "deliverables": string[],
    "dependencies": string[],
    "risks": string[],
    "goNoGoCriteria": string[]
  }],
  "totalWeeks": number,
  "criticalPath": string[],
  "teamRecommendation": {
    "roles": [{ "role": string, "count": number, "phase": string }],
    "totalFTE": number
  },
  "keyDecisions": string[],
  "assumptions": string[]
}`,
    user: `Generate a migration plan for:
- Project: ${input.projectName}
- Type: ${input.migrationType}
- Source: ${input.sourceVersion}
- Target: ${input.targetPlatform}
- Items: ${input.itemCount}
- Critical findings: ${input.criticalFindings}
- Content size: ${input.contentSizeGB}GB
- Integrations: ${input.integrationCount}
- Compliance: ${input.complianceRequirements.join(', ') || 'None'}
- Readiness score: ${input.overallScore}/100`,
  };
}

// ============================================================
// Risk Assessment Prompts (Sonnet)
// ============================================================

export function ASSESS_RISK(input: {
  findings: Array<{ title: string; severity: string; category: string }>;
  contentHealth: {
    totalSizeGB: number;
    brokenReferences: number;
    duplicates: number;
    metadataCompleteness: number;
  };
  integrationCount: number;
  migrationType: string;
}): PromptPair {
  return {
    system: `You are a migration risk analyst. Assess the risks of this migration based on the assessment data provided. Consider technical, operational, business, and compliance risks.

For each risk, provide:
1. Severity (critical, high, medium, low)
2. Probability (0.0-1.0)
3. Business impact description
4. Specific mitigation strategy

Respond ONLY with valid JSON:
{
  "risks": [{
    "severity": "critical" | "high" | "medium" | "low",
    "category": "code" | "content" | "integration" | "operational" | "compliance" | "business",
    "description": string,
    "probability": number,
    "impact": string,
    "mitigation": string
  }],
  "overallRiskLevel": "low" | "medium" | "high" | "critical",
  "riskScore": number,
  "topMitigations": string[]
}`,
    user: `Assess migration risks:
- Type: ${input.migrationType}
- Findings: ${input.findings.length} total (${input.findings.filter((f) => f.severity === 'critical').length} critical)
- Content: ${input.contentHealth.totalSizeGB}GB, ${input.contentHealth.brokenReferences} broken refs, ${input.contentHealth.duplicates} duplicates, ${input.contentHealth.metadataCompleteness}% metadata complete
- Integrations: ${input.integrationCount}

Finding summary:
${input.findings.map((f) => `- [${f.severity}] ${f.category}: ${f.title}`).join('\n')}`,
  };
}

// ============================================================
// Test Generation Prompts (Sonnet)
// ============================================================

export function GENERATE_TEST_CASES(input: {
  findings: Array<{ title: string; severity: string; remediationGuide: string }>;
  migrationType: string;
  targetPlatform: string;
}): PromptPair {
  return {
    system: `You are a QA engineer specializing in AEM Cloud Service migrations. Generate test cases that validate the migration was successful, based on the assessment findings.

For each finding, generate:
1. A verification test (confirm the issue was fixed)
2. A regression test (confirm nothing broke)
3. Expected outcome

Also generate integration tests and smoke tests for the overall migration.

Respond ONLY with valid JSON:
{
  "testCases": [{
    "id": string,
    "name": string,
    "category": "verification" | "regression" | "integration" | "smoke",
    "priority": "critical" | "high" | "medium" | "low",
    "relatedFinding": string | null,
    "steps": string[],
    "expectedResult": string,
    "automatable": boolean
  }],
  "testSummary": {
    "total": number,
    "automated": number,
    "manual": number,
    "estimatedHours": number
  }
}`,
    user: `Generate test cases for ${input.migrationType} migration to ${input.targetPlatform}:

Findings requiring validation:
${input.findings.map((f) => `- [${f.severity}] ${f.title}: ${f.remediationGuide}`).join('\n')}`,
  };
}
