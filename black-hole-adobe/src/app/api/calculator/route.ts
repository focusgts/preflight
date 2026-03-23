/**
 * POST /api/calculator — Migration Cost Calculator
 *
 * Public endpoint (no auth required).
 * Accepts CalculatorInputs and returns a full CalculationResult.
 */

import { success, error } from '@/lib/api/response';
import { costEngine } from '@/lib/calculator/cost-engine';
import type { CalculatorInputs } from '@/types/calculator';

const VALID_MIGRATION_TYPES = [
  'aem_onprem_to_cloud',
  'aem_ams_to_cloud',
  'wordpress_to_aem',
  'sitecore_to_aem',
  'ga_to_cja',
  'campaign_std_to_v8',
  'custom',
];

const VALID_COMPANY_SIZES = ['mid_market', 'enterprise', 'large_enterprise'];
const VALID_AEM_VERSIONS = ['6.1', '6.2', '6.3', '6.4', '6.5', 'ams'];
const VALID_COMPLIANCE = ['gdpr', 'hipaa', 'pci_dss', 'sox', 'fedramp'];

function validateInputs(body: unknown): CalculatorInputs | string {
  if (!body || typeof body !== 'object') {
    return 'Request body must be a JSON object';
  }

  const b = body as Record<string, unknown>;

  if (!VALID_MIGRATION_TYPES.includes(b.migrationType as string)) {
    return `Invalid migrationType. Must be one of: ${VALID_MIGRATION_TYPES.join(', ')}`;
  }

  if (!VALID_COMPANY_SIZES.includes(b.companySize as string)) {
    return `Invalid companySize. Must be one of: ${VALID_COMPANY_SIZES.join(', ')}`;
  }

  if (!VALID_AEM_VERSIONS.includes(b.currentAEMVersion as string)) {
    return `Invalid currentAEMVersion. Must be one of: ${VALID_AEM_VERSIONS.join(', ')}`;
  }

  const numFields = [
    'numberOfSites',
    'numberOfCustomComponents',
    'numberOfAssets',
    'assetSizeGB',
    'numberOfIntegrations',
  ] as const;

  for (const field of numFields) {
    const val = b[field];
    if (typeof val !== 'number' || val < 0) {
      return `${field} must be a non-negative number`;
    }
  }

  if (!Array.isArray(b.complianceRequirements)) {
    return 'complianceRequirements must be an array';
  }

  for (const req of b.complianceRequirements) {
    if (!VALID_COMPLIANCE.includes(req as string)) {
      return `Invalid compliance requirement: ${req}. Must be one of: ${VALID_COMPLIANCE.join(', ')}`;
    }
  }

  return b as unknown as CalculatorInputs;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = validateInputs(body);

    if (typeof validated === 'string') {
      return error('VALIDATION_ERROR', validated, 400);
    }

    const result = costEngine.calculate(validated);

    console.log(
      `[API] POST /api/calculator — ${validated.migrationType}, ${validated.numberOfSites} sites, savings: $${result.savings.costSaved}`,
    );

    return success(result);
  } catch (err) {
    console.error('[API] POST /api/calculator — error:', err);
    return error('CALCULATION_ERROR', 'Failed to calculate costs', 500);
  }
}
