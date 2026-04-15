# ADR-075: Pre-Flight™ GitHub Repository Scan

## Status: Proposed

## Date: 2026-04-15

## Context

The highest-value use case for Pre-Flight™ is scanning an entire AEM project — not one file at a time. While multi-file drag-and-drop (ADR-070) enables this locally, most AEM codebases live in GitHub. Allowing users to paste a GitHub repo URL and scan the relevant source files would remove all friction and enable the most comprehensive analysis possible.

This is the bridge between the free web tool and the CI/GitHub Action integration (ADR-067).

## Decision

Add a "Scan GitHub Repo" input that clones and analyzes a public repository.

### Behavior

1. **Input:** Text field accepting a GitHub repository URL (e.g., `https://github.com/org/aem-project`)
2. **Branch selector:** Optional branch/tag input (defaults to `main`/`master`)
3. **Path filter:** Optional subfolder (e.g., `core/src/main/java`) to limit scan scope
4. **API call:** Uses GitHub's REST API (`/repos/:owner/:repo/git/trees/:sha?recursive=1`) to list files, then fetches individual file contents via `/repos/:owner/:repo/contents/:path`
5. **File filtering:** Only fetches files with supported extensions (`.java`, `.xml`, `.json`, `.html`)
6. **Analysis:** Runs each fetched file through the Pre-Flight™ engine
7. **Results:** Multi-file dashboard (ADR-070) with per-file findings and overall readiness score (ADR-074)

### Authentication

- **Public repos:** No auth required — uses unauthenticated GitHub API (60 requests/hour per IP)
- **Private repos:** User provides a GitHub Personal Access Token (PAT) stored only in browser sessionStorage, never sent to our servers
- **Rate limiting:** Show clear messaging when GitHub API rate limit is hit, with instructions to add a PAT for higher limits

### Privacy

- Repository contents are fetched directly from GitHub to the user's browser
- File contents pass through the client-side engine only
- No code is sent to Focus GTS servers
- PATs are stored in sessionStorage (cleared on tab close) and never transmitted
- For private repos, the user's PAT authenticates directly with GitHub — we are not a proxy

### Limitations

- GitHub API rate limits: 60 req/hr unauthenticated, 5,000/hr with PAT
- Large repos (1,000+ files) may hit rate limits or be slow — recommend path filtering
- Binary files, assets, and node_modules are automatically excluded
- Only GitHub initially (GitLab, Bitbucket as future extensions)

## Consequences

**Positive:**
- Zero-friction full-project scan — paste a URL, see results
- Most comprehensive analysis Pre-Flight™ can offer
- Natural upsell: "Want this on every PR? Install the GitHub Action"
- Demonstrates Pre-Flight™'s real capability — scanning 200+ files, not just one
- Results feed into PDF report (ADR-068) for a complete migration readiness assessment

**Negative:**
- GitHub API dependency introduces external failure mode
- Rate limiting creates frustrating UX for unauthenticated users
- Private repo scanning requires users to trust our tool with a PAT
- Large repos may produce overwhelming results — needs good UX for filtering/sorting

## Estimated Effort
- GitHub API integration (tree listing + file fetch): 4 hours
- Branch/path selector UI: 2 hours
- PAT input and sessionStorage handling: 2 hours
- Rate limit handling and messaging: 2 hours
- Integration with multi-file dashboard: 2 hours
- **Total: 12 hours**
