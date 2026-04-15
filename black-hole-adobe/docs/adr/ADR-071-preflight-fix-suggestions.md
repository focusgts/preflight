# ADR-071: Pre-Flight™ Inline Fix Suggestions with Code Diffs

## Status: Proposed

## Date: 2026-04-15

## Context

Identifying a problem is only half the value. Showing the exact fix is what makes a tool indispensable. Currently, Pre-Flight™ tells users what's wrong and links to documentation, but the developer still has to figure out how to fix it. For many Cloud Manager rules, the fix is mechanical and deterministic — we can generate it automatically.

Fix suggestions with copy-to-clipboard turn Pre-Flight™ from "here's your problem" into "here's your solution."

## Decision

For each finding where a deterministic fix exists, show an inline code diff with a "Copy Fix" button.

### Behavior

1. **Diff view:** Below each finding card, show a before/after diff:
   - Red highlighted line: the problematic code
   - Green highlighted line: the suggested fix
   - Context lines above and below for orientation
2. **Copy button:** One click copies the fixed code to clipboard
3. **Apply all:** Button at the top to copy the entire file with all fixes applied
4. **Confidence indicator:** Each fix tagged as "Auto-fixable" (deterministic) or "Suggested" (heuristic, review recommended)

### Fixable Rules (Initial Set)

| Rule | Fix Pattern |
|------|------------|
| Mutable content path | Move from `/apps` to `/content` equivalent |
| Custom run mode reference | Replace with env-variable pattern |
| JCR session in servlet | Replace with ResourceResolver pattern |
| Deprecated API usage | Replace with current API equivalent |
| OSGi config format | Convert `.cfg` to `.cfg.json` format |
| Oak index definition | Add required `reindex` property |

### Rules NOT Auto-Fixed

Some rules require architectural decisions (e.g., replication agent replacement, workflow migration). These show the finding + documentation link but no auto-fix.

### Implementation

- Fix generators are pure functions: `(code: string, finding: Finding) => { fixed: string, diff: DiffLine[] }`
- Diff rendering uses a simple line-based differ (no external dependency needed)
- All fix generation happens client-side — no server, no AI

## Consequences

**Positive:**
- Developers get actionable output, not just a problem list
- Dramatically reduces time from "found issue" to "fixed issue"
- "Copy Fix" is the most satisfying interaction in a developer tool
- Differentiates Pre-Flight™ from every other AEM linting tool

**Negative:**
- Fix quality must be high — a wrong auto-fix is worse than no fix
- Not all rules have deterministic fixes; partial coverage may confuse users
- Fix generation adds complexity to the rule engine
- Maintaining fix patterns as Adobe APIs evolve

## Estimated Effort
- Fix generator framework: 3 hours
- Fix patterns for initial 6 rules: 6 hours
- Diff rendering UI: 3 hours
- Copy-to-clipboard integration: 1 hour
- "Apply all" logic: 2 hours
- **Total: 15 hours**
