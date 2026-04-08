# ADR-059: Code Modernization Apply — Fix File Output Bugs

## Status: Proposed

## Date: 2026-04-08

## Context

End-to-end testing of ADR-051 (Code Modernization File Output) on 2026-04-08 revealed several bugs in the apply endpoint and underlying writer:

1. **Apply endpoint ignores uploaded files**: `POST /api/migrations/[id]/modernize/apply` accepts a `files` array in the request body but doesn't process them — it uses the migration's stored findings and falls back to sample placeholder content instead.

2. **Regex replacements not applied**: When findings are applied, the response shows `Changed: False` for files that should have been modified. The `beforeCode` → `afterCode` substitution in `src/lib/migration/code-writer.ts` is not actually running against the file content.

3. **Incomplete file processing**: Test submitted 3 files with 5 total issues; the apply endpoint only processed 1 file and returned "no changes."

4. **Missing detection rule**: `code-modernizer.ts` API_RULES array does not detect `getAdministrativeResourceResolver()` — one of the most common AEM 6.5 → Cloud Service migration issues. The existing `loginAdministrative` rule doesn't match this pattern.

5. **ZIP contains wrong files**: Downloaded ZIP from `/modernize/download` contains fallback placeholder files (ContentListener.java, body.html, dispatcher.any) instead of the customer's uploaded files.

## Decision

### 1. Fix apply endpoint to prioritize uploaded files

In `src/app/api/migrations/[id]/modernize/apply/route.ts`:
- When `body.files` is a non-empty array, use those as the working set and run CodeModernizer against them fresh
- Use migration's stored findings only when `body.files` is absent or empty
- Pass the uploaded files through to `CodeModernizationWriter.applyFixes()`

### 2. Fix the writer's apply logic

In `src/lib/migration/code-writer.ts`:
- `applyFixes()` must iterate every finding with `autoFixApplied: true` AND `severity !== 'critical'`
- For each finding, find the corresponding file in the input array by matching `filePath`
- Apply the regex replacement: replace the `beforeCode` substring with `afterCode` in the file content
- Track whether each file was modified and return the new content
- If multiple findings affect the same file, apply them sequentially

### 3. Add missing detection rules to code-modernizer.ts

Add these patterns to the `API_RULES` array:

```typescript
{
  pattern: /getAdministrativeResourceResolver\s*\(/g,
  replacement: 'getServiceResourceResolver(',
  severity: 'high',
  description: 'getAdministrativeResourceResolver is removed in AEMaaCS',
  remediation: 'Use getServiceResourceResolver with a service user mapping',
},
{
  pattern: /SlingRepository\.loginAdministrative\s*\(/g,
  replacement: 'SlingRepository.loginService(',
  severity: 'critical',
  description: 'loginAdministrative is removed',
  remediation: 'Use loginService with a configured service user',
},
```

Verify each pattern against the actual Java code that failed detection in the test.

### 4. Fix ZIP generation to use real content

In `src/lib/migration/code-writer.ts` `generateZip()`:
- When files are provided explicitly, ZIP should contain ONLY those files (modified versions)
- Remove the fallback that generates sample placeholder files
- `CHANGES.md` manifest should list every actual modification with file path and change description

### 5. Add dry-run option

Support `dryRun: true` in the apply endpoint body:
- Returns what WOULD change without applying
- Shows before/after diffs
- Does not modify migration state

### 6. Verification test

After fixes, re-run the test that failed:
- Submit 3 files with `loginAdministrative`, `getAdministrativeResourceResolver`, `session.impersonate`, OSGi XML config, Dispatcher rule
- Expect 5+ findings
- Apply fixes
- Verify response contains 3 files with `Changed: True`
- Download ZIP, verify it contains the 3 modified files and `CHANGES.md`

## Consequences

### Positive
- Customers can actually use code modernization, not just see findings
- Detection coverage improves for the most common AEM migration patterns
- ZIP output is trustworthy — contains exactly what was uploaded, modified

### Negative
- Regex-based fixes have edge cases (multi-line patterns, comments, strings)
- Some fixes still require manual review (critical severity blockers)
- Adding more rules increases false positive risk — need to tune patterns carefully

### Estimated Effort
6-10 hours
