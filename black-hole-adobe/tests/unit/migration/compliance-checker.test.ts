/**
 * Tests for ComplianceChecker
 *
 * Tests PII detection, PHI detection, GDPR/CCPA compliance checks,
 * consent migration validation, data residency checks, and
 * compliance report generation.
 */

import { describe, it, expect } from 'vitest';
import { ComplianceFramework, Severity } from '@/types';

// ---- ComplianceChecker implementation ----

interface PIIMatch {
  type: string;
  field: string;
  pattern: string;
  severity: Severity;
  recommendation: string;
}

interface ComplianceCheck {
  framework: ComplianceFramework;
  passed: boolean;
  findings: ComplianceFinding[];
  score: number;
}

interface ComplianceFinding {
  rule: string;
  passed: boolean;
  severity: Severity;
  description: string;
  remediation: string;
}

interface ComplianceReport {
  overallScore: number;
  piiFindings: PIIMatch[];
  phiFindings: PIIMatch[];
  frameworkChecks: ComplianceCheck[];
  consentMigration: { valid: boolean; issues: string[] };
  dataResidency: { compliant: boolean; issues: string[] };
}

const PII_PATTERNS: Array<{ type: string; regex: RegExp; severity: Severity; recommendation: string }> = [
  { type: 'email', regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, severity: Severity.HIGH, recommendation: 'Hash or encrypt email addresses before migration' },
  { type: 'phone', regex: /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, severity: Severity.HIGH, recommendation: 'Mask phone numbers in non-production environments' },
  { type: 'ssn', regex: /\b\d{3}-\d{2}-\d{4}\b/g, severity: Severity.CRITICAL, recommendation: 'SSNs must NOT be migrated - remove or tokenize' },
  { type: 'credit_card', regex: /\b(?:4\d{12}(?:\d{3})?|5[1-5]\d{14}|3[47]\d{13}|6(?:011|5\d{2})\d{12})\b/g, severity: Severity.CRITICAL, recommendation: 'Credit card numbers must be tokenized via PCI-compliant vault' },
  { type: 'ip_address', regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, severity: Severity.MEDIUM, recommendation: 'Anonymize or hash IP addresses' },
  { type: 'date_of_birth', regex: /\b(?:dob|date.?of.?birth|birthdate|birth.?date)\b/i, severity: Severity.HIGH, recommendation: 'Encrypt date of birth fields' },
];

const PHI_PATTERNS: Array<{ type: string; regex: RegExp; severity: Severity; recommendation: string }> = [
  { type: 'medical_record', regex: /\b(?:mrn|medical.?record|patient.?id|health.?id)\b/i, severity: Severity.CRITICAL, recommendation: 'Medical records require HIPAA-compliant handling' },
  { type: 'diagnosis', regex: /\b(?:icd-?\d{1,2}|diagnosis|dx|condition)\b/i, severity: Severity.CRITICAL, recommendation: 'Diagnostic codes require PHI protection' },
  { type: 'prescription', regex: /\b(?:prescription|rx|medication|drug.?name)\b/i, severity: Severity.HIGH, recommendation: 'Prescription data must be encrypted in transit and at rest' },
  { type: 'insurance', regex: /\b(?:insurance.?id|policy.?number|group.?number|member.?id)\b/i, severity: Severity.HIGH, recommendation: 'Insurance identifiers require HIPAA safeguards' },
];

function detectPII(content: string, fieldName: string = ''): PIIMatch[] {
  const matches: PIIMatch[] = [];
  const searchText = `${fieldName} ${content}`;

  for (const pattern of PII_PATTERNS) {
    pattern.regex.lastIndex = 0;
    if (pattern.regex.test(searchText)) {
      matches.push({
        type: pattern.type,
        field: fieldName,
        pattern: pattern.regex.source,
        severity: pattern.severity,
        recommendation: pattern.recommendation,
      });
    }
  }

  return matches;
}

function detectPHI(content: string, fieldName: string = ''): PIIMatch[] {
  const matches: PIIMatch[] = [];
  const searchText = `${fieldName} ${content}`;

  for (const pattern of PHI_PATTERNS) {
    pattern.regex.lastIndex = 0;
    if (pattern.regex.test(searchText)) {
      matches.push({
        type: pattern.type,
        field: fieldName,
        pattern: pattern.regex.source,
        severity: pattern.severity,
        recommendation: pattern.recommendation,
      });
    }
  }

  return matches;
}

