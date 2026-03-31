# ADR-035: Post-Migration Drift Monitoring

## Status: Proposed

## Date: 2026-03-28

## Context

AEM as a Cloud Service is a continuously deployed platform — Adobe pushes updates every 2-4 weeks without customer control. These updates can introduce breaking changes to custom code, modify API behavior, deprecate functionality, or alter rendering. No Adobe tool monitors for breaking changes introduced by these automatic updates. Cloud Manager pipelines can start failing after an Adobe-side update with no customer code changes. The MONITOR phase of Adobe's migration lifecycle maps to "NOTHING."

This gap creates a recurring revenue opportunity: once a migration is complete, ongoing drift monitoring provides continuous value and justifies a SaaS subscription model.

## Decision

Build a Post-Migration Drift Monitoring service that detects environment changes before they become production incidents:

### 1. Visual Drift Detection

- Scheduled visual regression scans (daily or weekly, configurable)
- Compare current production against the post-migration validation baseline (ADR-034)
- Alert when visual diff exceeds configurable threshold
- Track visual drift over time — trending dashboard showing stability score

### 2. API Deprecation Monitoring

- Track Adobe's AEMaaCS release notes feed for newly deprecated APIs
- Cross-reference against customer's deployed code (requires codebase access or deployed bundle manifest)
- Alert when a deployed API is marked for deprecation with specific deadline
- Key dates: March 30, 2026 (pipeline failures begin), May 4, 2026 (security updates stop)
- BPA has no real-time awareness of these deadlines; Black Hole does

### 3. Pipeline Health Monitoring

- Monitor Cloud Manager pipeline success/failure rate via Cloud Manager API
- Detect pipeline failures that correlate with Adobe-side updates (customer code unchanged)
- Provide root cause analysis when pipeline breaks after Adobe update
- Alert on first failure, not after multiple days of failing builds

### 4. Performance Drift Detection

- Scheduled Core Web Vitals measurement (LCP, FID/INP, CLS)
- Compare against post-migration baseline
- Alert on performance regression exceeding threshold (e.g., LCP degrades >500ms)
- Correlate performance changes with Adobe release timeline

### 5. Content Health Monitoring

- Periodic link validation (detect broken internal links)
- DAM health checks (orphaned assets, oversized renditions)
- Detect content structure changes that may indicate authoring issues
- Track content publish success rates

### 6. Dashboard and Alerts

- Single dashboard showing: Visual stability, API compatibility, Pipeline health, Performance, Content health
- Per-metric status: Green (healthy), Yellow (warning), Red (action required)
- Configurable alert channels: email, Slack, webhook
- Monthly summary report (automated, PDF, stakeholder-ready)

### 7. Pricing Model

- Included free for 30 days post-migration (upsell hook)
- Monthly subscription: $500-$2,000/month depending on site size and check frequency
- Annual contracts at 20% discount
- Enterprise tier with custom SLA and dedicated support

## Consequences

### Positive

- Creates recurring SaaS revenue beyond one-time migration fees.
- Provides genuine ongoing value — AEMaaCS auto-updates are a real and continuous risk.
- Differentiates from SIs who walk away after go-live.
- Monthly reports maintain customer relationship and create upsell opportunities for optimization services.

### Negative

- Requires infrastructure investment (scheduled workers, screenshot capture, storage).
- Cloud Manager API access requires customer to grant permissions.
- False positive alerts erode trust; must calibrate thresholds carefully.
