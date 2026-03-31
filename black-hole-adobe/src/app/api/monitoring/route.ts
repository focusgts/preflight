/**
 * GET /api/monitoring — List all monitored migrations
 *
 * Returns a summary of every migration that has a drift baseline,
 * including current alert level, drift score, and last check time.
 */

import { success } from '@/lib/api/response';
import { listMonitoredMigrations } from '@/lib/monitoring/drift-monitor';
import { startScheduler } from '@/lib/monitoring/scheduler';

export async function GET() {
  // Lazy-init the drift monitoring scheduler on first request
  startScheduler();

  const migrations = listMonitoredMigrations();
  return success(migrations);
}