function checkGDPR(
  hasConsentMechanism: boolean,
  hasDataDeletion: boolean,
  hasDataExport: boolean,
  hasPrivacyPolicy: boolean,
  dataProcessingAgreement: boolean,
): ComplianceCheck {
  const findings: ComplianceFinding[] = [
    {
      rule: 'Consent Mechanism',
      passed: hasConsentMechanism,
      severity: Severity.CRITICAL,
      description: 'GDPR Article 7: Valid consent must be obtained',
      remediation: 'Implement consent management platform (CMP) integration',
    },
    {
      rule: 'Right to Erasure',
      passed: hasDataDeletion,
      severity: Severity.CRITICAL,
      description: 'GDPR Article 17: Right to be forgotten',
      remediation: 'Implement data deletion API in target platform',
    },
    {
      rule: 'Data Portability',
      passed: hasDataExport,
      severity: Severity.HIGH,
      description: 'GDPR Article 20: Right to data portability',
      remediation: 'Implement data export functionality',
    },
    {
      rule: 'Privacy Policy',
      passed: hasPrivacyPolicy,
      severity: Severity.HIGH,
      description: 'GDPR Articles 13-14: Transparency requirements',
      remediation: 'Update privacy policy to reflect new data processing',
    },
    {
      rule: 'Data Processing Agreement',
      passed: dataProcessingAgreement,
      severity: Severity.CRITICAL,
      description: 'GDPR Article 28: DPA with processors',
      remediation: 'Execute DPA with Adobe as data processor',
    },
  ];

  const passed = findings.every((f) => f.passed);
  const score = Math.round((findings.filter((f) => f.passed).length / findings.length) * 100);

  return {
    framework: ComplianceFramework.GDPR,
    passed,
    findings,
    score,
  };
}

function checkCCPA(
  hasOptOut: boolean,
  hasDisclosure: boolean,
  hasNonDiscrimination: boolean,
  hasDataInventory: boolean,
): ComplianceCheck {
  const findings: ComplianceFinding[] = [
    {
      rule: 'Right to Opt-Out',
      passed: hasOptOut,
      severity: Severity.CRITICAL,
      description: 'CCPA Section 1798.120: Right to opt-out of sale',
      remediation: 'Implement "Do Not Sell My Personal Information" link',
    },
    {
      rule: 'Disclosure at Collection',
      passed: hasDisclosure,
      severity: Severity.HIGH,
      description: 'CCPA Section 1798.100: Right to know',
      remediation: 'Provide notice at collection about categories of PI',
    },
    {
      rule: 'Non-Discrimination',
      passed: hasNonDiscrimination,
      severity: Severity.MEDIUM,
      description: 'CCPA Section 1798.125: Non-discrimination',
      remediation: 'Ensure equal service for opt-out consumers',
    },
    {
      rule: 'Data Inventory',
      passed: hasDataInventory,
      severity: Severity.HIGH,
      description: 'CCPA requires complete data inventory',
      remediation: 'Catalog all personal information categories in scope',
    },
  ];

  const passed = findings.every((f) => f.passed);
  const score = Math.round((findings.filter((f) => f.passed).length / findings.length) * 100);

  return {
    framework: ComplianceFramework.CCPA,
    passed,
    findings,
    score,
  };
}

function validateConsentMigration(
  consentRecords: Array<{ userId: string; consent: boolean; timestamp: string }>,
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  if (consentRecords.length === 0) {
    issues.push('No consent records found - consent must be re-collected');
  }

  for (const record of consentRecords) {
    if (!record.userId) {
      issues.push('Consent record missing userId');
    }
    if (record.consent === undefined || record.consent === null) {
      issues.push(`Consent status undefined for user ${record.userId}`);
    }
    if (!record.timestamp) {
      issues.push(`Missing timestamp for user ${record.userId} consent`);
    }
    const ts = new Date(record.timestamp);
    if (isNaN(ts.getTime())) {
      issues.push(`Invalid timestamp for user ${record.userId}`);
    }
  }

  return { valid: issues.length === 0, issues };
}

function checkDataResidency(
  sourceRegion: string,
  targetRegion: string,
  allowedRegions: string[],
): { compliant: boolean; issues: string[] } {
  const issues: string[] = [];

  if (!allowedRegions.includes(targetRegion)) {
    issues.push(`Target region "${targetRegion}" not in allowed regions: ${allowedRegions.join(', ')}`);
  }

  if (sourceRegion !== targetRegion) {
    issues.push(`Cross-region transfer detected: ${sourceRegion} -> ${targetRegion}. Ensure adequate safeguards.`);
  }

  return { compliant: issues.length === 0, issues };
}

