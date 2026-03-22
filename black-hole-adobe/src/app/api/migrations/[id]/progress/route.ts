/**
 * GET /api/migrations/[id]/progress
 *
 * Server-Sent Events endpoint for real-time migration progress.
 * Streams progress events as they occur via the ProgressEventBus.
 */

import { progressEventBus } from '@/lib/progress/event-bus';
import type { ProgressEvent } from '@/lib/progress/types';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: migrationId } = await params;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      const connectMsg = formatSSE({
        type: 'phase_start',
        migrationId,
        phase: 'connection',
        progress: 0,
        message: 'Connected to progress stream',
        timestamp: new Date().toISOString(),
        details: {},
      });
      controller.enqueue(encoder.encode(connectMsg));

      // Subscribe to progress events for this migration
      const unsubscribe = progressEventBus.subscribe(migrationId, (event: ProgressEvent) => {
        try {
          const msg = formatSSE(event);
          controller.enqueue(encoder.encode(msg));

          // Close the stream when migration completes or fails
          if (event.type === 'migration_complete' || event.type === 'error') {
            setTimeout(() => {
              try {
                controller.close();
              } catch {
                // Stream may already be closed
              }
            }, 500);
          }
        } catch {
          // Stream was closed by client
          unsubscribe();
        }
      });

      // Send a heartbeat every 15 seconds to keep the connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          clearInterval(heartbeat);
          unsubscribe();
        }
      }, 15_000);

      // Handle stream cancellation
      const originalCancel = stream.cancel?.bind(stream);
      stream.cancel = (reason) => {
        clearInterval(heartbeat);
        unsubscribe();
        console.log(`[SSE] Client disconnected from migration ${migrationId}`);
        return originalCancel?.(reason) ?? Promise.resolve();
      };
    },

    cancel() {
      console.log(`[SSE] Stream cancelled for migration ${migrationId}`);
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}

/**
 * Format a ProgressEvent as an SSE message.
 */
function formatSSE(event: ProgressEvent): string {
  const data = JSON.stringify(event);
  return `event: ${event.type}\ndata: ${data}\n\n`;
}
