# ADR-034: Visual Regression Testing & Migration Validation

## Status: Proposed

## Date: 2026-03-28

## Context

There is zero automated validation in Adobe's entire migration toolkit. The VALIDATE phase of their migration lifecycle maps to nothing. Practitioners document "silent migration failures" where CTT (Content Transfer Tool) reports success while publish environments are empty or incomplete. Groups and ACLs silently fail to migrate. Content appears on Author but not Publish. Visual rendering differences go undetected until a customer reports them. This is the most common source of post-go-live emergency escalations.

No Adobe tool, and no competitor tool, offers automated visual regression testing for AEM migrations.

## Decision

Build a Visual Regression Testing & Migration Validation module that provides automated confidence that the migrated site matches the source.

### 1. Pre-Migration Baseline Capture

- Crawl source site (configurable page limit: 50, 200, 1000, full site)
- Capture full-page screenshots at 3 breakpoints (desktop 1440px, tablet 768px, mobile 375px)
- Capture page metadata (title, meta description, canonical URL, OG tags)
- Capture HTTP status codes and redirect chains
- Capture Core Web Vitals baseline (LCP, FID, CLS)
- Store as immutable baseline with timestamp

### 2. Post-Migration Comparison

- Same crawl on target AEMaaCS environment
- Pixel-diff comparison using perceptual hash (pHash) — tolerates minor rendering differences (font smoothing, anti-aliasing) while catching structural changes
- Threshold: <5% pixel difference = PASS, 5-15% = WARNING, >15% = FAIL
- Side-by-side visual diff report (highlight regions that changed)
- Metadata diff (title changes, missing meta tags, broken canonicals)
- Status code diff (200->404, redirect chain changes)
- Core Web Vitals comparison (performance regression detection)

### 3. Content Integrity Validation

- Page count comparison (source vs. target — are pages missing?)
- DAM asset count comparison (source vs. target)
- Component count per page (are components dropping during migration?)
- Internal link validation (do all internal links resolve?)
- Form submission testing (do forms still work?)

### 4. Automated Validation Report

- Executive summary: X pages validated, Y% match rate, Z issues found
- Per-page detail with screenshot comparisons
- Categorized issues: Visual regressions, Missing pages, Broken links, SEO regressions, Performance regressions
- Priority ranking: Critical (visible to users), Major (affects SEO/performance), Minor (cosmetic)
- Exportable as PDF for stakeholder sign-off

### 5. Continuous Regression Monitoring (Post-Go-Live)

- Scheduled re-crawl (daily/weekly) to detect regressions introduced by AEMaaCS auto-updates
- Alert when visual diff exceeds threshold
- Ties into ADR-035 (Post-Migration Drift Monitoring)

## Consequences

### Positive

- Fills the biggest gap in Adobe's migration toolkit — automated proof that the migration worked.
- Replaces weeks of manual QA with automated comparison.
- Creates a deliverable (validation report) that customers can use for stakeholder sign-off.
- Continuous monitoring creates ongoing SaaS revenue post-migration.

### Negative

- Full-site crawl + screenshot capture is resource-intensive; need to manage costs.
- Dynamic content (personalization, A/B tests) creates false positives; need exclusion rules.
- Authenticated content (behind login) requires credentials or session tokens.
