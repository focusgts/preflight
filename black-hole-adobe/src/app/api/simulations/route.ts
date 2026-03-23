/**
 * POST /api/simulations — Create and run a new simulation
 * GET  /api/simulations — List simulations (optionally filtered by migrationId)
 */

import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { success, error } from '@/lib/api/response';
import { getMigration } from '@/lib/api/store';
import { SimulationEngine } from '@/lib/simulation/simulation-engine';
import { CompatibilityLevel } from '@/types';
import type { MigrationItem } from '@/types';
import type { SimulationDepth, SimulationPhase } from '@/types/simulation';

// Singleton engine (lives for the process lifetime)
const engine = new SimulationEngine();

const ALL_PHASES: SimulationPhase[] = [
  'assessment',
  'code_modernization',
  'content_migration',
  'integration_reconnection',
  'validation',
];

// ── POST ─────────────────────────────────────────────────────────────────

const createSchema = z.object({
  migrationId: z.string().min(1),
  depth: z.enum(['quick', 'standard', 'thorough']).optional().default('standard'),
  phases: z
    .array(z.enum([
      'assessment',
      'code_modernization',
      'content_migration',
      'integration_reconnection',
      'validation',
    ]))
    .optional(),
  riskThreshold: z.number().min(0).max(1).optional().default(0.3),
  generateDiffs: z.boolean().optional().default(true),
  validateIntegrations: z.boolean().optional().default(true),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createSchema.safeParse(body);

    if (!parsed.success) {
      return error('VALIDATION_ERROR', 'Invalid request body', 400, {
        issues: parsed.error.issues,
      });
    }

    const { migrationId, depth, phases, riskThreshold, generateDiffs, validateIntegrations } = parsed.data;

    // Fetch the migration project
    const migration = getMigration(migrationId);
    if (!migration) {
      return error('NOT_FOUND', `Migration ${migrationId} not found`, 404);
    }

    // Create simulation
    const simulation = engine.createSimulation(migrationId, {
      depth: depth as SimulationDepth,
      phases: (phases as SimulationPhase[]) ?? ALL_PHASES,
      riskThreshold,
      generateDiffs,
      validateIntegrations,
    });

    // Build simulated items from migration phases or generate defaults
    const items = migration.phases.flatMap((p) => p.items);

    // If no items yet (migration is in DRAFT), create placeholder items
    const simulationItems = items.length > 0
      ? items
      : generatePlaceholderItems(migration.migrationType);

    // Run simulation asynchronously but wait for it
    const report = await engine.runSimulation(
      simulation.id,
      migration,
      simulationItems,
    );

    const completedSimulation = engine.getSimulation(simulation.id);

    console.log(
      `[API] POST /api/simulations — created ${simulation.id} for migration ${migrationId}`,
    );
    return success({ simulation: completedSimulation, report }, 201);
  } catch (err) {
    console.error('[API] POST /api/simulations error:', err);
    return error('INTERNAL_ERROR', 'Failed to run simulation', 500);
  }
}

// ── GET ──────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const migrationId = params.get('migrationId') ?? undefined;

    const simulations = engine.listSimulations(migrationId);

    console.log(
      `[API] GET /api/simulations — ${simulations.length} simulation(s)`,
    );
    return success(simulations);
  } catch (err) {
    console.error('[API] GET /api/simulations error:', err);
    return error('INTERNAL_ERROR', 'Failed to list simulations', 500);
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────

function generatePlaceholderItems(_migrationType: string): MigrationItem[] {
  const { v4: uuidGen } = require('uuid');

  const baseItems: Array<{ type: string; name: string; sourcePath: string; compatibilityLevel: CompatibilityLevel }> = [
    { type: 'code', name: 'core-components.jar', sourcePath: '/apps/mysite/components', compatibilityLevel: CompatibilityLevel.COMPATIBLE },
    { type: 'code', name: 'custom-servlet.java', sourcePath: '/apps/mysite/servlets/custom-servlet', compatibilityLevel: CompatibilityLevel.MANUAL_FIX },
    { type: 'component', name: 'hero-component', sourcePath: '/apps/mysite/components/hero', compatibilityLevel: CompatibilityLevel.AUTO_FIXABLE },
    { type: 'page', name: 'homepage', sourcePath: '/content/mysite/en/homepage', compatibilityLevel: CompatibilityLevel.COMPATIBLE },
    { type: 'page', name: 'about-us', sourcePath: '/content/mysite/en/about-us', compatibilityLevel: CompatibilityLevel.COMPATIBLE },
    { type: 'content', name: 'hero-fragment', sourcePath: '/content/experience-fragments/mysite/hero', compatibilityLevel: CompatibilityLevel.COMPATIBLE },
    { type: 'asset', name: 'logo.png', sourcePath: '/content/dam/mysite/images/logo.png', compatibilityLevel: CompatibilityLevel.COMPATIBLE },
    { type: 'asset', name: 'banner.jpg', sourcePath: '/content/dam/mysite/images/banner.jpg', compatibilityLevel: CompatibilityLevel.COMPATIBLE },
    { type: 'config', name: 'osgi-config.cfg.json', sourcePath: '/apps/mysite/osgi-config/author', compatibilityLevel: CompatibilityLevel.AUTO_FIXABLE },
    { type: 'config', name: 'dispatcher.any', sourcePath: '/etc/dispatcher/mysite.any', compatibilityLevel: CompatibilityLevel.MANUAL_FIX },
  ];

  return baseItems.map((item) => ({
    id: `item-${uuidGen().slice(0, 8)}`,
    ...item,
    targetPath: null,
    status: 'pending' as const,
    autoFixed: false,
    validationResult: null,
    error: null,
    processedAt: null,
  }));
}
