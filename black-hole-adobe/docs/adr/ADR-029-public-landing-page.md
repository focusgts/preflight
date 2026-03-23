# ADR-029: Public Landing Page & Assessment Signup

## Status

Accepted

## Context

Black Hole needs a public-facing marketing site that converts visitors into free assessment signups. The platform previously redirected all unauthenticated users to `/login`, which provided no information about the product and zero conversion opportunity.

Key requirements:

- **Conversion-focused design** -- The landing page is the first (and often only) touchpoint with prospects. It must communicate value, build trust, and drive assessment signups.
- **No authentication required** -- The landing page, assessment signup, health score, and ROI calculator must all be accessible without login.
- **Lead capture** -- Assessment signups are stored as leads in the database for follow-up.
- **SEO readiness** -- The root `/` path renders the landing page server-side (with client interactivity) for search engine indexing.

## Decision

### Architecture

1. **Root page (`src/app/page.tsx`)** is a server component that checks for an active session. Authenticated users redirect to `/overview`; unauthenticated users see the full landing page via `LandingPageClient`.

2. **Public route group (`src/app/(public)/`)** wraps sub-pages like `/assessment` with a shared public layout (header + footer). The root `/` path is handled by the root `page.tsx` to enable server-side auth checks.

3. **Proxy (middleware)** updated to allow `/`, `/score`, `/calculator`, `/assessment`, and `/api/leads` without authentication.

4. **Lead capture API (`/api/leads`)** stores signups in a `leads` table in the existing SQLite database. No authentication required. Input validation at the boundary.

### Landing Page Sections

Single-page scroll design with these sections:

- **Hero** -- Value proposition with gradient text, countdown to AEM 6.5 EOL, dual CTAs
- **Problem Stats** -- Animated counters showing market crisis ($12.5B, 14K+ orgs, overruns)
- **Features Grid** -- 6 capabilities with scroll-triggered stagger animations
- **Comparison Table** -- Traditional SI vs Black Hole with animated bar charts
- **How It Works** -- 3-step process (assess, review, migrate)
- **Trust Section** -- Technology partners and Focus GTS branding
- **CTA Form** -- Assessment signup with form validation and success state

### Design Decisions

- **CSS-only animations** -- No heavy animation libraries. Intersection Observer for scroll triggers, CSS transitions for effects. Keeps bundle small.
- **Dark theme** -- Consistent with the authenticated dashboard. Violet-to-cyan gradient as the primary accent.
- **Glass morphism** -- Frosted glass cards with `backdrop-blur` for depth.
- **Responsive** -- Mobile-first with breakpoints at `sm`, `md`, `lg`.

### SEO Approach

- Server component at root for initial HTML render
- Semantic HTML with proper heading hierarchy
- Meta tags in root layout
- Public paths accessible without auth redirects

## Consequences

### Positive

- Unauthenticated visitors now see product value instead of a login wall
- Lead capture enables sales follow-up
- Consistent dark theme between marketing and product
- No additional dependencies for animations

### Negative

- Root `page.tsx` mixes auth logic with content rendering (acceptable trade-off for SEO)
- Landing page components are client-side rendered after initial server render
- Lead data stored in SQLite (adequate for current scale, may need migration to external DB later)

### Risks

- Landing page performance depends on keeping animations CSS-only
- Lead form has no CAPTCHA (should be added before high-traffic launch)
