/**
 * Compliance and Security Scanning Engine
 *
 * Scans content during migration for PII, PHI, consent records,
 * and data residency violations. Supports GDPR, CCPA, HIPAA, PCI-DSS.
 */
import { ComplianceFramework, Severity } from '@/types';

export interface ComplianceReport { id: string; timestamp: string; frameworks: ComplianceFramework[]; piiFindings: PIIFinding[]; phiFindings: PHIFinding[]; consentIssues: ConsentIssue[]; residencyIssues: ResidencyIssue[]; summary: ComplianceSummary; }
export interface PIIFinding { id: string; path: string; fieldName: string | null; piiType: PIIType; severity: Severity; value: string; context: string; frameworks: ComplianceFramework[]; recommendation: string; }
export type PIIType = 'email' | 'phone' | 'ssn' | 'credit_card' | 'passport' | 'drivers_license' | 'date_of_birth' | 'ip_address' | 'full_name' | 'address' | 'national_id' | 'bank_account' | 'tax_id';
export interface PHIFinding { id: string; path: string; phiType: PHIType; severity: Severity; value: string; context: string; recommendation: string; }
export type PHIType = 'medical_record_number' | 'diagnosis_code' | 'prescription' | 'health_plan_id' | 'patient_name' | 'treatment_date' | 'lab_result' | 'provider_name';
export interface ConsentIssue { id: string; path: string; type: 'missing_consent' | 'expired_consent' | 'invalid_format' | 'missing_timestamp' | 'missing_purpose'; description: string; severity: Severity; framework: ComplianceFramework; recommendation: string; }
export interface ResidencyIssue { id: string; dataType: string; currentRegion: string; requiredRegion: string; framework: ComplianceFramework; severity: Severity; description: string; }
export interface ComplianceSummary { overallScore: number; totalFindings: number; criticalFindings: number; piiDetected: number; phiDetected: number; consentIssues: number; residencyIssues: number; frameworkScores: Record<string, number>; }
export interface ScanInput { path: string; content: string; contentType?: string; metadata?: Record<string, unknown>; }
export interface ResidencyConfig { allowedRegions: string[]; dataClassification: Record<string, string[]>; framework: ComplianceFramework; }
export interface ConsentRecord { userId: string; path: string; purposes: string[]; granted: boolean; timestamp: string | null; expiresAt: string | null; source: string; }

interface PIIRule { type: PIIType; patterns: RegExp[]; severity: Severity; frameworks: ComplianceFramework[]; rec: string; }

const PII_RULES: PIIRule[] = [
  { type: 'email', patterns: [/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g], severity: Severity.HIGH, frameworks: [ComplianceFramework.GDPR, ComplianceFramework.CCPA], rec: 'Hash or encrypt email addresses.' },
  { type: 'phone', patterns: [/\b(?:\+?1[-.\s]?)?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g], severity: Severity.HIGH, frameworks: [ComplianceFramework.GDPR, ComplianceFramework.CCPA], rec: 'Mask or encrypt phone numbers.' },
  { type: 'ssn', patterns: [/\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g], severity: Severity.CRITICAL, frameworks: [ComplianceFramework.GDPR, ComplianceFramework.CCPA, ComplianceFramework.HIPAA], rec: 'SSNs must never be stored in plain text.' },
  { type: 'credit_card', patterns: [/\b4[0-9]{12}(?:[0-9]{3})?\b/g, /\b5[1-5][0-9]{14}\b/g, /\b3[47][0-9]{13}\b/g, /\b6(?:011|5[0-9]{2})[0-9]{12}\b/g], severity: Severity.CRITICAL, frameworks: [ComplianceFramework.PCI_DSS, ComplianceFramework.GDPR], rec: 'Tokenize credit card numbers. Never store full PANs.' },
  { type: 'date_of_birth', patterns: [/\b(?:dob|date[_\s]?of[_\s]?birth|birthdate)\s*[:=]\s*\d{1,4}[-/]\d{1,2}[-/]\d{1,4}\b/gi], severity: Severity.HIGH, frameworks: [ComplianceFramework.GDPR, ComplianceFramework.HIPAA], rec: 'Consider using age ranges instead.' },
  { type: 'ip_address', patterns: [/\b(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g], severity: Severity.MEDIUM, frameworks: [ComplianceFramework.GDPR], rec: 'Anonymize by zeroing last octet.' },
  { type: 'national_id', patterns: [/\b[A-Z]{2}\d{6}[A-Z]\b/g], severity: Severity.CRITICAL, frameworks: [ComplianceFramework.GDPR], rec: 'National IDs must be encrypted.' },
  { type: 'bank_account', patterns: [/\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}(?:[A-Z0-9]{0,16})?\b/g], severity: Severity.CRITICAL, frameworks: [ComplianceFramework.GDPR, ComplianceFramework.PCI_DSS], rec: 'Use tokenization for bank accounts.' },
];

