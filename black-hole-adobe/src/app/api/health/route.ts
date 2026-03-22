/**
 * GET /api/health — Health check endpoint
 *
 * Returns system health status including uptime, memory usage,
 * store counts, and dependency status.
 */

import { success } from '@/lib/api/response';
import { listMigrations, listAssessments, listConnectors } from '@/lib/api/store';

const startedAt = new Date().toISOString();

export async function GET() {
  try {
    const now = new Date();
    const uptimeMs = now.getTime() - new Date(startedAt).getTime();
    const memUsage = process.memoryUsage();

    const migrations = listMigrations();
    const assessmentsList = listAssessments();
    const connectorsList = listConnectors();

    const connectedConnectors = connectorsList.filter(
      (c) => c.status === 'connected',
    ).length;

    const health = {
      status: 'healthy' as const,
      version: '0.1.0',
      environment: process.env.NODE_ENV ?? 'development',
      startedAt,
      uptime: {
        ms: uptimeMs,
        human: formatUptime(uptimeMs),
      },
      memory: {
        rssBytes: memUsage.rss,
        heapUsedBytes: memUsage.heapUsed,
        heapTotalBytes: memUsage.heapTotal,
        rssMB: Math.round(memUsage.rss / 1024 / 1024),
        heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
      },
      store: {
        migrations: migrations.length,
        assessments: assessmentsList.length,
        connectors: connectorsList.length,
        connectedConnectors,
      },
      dependencies: {
        database: { status: 'in-memory', healthy: true },
        aiService: { status: 'mock', healthy: true },
        connectorEngine: {
          status: connectedConnectors > 0 ? 'operational' : 'idle',
          healthy: true,
        },
      },
      timestamp: now.toISOString(),
    };

    console.log('[API] GET /api/health — healthy');
    return success(health);
  } catch {
    // Even the health check failing should return structured JSON
    return Response.json(
      {
        success: false,
        data: null,
        error: {
          code: 'HEALTH_CHECK_FAILED',
          message: 'Health check encountered an error',
          details: null,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: 'health-error',
        },
      },
      { status: 503 },
    );
  }
}

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}
