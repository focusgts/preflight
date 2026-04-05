# ADR-051: Code Modernization File Output — Git Branch Integration

## Status: Proposed

## Date: 2026-03-31

## Context

`CodeModernizer` in `src/lib/migration/code-modernizer.ts` produces correct `beforeCode`/`afterCode` transformation pairs but never writes to the filesystem. No file I/O exists anywhere in the modernization pipeline. The `autoFixApplied` flag is a report indicator, not an action confirmation.

Users see a list of modernization findings with before/after diffs in the UI, but there is no way to apply those fixes to their actual codebase. The "Apply Fix" button is decorative.

## Decision

### 1. CodeModernizationWriter

Create `src/lib/migration/code-writer.ts` that:

- Accepts a list of findings with `autoFixApplied: true`
- Clones or opens the target repository at a configurable path
- Creates a new Git branch (`blackhole/modernize-{timestamp}`)
- Writes each `afterCode` to the corresponding `filePath`
- Groups changes by finding category (deprecated API, OSGi config, Sling model, etc.)
- Commits all changes with a descriptive message per category
- Optionally pushes to remote (configurable via `pushToRemote: boolean`)

### 2. API endpoint

Create `POST /api/migrations/[id]/modernize/apply` in `src/app/api/migrations/[id]/modernize/apply/route.ts`:

- Accepts: `{ findingIds: string[], outputPath?: string, gitBranch?: string }`
- Validates that all referenced findings exist and have `autoFixApplied: true`
- Applies the selected auto-fixes via `CodeModernizationWriter`
- Returns: `{ filesModified: string[], gitCommitHash: string, branch: string }`

### 3. Safety rules

- Never auto-apply CRITICAL severity findings — those always require manual review
- Validate that `outputPath` is within allowed directories (prevent path traversal)
- Create a backup branch before applying changes
- Generate a rollback script alongside the applied changes

### 4. Non-Git fallback

- For customers who cannot grant Git access, support direct file output to a configurable directory
- Add a "Download as ZIP" option (`GET /api/migrations/[id]/modernize/download`) that bundles all modified files with their directory structure

## Consequences

**Positive:**
- Auto-fixes actually produce modified source code that developers can review and merge
- Git branch workflow integrates naturally with existing CI/CD pipelines
- ZIP download provides a safe fallback for demos and restricted environments
- Per-category commits make code review manageable

**Negative:**
- Requires filesystem access to the customer's code repository or Git credentials
- Writing to the wrong path could overwrite unrelated files (mitigated by path validation and backup branch)
- ZIP download loses Git history context

**Estimated effort:** 16-24 hours
