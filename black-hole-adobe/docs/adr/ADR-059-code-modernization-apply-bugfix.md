# ADR-059: Code Modernization Apply — Fix File Output Bugs

## Status: Proposed

## Date: 2026-04-08

## Context

Testing ADR-051 (Code Modernization File Output) against real inputs revealed that the apply endpoint is broken in several ways that prevent customers from using auto-fix end-to-end:

- The apply endpoint (`/api/migrations/[id]/modernize/apply`) ignores the uploaded `files` array in the request body and instead uses the migration's stored findings from a prior scan. This means the file content the customer submits is never actually modified.
- `Changed: false` is returned even when fixes are supposed to be applied. The regex replacement that turns `beforeCode` into `afterCode` is not actually executing against file content.
- Only 1 file out of 3 submitted is processed. The loop short-circuits after the first match.
- The `getAdministrativeResourceResolver(null)` detection rule is missing from the `API_RULES` array in `src/lib/migration/code-modernizer.ts`, so one of the most common deprecated patterns in AEM 6.x codebases is never flagged.
- The ZIP download produces placeholder files generated from migration fallback findings rather than the customer's actual uploaded file content. A customer downloading the ZIP gets sample code, not their code.

Without these fixes, ADR-051 is essentially a demo feature, not a usable tool.

## Decision

1. Fix `/api/migrations/[id]/modernize/apply/route.ts` so that when the request includes a `files` array, those files are the source of truth. Stored migration findings are used only as a fallback when no files are uploaded.
2. Fix the apply logic in `src/lib/migration/code-writer.ts`. Each finding carries its file path and a `beforeCode` / `afterCode` transformation. The writer must run the actual regex substitution against the file's content and return the modified buffer. The current code appears to track findings without mutating content.
3. Add a detection rule for `getAdministrativeResourceResolver\(null\)` to the `API_RULES` array in `src/lib/migration/code-modernizer.ts`, including the replacement pattern (service user resolver) and a CRITICAL severity marker.
4. Fix ZIP generation so it assembles the archive from the customer-provided files after transformation, not from fallback samples.
5. Add a `dryRun` boolean option to the apply endpoint. When set, the endpoint returns the diff and list of changes that would be made without persisting anything. Default is `false`.
6. Add an end-to-end test: upload 3 files containing 5 deprecated APIs, run scan, get 5 findings, run apply, assert that the response body contains modified content for all 3 files and that the ZIP download contains the transformed files.

## Consequences

**Positive**
- Customers can actually use code modernization as an apply-and-download workflow instead of a read-only report.
- `dryRun` gives reviewers a safe preview before any file is touched.
- Adding the `getAdministrativeResourceResolver(null)` rule closes a common detection gap.
- End-to-end coverage prevents regressions in the apply pipeline.

**Negative**
- Regex-based replacements still have edge cases around multi-line patterns, comments, and string literals. CRITICAL findings will continue to require manual review even after auto-fix.
- Fixing the ZIP path adds memory pressure when customers upload very large file sets.

Estimated effort: 6-10 hours.