function generateComplianceReport(
  contentSamples: Array<{ content: string; fieldName: string }>,
  frameworks: ComplianceFramework[],
  gdprParams: { consent: boolean; deletion: boolean; export: boolean; privacy: boolean; dpa: boolean },
  ccpaParams: { optOut: boolean; disclosure: boolean; nonDiscrimination: boolean; inventory: boolean },
  consentRecords: Array<{ userId: string; consent: boolean; timestamp: string }>,
  residency: { source: string; target: string; allowed: string[] },
): ComplianceReport {
  const piiFindings: PIIMatch[] = [];
  const phiFindings: PIIMatch[] = [];

  for (const sample of contentSamples) {
    piiFindings.push(...detectPII(sample.content, sample.fieldName));
    phiFindings.push(...detectPHI(sample.content, sample.fieldName));
  }

  const frameworkChecks: ComplianceCheck[] = [];
  if (frameworks.includes(ComplianceFramework.GDPR)) {
    frameworkChecks.push(checkGDPR(gdprParams.consent, gdprParams.deletion, gdprParams.export, gdprParams.privacy, gdprParams.dpa));
  }
  if (frameworks.includes(ComplianceFramework.CCPA)) {
    frameworkChecks.push(checkCCPA(ccpaParams.optOut, ccpaParams.disclosure, ccpaParams.nonDiscrimination, ccpaParams.inventory));
  }

  const consentMigration = validateConsentMigration(consentRecords);
  const dataResidency = checkDataResidency(residency.source, residency.target, residency.allowed);

  const frameworkScore = frameworkChecks.length > 0
    ? Math.round(frameworkChecks.reduce((s, c) => s + c.score, 0) / frameworkChecks.length)
    : 100;
  const piiPenalty = Math.min(30, piiFindings.length * 5);
  const phiPenalty = Math.min(30, phiFindings.length * 10);
  const consentPenalty = consentMigration.valid ? 0 : 15;
  const residencyPenalty = dataResidency.compliant ? 0 : 10;

  const overallScore = Math.max(0, frameworkScore - piiPenalty - phiPenalty - consentPenalty - residencyPenalty);

  return {
    overallScore,
    piiFindings,
    phiFindings,
    frameworkChecks,
    consentMigration,
    dataResidency,
  };
}

// ============================================================
// Tests
// ============================================================

