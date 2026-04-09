# ADR-067: Pre-Flight GitHub Action

## Status: Accepted

## Date: 2026-04-05

## Context

The CLI (ADR-065) and VS Code extension (ADR-066) protect the developer loop. The GitHub Action protects the repository: it runs pre-flight on every pull request and blocks merges when blocker or critical findings appear. This is the enforcement layer — where "it shows me problems" becomes "it stops bad code from reaching main."

Phase 4 of the GTM plan in `docs/strategy/preflight-business-plan.md` is the GitHub Action. For engineering leaders it is the most important artifact — one YAML file in `.github/workflows/` enforces Cloud Manager gates across the entire team without any developer opt-in.

## Decision

Publish `blackhole/preflight-action@v1` to the GitHub Marketplace.

### 1. Action Shape

- Repository: `blackhole/preflight-action` (public)
- Type: Composite action (runs the CLI under the hood, no Docker container needed — fast startup)
- Marketplace category: Code Quality
- Runner support: `ubuntu-latest`, `macos-latest`, `windows-latest`

### 2. Usage

```yaml
name: Pre-Flight
on: [pull_request]
jobs:
  preflight:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: blackhole/preflight-action@v1
        with:
          fail-on: critical
          scan: changed
          comment: true
```

Minimal config: drop the step in, done.

### 3. Inputs

| Input | Default | Description |
|-------|---------|-------------|
| `fail-on` | `critical` | Minimum severity that fails the check |
| `scan` | `changed` | `changed` (PR diff only) or `all` (full repo) |
| `config-file` | `.preflightrc.json` | Path to config file |
| `comment` | `true` | Post PR comment with findings |
| `annotations` | `true` | Emit GitHub Checks annotations inline on the PR diff |
| `sarif-upload` | `true` | Upload SARIF to GitHub Code Scanning |
| `api-key` | — | Optional, enables cloud features |
| `cloud` | `false` | Use cloud engine instead of local |

### 4. Outputs

| Output | Description |
|--------|-------------|
| `total` | Total finding count |
| `blocker` | Blocker finding count |
| `critical` | Critical finding count |
| `sarif-path` | Path to generated SARIF file |
| `report-url` | Link to HTML report artifact |

### 5. PR Integration

Three integration layers, all optional:

1. **Checks annotations** — every finding becomes an inline annotation on the changed line in the PR's Files tab. Uses `::error file=…,line=…` workflow commands. This is what developers actually see.

2. **PR comment** — single sticky comment (edited in place on re-runs, not appended) with a collapsible table grouped by severity. Includes a "New since last commit" section when re-running. Uses the GitHub API with `GITHUB_TOKEN`.

3. **SARIF upload** — `github/codeql-action/upload-sarif@v3` ingests our output so findings appear in the repository's Security → Code Scanning tab permanently.

### 6. Changed-Files Scoping

Default `scan: changed` uses `gh pr diff --name-only` to limit work to files in the PR. Keeps runs under 10 seconds even on massive repos. `scan: all` is available for nightly cron jobs or branch protection runs on `main`.

### 7. Caching

- npm cache: shared via `actions/setup-node` built-in caching
- Engine rule version: cached by version key so re-runs skip re-download
- No code caching — pre-flight is already fast enough that caching findings adds more complexity than it saves

### 8. Failure Behavior

- `fail-on: blocker` → only blocker findings fail
- `fail-on: critical` (default) → blocker + critical fail
- `fail-on: none` → report only, never fail (useful for legacy repos onboarding gradually)

On failure, the step exits 1 but the PR comment and annotations still post — we never swallow results.

### 9. Secrets Management

- `GITHUB_TOKEN` is sufficient for comment + annotation (standard perms)
- Optional `api-key` input for cloud mode, read from `secrets.BLACKHOLE_API_KEY`
- No code is sent off-runner in the default local mode — important for enterprise compliance

### 10. Release + Versioning

- Tags: `v1`, `v1.2.3` (users pin to `@v1` for auto-updates within major)
- Release process: tagged release → automated update of `v1` moving tag
- Changelog published to the action repo and linked from Marketplace listing
- Rule updates ship by bumping the engine dependency and cutting a new tag

### 11. Dogfooding

Run the action against the Black Hole repo itself from day one. Findings on our own code are both a trust signal and a free bug-finder.

## Consequences

### Positive
- One YAML block enforces Cloud Manager gates across an entire organization
- Inline PR annotations catch problems at review time, not at Cloud Manager pipeline time
- SARIF upload gives security teams a persistent view of code-quality trends
- Local-mode execution keeps enterprise code on the runner — no data exfil concern
- Shares the same engine as CLI/extension/API — zero rule drift

### Negative
- GitHub-only (GitLab/Bitbucket users need separate work; defer to a later ADR)
- PR comment sticky logic is surprisingly finicky (finding the right comment to edit, handling rebases)
- SARIF format is verbose and occasionally rejected by GitHub with opaque errors
- Composite actions have limited error handling; a crashing CLI means a crashing action
- Version-pinning culture in enterprises means rule updates propagate slowly

### Estimated Effort
- Action repo scaffold + composite yaml: 3 hours
- CLI invocation + input parsing: 2 hours
- Changed-files scoping via gh CLI: 2 hours
- GitHub Checks annotations emission: 3 hours
- Sticky PR comment (create/edit logic): 4-6 hours
- SARIF generation + upload wiring: 3 hours
- Marketplace listing + icon + README: 3 hours
- Dogfood workflow on Black Hole repo: 1 hour
- Release automation (tag-moving for `v1`): 2 hours
- **Total: 23-27 hours**

## References
- ADR-064 — Public Web UI
- ADR-065 — CLI (the action wraps this)
- ADR-066 — VS Code Extension
- `docs/strategy/preflight-business-plan.md` — Phase 4 GTM, enforcement positioning
- GitHub Checks API — annotation emission reference
- SARIF 2.1.0 spec — upload format
