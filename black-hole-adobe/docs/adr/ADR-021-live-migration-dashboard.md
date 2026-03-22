# ADR-021: Live Migration Dashboard

**Status:** Accepted
**Date:** 2026-03-22
**Authors:** Migration Platform Team

## Context

Customers need real-time visibility into their migration execution. The existing portal shows static mock data. We need a live dashboard that displays real-time metrics, phase progress, and event logs during migration execution.

## Decision

### SSE + Polling Hybrid Architecture

We adopt a hybrid approach combining Server-Sent Events (SSE) and HTTP polling:

- **SSE** (`useMigrationProgress`) for discrete events (item processed, phase started, errors). SSE provides low-latency push delivery for the event feed, giving the dashboard its real-time feel.
- **Polling** (`useLiveMetrics`, 5-second interval) for aggregated metrics (throughput, item counts, phase breakdown). Metrics are computed server-side and change gradually, making polling the simpler and more reliable choice.

This avoids the complexity of WebSocket connection management while delivering a responsive experience. SSE reconnection is handled automatically with exponential backoff.

### Customer-Facing Design Decisions

The dashboard is designed for non-technical stakeholders watching their migration:

1. **Simplicity over technical detail** — Large progress ring, formatted counters, plain-English event messages. No raw IDs, stack traces, or technical jargon.
2. **Animated counters** — Numbers roll up smoothly rather than jumping, creating a sense of continuous progress.
3. **Color-coded status** — Green (on track), amber (slowing), red (stalled) for throughput. Color-coded event types (info, success, warning, error).
4. **Pulsing active phase** — The currently executing phase uses a shimmer gradient animation to draw attention.

### Mock Data Simulation

For demos and development, `getMockLiveMetrics` provides stateful mock data:

- Uses a global call counter that persists across requests in the same server process.
- Each call advances progress slightly (~0.5% per call, ~200 calls to completion).
- Generates realistic event messages with randomized paths, asset names, and sizes.
- Throughput varies sinusoidally to simulate natural fluctuations.
- Phases complete sequentially based on weighted progress fractions.

This approach lets the demo feel like a real migration without requiring backend infrastructure.

### Performance Considerations

1. **DOM updates** — Animated counters use `requestAnimationFrame` with cubic ease-out. Only the changing numbers re-render, not the entire dashboard.
2. **Event feed memory** — Capped at 100 displayed events. Older events are discarded from the display buffer. The `AnimatePresence` wrapper handles exit animations without accumulating DOM nodes.
3. **Sparkline rendering** — SVG path is memoized and only recomputed when throughput history changes. The chart uses a fixed-width SVG rather than a canvas to avoid layout thrashing.
4. **Polling cleanup** — The `useLiveMetrics` hook clears its interval on unmount. The `useMigrationProgress` SSE hook closes the EventSource and cancels reconnection timers.

## Consequences

- Customers get real-time visibility without complex WebSocket infrastructure.
- Demo mode works without any backend — the mock data module handles simulation.
- The polling interval (5s) is a reasonable trade-off between responsiveness and server load.
- The 100-event cap prevents memory growth during long-running migrations.
- SSE reconnection with backoff handles intermittent network issues gracefully.

## File Map

| File | Purpose |
|------|---------|
| `src/app/(portal)/portal/[orgId]/migration/[migrationId]/page.tsx` | Live migration detail view |
| `src/app/(portal)/portal/[orgId]/layout.tsx` | Portal layout with navigation |
| `src/hooks/use-live-metrics.ts` | Polling hook for aggregated metrics |
| `src/components/portal/live-counter.tsx` | Animated number counter |
| `src/components/portal/transfer-speed.tsx` | Throughput indicator with sparkline |
| `src/components/portal/event-feed.tsx` | Scrolling event log |
| `src/app/api/migrations/[id]/metrics/route.ts` | Metrics API endpoint |
| `src/config/mock-live-data.ts` | Mock data simulation module |
