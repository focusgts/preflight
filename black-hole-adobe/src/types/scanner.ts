/**
 * Public AEM Health Score - Type Definitions
 *
 * Types for the public site scanner that detects AEM version,
 * performance, SEO health, security headers, and accessibility.
 */

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
  deployment: 'cloud-service' | 'managed-services' | 'on-prem' | 'unknown';
  indicators: string[];
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
