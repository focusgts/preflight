# ADR-065: Pre-Flight CLI (@blackhole/preflight)

## Status: Accepted

## Date: 2026-04-05

## Context

The web UI (ADR-064) solves the "paste a snippet" case. It does not solve the much more common developer loop: run pre-flight against an entire local AEM project before committing. Developers today don't discover Cloud Manager violations until they push to Adobe's pipeline — 12+ minute feedback loops that kill velocity.

A local CLI collapses that loop from 12 minutes to under a second, which is the core proof-point in `docs/strategy/preflight-business-plan.md`. Phase 2 of the GTM plan is the CLI.

## Decision

Ship an npm package, `@blackhole/preflight`, that runs the same rule engine locally against a developer's workspace.

### 1. Package Shape

- Name: `@blackhole/preflight`
- Bin: `preflight` (also aliased as `blackhole-preflight`)
- Distribution: public npm, MIT-licensed wrapper, engine bundled as a compiled JS artifact
- Install: `npm install -g @blackhole/preflight` or `npx @blackhole/preflight`
- Node version: >=18

### 2. Commands

```
preflight run [paths...]      # default: scan cwd
preflight run --staged        # scan git staged files only
preflight run --since main    # scan files changed since a ref
preflight explain <rule-id>   # print rule detail + remediation
preflight list-rules          # print all rules with severities
preflight init                # write .preflightrc.json + pre-commit hook
preflight login               # optional: link to paid tier
preflight --version
```

### 3. File Discovery

- Walks the project honoring `.gitignore`
- Default extensions: `.java`, `.xml`, `.cfg.json`, `.json` (under `jcr_root/**/_rep_policy.xml`, `_sling_configs`, etc.)
- Respects `.preflightrc.json` includes/excludes
- `--staged` uses `git diff --cached --name-only`
- `--since <ref>` uses `git diff --name-only <ref>...HEAD`

### 4. Execution Modes

Two modes, user-selectable via config or flag:

1. **Local mode (default, free)**: the rule engine runs entirely in-process. No network. Works offline. Bundled rule definitions versioned with the CLI.
2. **Cloud mode (`--cloud`)**: POSTs files to `https://blackhole.focusgts.com/api/preflight`. Needed for team features (shared rule overrides, history, PR integration). Requires `preflight login` → stores API key in OS keychain.

Local mode is the killer feature — no data leaves the developer's machine. That removes the #1 enterprise objection.

### 5. Output Formats

- `--format human` (default): colorized grouped-by-severity output with file:line
- `--format json`: machine-readable for CI
- `--format sarif`: SARIF 2.1.0 for GitHub Code Scanning upload
- `--format junit`: for CI systems that ingest JUnit XML

### 6. Exit Codes

- `0` — no findings at or above threshold
- `1` — findings at `blocker` or `critical` (default threshold)
- `2` — CLI error (bad config, unreachable cloud, etc.)

Threshold configurable via `--fail-on <severity>` or `.preflightrc.json`.

### 7. Configuration File

`.preflightrc.json` at repo root:

```json
{
  "include": ["core/src/main/java/**", "ui.apps/**"],
  "exclude": ["**/generated/**"],
  "failOn": "critical",
  "rules": {
    "CQBP-84": "off",
    "NativeLibrary": "warn"
  },
  "mode": "local"
}
```

Rule overrides let teams ignore specific rules or downgrade severity — but the CLI prints a warning whenever an override is applied, visible in CI logs.

### 8. Pre-Commit Hook Integration

`preflight init` offers to install a Husky-compatible pre-commit hook:

```
#!/bin/sh
npx @blackhole/preflight run --staged --fail-on critical
```

Fast enough (<1s) that it doesn't annoy developers.

### 9. Rule Engine Packaging

The existing `src/lib/preflight/cloud-manager-rules.ts` is extracted into an internal `@blackhole/preflight-engine` workspace package. The CLI and the web API both import from it. Single source of truth — no rule drift between local and cloud modes.

### 10. Update Channel

- CLI checks npm for updates once per 24h (async, non-blocking)
- Prints a one-line upgrade notice if behind
- Rule definitions version-locked to CLI version; `preflight run --rules-version latest` (cloud mode only) pulls fresh rules

## Consequences

### Positive
- Collapses the Cloud Manager feedback loop from ~12 min to <1 sec
- Local mode removes enterprise data-leaving-machine objection
- Pre-commit hooks catch violations before they ever reach a PR
- SARIF output integrates with GitHub Code Scanning for free security-tab visibility
- npm distribution is the obvious place AEM developers will look

### Negative
- Bundling the engine means shipping rule updates via npm releases (local-mode users get stale rules until they upgrade)
- OS keychain integration is finicky across macOS/Linux/Windows
- Enterprise customers will ask for air-gapped installs (tarball distribution needed)
- Rule overrides create support burden ("why isn't CQBP-84 firing?" — because you turned it off)

### Estimated Effort
- Engine extraction to shared package: 4-6 hours
- CLI scaffolding (commander/yargs, bin wiring): 3 hours
- File discovery + git integration: 3-4 hours
- Output formatters (human/json/sarif/junit): 4 hours
- Config file loading + rule overrides: 3 hours
- Cloud mode + keychain auth: 4-6 hours
- `init` command + Husky hook template: 2 hours
- Update check + release automation: 2 hours
- Docs + README + quick-start: 2 hours
- **Total: 27-32 hours**

## References
- ADR-064 — Public Web UI (shares engine)
- `src/lib/preflight/cloud-manager-rules.ts` — engine to extract
- `src/app/api/preflight/route.ts` — cloud-mode backend
- `docs/strategy/preflight-business-plan.md` — Phase 2 GTM, local-mode positioning
