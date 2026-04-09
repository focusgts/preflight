/**
 * /preflight — Public Cloud Manager Pre-Flight Web UI (ADR-064)
 *
 * Server component shell that exports static metadata for SEO and
 * defers the interactive work to <PreflightClient />. Unauthenticated,
 * indexable, no session required.
 */

import type { Metadata } from 'next';
import { PreflightClient } from './preflight-client';

export const metadata: Metadata = {
  title: 'AEM Cloud Manager Pre-Flight Checker | Black Hole',
  description:
    'Check your AEM code against Cloud Manager quality gates in under a second. Free, no login, no setup. Covers SonarQube CQRules, OakPAL index validation, and Java compatibility.',
  keywords: [
    'AEM',
    'Cloud Manager',
    'quality gate',
    'SonarQube',
    'OakPAL',
    'pre-flight',
    'AEMaaCS',
    'Adobe Experience Manager',
  ],
  robots: { index: true, follow: true },
  openGraph: {
    title: 'AEM Cloud Manager Pre-Flight Checker',
    description:
      'Paste your AEM code, get Cloud Manager gate results in under a second. Free.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AEM Cloud Manager Pre-Flight Checker',
    description:
      'Paste your AEM code, get Cloud Manager gate results in under a second. Free.',
  },
};

export default function PreflightPage() {
  return <PreflightClient />;
}