const PHI_RULES: Array<{ type: PHIType; patterns: RegExp[]; severity: Severity; rec: string }> = [
  { type: 'medical_record_number', patterns: [/\b(?:MRN|medical[_\s]?record[_\s]?(?:number|no|#))\s*[:=]?\s*[A-Z0-9]{5,15}\b/gi], severity: Severity.CRITICAL, rec: 'MRNs must be encrypted under HIPAA.' },
  { type: 'diagnosis_code', patterns: [/\bICD[-\s]?(?:9|10)\s*[:=]?\s*\S+/gi], severity: Severity.CRITICAL, rec: 'Diagnosis codes are PHI when linked to patients.' },
  { type: 'prescription', patterns: [/\b(?:prescription|rx|medication)\s*[:=]?\s*[A-Za-z\s]+\d+\s*mg\b/gi], severity: Severity.CRITICAL, rec: 'Prescriptions are PHI. Encrypt under HIPAA.' },
  { type: 'health_plan_id', patterns: [/\b(?:health[_\s]?plan|insurance)[_\s]?(?:id|number)\s*[:=]?\s*[A-Z0-9]{5,20}\b/gi], severity: Severity.HIGH, rec: 'Health plan IDs are PHI. Encrypt.' },
  { type: 'lab_result', patterns: [/\b(?:lab[_\s]?result|blood[_\s]?type|hemoglobin|glucose)\s*[:=]?\s*[\d.]+\s*(?:mg|ml|mmol)?\b/gi], severity: Severity.CRITICAL, rec: 'Lab results are PHI. Encrypt under HIPAA.' },
];

export class ComplianceChecker {
  /** Scan content for PII using pattern matching with false positive filtering. */
  async scanForPII(inputs: ScanInput[], frameworks: ComplianceFramework[] = [ComplianceFramework.GDPR, ComplianceFramework.CCPA]): Promise<PIIFinding[]> {
    const findings: PIIFinding[] = [];
    let fid = 0;
    for (const input of inputs) for (const rule of PII_RULES) {
      if (!rule.frameworks.some((f) => frameworks.includes(f))) continue;
      for (const rx of rule.patterns) {
        rx.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = rx.exec(input.content)) !== null) {
          if (this.isFP(rule.type, m[0], input.content, m.index)) continue;
          const cs = Math.max(0, m.index - 30), ce = Math.min(input.content.length, m.index + m[0].length + 30);
          findings.push({ id: `pii-${fid++}`, path: input.path, fieldName: this.extractField(input.content, m.index), piiType: rule.type,
            severity: rule.severity, value: this.mask(m[0], rule.type), context: this.maskCtx(input.content.slice(cs, ce)),
            frameworks: rule.frameworks.filter((f) => frameworks.includes(f)), recommendation: rule.rec });
        }
      }
    }
    return findings;
  }

  /** Scan content for Protected Health Information. */
  async scanForPHI(inputs: ScanInput[]): Promise<PHIFinding[]> {
    const findings: PHIFinding[] = [];
    let fid = 0;
    for (const input of inputs) for (const rule of PHI_RULES) for (const rx of rule.patterns) {
      rx.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = rx.exec(input.content)) !== null) {
        const cs = Math.max(0, m.index - 30), ce = Math.min(input.content.length, m.index + m[0].length + 30);
        findings.push({ id: `phi-${fid++}`, path: input.path, phiType: rule.type, severity: rule.severity,
          value: this.mask(m[0], 'national_id'), context: this.maskCtx(input.content.slice(cs, ce)), recommendation: rule.rec });
      }
    }
    return findings;
  }

  /** Validate consent records for compliance requirements. */
  async checkConsent(records: ConsentRecord[], fw: ComplianceFramework = ComplianceFramework.GDPR): Promise<ConsentIssue[]> {
    const issues: ConsentIssue[] = [];
    let id = 0;
    for (const r of records) {
      if (!r.granted) issues.push({ id: `c-${id++}`, path: r.path, type: 'missing_consent',
        description: `User ${r.userId} has no consent.`, severity: Severity.CRITICAL, framework: fw,
        recommendation: 'Do not migrate without valid consent.' });
      if (!r.timestamp) issues.push({ id: `c-${id++}`, path: r.path, type: 'missing_timestamp',
        description: `Consent for ${r.userId} has no timestamp.`, severity: Severity.HIGH, framework: fw,
        recommendation: 'Consent records must include timestamp.' });
      if (r.expiresAt && new Date(r.expiresAt) < new Date()) issues.push({ id: `c-${id++}`, path: r.path,
        type: 'expired_consent', description: `Consent expired ${r.expiresAt}.`, severity: Severity.CRITICAL,
        framework: fw, recommendation: 'Renew consent before migrating.' });
      if (!r.purposes || r.purposes.length === 0) issues.push({ id: `c-${id++}`, path: r.path,
        type: 'missing_purpose', description: `No purposes for ${r.userId}.`, severity: Severity.HIGH,
        framework: fw, recommendation: 'Add purpose declarations.' });
    }
    return issues;
  }

  /** Validate data residency compliance. */
  async checkDataResidency(items: Array<{ path: string; dataType: string; currentRegion: string }>, config: ResidencyConfig): Promise<ResidencyIssue[]> {
    const issues: ResidencyIssue[] = [];
    let id = 0;
    for (const item of items) {
      if (!config.allowedRegions.includes(item.currentRegion))
        issues.push({ id: `r-${id++}`, dataType: item.dataType, currentRegion: item.currentRegion,
          requiredRegion: config.allowedRegions[0] ?? 'unspecified', framework: config.framework, severity: Severity.CRITICAL,
          description: `"${item.dataType}" in "${item.currentRegion}" but must be in ${config.allowedRegions.join('/')}.` });
      const typeRegs = config.dataClassification[item.dataType];
      if (typeRegs && !typeRegs.includes(item.currentRegion))
        issues.push({ id: `r-${id++}`, dataType: item.dataType, currentRegion: item.currentRegion,
          requiredRegion: typeRegs[0], framework: config.framework, severity: Severity.HIGH,
          description: `"${item.dataType}" requires ${typeRegs.join('/')} but is in "${item.currentRegion}".` });
    }
    return issues;
  }

  /** Generate comprehensive compliance audit report. */
  async generateComplianceReport(inputs: ScanInput[], consent: ConsentRecord[],
    residencyData: Array<{ path: string; dataType: string; currentRegion: string }>,
    residencyConfig: ResidencyConfig, frameworks: ComplianceFramework[] = [ComplianceFramework.GDPR]): Promise<ComplianceReport> {
    const [pii, phi, cIssues, rIssues] = await Promise.all([
      this.scanForPII(inputs, frameworks),
      frameworks.includes(ComplianceFramework.HIPAA) ? this.scanForPHI(inputs) : Promise.resolve([]),
      Promise.all(frameworks.map((f) => this.checkConsent(consent, f))).then((r) => r.flat()),
      this.checkDataResidency(residencyData, residencyConfig),
    ]);
    const total = pii.length + phi.length + cIssues.length + rIssues.length;
    const crit = [...pii, ...phi, ...cIssues, ...rIssues].filter((f) => f.severity === Severity.CRITICAL).length;
    const fwScores: Record<string, number> = {};
    for (const fw of frameworks) {
      const fwItems = [...pii.filter((f) => f.frameworks.includes(fw)), ...cIssues.filter((f) => f.framework === fw), ...rIssues.filter((f) => f.framework === fw)];
      const fc = fwItems.filter((f) => f.severity === Severity.CRITICAL).length;
      const fh = fwItems.filter((f) => f.severity === Severity.HIGH).length;
      fwScores[fw] = Math.max(0, 100 - fc * 20 - fh * 5);
    }
    const vals = Object.values(fwScores);
    const overall = vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 100;
    return { id: `compliance-${Date.now()}`, timestamp: new Date().toISOString(), frameworks,
      piiFindings: pii, phiFindings: phi, consentIssues: cIssues, residencyIssues: rIssues,
      summary: { overallScore: overall, totalFindings: total, criticalFindings: crit, piiDetected: pii.length,
        phiDetected: phi.length, consentIssues: cIssues.length, residencyIssues: rIssues.length, frameworkScores: fwScores } };
  }

  private isFP(type: PIIType, val: string, content: string, idx: number): boolean {
    const ctx = content.slice(Math.max(0, idx - 15), idx);
    if (type === 'ssn' && (/^\d{4}[-/]\d{2}[-/]\d{2}$/.test(val) || /version|v\s*$/i.test(ctx))) return true;
    if (type === 'phone' && val.replace(/\D/g, '').length < 7) return true;
    if (type === 'ip_address' && (/version|v\s*$/i.test(ctx) || /^(127\.0\.0\.1|0\.0\.0\.0|192\.168\.|10\.)/.test(val))) return true;
    if (type === 'bank_account' && !/\b(?:account|iban|bank)\b/i.test(content.slice(Math.max(0, idx - 50), idx + val.length + 50))) return true;
    return false;
  }

  private mask(val: string, type: PIIType): string {
    if (type === 'email') { const [l, d] = val.split('@'); return `${l[0]}***@${d}`; }
    if (type === 'credit_card') return '****-****-****-' + val.slice(-4);
    if (type === 'ssn') return '***-**-' + val.slice(-4);
    if (type === 'ip_address') return val.split('.').slice(0, 2).join('.') + '.***';
    return val.length <= 4 ? '***' : val.slice(0, 2) + '*'.repeat(Math.max(0, val.length - 4)) + val.slice(-2);
  }

  private maskCtx(ctx: string): string {
    return ctx.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[EMAIL]')
      .replace(/\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g, '[SSN]').replace(/\b4[0-9]{12}(?:[0-9]{3})?\b/g, '[CC]');
  }

  private extractField(content: string, idx: number): string | null {
    const before = content.slice(Math.max(0, idx - 100), idx);
    const json = before.match(/"([^"]+)"\s*:\s*"?\s*$/);
    if (json) return json[1];
    const xml = before.match(/(\w+)=["']?\s*$/);
    if (xml) return xml[1];
    return null;
  }
}
