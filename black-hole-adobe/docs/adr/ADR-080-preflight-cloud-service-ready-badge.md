# ADR-080: Pre-Flight™ Cloud Service Ready Badge for READMEs

## Status: Proposed

## Date: 2026-04-15

## Context

Developer tools live or die on visibility. The most successful open-source tools (Jest, Prettier, ESLint) all have a common growth mechanism: badges in README files. Every GitHub repository that displays a badge creates a permanent, visible impression for every developer who views that repo. A shields.io-style badge is the cheapest, most scalable marketing channel in developer tooling.

Pre-Flight™ generates a readiness score and letter grade (ADR-074). That score currently lives in the browser session and PDF report. A badge takes that score and makes it visible in the place developers look every day: the repository README.

Every badge is simultaneously:
1. A status indicator for the team (functional value)
2. A backlink to focusgts.com/preflight (SEO value)
3. A brand impression for Pre-Flight™ (marketing value)
4. Social proof that serious teams use the tool (credibility value)

No AEM migration tool currently offers this. It's a unique viral mechanism in a market that has zero viral tooling.

## Decision

Generate a shields.io-compatible SVG badge from scan results that teams can embed in their GitHub README.md files.

### Badge Format

```
┌──────────────────────────────────────────┐
│ AEM Cloud Service Ready │ A+ │
│ (navy background)       │(green)│
│ Pre-Flight™ by Focus GTS               │
└──────────────────────────────────────────┘
```

- **Left side:** "AEM Cloud Service Ready" in white on navy (#06265F)
- **Right side:** Letter grade (A+ through F) with grade-appropriate color (green/blue/yellow/orange/red)
- **Subtext:** "Pre-Flight™" in small text below the badge (optional, depending on badge style)
- **Style:** Flat style matching shields.io conventions

### Grade-to-Color Mapping

| Grade | Color | Hex |
|-------|-------|-----|
| A / A+ | Bright Green | #4c1 |
| B | Blue | #007ec6 |
| C | Yellow | #dfb317 |
| D | Orange | #fe7d37 |
| F | Red | #e05d44 |

### Badge URL Structure

```
https://focusgts.com/preflight/badge/{project-hash}.svg
```

- `project-hash` is a short hash generated from the project name + scan timestamp
- The SVG is generated server-side (or via a serverless function) based on stored scan results
- Badge URL is stable — it updates when the user re-scans, so README always shows latest score

### Alternative: Static Badge (No Server)

If server-side generation is not yet available, offer a static shields.io URL:

```markdown
![AEM Cloud Service Ready](https://img.shields.io/badge/AEM_Cloud_Service_Ready-A+-brightgreen?style=flat&logo=data:image/svg+xml;base64,...)
```

- Uses shields.io's static badge API
- Encodes the score directly in the URL
- User must manually update after re-scanning
- No backlink to focusgts.com (trade-off for zero infrastructure)

### README Integration

After a scan, show a "Copy Badge" button in the results panel:

```markdown
[![AEM Cloud Service Ready](https://focusgts.com/preflight/badge/abc123.svg)](https://focusgts.com/preflight/report/abc123)
```

- The badge image links to the full report on focusgts.com/preflight
- Clicking the badge takes the viewer to the detailed scan results
- The markdown snippet is pre-formatted and one-click copyable

### Viral Loop

```
Engineer scans code → Gets badge → Adds to README → 
Teammate sees badge → Clicks through → Runs their own scan → 
Gets their own badge → Adds to their README → ...
```

Each badge in a README is a permanent, zero-cost impression that compounds over time. If 100 projects add the badge, every developer who views those repos sees Pre-Flight™ branding.

## Consequences

**Positive:**
- Every badge is a permanent backlink — compounds over time with zero ongoing cost
- Badges in README files reach developers who would never search for an AEM migration tool
- The click-through to full reports drives traffic to focusgts.com/preflight
- Teams can track their readiness score at a glance in their repo
- Creates social proof: "If that team uses Pre-Flight™, we should too"
- SEO benefit from backlinks across GitHub repositories

**Negative:**
- Dynamic badges require server infrastructure (serverless function at minimum)
- Stale badges (if team doesn't re-scan) could show outdated scores
- Badge proliferation without meaningful usage could dilute credibility
- Relies on teams voluntarily adding badges — no enforcement mechanism

**Mitigations:**
- Ship static shields.io badges first (zero infrastructure), add dynamic badges later
- Include scan date in badge tooltip/alt-text so viewers know freshness
- Badge links to full report where freshness is clearly visible

## Estimated Effort
- Static badge URL generation + copy button: 4 hours
- Badge design (SVG template): 4 hours
- Dynamic badge serverless function: 1-2 days
- Report landing page (badge click destination): 1-2 days
- **Total: 3-5 days**
