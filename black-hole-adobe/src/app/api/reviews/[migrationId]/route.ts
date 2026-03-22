/**
 * GET   /api/reviews/[migrationId] — Get review queue for a migration
 * PATCH /api/reviews/[migrationId] — Update items (approve/reject/skip individual or bulk)
 */

import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { success, error } from '@/lib/api/response';
import { reviewEngine } from '@/lib/review/review-engine';

type RouteParams = { params: Promise<{ migrationId: string }> };

// ── GET ──────────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: RouteParams,
) {
  try {
    const { migrationId } = await params;
    const searchParams = request.nextUrl.searchParams;

    const filter: Record<string, unknown> = {};

    const changeType = searchParams.get('changeType');
    if (changeType) filter.changeType = changeType.split(',');

    const status = searchParams.get('status');
    if (status) filter.status = status.split(',');

    const severity = searchParams.get('severity');
    if (severity) filter.severity = severity.split(',');

    const confidenceMin = searchParams.get('confidenceMin');
    if (confidenceMin) filter.confidenceMin = parseFloat(confidenceMin);

    const confidenceMax = searchParams.get('confidenceMax');
    if (confidenceMax) filter.confidenceMax = parseFloat(confidenceMax);

    const hasFilter = Object.keys(filter).length > 0;
    const queue = reviewEngine.getQueue(
      migrationId,
      hasFilter ? filter as Parameters<typeof reviewEngine.getQueue>[1] : undefined,
    );

    if (!queue) {
      return error('NOT_FOUND', `Review queue for migration ${migrationId} not found`, 404);
    }

    console.log(`[API] GET /api/reviews/${migrationId} — ${queue.items.length} items`);
    return success(queue);
  } catch (err) {
    console.error('[API] GET /api/reviews/[migrationId] error:', err);
    return error('INTERNAL_ERROR', 'Failed to get review queue', 500);
  }
}

// ── PATCH ────────────────────────────────────────────────────────────────

const singleReviewSchema = z.object({
  type: z.literal('single'),
  itemId: z.string(),
  action: z.enum(['approved', 'rejected', 'skipped']),
  notes: z.string().optional(),
});

const bulkReviewSchema = z.object({
  type: z.literal('bulk'),
  action: z.enum([
    'approve_all_high_confidence',
    'approve_selected',
    'reject_selected',
    'skip_selected',
  ]),
  itemIds: z.array(z.string()).optional(),
  confidenceThreshold: z.number().min(0).max(1).optional(),
});

const patchSchema = z.discriminatedUnion('type', [
  singleReviewSchema,
  bulkReviewSchema,
]);

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams,
) {
  try {
    const { migrationId } = await params;

    const queue = reviewEngine.getQueue(migrationId);
    if (!queue) {
      return error('NOT_FOUND', `Review queue for migration ${migrationId} not found`, 404);
    }

    const body = await request.json();
    const parsed = patchSchema.safeParse(body);

    if (!parsed.success) {
      return error('VALIDATION_ERROR', 'Invalid request body', 400, {
        issues: parsed.error.issues,
      });
    }

    const data = parsed.data;

    if (data.type === 'single') {
      const item = reviewEngine.reviewItem(
        migrationId,
        data.itemId,
        data.action,
        data.notes,
      );

      if (!item) {
        return error('NOT_FOUND', `Review item ${data.itemId} not found`, 404);
      }

      console.log(`[API] PATCH /api/reviews/${migrationId} — ${data.action} item ${data.itemId}`);
      return success({
        item,
        stats: reviewEngine.getStats(migrationId),
      });
    }

    // Bulk action
    const count = reviewEngine.processBulkAction(
      migrationId,
      data.action,
      data.itemIds,
      data.confidenceThreshold,
    );

    console.log(`[API] PATCH /api/reviews/${migrationId} — bulk ${data.action}, ${count} items affected`);
    return success({
      action: data.action,
      affected: count,
      stats: reviewEngine.getStats(migrationId),
    });
  } catch (err) {
    console.error('[API] PATCH /api/reviews/[migrationId] error:', err);
    return error('INTERNAL_ERROR', 'Failed to update review queue', 500);
  }
}
