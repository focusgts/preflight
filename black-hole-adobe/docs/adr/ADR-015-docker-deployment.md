# ADR-015: Containerised Deployment with Docker

**Status:** Accepted
**Date:** 2026-03-21
**Deciders:** Platform Engineering

## Context

Black Hole for Adobe Marketing Cloud is a Next.js application backed by SQLite. We need a repeatable, portable deployment strategy that works across local development, CI, and cloud hosting without requiring teams to install specific Node.js versions or manage OS-level dependencies.

## Decision

We will provide a multi-stage Docker build alongside a Docker Compose configuration for local orchestration.

### Multi-stage Dockerfile

| Stage | Base | Purpose |
|-------|------|---------|
| `deps` | `node:20-alpine` | Install production `node_modules` via `npm ci` |
| `builder` | `node:20-alpine` | Build Next.js standalone output |
| `runner` | `node:20-alpine` | Minimal production image (~120 MB) |

Key design choices:

1. **Standalone output** -- Next.js `output: 'standalone'` produces a self-contained `server.js` with only the required `node_modules` subset, keeping the final image small.
2. **Non-root user** -- The runner stage creates a `nextjs` user (UID 1001) to follow the principle of least privilege.
3. **Health check** -- The container includes a `HEALTHCHECK` directive that calls `GET /api/health`, which already exists in the codebase.
4. **Data volume** -- `/app/data` is declared as a Docker volume so that SQLite data and uploaded files survive container restarts.

### Docker Compose

A single `docker-compose.yml` defines:

- The `black-hole` service built from the local Dockerfile.
- Named volumes for database persistence (`blackhole-data`) and uploads (`blackhole-uploads`).
- Environment variables passed from the host `.env` file or shell.
- Port mapping `3000:3000`.

### Environment configuration

A `.env.example` file documents every configurable value with sensible defaults. The setup script copies it to `.env` on first run.

## Consequences

### Positive

- Any developer can run `docker compose up --build` with no local Node.js install.
- Identical image runs in CI, staging, and production.
- SQLite data is persisted across container restarts via named volumes.
- Small attack surface: Alpine base, non-root user, no unnecessary packages.

### Negative

- SQLite inside a container is not suitable for horizontally scaled deployments; a future ADR should address migration to PostgreSQL if multi-instance scaling is required.
- Developers modifying source code still need a local Node.js install for `npm run dev`; the container is optimised for production, not hot-reloading.

### Neutral

- The setup and seed scripts (`scripts/setup.sh`, `scripts/seed.sh`) remain useful for non-Docker workflows and CI pipelines.

## Alternatives Considered

1. **Bare-metal Node.js only** -- Rejected because it requires each developer to maintain the correct Node.js version and system dependencies.
2. **Docker with PostgreSQL** -- Deferred; SQLite is sufficient for the current single-instance deployment model and avoids an additional service dependency.
3. **Serverless (Vercel / AWS Lambda)** -- Viable for the Next.js frontend but complicates SQLite persistence; may be revisited once the data layer is extracted.
