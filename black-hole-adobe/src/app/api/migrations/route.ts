/**
 * GET /api/migrations  — List migrations with filtering, pagination, sorting
 * POST /api/migrations — Create a new migration project
 */

import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { MigrationStatus, MigrationType } from '@/types';
import { success, error, paginated } from '@/lib/api/response';
import { listMigrations, createMigration } from '@/lib/api/store';

// ── GET ──────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;

    const page = Math.max(1, Number(params.get('page') ?? '1'));
    const pageSize = Math.min(100, Math.max(1, Number(params.get('pageSize') ?? '20')));
    const sortBy = params.get('sortBy') ?? 'updatedAt';
    const sortOrder = params.get('sortOrder') === 'asc' ? 'asc' : 'desc';
    const statusFilter = params.get('status') as MigrationStatus | null;
    const typeFilter = params.get('type') as MigrationType | null;
    const orgFilter = params.get('organizationId');
    const search = params.get('search')?.toLowerCase();

    let items = listMigrations();

    // Filtering
    if (statusFilter) {
      items = items.filter((m) => m.status === statusFilter);
    }
    if (typeFilter) {
      items = items.filter((m) => m.migrationType === typeFilter);
    }
    if (orgFilter) {
      items = items.filter((m) => m.organizationId === orgFilter);
    }
    if (search) {
      items = items.filter(
        (m) =>
          m.name.toLowerCase().includes(search) ||
          m.organizationName.toLowerCase().includes(search),
      );
    }

    // Sorting
    const validSortFields = ['createdAt', 'updatedAt', 'name', 'progress', 'riskScore', 'status'] as const;
    const field = validSortFields.includes(sortBy as typeof validSortFields[number])
      ? (sortBy as keyof typeof items[0])
      : 'updatedAt';

    items.sort((a, b) => {
      const aVal = a[field];
      const bVal = b[field];
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    const totalItems = items.length;
    const start = (page - 1) * pageSize;
    const paged = items.slice(start, start + pageSize);

    console.log(`[API] GET /api/migrations — ${totalItems} total, page ${page}`);
    return paginated(paged, page, pageSize, totalItems);
  } catch (err) {
    console.error('[API] GET /api/migrations error:', err);
    return error('INTERNAL_ERROR', 'Failed to list migrations', 500);
  }
}

// ── POST ─────────────────────────────────────────────────────────────────

const createMigrationSchema = z.object({
  name: z.string().min(1).max(200),
  organizationId: z.string().min(1),
  organizationName: z.string().min(1),
  migrationType: z.nativeEnum(MigrationType),
  productsInScope: z.array(z.string()).min(1),
  complianceRequirements: z.array(z.string()).optional().default([]),
  sourceEnvironment: z.object({
    platform: z.string().min(1),
    version: z.string().min(1),
    url: z.string().nullable().optional().default(null),
    connectionType: z.enum(['api', 'file_upload', 'git', 'package']),
    metadata: z.record(z.string(), z.unknown()).optional().default({}),
  }),
  targetEnvironment: z.object({
    platform: z.string().min(1),
    organizationId: z.string().min(1),
    programId: z.string().nullable().optional().default(null),
    environmentId: z.string().nullable().optional().default(null),
    url: z.string().nullable().optional().default(null),
    metadata: z.record(z.string(), z.unknown()).optional().default({}),
  }),
  targetCompletionDate: z.string().nullable().optional().default(null),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createMigrationSchema.safeParse(body);

    if (!parsed.success) {
      return error('VALIDATION_ERROR', 'Invalid request body', 400, {
        issues: parsed.error.issues,
      });
    }

    const data = parsed.data;
    const now = new Date().toISOString();

    const project = createMigration({
      id: `mig-${uuidv4().slice(0, 8)}`,
      name: data.name,
      organizationId: data.organizationId,
      organizationName: data.organizationName,
      migrationType: data.migrationType,
      status: MigrationStatus.DRAFT,
      productsInScope: data.productsInScope as never[],
      complianceRequirements: data.complianceRequirements as never[],
      sourceEnvironment: {
        ...data.sourceEnvironment,
        url: data.sourceEnvironment.url ?? null,
        credentials: null,
        metadata: data.sourceEnvironment.metadata ?? {},
      },
      targetEnvironment: {
        ...data.targetEnvironment,
        programId: data.targetEnvironment.programId ?? null,
        environmentId: data.targetEnvironment.environmentId ?? null,
        url: data.targetEnvironment.url ?? null,
        credentials: null,
        metadata: data.targetEnvironment.metadata ?? {},
      },
      assessment: null,
      phases: [],
      riskScore: 0,
      estimatedDurationWeeks: 0,
      estimatedCost: 0,
      actualCost: null,
      progress: 0,
      createdAt: now,
      updatedAt: now,
      targetCompletionDate: data.targetCompletionDate ?? null,
      completedAt: null,
    });

    console.log(`[API] POST /api/migrations — created ${project.id}`);
    return success(project, 201);
  } catch (err) {
    console.error('[API] POST /api/migrations error:', err);
    return error('INTERNAL_ERROR', 'Failed to create migration', 500);
  }
}
