/**
 * Public AEM Health Score - Type Definitions
 *
 * Types for the public site scanner that detects AEM version,
 * performance, SEO health, security headers, and accessibility.
 */

import type { DetectedIntegration } from '@/lib/scanner/integration-detector';

// ============================================================
// Enums
// ============================================================

export type ScanPhase =
  | 'detecting'
  | 'performance'
  | 'seo'
  | 'security'
  | 'accessibility'
  | 'scoring'
  | 'complete';

export type Grade = 'A' | 'B' | 'C' | 'D' | 'F';

export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type UrgencyLevel = 'critical' | 'high' | 'medium' | 'low' | 'none';

// ============================================================
// Core Scan Result
// ============================================================

export interface ScanResult {
  url: string;
  domain: string;
  overallScore: number;
  grade: Grade;
  categories: {
    performance: CategoryScore;
    seo: CategoryScore;
    security: CategoryScore;
    accessibility: CategoryScore;
    migration: CategoryScore;
  };
  aemDetected: boolean;
  aemVersion: string | null;
  platformDetails: PlatformDetails;
  recommendations: ScanFinding[];
  industryBenchmark: IndustryBenchmark | null;
  migrationUrgency: MigrationUrgency;
  scannedAt: string;
  /** Third-party integrations detected via external discovery (ADR-033). */
  integrations?: DetectedIntegration[];
  /** Dispatcher security assessment (ADR-037). Absent if scan failed or was skipped. */
  dispatcherSecurity?: import('@/lib/scanner/dispatcher-security').DispatcherSecurityResult;
}

// ============================================================
// Category Score
// ============================================================

export interface CategoryScore {
  name: string;
  score: number;
  weight: number;
  grade: Grade;
  findings: ScanFinding[];
}

// ============================================================
// Scan Finding
// ============================================================

export interface ScanFinding {
  category: string;
  severity: FindingSeverity;
  title: string;
  description: string;
  recommendation: string;
}

// ============================================================
// Platform Details
// ============================================================

export interface PlatformDetails {
  detected: boolean;
  platform: string;
  version: string | null;
  deployment: 'cloud-service' | 'managed-services' | 'on-prem' | 'edge-delivery' | 'unknown';
  indicators: string[];
  confidence?: number;
  versionConfidence?: number;
  deploymentConfidence?: number;
}

// ============================================================
// Industry Benchmark
// ============================================================

export interface IndustryBenchmark {
  industry: string;
  averageScore: number;
  percentile: number;
  comparison: 'above' | 'below' | 'at';
}

// ============================================================
// Migration Urgency
// ============================================================

export interface MigrationUrgency {
  level: UrgencyLevel;
  daysUntilDeadline: number | null;
  deadlineDate: string | null;
  message: string;
}

// ============================================================
// Scan Request / Cache
// ============================================================

export interface ScanRequest {
  url: string;
  industry?: string;
}

export interface CachedScanResult {
  result: ScanResult;
  cachedAt: string;
  expiresAt: string;
}

// ============================================================
// Raw Scan Data (internal)
// ============================================================

export interface RawScanData {
  url: string;
  statusCode: number;
  headers: Record<string, string>;
  html: string;
  responseTimeMs: number;
  contentLengthBytes: number;
  redirectCount: number;
  finalUrl: string;
}

// ============================================================
// 5-Tier Scanner Types (ADR-030)
// ============================================================

export { type DNSResult } from '@/lib/scanner/dns-resolver';
export { type ProbeResult } from '@/lib/scanner/path-prober';
export {
  type DetectedSignal,
  type VersionResult,
  type DeploymentResult,
  type DeploymentType,
} from '@/lib/scanner/version-detector';

export type {
  DetectedIntegration,
  IntegrationCategory,
  AemcsCompatibility,
} from '@/lib/scanner/integration-detector';

export interface ScanTierResults {
  dns: import('@/lib/scanner/dns-resolver').DNSResult;
  pageLoad: {
    signals: import('@/lib/scanner/version-detector').DetectedSignal[];
    cumulativeWeight: number;
    aemDetected: boolean;
  };
  probes: import('@/lib/scanner/path-prober').ProbeResult[];
  version: import('@/lib/scanner/version-detector').VersionResult;
  deployment: import('@/lib/scanner/version-detector').DeploymentResult;
}
