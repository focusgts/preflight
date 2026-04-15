# ADR-069: Pre-Flight™ Drag-and-Drop File Upload

## Status: Proposed

## Date: 2026-04-15

## Context

The current Pre-Flight™ interface requires users to copy code from their IDE, switch to the browser, and paste it into a textarea. This friction reduces adoption, especially for engineers who want to check a file quickly without selecting and copying hundreds of lines.

Drag-and-drop file upload is the expected interaction pattern for developer tools in 2026. It removes a step, feels more professional, and enables the multi-file analysis capability (ADR-070).

## Decision

Add drag-and-drop file upload to the Pre-Flight™ editor panel.

### Behavior

1. **Drop zone:** The entire editor panel becomes a drop target. Visual indicator (dashed border, icon change) on dragover.
2. **Accepted file types:** `.java`, `.xml`, `.json`, `.cfg.json`, `.html` (HTL), `.htl`
3. **File reading:** Uses the browser File API (`FileReader.readAsText()`) — no upload to any server
4. **Auto-detect language:** Based on file extension, automatically set the language selector
5. **Auto-detect path:** Use the filename to set the virtual path (e.g., `com.example.MyService.java`)
6. **Size limit:** 500KB per file. Show error for larger files ("File too large — paste the relevant section instead")
7. **Fallback:** Paste still works. Drop zone is additive, not a replacement.

### Implementation

- HTML5 Drag and Drop API with `onDragOver`, `onDrop` event handlers
- `FileReader.readAsText()` for file content — entirely client-side
- No changes to the analysis engine required

### Privacy

- Files are read into browser memory only via FileReader API
- No file content is sent to any server, uploaded, or stored
- File name is used only for path inference and language detection

## Consequences

**Positive:**
- Reduces friction from 3 steps (copy → switch → paste) to 1 (drag)
- Enables multi-file analysis (ADR-070)
- Makes the tool feel like a real developer utility, not a demo
- File path inference improves analysis accuracy (some rules are path-dependent)

**Negative:**
- Mobile users can't drag-and-drop (paste remains available)
- Large files may cause browser sluggishness (mitigated by 500KB limit)
- File encoding edge cases (UTF-16, binary files mistakenly dropped)

## Estimated Effort
- Drop zone UI and event handling: 2 hours
- Language/path auto-detection: 1 hour
- Error handling and edge cases: 1 hour
- **Total: 4 hours**
