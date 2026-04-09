# ADR-066: Pre-Flight VS Code Extension

## Status: Accepted

## Date: 2026-04-05

## Context

The CLI (ADR-065) runs pre-flight on demand or at commit time. The next shorter feedback loop is as-you-type: developers should see Cloud Manager violations inline in the editor, the same way ESLint shows JavaScript errors. VS Code is the dominant AEM developer editor (Eclipse/IntelliJ are legacy for backend-only teams); targeting VS Code first reaches the majority.

Phase 3 of the GTM plan in `docs/strategy/preflight-business-plan.md` is the VS Code extension. It is the highest-engagement touchpoint — developers who adopt it run pre-flight thousands of times a week without thinking about it, which drives both stickiness and paid conversion.

## Decision

Ship a VS Code extension, `blackhole.preflight`, published to the Marketplace, that surfaces pre-flight findings as Language Server diagnostics.

### 1. Extension Shape

- Publisher: `blackhole`
- ID: `blackhole.preflight`
- Marketplace name: "Black Hole Pre-Flight for AEM"
- Activation events: `onLanguage:java`, `workspaceContains:**/jcr_root/**`, `workspaceContains:.preflightrc.json`
- VS Code engine: `^1.85.0`

### 2. Engine Reuse

Extension depends on `@blackhole/preflight-engine` (the workspace package extracted in ADR-065). The engine runs in-process in the extension host — no separate daemon, no network calls by default.

This means:
- The CLI, the web API, the extension, and the GitHub Action all run the exact same rule code
- Rule updates ship via extension updates (auto-updates daily via Marketplace)
- Offline-friendly

### 3. Diagnostics

For each open file matching AEM patterns:
- Run the engine on save + on-type (debounced 500ms)
- Emit `vscode.Diagnostic[]` with:
  - Rule ID as the source (e.g., `CQBP-84`)
  - Severity mapped: blocker/critical → Error, major → Warning, minor → Information, info → Hint
  - Range pointing at the offending line/column
  - `relatedInformation` linking to the rule's Adobe doc URL

Findings appear as red squiggles, in the Problems panel, and in the status-bar summary.

### 4. Code Actions (Quick Fixes)

Where a rule has a known auto-fix, register a `CodeActionProvider`:
- `javax.servlet → jakarta.servlet` import rewrite
- `sun.misc.BASE64Encoder → java.util.Base64` swap
- Add `try-with-resources` around `ResourceResolver`
- Set `async="true"` on Lucene index definitions

Initial release ships 4-6 quick fixes covering the most common findings. Each quick fix is gated on a deterministic AST/regex match — we never guess.

### 5. Commands

Registered in the Command Palette:
- `Pre-Flight: Run on Workspace` — full scan, results in a webview panel
- `Pre-Flight: Run on Current File`
- `Pre-Flight: Explain Rule…` — quick-pick of rules, opens detail webview
- `Pre-Flight: Open Dashboard` — opens blackhole.focusgts.com/preflight
- `Pre-Flight: Sign In` — for paid tier features

### 6. Settings

```json
{
  "preflight.enable": true,
  "preflight.runOnType": true,
  "preflight.runOnSave": true,
  "preflight.severityThreshold": "info",
  "preflight.rules": { "CQBP-84": "off" },
  "preflight.cloudMode": false,
  "preflight.apiKey": ""
}
```

Workspace `.preflightrc.json` overrides user settings so teams get consistent behavior.

### 7. Paid-Tier Hooks

The free extension provides all 16 rules and all quick fixes locally. Paid tier unlocks:
- Team-shared rule overrides (sync via cloud)
- Inline "recent team findings" side panel
- PR integration (opens the matching GitHub Action run)
- Telemetry dashboard link

Paid gating is soft — the free experience is fully useful; we only upsell collaborative features.

### 8. Telemetry

Opt-in only, default off. If enabled:
- Rule firing counts (no code content)
- Quick-fix accept/reject
- Command usage
- Version + platform

Respects `telemetry.telemetryLevel: off`.

### 9. What This Is Not

- Not a full AEM IDE — we do not reimplement AEM Developer Tools
- Not a formatter — we do not auto-format code
- Not a language server (yet) — we run in the extension host; LSP migration is a future ADR if perf demands it

## Consequences

### Positive
- Shortest possible feedback loop: violations appear as developers type
- Quick fixes remove the "I see the problem but how do I fix it" friction
- Marketplace presence is marketing — every install is a brand touch
- Shares the engine with CLI/API/Action; rule fixes propagate everywhere
- High stickiness — once installed, developers don't uninstall linters

### Negative
- On-type scanning must stay fast (<50ms per file) or developers will disable it
- Quick fixes must be 100% safe; one bad auto-fix destroys trust
- Marketplace review + signing adds release friction
- Extension host crashes become our problem even when caused by VS Code itself
- Supporting Eclipse/IntelliJ later will duplicate a lot of this work

### Estimated Effort
- Extension scaffold + activation: 3 hours
- Diagnostic provider + debouncing: 4-6 hours
- Code action provider + 4-6 quick fixes: 8-12 hours
- Commands + webview panels: 4-6 hours
- Settings + workspace config loading: 3 hours
- Telemetry (opt-in): 2 hours
- Marketplace packaging, signing, publishing: 3-4 hours
- Docs + README + demo GIF: 3 hours
- **Total: 30-39 hours**

## References
- ADR-064 — Public Web UI
- ADR-065 — CLI (shared engine package)
- `docs/strategy/preflight-business-plan.md` — Phase 3 GTM
- VS Code Diagnostics API: `node_modules/@types/vscode/index.d.ts`
