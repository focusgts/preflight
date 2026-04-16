# ADR-083: Pre-Flight™ Content Package Structure Analyzer

## Status: Proposed

## Date: 2026-04-15

## Context

AEM Cloud Service requires a strict content package structure that separates mutable content (runtime-writable paths like `/content`, `/etc/tags`, `/conf`) from immutable content (deploy-time paths like `/apps`, `/libs`). This separation exists because Cloud Service nodes are ephemeral — mutable content lives in a shared repository, while immutable content is baked into container images at deploy time.

The `ImmutableMutableMixedPackage` OakPAL rule is the **#1 most common deployment failure** in Cloud Manager pipelines. Teams migrating from on-premise or AMS have years of content packages that mix mutable and immutable content because the old architecture didn't require separation. Every single one of these packages will fail the pipeline.

Additionally, Cloud Service requires:
- Correct `packageType` declarations (`application` for immutable, `content` for mutable)
- A container package (`all`) that embeds sub-packages correctly
- No overlapping packages (two packages writing to the same path)
- Correct install hook declarations (deprecated hooks fail in Cloud Service)

Pre-Flight™ can validate all of this by parsing `filter.xml`, `properties.xml`, and `pom.xml` files — no Maven execution or AEM instance required.

## Decision

Add a Content Package Structure Analyzer to Pre-Flight™ that validates AEM content package structure against Cloud Service requirements entirely client-side.

### Supported Input

- `filter.xml` — package filter definitions (the primary input for structure validation)
- `properties.xml` — package metadata and type declarations
- `pom.xml` — Maven content-package-maven-plugin configuration
- ZIP upload of a content package for full analysis
- Multi-file upload of all three files for cross-file validation

### Validation Rules

#### Mutable/Immutable Separation

| Rule | Severity | Description |
|------|----------|-------------|
| ImmutableMutableMixed | Blocker | Single filter.xml contains both mutable paths (`/content`, `/conf`, `/etc`, `/var`) and immutable paths (`/apps`, `/libs`) |
| MutableInAppPackage | Blocker | Package declared as `packageType=application` but filter includes mutable paths |
| ImmutableInContentPackage | Blocker | Package declared as `packageType=content` but filter includes immutable paths |
| MissingPackageType | Critical | No `packageType` declared in properties.xml or pom.xml — Cloud Service requires explicit declaration |

#### Path Classification

```typescript
const IMMUTABLE_ROOTS = ['/apps', '/libs', '/oak:index'];
const MUTABLE_ROOTS = ['/content', '/conf', '/etc', '/var', '/tmp', '/home'];
const BANNED_PATHS = ['/var/audit', '/tmp', '/home/users', '/home/groups'];

function classifyPath(path: string): 'mutable' | 'immutable' | 'banned' {
  if (BANNED_PATHS.some(b => path.startsWith(b))) return 'banned';
  if (MUTABLE_ROOTS.some(r => path.startsWith(r))) return 'mutable';
  if (IMMUTABLE_ROOTS.some(r => path.startsWith(r))) return 'immutable';
  return 'unknown';  // flag for manual review
}
```

#### Container Package Rules

| Rule | Severity | Description |
|------|----------|-------------|
| MissingContainerPackage | Major | No container (`all`) package embedding sub-packages — required for Cloud Service deployment |
| ContainerHasContent | Critical | Container package has its own filter paths (should only embed sub-packages) |
| SubpackageNotEmbedded | Major | Sub-package exists but isn't listed as an embedded dependency in the container |
| EmbedTypeMismatch | Critical | Sub-package embedded with wrong `<type>` (application sub-packages must use `<type>application</type>`) |

#### Overlapping Package Detection

| Rule | Severity | Description |
|------|----------|-------------|
| OverlappingFilters | Critical | Multiple packages define filters for the same JCR path — deploy order becomes fragile |
| NestedFilterConflict | Major | Package A filters `/apps/myapp` and Package B filters `/apps/myapp/components` — nested overlap causes content loss risk |
| DuplicateRootFilter | Blocker | Multiple packages claim the exact same filter root — one will overwrite the other |

#### Install Hook and AC Handling Rules

| Rule | Severity | Description |
|------|----------|-------------|
| DeprecatedInstallHook | Blocker | Package uses `installhook` — not supported in Cloud Service, use RepoinitT (ADR-084) instead |
| AclHandlingMissing | Major | Package modifies `/home` or `/conf` without specifying AC handling policy |
| MergeInstallBehavior | Major | Package uses `acHandling=overwrite` which will destroy existing permissions on deploy |

### Filter.xml Parser

```typescript
interface FilterDefinition {
  root: string;                    // e.g., "/apps/myproject"
  rules: FilterRule[];             // include/exclude rules
  mode?: string;                   // merge, replace, update
}

interface FilterRule {
  type: 'include' | 'exclude';
  pattern: string;                 // regex pattern
}

function parseFilterXml(content: string): FilterDefinition[] {
  // XML parser extracts <filter> elements
  // Classifies each root as mutable/immutable/banned
  // Validates include/exclude patterns
}
```

### Remediation Guidance

For each finding, show specific remediation:

- **ImmutableMutableMixed:** "Split this package into two: move `/apps/**` filters to `ui.apps` (packageType=application) and `/content/**` filters to `ui.content` (packageType=content)"
- **MissingPackageType:** "Add `<packageType>application</packageType>` to your content-package-maven-plugin configuration"
- **OverlappingFilters:** "Package A and Package B both filter `/apps/myapp/config`. Consolidate these into a single package or use distinct sub-paths"

### Visual Package Map

Display a visual representation of the package structure:

```
all (container)
├── ui.apps (application) ✓
│   ├── /apps/myproject/components
│   └── /apps/myproject/templates
├── ui.content (content) ✓
│   ├── /content/myproject
│   └── /conf/myproject
└── ui.config (application) ✓
    └── /apps/myproject/osgiconfig
```

With color coding: green for valid structure, red for violations, yellow for warnings.

## Consequences

**Positive:**
- **Addresses the #1 most common deployment failure** — ImmutableMutableMixedPackage affects virtually every migrating project
- Visual package map makes the abstract concept of mutable/immutable separation concrete and understandable
- Catches overlapping packages that cause subtle, hard-to-debug content loss in production
- No existing tool provides this validation in a browser — all alternatives require Maven and CLI
- Remediation guidance gives teams the exact steps to fix structure issues, not just error messages
- Natural cross-sell with ADR-084 (RepoInit Validator) — teams fixing install hooks need RepoInit migration

**Negative:**
- Full validation requires multiple related files (filter.xml, properties.xml, pom.xml) — single-file mode gives incomplete picture
- ZIP package upload requires client-side ZIP parsing library (adds bundle size)
- Container package validation depends on seeing all sub-packages — partial uploads give partial results
- AEM project archetypes differ across versions, so "correct" structure varies

**Mitigations:**
- Single-file mode (filter.xml only) catches the most critical issue (mixed content) without requiring other files
- Use `jszip` for client-side ZIP extraction (well-maintained, ~45KB gzipped)
- Clearly state when validation is partial due to missing files: "Upload properties.xml for complete package type validation"
- Default to AEM Cloud Service archetype conventions as the baseline

## Estimated Effort
- Filter.xml parser: 2 days
- Properties.xml / pom.xml parser: 1 day
- Mutable/immutable classification rules: 1 day
- Container package rules: 2 days
- Overlapping package detection: 2 days
- Visual package map UI: 1 day
- ZIP upload and extraction: 1 day
- Remediation guidance content: 1 day
- **Total: 1-2 weeks**
