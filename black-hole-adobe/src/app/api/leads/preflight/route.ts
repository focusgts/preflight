/**
 * POST /api/leads/preflight
 *
 * Email-only lead capture for the public pre-flight page (ADR-064).
 * No auth required. Idempotent on duplicate emails. Designed to be
 * email-enumeration-safe — always returns 200 with a generic success
 * shape regardless of whether the email is new or already on file.
 */

import type { NextRequest } from 'next/server';
import { getDatabase } from '@/lib/db';
import { randomUUID } from 'node:crypto';

interface LeadPayload {
  email?: unknown;
  source?: unknown;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254; // RFC 3696

function ensurePreflightLeadsTable() {
  const db = getDatabase();
  db.exec(`
    CREATE TABLE IF NOT EXISTS preflight_leads (
      id          TEXT PRIMARY KEY,
      email       TEXT NOT NULL,
      source      TEXT NOT NULL DEFAULT 'preflight-public',
      ip          TEXT,
      user_agent  TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_preflight_leads_email
      ON preflight_leads(email);
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
  // Generic success shape. Does NOT distinguish "created" from "duplicate"
  // to avoid leaking email enumeration.
  return Response.json(
    { success: true, data: { ok: true }, error: null },
    { status: 200 },
  );
}

function badEmail(): Response {
  return Response.json(
    {
      success: false,
      data: null,
      error: { code: 'INVALID_EMAIL', message: 'Please provide a valid email address.' },
    },
    { status: 400 },
  );
}

export async function POST(request: NextRequest): Promise<Response> {
  let body: LeadPayload | null;
  try {
    body = (await request.json()) as LeadPayload;
  } catch {
    return badEmail();
  }

  const rawEmail = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!rawEmail || rawEmail.length > MAX_EMAIL_LENGTH || !EMAIL_REGEX.test(rawEmail)) {
    return badEmail();
  }

  const source =
    typeof body?.source === 'string' && body.source.trim().length > 0
      ? body.source.trim().slice(0, 64)
      : 'preflight-public';

  try {
    ensurePreflightLeadsTable();
    const db = getDatabase();
    const ip = getClientIp(request);
    const userAgent = request.headers.get('user-agent')?.slice(0, 512) ?? null;

    // INSERT OR IGNORE keeps this idempotent on the unique email index.
    // We never tell the caller which branch hit.
    db.prepare(
      `INSERT OR IGNORE INTO preflight_leads (id, email, source, ip, user_agent)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(randomUUID(), rawEmail, source, ip, userAgent);

    return ok();
  } catch (err) {
    console.error('[API] POST /api/leads/preflight error:', err);
    // Still return 200 to avoid leaking whether the failure was storage
    // or validation. Log server-side for ops visibility.
    return ok();
  }
}