describe('ComplianceChecker', () => {

  // ----------------------------------------------------------
  // PII Detection
  // ----------------------------------------------------------

  describe('PII detection', () => {
    it('should detect email addresses', () => {
      const matches = detectPII('Contact us at john.doe@example.com for info');
      expect(matches.some((m) => m.type === 'email')).toBe(true);
      expect(matches.find((m) => m.type === 'email')?.severity).toBe(Severity.HIGH);
    });

    it('should detect phone numbers', () => {
      const matches = detectPII('Call us at (555) 123-4567');
      expect(matches.some((m) => m.type === 'phone')).toBe(true);
    });

    it('should detect SSN patterns', () => {
      const matches = detectPII('SSN: 123-45-6789');
      expect(matches.some((m) => m.type === 'ssn')).toBe(true);
      expect(matches.find((m) => m.type === 'ssn')?.severity).toBe(Severity.CRITICAL);
    });

    it('should detect credit card numbers (Visa)', () => {
      const matches = detectPII('Card: 4111111111111111');
      expect(matches.some((m) => m.type === 'credit_card')).toBe(true);
      expect(matches.find((m) => m.type === 'credit_card')?.severity).toBe(Severity.CRITICAL);
    });

    it('should detect credit card numbers (Mastercard)', () => {
      const matches = detectPII('Card: 5500000000000004');
      expect(matches.some((m) => m.type === 'credit_card')).toBe(true);
    });

    it('should detect credit card numbers (Amex)', () => {
      const matches = detectPII('Card: 340000000000009');
      expect(matches.some((m) => m.type === 'credit_card')).toBe(true);
    });

    it('should detect IP addresses', () => {
      const matches = detectPII('Server IP: 192.168.1.100');
      expect(matches.some((m) => m.type === 'ip_address')).toBe(true);
      expect(matches.find((m) => m.type === 'ip_address')?.severity).toBe(Severity.MEDIUM);
    });

    it('should detect date of birth field names', () => {
      const matches = detectPII('', 'dateOfBirth');
      expect(matches.some((m) => m.type === 'date_of_birth')).toBe(true);
    });

    it('should return empty for clean content', () => {
      const matches = detectPII('This is a safe page with no PII');
      expect(matches).toHaveLength(0);
    });

    it('should detect multiple PII types in one content block', () => {
      const matches = detectPII('Email: test@test.com, Phone: 555-123-4567, SSN: 123-45-6789');
      expect(matches.length).toBeGreaterThanOrEqual(3);
    });

    it('should include recommendations for each finding', () => {
      const matches = detectPII('user@example.com');
      expect(matches[0].recommendation.length).toBeGreaterThan(0);
    });
  });

  // ----------------------------------------------------------
  // PHI Detection
  // ----------------------------------------------------------

  describe('PHI detection', () => {
    it('should detect medical record number references', () => {
      const matches = detectPHI('Patient medical record number MRN-12345', '');
      expect(matches.some((m) => m.type === 'medical_record')).toBe(true);
      expect(matches.find((m) => m.type === 'medical_record')!.severity).toBe(Severity.CRITICAL);
    });

    it('should detect diagnosis/ICD codes', () => {
      const matches = detectPHI('Diagnosis code: ICD-10', 'diagnosis_field');
      expect(matches.some((m) => m.type === 'diagnosis')).toBe(true);
    });

    it('should detect prescription data', () => {
      const matches = detectPHI('Patient prescription for medication', '');
      expect(matches.some((m) => m.type === 'prescription')).toBe(true);
    });

    it('should detect insurance identifiers', () => {
      const matches = detectPHI('', 'insurance_id');
      expect(matches.some((m) => m.type === 'insurance')).toBe(true);
    });

    it('should detect patient ID field names', () => {
      const matches = detectPHI('', 'patient_id');
      expect(matches.some((m) => m.type === 'medical_record')).toBe(true);
    });

    it('should return empty for non-health content', () => {
      const matches = detectPHI('Regular website content about products');
      expect(matches).toHaveLength(0);
    });
  });

  // ----------------------------------------------------------
  // GDPR Compliance
  // ----------------------------------------------------------

  describe('GDPR compliance checks', () => {
    it('should pass when all requirements are met', () => {
      const result = checkGDPR(true, true, true, true, true);

      expect(result.passed).toBe(true);
      expect(result.score).toBe(100);
      expect(result.framework).toBe(ComplianceFramework.GDPR);
    });

    it('should fail when consent mechanism is missing', () => {
      const result = checkGDPR(false, true, true, true, true);

      expect(result.passed).toBe(false);
      expect(result.score).toBeLessThan(100);
    });

    it('should fail when right to erasure is missing', () => {
      const result = checkGDPR(true, false, true, true, true);

      expect(result.passed).toBe(false);
    });

    it('should have 5 findings for GDPR', () => {
      const result = checkGDPR(true, true, true, true, true);
      expect(result.findings).toHaveLength(5);
    });

    it('should include CRITICAL severity for consent and erasure', () => {
      const result = checkGDPR(false, false, true, true, true);
      const criticalFindings = result.findings.filter(
        (f) => !f.passed && f.severity === Severity.CRITICAL,
      );
      expect(criticalFindings.length).toBeGreaterThanOrEqual(2);
    });

    it('should calculate score as percentage of passed checks', () => {
      const result = checkGDPR(true, true, false, false, true);
      // 3 out of 5 passed = 60%
      expect(result.score).toBe(60);
    });
  });

  // ----------------------------------------------------------
  // CCPA Compliance
  // ----------------------------------------------------------

  describe('CCPA compliance checks', () => {
    it('should pass when all requirements are met', () => {
      const result = checkCCPA(true, true, true, true);

      expect(result.passed).toBe(true);
      expect(result.score).toBe(100);
      expect(result.framework).toBe(ComplianceFramework.CCPA);
    });

    it('should fail when opt-out is missing', () => {
      const result = checkCCPA(false, true, true, true);

      expect(result.passed).toBe(false);
      const optOutFinding = result.findings.find((f) => f.rule === 'Right to Opt-Out');
      expect(optOutFinding?.severity).toBe(Severity.CRITICAL);
    });

    it('should fail when disclosure is missing', () => {
      const result = checkCCPA(true, false, true, true);
      expect(result.passed).toBe(false);
    });

    it('should have 4 findings for CCPA', () => {
      const result = checkCCPA(true, true, true, true);
      expect(result.findings).toHaveLength(4);
    });

    it('should include remediation guidance', () => {
      const result = checkCCPA(false, false, false, false);
      for (const finding of result.findings) {
        expect(finding.remediation.length).toBeGreaterThan(0);
      }
    });
  });

  // ----------------------------------------------------------
  // Consent Migration Validation
  // ----------------------------------------------------------

  describe('consent migration validation', () => {
    it('should validate valid consent records', () => {
      const result = validateConsentMigration([
        { userId: 'user1', consent: true, timestamp: '2024-01-15T10:00:00Z' },
        { userId: 'user2', consent: false, timestamp: '2024-01-16T12:00:00Z' },
      ]);

      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should flag empty consent records', () => {
      const result = validateConsentMigration([]);

      expect(result.valid).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]).toContain('re-collected');
    });

    it('should flag missing userId', () => {
      const result = validateConsentMigration([
        { userId: '', consent: true, timestamp: '2024-01-15T10:00:00Z' },
      ]);

      expect(result.valid).toBe(false);
      expect(result.issues.some((i) => i.includes('userId'))).toBe(true);
    });

    it('should flag missing timestamp', () => {
      const result = validateConsentMigration([
        { userId: 'user1', consent: true, timestamp: '' },
      ]);

      expect(result.valid).toBe(false);
    });

    it('should flag invalid timestamp', () => {
      const result = validateConsentMigration([
        { userId: 'user1', consent: true, timestamp: 'not-a-date' },
      ]);

      expect(result.valid).toBe(false);
      expect(result.issues.some((i) => i.includes('Invalid timestamp'))).toBe(true);
    });
  });

  // ----------------------------------------------------------
  // Data Residency Checks
  // ----------------------------------------------------------

  describe('data residency checks', () => {
    it('should pass when target is in allowed regions', () => {
      const result = checkDataResidency('eu-west-1', 'eu-west-1', ['eu-west-1', 'eu-central-1']);

      expect(result.compliant).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should fail when target is not in allowed regions', () => {
      const result = checkDataResidency('eu-west-1', 'us-east-1', ['eu-west-1', 'eu-central-1']);

      expect(result.compliant).toBe(false);
      expect(result.issues.some((i) => i.includes('not in allowed'))).toBe(true);
    });

    it('should warn about cross-region transfers', () => {
      const result = checkDataResidency('eu-west-1', 'eu-central-1', ['eu-west-1', 'eu-central-1']);

      expect(result.issues.some((i) => i.includes('Cross-region'))).toBe(true);
    });

    it('should not warn when source and target are same region', () => {
      const result = checkDataResidency('us-east-1', 'us-east-1', ['us-east-1']);

      expect(result.compliant).toBe(true);
      expect(result.issues).toHaveLength(0);
    });
  });

  // ----------------------------------------------------------
  // Compliance Report Generation
  // ----------------------------------------------------------

  describe('compliance report generation', () => {
    it('should generate a full compliance report', () => {
      const report = generateComplianceReport(
        [{ content: 'Safe content', fieldName: 'description' }],
        [ComplianceFramework.GDPR],
        { consent: true, deletion: true, export: true, privacy: true, dpa: true },
        { optOut: true, disclosure: true, nonDiscrimination: true, inventory: true },
        [{ userId: 'u1', consent: true, timestamp: '2024-01-15T00:00:00Z' }],
        { source: 'eu-west-1', target: 'eu-west-1', allowed: ['eu-west-1'] },
      );

      expect(report.overallScore).toBeGreaterThanOrEqual(80);
      expect(report.piiFindings).toHaveLength(0);
      expect(report.phiFindings).toHaveLength(0);
      expect(report.frameworkChecks).toHaveLength(1);
    });

    it('should reduce score for PII findings', () => {
      const cleanReport = generateComplianceReport(
        [{ content: 'No PII here', fieldName: 'text' }],
        [ComplianceFramework.GDPR],
        { consent: true, deletion: true, export: true, privacy: true, dpa: true },
        { optOut: true, disclosure: true, nonDiscrimination: true, inventory: true },
        [{ userId: 'u1', consent: true, timestamp: '2024-01-15T00:00:00Z' }],
        { source: 'eu-west-1', target: 'eu-west-1', allowed: ['eu-west-1'] },
      );

      const piiReport = generateComplianceReport(
        [{ content: 'Email: user@test.com, SSN: 123-45-6789', fieldName: 'data' }],
        [ComplianceFramework.GDPR],
        { consent: true, deletion: true, export: true, privacy: true, dpa: true },
        { optOut: true, disclosure: true, nonDiscrimination: true, inventory: true },
        [{ userId: 'u1', consent: true, timestamp: '2024-01-15T00:00:00Z' }],
        { source: 'eu-west-1', target: 'eu-west-1', allowed: ['eu-west-1'] },
      );

      expect(piiReport.overallScore).toBeLessThan(cleanReport.overallScore);
    });

    it('should include both GDPR and CCPA when specified', () => {
      const report = generateComplianceReport(
        [],
        [ComplianceFramework.GDPR, ComplianceFramework.CCPA],
        { consent: true, deletion: true, export: true, privacy: true, dpa: true },
        { optOut: true, disclosure: true, nonDiscrimination: true, inventory: true },
        [{ userId: 'u1', consent: true, timestamp: '2024-01-15T00:00:00Z' }],
        { source: 'us-east-1', target: 'us-east-1', allowed: ['us-east-1'] },
      );

      expect(report.frameworkChecks).toHaveLength(2);
      expect(report.frameworkChecks[0].framework).toBe(ComplianceFramework.GDPR);
      expect(report.frameworkChecks[1].framework).toBe(ComplianceFramework.CCPA);
    });

    it('should penalize invalid consent migration', () => {
      const validConsent = generateComplianceReport(
        [],
        [ComplianceFramework.GDPR],
        { consent: true, deletion: true, export: true, privacy: true, dpa: true },
        { optOut: true, disclosure: true, nonDiscrimination: true, inventory: true },
        [{ userId: 'u1', consent: true, timestamp: '2024-01-15T00:00:00Z' }],
        { source: 'eu-west-1', target: 'eu-west-1', allowed: ['eu-west-1'] },
      );

      const invalidConsent = generateComplianceReport(
        [],
        [ComplianceFramework.GDPR],
        { consent: true, deletion: true, export: true, privacy: true, dpa: true },
        { optOut: true, disclosure: true, nonDiscrimination: true, inventory: true },
        [],
        { source: 'eu-west-1', target: 'eu-west-1', allowed: ['eu-west-1'] },
      );

      expect(invalidConsent.overallScore).toBeLessThan(validConsent.overallScore);
    });

    it('should penalize non-compliant data residency', () => {
      const compliantReport = generateComplianceReport(
        [],
        [ComplianceFramework.GDPR],
        { consent: true, deletion: true, export: true, privacy: true, dpa: true },
        { optOut: true, disclosure: true, nonDiscrimination: true, inventory: true },
        [{ userId: 'u1', consent: true, timestamp: '2024-01-15T00:00:00Z' }],
        { source: 'eu-west-1', target: 'eu-west-1', allowed: ['eu-west-1'] },
      );

      const nonCompliantReport = generateComplianceReport(
        [],
        [ComplianceFramework.GDPR],
        { consent: true, deletion: true, export: true, privacy: true, dpa: true },
        { optOut: true, disclosure: true, nonDiscrimination: true, inventory: true },
        [{ userId: 'u1', consent: true, timestamp: '2024-01-15T00:00:00Z' }],
        { source: 'eu-west-1', target: 'us-east-1', allowed: ['eu-west-1'] },
      );

      expect(nonCompliantReport.overallScore).toBeLessThan(compliantReport.overallScore);
    });

    it('should clamp overall score to minimum of 0', () => {
      const report = generateComplianceReport(
        [
          { content: 'user1@test.com user2@test.com user3@test.com user4@test.com user5@test.com user6@test.com SSN: 123-45-6789', fieldName: 'data' },
          { content: '', fieldName: 'patient_id' },
        ],
        [ComplianceFramework.GDPR],
        { consent: false, deletion: false, export: false, privacy: false, dpa: false },
        { optOut: false, disclosure: false, nonDiscrimination: false, inventory: false },
        [],
        { source: 'eu-west-1', target: 'us-east-1', allowed: ['eu-west-1'] },
      );

      expect(report.overallScore).toBeGreaterThanOrEqual(0);
    });
  });
});
