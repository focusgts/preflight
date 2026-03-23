/**
 * POST /api/leads
 *
 * Captures assessment signup leads. No auth required.
 * Stores in SQLite database.
 */

import { getDatabase } from '@/lib/db';
import { randomUUID } from 'node:crypto';

interface LeadPayload {
  name: string;
  email: string;
  company: string;
  phone?: string | null;
  aemVersion?: string;
  numSites?: number | null;
  companySize?: string;
  compliance?: string[];
  source?: string;
}

function ensureLeadsTable() {
  const db = getDatabase();
  db.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      company TEXT NOT NULL,
      phone TEXT,
      aem_version TEXT,
      num_sites INTEGER,
      company_size TEXT,
      compliance TEXT,
      source TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as LeadPayload;

    if (!body.name || !body.email || !body.company) {
      return Response.json(
        {
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'Name, email, and company are required.',
          },
        },
        { status: 400 },
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return Response.json(
        {
          success: false,
          error: {
            code: 'INVALID_EMAIL',
            message: 'Please provide a valid email address.',
          },
        },
        { status: 400 },
      );
    }

    ensureLeadsTable();

    const db = getDatabase();
    const id = randomUUID();

    db.prepare(
      `INSERT INTO leads (id, name, email, company, phone, aem_version, num_sites, company_size, compliance, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      body.name.trim(),
      body.email.trim().toLowerCase(),
      body.company.trim(),
      body.phone || null,
      body.aemVersion || null,
      body.numSites || null,
      body.companySize || null,
      body.compliance ? JSON.stringify(body.compliance) : null,
      body.source || 'unknown',
    );

    return Response.json(
      {
        success: true,
        data: { id },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: id,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    console.error('Lead capture error:', err);
    return Response.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to capture lead. Please try again.',
        },
      },
      { status: 500 },
    );
  }
}
