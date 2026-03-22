# ADR-014: SSE over WebSocket for Real-Time Progress

## Status

Accepted

## Date

2026-03-21

## Context

The migration platform needs real-time progress updates to show users the status of long-running migration operations. We need to decide between WebSocket and Server-Sent Events (SSE) for the transport mechanism.

The application is built on Next.js App Router (v16), which uses standard Web Request/Response APIs for route handlers.

### Requirements

- Deliver real-time progress updates from server to client during migration execution.
- Display phase transitions, item-level processing status, and error events.
- Support automatic reconnection on network interruptions.
- Work within the Next.js App Router architecture without additional infrastructure.

## Decision

Use **Server-Sent Events (SSE)** instead of WebSocket for real-time migration progress.

## Rationale

### 1. Unidirectional Data Flow is Sufficient

Progress updates flow exclusively from server to client. The client never needs to send messages back through the progress channel - any client actions (pause, cancel) use standard REST endpoints. SSE is purpose-built for this pattern.

### 2. Next.js App Router Compatibility

Next.js App Router route handlers return `Response` objects using the Web API. SSE works natively by returning a `ReadableStream` with `text/event-stream` content type. WebSocket requires upgrading the HTTP connection, which is not supported by Next.js route handlers without a custom server or middleware.

### 3. Automatic Reconnection

The `EventSource` browser API includes built-in reconnection logic with configurable retry intervals. With WebSocket, reconnection must be implemented manually. This reduces client-side code complexity.

### 4. Simpler Infrastructure

SSE uses standard HTTP/1.1 or HTTP/2 connections. No additional WebSocket server, load balancer configuration, or sticky sessions are required. This simplifies deployment to platforms like Vercel, AWS, and standard CDN/proxy setups.

### 5. Sufficient Performance

Migration progress updates are low-frequency (typically 1-10 events per second). SSE handles this volume easily. WebSocket's lower overhead per message is unnecessary at these rates.

## Consequences

### Positive

- Zero additional infrastructure or dependencies.
- Works out of the box with Next.js App Router route handlers.
- Built-in browser reconnection via `EventSource`.
- Standard HTTP means no proxy/firewall issues.
- Simpler debugging - events are visible in browser DevTools Network tab.

### Negative

- Cannot send messages from client to server through the same connection (use REST for that).
- Limited to ~6 concurrent connections per domain in HTTP/1.1 (HTTP/2 multiplexing eliminates this).
- Text-only transport (JSON serialisation required, but we use JSON for all API responses anyway).

## Implementation

- **Server**: `GET /api/migrations/[id]/progress` returns a `ReadableStream` with `text/event-stream` content type. Subscribes to `ProgressEventBus` singleton for the given migration ID.
- **Client**: `useMigrationProgress(migrationId)` hook wraps `EventSource` with auto-reconnect, state management, and event history.
- **Event Bus**: In-memory `ProgressEventBus` singleton broadcasts events from migration engine workers to SSE route handlers via callbacks.

## Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| WebSocket | Requires custom server; not supported by Next.js route handlers natively |
| Polling | Higher latency, unnecessary server load, worse user experience |
| WebTransport | Not widely supported yet; excessive for this use case |
| Third-party (Pusher, Ably) | Adds external dependency and cost for a feature that works natively |
