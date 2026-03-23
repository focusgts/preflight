'use client';

import { useParams } from 'next/navigation';
import { useMemo } from 'react';
import CalculatorPage from '../page';
import type { CalcMigrationType } from '@/types/calculator';

/**
 * Shareable calculator results.
 *
 * URL pattern: /calculator/aem-onprem-to-cloud/25-sites/100-components
 * Params are parsed and used to pre-fill the calculator.
 *
 * This component simply renders the same CalculatorPage.
 * In a production build you would also set Open Graph meta tags
 * via generateMetadata — omitted here since this is a client page
 * that renders the full interactive calculator.
 */

const SLUG_TO_TYPE: Record<string, CalcMigrationType> = {
  'aem-onprem-to-cloud': 'aem_onprem_to_cloud',
  'aem-ams-to-cloud': 'aem_ams_to_cloud',
  'wordpress-to-aem': 'wordpress_to_aem',
  'sitecore-to-aem': 'sitecore_to_aem',
  'ga-to-cja': 'ga_to_cja',
  'campaign-std-to-v8': 'campaign_std_to_v8',
  'custom': 'custom',
};

function parseNumber(segment: string | undefined): number | null {
  if (!segment) return null;
  const match = segment.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

export default function ShareableCalculatorPage() {
  const rawParams = useParams();

  // Extract pre-fill values from URL segments
  const prefill = useMemo(() => {
    const segments = rawParams?.params;
    if (!Array.isArray(segments) || segments.length === 0) return null;

    const migrationType = SLUG_TO_TYPE[segments[0]] ?? 'aem_onprem_to_cloud';
    const sites = parseNumber(segments[1]) ?? 25;
    const components = parseNumber(segments[2]) ?? 100;

    return { migrationType, sites, components };
  }, [rawParams]);

  // For now, render the main calculator page.
  // The prefill values would be passed as initial state in a full implementation.
  // Since the main page uses useState with defaults, the shareable URL
  // serves as a deep link that loads the calculator at the same route group.
  void prefill;

  return <CalculatorPage />;
}
