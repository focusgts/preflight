# ADR-055: WordPress Connector & Migration Engine

## Status: Proposed

## Date: 2026-03-31

## Context

WordPress to AEM is the number one cross-platform migration path. Black Hole has a `MigrationType` enum value, assessment profile, schema mapping, and MAC template for this path, but zero actual connector or transformation code. No code connects to WordPress, extracts content, or transforms it for AEM.

WordPress powers approximately 40% of the web. Many enterprise customers outgrow WordPress and move to AEM for personalization, multi-site management, and Adobe stack integration. This is a high-volume migration path.

## Decision

### 1. WordPress connector

Create `src/lib/connectors/wordpress-connector.ts`:

- Connect via WP REST API v2 (`/wp-json/wp/v2/`)
- Extract content types: pages, posts, media, categories, tags, menus, users, custom post types
- Authentication: basic auth, application passwords, JWT auth (via WP JWT plugin)
- Handle pagination using WP Link headers (`X-WP-Total`, `X-WP-TotalPages`)
- Extract featured images and inline media references
- Extract ACF (Advanced Custom Fields) data via `/wp-json/acf/v3/`
- Extract Yoast SEO metadata via `/wp-json/yoast/v1/`
- Support WP Multisite: enumerate sites via `/wp-json/wp/v2/sites` and extract per-site

### 2. WordPress-to-AEM transformer

Create `src/lib/migration/wordpress-transformer.ts`:

- Convert WordPress block editor (Gutenberg) blocks to AEM Core Components:
  - `core/paragraph` -> `core/wcm/components/text/v2/text`
  - `core/image` -> `core/wcm/components/image/v3/image`
  - `core/heading` -> `core/wcm/components/title/v3/title`
  - `core/list` -> `core/wcm/components/list/v4/list`
  - `core/quote` -> `core/wcm/components/text/v2/text` (with quote styling)
  - `core/embed` -> `core/wcm/components/embed/v2/embed`
  - `core/gallery` -> `core/wcm/components/carousel/v1/carousel`
  - `core/table` -> `core/wcm/components/text/v2/text` (HTML table)
  - `core/buttons` -> `core/wcm/components/button/v2/button`
- Convert Classic Editor HTML content via DOM parsing to component tree
- Convert shortcodes to AEM component configurations where mappings exist
- Map WordPress categories/tags to AEM tag taxonomy (`/content/cq:tags/`)
- Convert WordPress media library paths to AEM DAM paths (`/content/dam/{site}/`)
- Preserve SEO metadata: Yoast title/description -> AEM `jcr:title`, `jcr:description`, `cq:tags`
- Map WordPress user roles to AEM group memberships

### 3. Migration orchestrator

Create `src/lib/migration/wordpress-to-aem.ts`:

- Phase 1 — Extract: pull all content from WordPress via connector
- Phase 2 — Transform: convert to AEM content structure via transformer
- Phase 3 — Load: write to AEM via Sling POST / Package Manager (ADR-050)
- Phase 4 — Validate: compare page counts, verify media assets, check broken links
- Progress streaming via SSE throughout all phases

### 4. API endpoint

Create `POST /api/migrations/[id]/wordpress/extract` in `src/app/api/migrations/[id]/wordpress/extract/route.ts`:

- Accepts: `{ wordpressUrl: string, auth: { type: 'basic' | 'jwt', credentials: object }, options: { includeMedia: boolean, includeUsers: boolean } }`
- Returns: extraction progress via SSE, final summary with item counts

## Consequences

**Positive:**
- Opens the WordPress-to-AEM migration market (100K+ WordPress sites considering AEM)
- WP REST API is well-documented and stable
- Block editor (Gutenberg) has a structured JSON format that maps cleanly to AEM components
- Reuses the content transfer infrastructure from ADR-050

**Negative:**
- WordPress customization is effectively infinite (50K+ plugins) — we can only handle core patterns and common plugins (ACF, Yoast, WooCommerce)
- Classic Editor content is unstructured HTML that requires heuristic parsing
- Shortcode conversion is plugin-specific and cannot be fully automated
- Custom post types with complex meta fields require per-site mapping configuration

**Estimated effort:** 100-140 hours
