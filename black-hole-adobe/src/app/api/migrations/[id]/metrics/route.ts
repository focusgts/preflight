/**
 * GET /api/migrations/[id]/metrics
 *
 * Returns current migration metrics for the live dashboard.
 * In demo mode, returns progressively advancing mock data
 * that simulates a migration in progress.
 */

import { type NextRequest } from 'next/server';
import { success, error } from '@/lib/api/response';
import { getMockLiveMetrics } from '@/config/mock-live-data';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(
  _request: NextRequest,
  { params }: RouteParams,
) {
  try {
    const { id } = await params;

    if (!id) {
      return error('BAD_REQUEST', 'Migration ID is required', 400);
    }

    console.log(`[API] GET /api/migrations/${id}/metrics`);

    // In a production implementation, this would query the database
    // and the active migration engine for real metrics. For demo mode,
    // we return progressively advancing mock data.
    const metrics = getMockLiveMetrics(id);

    return success(metrics);
  } catch (err) {
    console.error('[API] Error fetching migration metrics:', err);
    return error(
      'INTERNAL_ERROR',
      'Failed to fetch migration metrics',
      500,
    );
  }
}
