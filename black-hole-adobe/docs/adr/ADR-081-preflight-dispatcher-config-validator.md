# ADR-081: Pre-Flight™ Dispatcher Configuration Validator

## Status: Proposed

## Date: 2026-04-15

## Context

AEM Cloud Service has strict requirements for Dispatcher configurations that differ significantly from on-premise and AMS deployments. Adobe provides the Dispatcher Optimization Tool (DOT) as a Docker-based validator, but it requires Docker, a local SDK, and command-line familiarity. No web-based alternative exists anywhere — not from Adobe, not from any community tool, not from any competitor.

Dispatcher misconfigurations are the second most common cause of Cloud Manager pipeline failures (after deprecated APIs). Teams migrating from on-premise or AMS environments almost always have Dispatcher configurations that violate Cloud Service requirements: custom rewrite rules that aren't allowed, filter patterns that are too permissive, missing required headers, and cache configurations that don't align with CDN-first architecture.

Front-end developers and content authors who touch Dispatcher configs (adding redirects, cache rules, etc.) are particularly underserved. They can't run Docker locally, don't have Java/Maven installed, and have no way to validate their changes before pushing to a pipeline that takes 45+ minutes to fail.

This is the single biggest gap in the browser-based tooling landscape. Building this makes Pre-Flight™ indispensable rather than merely convenient.

## Decision

Add a Dispatcher Configuration Validator to Pre-Flight™ that parses and validates `dispatcher.any`, `.vhost`, `.farm`, and rewrite rule files entirely client-side in the browser.

### Supported File Types

| File Type | Extension | Purpose |
|-----------|-----------|---------|
| Dispatcher config | `dispatcher.any` | Main configuration entry point |
| Farm files | `*.farm` | Virtual host to render mapping |
| Vhost files | `*.vhost` | Apache virtual host definitions |
| Rewrite rules | `rewrite.rules` | URL rewrite/redirect rules |
| Filter rules | `*.any` (filter context) | Request filtering rules |
| Cache rules | `*.any` (cache context) | Cache invalidation and TTL rules |
| Variables | `custom.vars` | Environment-specific variables |

### Validation Rules

#### Required Structure Rules

| Rule | Severity | Description |
|------|----------|-------------|
| ImmutableFilesUnmodified | Blocker | Default files from SDK must not be modified (only `conf.d/available_vhosts`, `conf.d/variables`, `conf.dispatcher.d/available_farms`, `conf.dispatcher.d/cache` are customizable) |
| RequiredIncludes | Critical | Farm files must include required snippets (`$include "../cache/default_rules.any"`, etc.) |
| FolderStructure | Blocker | Directory structure must match SDK template (no custom top-level directories) |
| SymlinkConvention | Critical | `enabled_vhosts` and `enabled_farms` must use symlinks (validated via naming conventions) |

#### Filter Rules

| Rule | Severity | Description |
|------|----------|-------------|
| DefaultDenyFirst | Critical | Filter must start with `/0001 { /type "deny" /url "*" }` |
| NoGlobAllow | Major | Filter should not use `/glob "*"` allow patterns (too permissive) |
| SelectorBlocking | Major | Must block `.json`, `.xml`, `.html` selectors not explicitly needed |
| QueryStringFiltering | Major | Must filter dangerous query parameters (`?debug`, `?wcmmode`) |
| MethodRestriction | Critical | Must restrict HTTP methods (allow only GET, HEAD, POST as needed) |

#### Cache Rules

| Rule | Severity | Description |
|------|----------|-------------|
| GracePeriodSet | Major | `/gracePeriod` should be set for stale-while-revalidate behavior |
| StatFileLevel | Critical | `/statfileslevel` must be set (recommended: 2 or higher for Cloud Service) |
| ServeStaleOnError | Major | `/serveStaleOnError "1"` recommended for resilience |
| InvalidateClientHeaders | Critical | Must include `CQ-Action` and `CQ-Handle` in `/allowedClients` section |
| CacheRulesPresent | Critical | `/rules` section must allow HTML caching (`/0000 { /glob "*" /type "allow" }` as baseline) |

