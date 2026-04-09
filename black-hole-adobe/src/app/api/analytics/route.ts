/**
 * POST /api/analytics
 *
 * Lightweight, privacy-friendly analytics sink (ADR-064). Accepts a
 * single event at a time, persists to SQLite, and always returns 200
 * so client-side logging never impacts the user experience.
 *
 * Body:
 *   { event: string, properties?: object, path?: string, timestamp?: string }
 *
 * This is intentionally minimal — no third-party scripts, no cookies,
 * no cross-site tracking. The goal is funnel insight for the public
 * pre-flight page, not behavioural profiling.
 */

import type { NextRequest } from 'next/server';
import { getDatabase } from '@/lib/db';
import { randomUUID } from 'node:crypto';

interface EventPayload {
  event?: unknown;
  properties?: unknown;
  path?: unknown;
  timestamp?: unknown;
}

const MAX_EVENT_LENGTH = 64;
const MAX_PATH_LENGTH = 256;
const MAX_PROPS_BYTES = 4 * 1024; // 4 KB

// Strict allowlist of events the public page is allowed to emit.
// This keeps the table focused and prevents accidental firehose.
export const ALLOWED_EVENTS = new Set<string>([
  'preflight.page.view',
  'preflight.run.submit',
  'preflight.run.result',
  'preflight.lead.capture',
  'preflight.cta.upgrade.click',
  'preflight.sample.load',
  'preflight.share.click',
]);

function ensureAnalyticsTable() {
  const db = getDatabase();
  db.exec(`
    CREATE TABLE IF NOT EXISTS analytics_events (
      id          TEXT PRIMARY KEY,
      event       TEXT NOT NULL,
      path        TEXT,
      properties  TEXT NOT NULL DEFAULT '{}',
      ip          TEXT,
      user_agent  TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_analytics_events_event
      ON analytics_events(event);
  `);
}

function getClientIp(request: NextRequest): string | null {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  const real = request.headers.get('x-real-ip');
  if (real) return real.trim();
  return null;
}

function ok(): Response {
  return Response.json(
    { success: true, data: { ok: true }, error: null },
    { status: 200 },
  );
}

export async function POST(request: NextRequest): Promise<Response> {
  let body: EventPayload | null;
  try {
    body = (await request.json()) as EventPayload;
  } catch {
    // Swallow parse errors — analytics must never 4xx the UI.
    return ok();
  }

  const event =
    typeof body?.event === 'string'
      ? body.event.trim().slice(0, MAX_EVENT_LENGTH)
      : '';

  if (!event || !ALLOWED_EVENTS.has(event)) {
    return ok();
  }

  const path =
    typeof body?.path === 'string'
      ? body.path.slice(0, MAX_PATH_LENGTH)
      : null;

  // Serialize properties defensively — if it's too big or non-JSON,
  // drop it rather than erroring.
  let propsJson = '{}';
  if (body?.properties && typeof body.properties === 'object') {
    try {
      const serialized = JSON.stringify(body.properties);
      if (serialized.length <= MAX_PROPS_BYTES) {
        propsJson = serialized;
      }
    } catch {
      /* ignore */
    }
  }

  try {
    ensureAnalyticsTable();
    const db = getDatabase();
    const ip = getClientIp(request);
    const userAgent = request.headers.get('user-agent')?.slice(0, 512) ?? null;

    db.prepare(
      `INSERT INTO analytics_events (id, event, path, properties, ip, user_agent)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(randomUUID(), event, path, propsJson, ip, userAgent);
  } catch (err) {
    console.error('[API] POST /api/analytics error:', err);
    // Still 200 — logging failures are non-fatal.
  }

  return ok();
}
