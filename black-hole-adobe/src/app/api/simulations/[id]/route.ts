/**
 * GET /api/simulations/[id] — Get simulation results and report
 */

import { type NextRequest } from 'next/server';
import { success, error } from '@/lib/api/response';
import { SimulationEngine } from '@/lib/simulation/simulation-engine';

const engine = new SimulationEngine();

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(
  _request: NextRequest,
  { params }: RouteParams,
) {
  try {
    const { id } = await params;
    const simulation = engine.getSimulation(id);

    if (!simulation) {
      return error('NOT_FOUND', `Simulation ${id} not found`, 404);
    }

    const report = engine.getSimulationReport(id);

    console.log(`[API] GET /api/simulations/${id}`);
    return success({ simulation, report });
  } catch (err) {
    console.error('[API] GET /api/simulations/[id] error:', err);
    return error('INTERNAL_ERROR', 'Failed to get simulation', 500);
  }
}
