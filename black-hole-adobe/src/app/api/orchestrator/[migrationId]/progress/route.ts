/**
 * GET /api/orchestrator/[migrationId]/progress
 *
 * ADR-062: Server-Sent Events stream for the orchestrator's background
 * execution runtime. Polls `executionRuntime.getProgress()` for the given
 * migration and emits a frame every 2s. Closes when the job is no longer
 * tracked (finished and cleaned up, or never started).
 */

import { executionRuntime } from '@/lib/orchestrator/execution-runtime';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ migrationId: string }> },
) {
  const { migrationId } = await params;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let interval: ReturnType<typeof setInterval>;
      const tick = () => {
        const job = executionRuntime.getProgress(migrationId);
        if (!job) {
          try {
            controller.enqueue(
              encoder.encode(`event: end\ndata: {"reason":"not-found"}\n\n`),
            );
            controller.close();
          } catch {
            /* already closed */
          }
          clearInterval(interval);
          return;
        }

        const payload = {
          migrationId: job.migrationId,
          phase: job.phase,
          correlationId: job.correlationId,
          startedAt: new Date(job.startedAt).toISOString(),
          finishedAt: job.finishedAt ? new Date(job.finishedAt).toISOString() : null,
          progress: job.lastProgress,
          running: job.finishedAt === undefined,
        };

        try {
          controller.enqueue(
            encoder.encode(`event: progress\ndata: ${JSON.stringify(payload)}\n\n`),
          );
        } catch {
          clearInterval(interval);
          return;
        }

        if (job.finishedAt !== undefined) {
          try {
            controller.enqueue(encoder.encode(`event: end\ndata: {"reason":"complete"}\n\n`));
            controller.close();
          } catch {
            /* already closed */
          }
          clearInterval(interval);
        }
      };

      // Emit immediately, then every 2s.
      interval = setInterval(tick, 2000);
      tick();
    },

    cancel() {
      // No persistent resources beyond the interval, which is cleared above.
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
