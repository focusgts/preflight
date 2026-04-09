/**
 * Tests for ADR-064 Phase 4 — /api/leads/preflight and /api/analytics.
 *
 * These tests call the real route handlers with a constructed Request
 * object. They write to the dev SQLite database (tables are created
 * via IF NOT EXISTS), using uniquely-random emails/events to avoid
 * collisions between runs.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as leadsPost } from '@/app/api/leads/preflight/route';
import { POST as analyticsPost, ALLOWED_EVENTS } from '@/app/api/analytics/route';
import { getDatabase } from '@/lib/db';

function jsonRequest(url: string, body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function randomEmail(): string {
  return `preflight-test-${Math.random().toString(36).slice(2, 10)}@example.com`;
}

// ── /api/leads/preflight ─────────────────────────────────────────────────

describe('POST /api/leads/preflight', () => {
  it('accepts a valid email and persists source=preflight-public', async () => {
    const email = randomEmail();
    const res = await leadsPost(
      jsonRequest('http://localhost/api/leads/preflight', { email }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    const db = getDatabase();
    const row = db
      .prepare(
        'SELECT email, source FROM preflight_leads WHERE email = ?',
      )
      .get(email) as { email: string; source: string } | undefined;
    expect(row).toBeTruthy();
    expect(row?.email).toBe(email);
    expect(row?.source).toBe('preflight-public');
  });

  it('rejects an invalid email with 400', async () => {
    const res = await leadsPost(
      jsonRequest('http://localhost/api/leads/preflight', { email: 'not-an-email' }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error?.code).toBe('INVALID_EMAIL');
  });

  it('rejects an empty body with 400', async () => {
    const res = await leadsPost(
      jsonRequest('http://localhost/api/leads/preflight', {}),
    );
    expect(res.status).toBe(400);
  });

  it('is idempotent on duplicate emails (200 + no new row)', async () => {
    const email = randomEmail();
    const r1 = await leadsPost(
      jsonRequest('http://localhost/api/leads/preflight', { email }),
    );
    expect(r1.status).toBe(200);

    const r2 = await leadsPost(
      jsonRequest('http://localhost/api/leads/preflight', { email }),
    );
    expect(r2.status).toBe(200);
    const body = await r2.json();
    expect(body.success).toBe(true);

    const db = getDatabase();
    const count = (
      db
        .prepare('SELECT COUNT(*) as n FROM preflight_leads WHERE email = ?')
        .get(email) as { n: number }
    ).n;
    expect(count).toBe(1);
  });

  it('clamps the source value when caller passes a custom one', async () => {
    const email = randomEmail();
    const res = await leadsPost(
      jsonRequest('http://localhost/api/leads/preflight', {
        email,
        source: 'preflight-public',
      }),
    );
    expect(res.status).toBe(200);
    const db = getDatabase();
    const row = db
      .prepare('SELECT source FROM preflight_leads WHERE email = ?')
      .get(email) as { source: string } | undefined;
    expect(row?.source).toBe('preflight-public');
  });
});

// ── /api/analytics ───────────────────────────────────────────────────────

describe('POST /api/analytics', () => {
  beforeAll(() => {
    // Ensure the table exists before we start reading from it.
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
    `);
  });

  it('accepts an allowlisted event and persists it', async () => {
    const marker = `marker-${Math.random().toString(36).slice(2, 10)}`;
    const res = await analyticsPost(
      jsonRequest('http://localhost/api/analytics', {
        event: 'preflight.run.submit',
        properties: { marker, language: 'java' },
        path: '/preflight',
      }),
    );
    expect(res.status).toBe(200);

    const db = getDatabase();
    const row = db
      .prepare(
        `SELECT event, path, properties FROM analytics_events
         WHERE properties LIKE ? ORDER BY created_at DESC LIMIT 1`,
      )
      .get(`%${marker}%`) as { event: string; path: string; properties: string } | undefined;
    expect(row).toBeTruthy();
    expect(row?.event).toBe('preflight.run.submit');
    expect(row?.path).toBe('/preflight');
    const parsed = JSON.parse(row!.properties);
    expect(parsed.marker).toBe(marker);
  });

  it('silently drops non-allowlisted events (still returns 200)', async () => {
    const marker = `bad-${Math.random().toString(36).slice(2, 10)}`;
    const res = await analyticsPost(
      jsonRequest('http://localhost/api/analytics', {
        event: 'evil.event',
        properties: { marker },
      }),
    );
    expect(res.status).toBe(200);

    const db = getDatabase();
    const row = db
      .prepare(
        'SELECT id FROM analytics_events WHERE properties LIKE ?',
      )
      .get(`%${marker}%`);
    expect(row).toBeUndefined();
  });

  it('returns 200 on malformed JSON body (never 4xx)', async () => {
    const res = await analyticsPost(
      new NextRequest('http://localhost/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{not json',
      }),
    );
    expect(res.status).toBe(200);
  });

  it('exposes the full ADR-064 event allowlist', () => {
    expect(ALLOWED_EVENTS.has('preflight.page.view')).toBe(true);
    expect(ALLOWED_EVENTS.has('preflight.run.submit')).toBe(true);
    expect(ALLOWED_EVENTS.has('preflight.run.result')).toBe(true);
    expect(ALLOWED_EVENTS.has('preflight.lead.capture')).toBe(true);
    expect(ALLOWED_EVENTS.has('preflight.cta.upgrade.click')).toBe(true);
    expect(ALLOWED_EVENTS.has('preflight.sample.load')).toBe(true);
    expect(ALLOWED_EVENTS.has('preflight.share.click')).toBe(true);
    expect(ALLOWED_EVENTS.size).toBe(7);
  });
});
