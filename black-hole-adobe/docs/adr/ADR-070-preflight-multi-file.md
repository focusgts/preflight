# ADR-070: Pre-Flight™ Multi-File Analysis

## Status: Proposed

## Date: 2026-04-15

## Context

Real AEM projects don't have one file — they have hundreds. A developer migrating from AEM 6.5 to Cloud Service needs to know the state of their entire codebase, not just one snippet. The current single-file interface is useful for quick checks but doesn't answer the question every migration team asks: "How ready is our whole project?"

Multi-file analysis transforms Pre-Flight™ from a convenience tool into a migration readiness scanner.

## Decision

Support scanning multiple files at once via folder drop or multi-file selection.

### Behavior

1. **Folder drop:** User drops a project folder (e.g., `ui.apps/src/main/`) onto the drop zone
2. **Multi-file select:** File picker allows selecting multiple files at once
3. **Recursive scanning:** Uses `webkitGetAsEntry()` / `DataTransferItem.getAsFileSystemHandle()` for directory traversal
4. **File filtering:** Only process supported extensions (`.java`, `.xml`, `.json`, `.cfg.json`, `.html`, `.htl`). Skip binaries, images, etc.
5. **Progress indicator:** Show scanning progress ("Checking 47 of 128 files...")
6. **Summary dashboard:** After scan, show:
   - Total files scanned
   - Files with findings vs clean files
   - Findings by severity (Blocker / Critical / Major / Minor)
   - Top 5 most common rule violations
   - Expandable per-file detail view
7. **Performance:** Run analysis in a Web Worker to prevent UI blocking on large codebases

### Limits

- Max 500 files per scan (show warning for larger projects: "For full codebase analysis, contact us")
- Max 500KB per individual file
- Max 50MB total across all files

### Privacy

- All files are read and analyzed entirely client-side via FileReader API
- No file contents are sent to any server
- Directory structure metadata is used only for path-based rule matching

## Consequences

**Positive:**
- Answers the real question: "How ready is my codebase?"
- Positions Pre-Flight™ as a migration readiness tool, not just a code checker
- Summary dashboard creates a shareable artifact (combined with PDF export, ADR-068)
- "128 files, 12 blockers, 47 warnings" is the kind of data that triggers a purchase conversation
- Natural upsell: "Need these fixed? Talk to Navigator"

**Negative:**
- Directory access API has inconsistent browser support (Chrome/Edge full support, Firefox partial, Safari limited)
- Large scans may take several seconds — needs progress UI and Web Worker
- Summary dashboard is new UI surface area to design and maintain
- Risk of false sense of completeness ("Pre-Flight™ said we're clean" when only a subset was scanned)

## Estimated Effort
- Directory traversal and file filtering: 3 hours
- Web Worker integration: 2 hours
- Summary dashboard UI: 4 hours
- Progress indicator: 1 hour
- Testing across browsers: 2 hours
- **Total: 12 hours**
