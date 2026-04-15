# ADR-073: Pre-Flight™ Shareable Report URLs

## Status: Proposed

## Date: 2026-04-15

## Context

The current share mechanism encodes the entire code snippet into the URL hash fragment using base64. This works for small snippets but creates absurdly long URLs for real code (a 200-line Java file produces a 15KB URL). These URLs break in email clients, Slack truncates them, and they look suspicious to recipients.

Shareable reports need short, clean URLs that work everywhere.

## Decision

Implement client-side compressed share URLs with a fallback to a lightweight server-side paste service.

### Tier 1: Client-Side Compression (No Server)

1. **Compression:** Use `pako` (zlib) to compress the JSON payload before base64 encoding
2. **Typical reduction:** 60-80% smaller URLs (200-line file goes from ~15KB URL to ~3KB)
3. **Format:** `#z=<compressed-base64>` (prefix `z=` distinguishes from old `s=` format)
4. **Backward compatible:** Old `s=` links still decode correctly

### Tier 2: Server-Side Short URLs (Future)

If/when a backend is available:
1. **POST** compressed payload to `/api/share` → returns a short ID (8 chars)
2. **Share URL:** `focusgts.com/preflight/#r=abc12345`
3. **Retrieval:** Client fetches payload from `/api/share/:id`
4. **Expiry:** 30 days, then deleted
5. **Privacy:** Code is stored encrypted at rest, auto-deleted on expiry

### Current Implementation (Tier 1 Only)

- Add `pako` dependency (~15KB gzipped) for zlib compression
- Compress before base64 encoding
- Decompress on page load if `z=` prefix detected
- No server required — maintains the zero-backend guarantee

## Consequences

**Positive:**
- Share URLs become practical for real code (under 4KB for most files)
- URLs work in Slack, email, Jira comments without truncation
- Enables viral sharing: "Check out these findings on our codebase"
- Backward compatible with existing share links

**Negative:**
- Still limited by URL length (~8KB practical browser limit) for very large files
- Adds pako dependency to bundle (~15KB)
- Server-side short URLs require backend infrastructure (deferred to Tier 2)

## Estimated Effort
- Tier 1 (compression): 2 hours
- Backward compatibility: 1 hour
- Testing: 1 hour
- **Total Tier 1: 4 hours**
- Tier 2 (server): 6 additional hours when backend is available
