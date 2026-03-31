# ADR-033: Integration Discovery & Mapping

## Status: Proposed

## Date: 2026-03-28

## Context

Adobe's BPA completely ignores third-party integrations. In enterprise AEM installations (5-15 years old), 30-50% of integrations are undocumented. AEM implementations routinely integrate with Adobe Target, Adobe Analytics, Salesforce, Marketo, custom REST APIs, content delivery networks, PIM systems, e-commerce platforms, and more. AEMaaCS introduces strict networking constraints (egress IP model, Advanced Networking requirements, no direct filesystem access) that break many integration patterns. Migration failures from broken integrations are cited by multiple practitioner sources (Valtech, Exadel, NextRow) as the most common source of post-migration production issues.

No tool in Adobe's stack discovers or maps integrations. Every SI firm does this manually -- typically taking 1-2 weeks per engagement for discovery alone.

## Decision

Build an Integration Discovery & Mapping module that operates at two levels:

### 1. External Discovery (from health score scan, ADR-030)

- Detect third-party JavaScript tags in page HTML (Adobe Analytics, Google Analytics, Adobe Target, Tealium, Segment, etc.)
- Detect CDN provider from DNS/headers (Fastly, Akamai, CloudFront, Cloudflare)
- Detect DAM/media integrations from asset URLs (Scene7, external DAM references)
- Detect form service integrations (Marketo forms, HubSpot, Pardot)
- Detect e-commerce platform integrations (Magento/Adobe Commerce, Shopify, custom)
- Confidence: 50-70% (surface-level, external only)

### 2. Deep Discovery (from codebase/BPA analysis -- paid tier)

- Parse OSGi configurations for external service URLs and connection pools
- Scan Sling Models and servlets for HTTP client usage and external API calls
- Map Sling Resource Merger overlays that reference third-party services
- Identify custom authentication handlers (SAML, OAuth, LDAP, SSO)
- Detect Workflow process steps that call external systems
- Map Event Handlers and Listeners that trigger external calls
- Catalog replication agents pointing to external endpoints
- Confidence: 80-95%

### 3. AEMaaCS Compatibility Assessment per Integration

- Flag integrations that use direct filesystem access (incompatible with Cloud Service)
- Flag integrations that require static IP (needs Advanced Networking)
- Flag integrations that use custom Apache modules (not available in Cloud Service)
- Flag integrations using custom SSL certificates (managed by Adobe CDN in Cloud Service)
- Flag integrations relying on specific JVM system properties (not configurable in Cloud Service)
- Provide migration path recommendation per integration (compatible as-is, needs modification, needs replacement)

### 4. Output: Integration Map

- Visual dependency graph showing AEM to external system connections
- Per-integration risk score (will it survive migration?)
- Effort estimate per integration reconnection (tied to ADR-032)
- Priority ordering: which integrations to migrate first based on business criticality

## Consequences

- **Positive**: Eliminates the most common source of post-migration production failures.
- **Positive**: Discovers undocumented integrations that would otherwise be found only when they break in production.
- **Positive**: External discovery layer enhances the free health score with actionable intelligence.
- **Negative**: Deep discovery requires codebase access (paid tier only).
- **Negative**: Dynamic integrations (configured at runtime, not in code) may be missed even in deep scan.
