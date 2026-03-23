# ADR-026: Self-Healing Migrations

**Status:** Accepted
**Date:** 2026-03-22
**Author:** Black Hole Engineering

## Context

Enterprise AEM migrations fail at high rates. Industry data shows 40-60% of migration steps encounter at least one error requiring manual intervention. The typical response is:

1. Migration step fails
2. Human reviews the error log
3. Human researches the fix (often hours/days)
4. Human applies the fix manually
5. Migration step retries

This loop is expensive, slow, and does not learn. The same error on different projects triggers the same research cycle repeatedly.

## Decision

We implement a **Self-Healing Migration Engine** that automatically detects failures, diagnoses root causes, and applies proven fixes from both a built-in remedy library and the RuVector learned-pattern database. The engine uses confidence-based decision thresholds to determine whether to auto-apply, suggest, or escalate each fix.

### Architecture

```
Migration Step Fails
        |
  DiagnosticEngine.analyze()
        |
  Classify Error → Extract Patterns → Suggest Root Cause
        |
  RemedyLibrary.findRemedy() + RuVector.findSimilarFixes()
        |
  Confidence-Based Decision
        |
  ┌─────────────────┬─────────────────┬──────────────────┐
  │  > 0.95 + 10    │  0.80 - 0.95    │  0.60 - 0.80     │  < 0.60
  │  successes      │                 │                  │
  │  AUTO-APPLY     │  AUTO-APPLY     │  SUGGEST         │  ESCALATE
  │  (audit log)    │  (+ notify)     │  (wait for       │  (human
  │                 │  (+ rollback)   │   approval)      │   review)
  └─────────────────┴─────────────────┴──────────────────┘
        |
  Record Outcome → Update Confidence → RuVector Learning
```

### Confidence Thresholds

| Threshold | Action | Rationale |
|-----------|--------|-----------|
| >= 0.95 AND success_count > 10 | Auto-apply silently | Proven fix with extensive track record |
| 0.80 - 0.95 | Auto-apply with notification | High confidence but user should be aware; rollback available |
| 0.60 - 0.80 | Suggest fix, wait for approval | Moderate confidence; human judgment needed |
| < 0.60 | Escalate, no suggestion | Low confidence; suggesting a bad fix is worse than no suggestion |

### Circuit Breaker

If the same item fails 3 times (regardless of remedy applied), the engine stops attempting fixes and escalates immediately. This prevents infinite retry loops and resource waste on items that may require structural changes.

### Error Categories

The diagnostic engine classifies errors into seven categories:
- **api_error** - HTTP failures, rate limits, connectivity issues
- **code_compatibility** - Build failures, deprecated APIs, bundle resolution
- **content_integrity** - Broken references, invalid node types, missing assets
- **permission_denied** - Auth failures, ACL violations, missing service users
- **resource_limit** - Timeouts, memory, disk space, payload size
- **configuration_error** - Invalid OSGi configs, dispatcher rules, workflow steps
- **unknown** - Unrecognized errors requiring manual investigation

### Built-in Remedies

Ten pre-built remedies cover the most common AEM migration failures:
1. OSGi bundle dependency resolution
2. Content node splitting for oversized nodes
3. Dispatcher rule syntax correction
4. API rate limit backoff with exponential retry
5. Service user mapping suggestions
6. Oak index conversion to cloud format
7. Workflow step mapping to cloud alternatives
8. Broken content reference repair
9. Package filter overlap resolution
10. Replication agent to Sling Content Distribution conversion

### RuVector Integration

Beyond built-in remedies, the engine queries the RuVector `fix_library` namespace for learned fixes from previous migrations. When a remedy (built-in or learned) succeeds or fails, the outcome is recorded back to RuVector, continuously improving fix accuracy across all migrations.

## Consequences

### Positive
- Dramatic reduction in human intervention during migrations
- Learning network means fixes improve over time across all customers
- Consistent, auditable remediation decisions
- Reduced migration duration and cost
- Competitive differentiator: no other migration tool self-heals

### Negative
- Auto-applied fixes could mask deeper issues if confidence scoring is poorly calibrated
- Circuit breaker threshold (3 failures) may be too aggressive for some edge cases
- Built-in remedy library requires ongoing maintenance as AEM evolves

### Mitigations
- All auto-applied fixes are logged with full audit trail including rollback info
- Confidence thresholds are conservative; the 0.95 threshold with 10+ success requirement is intentionally strict
- Circuit breaker limit is configurable
- Human approval required for all medium-confidence fixes
- RuVector learning loop continuously adjusts confidence based on real outcomes
