/**
 * GET /api/scanner/:domain — Get cached scan results for a domain
 *
 * Returns the last scan result or 404 if no cached result exists.
 */

import { success, error } from '@/lib/api/response';

// Shared cache reference — in production this would be a database
// For now we re-trigger a scan if not cached
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ domain: string }> },
) {
  const { domain } = await params;

  if (!domain || typeof domain !== 'string') {
    return error('INVALID_INPUT', 'Domain parameter is required.', 400);
  }

  // Try to get cached result via internal POST
  try {
    const origin =
      process.env.NEXT_PUBLIC_BASE_URL ??
      'http://localhost:3000';

    const response = await fetch(`${origin}/api/scanner`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: domain }),
    });

    if (!response.ok) {
      return error('NOT_FOUND', `No scan results found for ${domain}.`, 404);
    }

    const data = await response.json();

    if (data.success && data.data) {
      return success(data.data);
    }

    return error('NOT_FOUND', `No scan results found for ${domain}.`, 404);
  } catch (err) {
    console.error(`[Scanner] Failed to fetch results for ${domain}:`, err);
    return error('FETCH_FAILED', 'Failed to retrieve scan results.', 500);
  }
}
