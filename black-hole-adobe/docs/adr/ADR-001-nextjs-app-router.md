# ADR-001: Next.js App Router as Application Framework

## Status: Accepted

## Date: 2026-03-21

## Context

Black Hole for Adobe Marketing Cloud requires a full-stack web framework to power both the UI dashboard and the API layer. The platform needs server-side rendering for SEO-sensitive reporting pages, streaming responses for long-running AI analysis, API routes for the migration engine, and a modern React-based component architecture for the interactive dashboard.

Key requirements:
- Server-side rendering and static generation for performance
- API route handlers co-located with the application
- Streaming support for AI-powered assessment and transformation operations
- TypeScript-first developer experience
- Strong ecosystem for enterprise deployment (Vercel, Docker, standalone)
- React Server Components for data-heavy dashboard views

Candidates evaluated: Next.js App Router, Remix, SvelteKit, standalone Express + React SPA.

## Decision

We chose Next.js App Router (v16) as the application framework for Black Hole.

Rationale:

1. **React Server Components** reduce client-side bundle size for data-heavy dashboard and report pages. Migration project lists, assessment reports, and connector status views are naturally server-rendered.

2. **Route Handlers** provide a clean API layer without a separate backend service. Each migration lifecycle endpoint (assess, transform, execute, validate) maps directly to a route handler file, keeping the codebase navigable.

3. **Streaming** is built in via the Web Streams API. AI-powered assessment and code analysis can stream partial results to the client as they complete, which is critical for operations that can take 30-60 seconds.

4. **TypeScript integration** is first-class. Path aliases, strict mode, and generated route types work out of the box.

5. **Deployment flexibility** supports Vercel for quick iteration, Docker for enterprise on-premises deployment, and standalone Node.js output for air-gapped environments common in financial services and healthcare customers.

6. **Ecosystem maturity** provides middleware for authentication, image optimisation for DAM previews, and incremental static regeneration for cached report pages.

## Consequences

**Positive:**
- Single deployment unit for UI + API simplifies operations
- React Server Components reduce time-to-interactive on data-heavy pages
- Built-in streaming reduces perceived latency for AI operations
- Large talent pool familiar with Next.js reduces hiring friction
- File-system routing makes the API surface self-documenting

**Negative:**
- App Router is more complex than Pages Router; team requires training on server/client component boundaries
- Vendor coupling to Vercel for certain optimisations (though standalone mode mitigates this)
- Route Handlers have no built-in middleware chaining; we must implement our own pattern for auth, logging, and rate limiting
- Dynamic route params are now Promises (v15+ breaking change), requiring `await params` in all handlers

**Mitigations:**
- Established clear `'use client'` boundary conventions in CLAUDE.md
- Built a shared response helper (`src/lib/api/response.ts`) to standardise all API responses
- Will add middleware layer for auth/logging in a future milestone

## Alternatives Considered

**Remix:** Strong data loading model with loaders/actions, but smaller ecosystem and less enterprise adoption. Streaming support is good but the community around Adobe integrations is minimal.

**SvelteKit:** Excellent performance and developer experience, but the team has deep React expertise. Svelte's ecosystem lacks enterprise component libraries needed for complex data visualisation (Recharts, etc.).

**Express + React SPA:** Maximum flexibility, but doubles the deployment surface. Requires separate build pipelines, CORS configuration, and loses the benefits of server-side rendering and React Server Components. Higher operational overhead for a small initial team.