#### Rewrite Rules

| Rule | Severity | Description |
|------|----------|-------------|
| NoRewriteLogLevel | Major | `RewriteLogLevel` is not supported in Cloud Service |
| ForcedLanding | Major | Rewrites must use `[L]` flag to prevent rule chain issues |
| NoAbsoluteRedirects | Critical | Redirects must not hardcode domain names (use relative or `%{HTTP_HOST}`) |
| MaxRedirects | Major | Warn if redirect map exceeds 1000 entries (performance concern) |
| ValidRewriteSyntax | Blocker | Regex syntax validation on all `RewriteRule` and `RewriteCond` patterns |

#### Header Rules

| Rule | Severity | Description |
|------|----------|-------------|
| RequiredSecurityHeaders | Major | Must set `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security` |
| NoCacheControlOverride | Critical | Must not override CDN cache-control headers set by AEM |
| CustomHeaderNaming | Minor | Custom headers should use `X-` prefix convention |

### Parser Implementation

```typescript
// Client-side parser for dispatcher.any format
interface DispatcherConfig {
  type: 'farm' | 'vhost' | 'rewrite' | 'filter' | 'cache' | 'variables';
  sections: ConfigSection[];
  includes: IncludeDirective[];
  errors: ParseError[];
}

function parseDispatcherAny(content: string): DispatcherConfig {
  // Recursive descent parser for the .any format:
  // - Handles nested { } blocks
  // - Resolves $include directives (flags unresolvable ones)
  // - Extracts /name "value" pairs
  // - Handles /glob patterns and /type assignments
}

function parseVhost(content: string): DispatcherConfig {
  // Apache httpd.conf subset parser:
  // - VirtualHost blocks
  // - RewriteRule / RewriteCond directives
  // - Header directives
  // - Include directives
}
```

The parser is implemented entirely in TypeScript and runs client-side. No server calls. The `.any` format is not formally specified by Apache, so the parser must handle real-world variations found in existing customer configurations.

### Multi-File Upload

Dispatcher validation requires understanding file relationships (includes, symlinks). Support:
1. **Single file:** Validate one file with limited context (flag unresolvable includes as warnings)
2. **Folder upload:** Drag-and-drop a `dispatcher/` folder for full cross-file validation
3. **ZIP upload:** Upload a ZIP of the dispatcher directory for full analysis

### Limitations

- Cannot validate runtime behavior (actual request routing)
- Cannot verify that referenced files exist on disk (in single-file mode)
- Cannot test rewrite rules against sample URLs (future enhancement)
- Cannot validate against a specific AEM SDK version (uses latest known rules)

## Consequences

**Positive:**
- **No web-based alternative exists anywhere** — this is a genuine first-mover advantage
- Dispatcher issues are the #2 pipeline failure cause — directly addresses a top pain point
- Front-end developers and content authors get a validation tool they've never had
- Validates before pushing to pipeline — saves 45+ minutes per failed build
- Differentiates Pre-Flight™ from every competitor (all require CLI/Docker/Maven)
- Creates a natural entry point for teams who don't write Java but do manage Dispatcher configs

**Negative:**
- The `.any` format parser is complex — no formal grammar specification exists
- Dispatcher rules change across AEM SDK versions, requiring maintenance
- Multi-file analysis (folder/ZIP upload) is significantly more complex than single-file scanning
- False positives on unusual but valid configurations could erode trust
- Substantial implementation effort compared to regex-based Java rule scanning

**Mitigations:**
- Start with single-file validation, add multi-file support in a follow-up phase
- Test parser against 10+ real customer Dispatcher configurations before launch
- Clearly label rules with the AEM SDK version they apply to
- Allow rule suppression for known false positives

## Estimated Effort
- `.any` format parser: 1 week
- Apache vhost / rewrite parser: 3-4 days
- Validation rules (20+ rules): 1 week
- Multi-file / folder upload: 3-4 days
- Testing against real configurations: 2-3 days
- **Total: 3-4 weeks**
