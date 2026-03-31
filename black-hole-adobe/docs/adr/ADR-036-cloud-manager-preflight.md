# ADR-036: Cloud Manager Pre-Flight Simulation

## Status: Proposed

## Date: 2026-03-28

## Context

Customers who pass Adobe's BPA assessment often fail their first Cloud Manager pipeline run. This is because BPA and Cloud Manager's quality gates are NOT identical — they overlap in some areas but are distinct rule sets. Cloud Manager enforces 100+ SonarQube rules and 40+ OakPAL rules that BPA does not pre-assess. Common Cloud Manager failures not caught by BPA include:

- Connection timeout requirements (HttpClient must have timeouts configured)
- ResourceResolver lifecycle violations (must be closed in finally blocks)
- Servlet path registration style (must use resourceType, not path)
- HTTPClient reuse violations (must not create new clients per request)
- OakPAL index rule violations (naming conventions, Tika config requirements)
- Sling Model injection failures (wrong adapter types)
- Custom SonarQube rules specific to AEMaaCS (runtime compatibility checks)

First Cloud Manager failure typically delays migration by 1-3 weeks while teams diagnose and fix quality gate violations they didn't know existed. This is one of the most common and preventable migration delays.

Adobe does not offer a way to run Cloud Manager's quality gates locally before the first deployment.

## Decision

Build a Cloud Manager Pre-Flight Simulation that runs the same quality gate rules locally before the customer's first Cloud Manager deployment:

### 1. SonarQube Rule Replication

- Implement the AEMaaCS-specific SonarQube ruleset (documented at experienceleague.adobe.com under "Custom Code Quality Rules")
- Key rules to replicate:
  - CQRules:ConnectionTimeoutMechanism — all HttpClient calls must have timeout
  - CQRules:ResourceResolverAutoClose — ResourceResolver must be closed
  - CQRules:OakPAL — Oak index definitions must follow naming/type conventions
  - CQRules:ContentClassification — must not reference /libs content directly
  - CQRules:AMSRT — deprecated AMS-specific run modes
  - CQRules:CQBP-72 — custom Sling servlet path registration
  - CQRules:CQBP-84 — ResourceResolver lifecycle management
- Run against customer's Maven project source code
- Output: pass/fail per rule, with specific file/line references

### 2. OakPAL Rule Replication

- Implement the 40+ OakPAL index validation rules
- Check Oak index definitions for:
  - Correct type (lucene, not property)
  - Tika configuration presence
  - Asynchronous indexing flags
  - damAssetLucene compatibility
  - Naming convention compliance
- Run against customer's ui.apps content package
- Output: pass/fail per rule, with specific index references

### 3. Java Runtime Compatibility Check

- Detect Java 11 to Java 21 compatibility issues BPA misses
- Flag sun.* package usage
- Flag native library dependencies (x86-64 compiled .so files that will fail on ARM VMs)
- Flag reflection-based code that may behave differently on Java 21
- Flag removed/changed Java APIs between Java 11 and 21

### 4. Pre-Flight Report

- Traffic light summary: X rules pass, Y warnings, Z blockers
- Per-rule detail with file references and remediation guidance
- Estimated Cloud Manager success probability
- Comparison: "BPA found N issues. Pre-flight found M additional issues that BPA missed."
- Remediation priority: fix these Z blockers first, then these Y warnings

### 5. Delivery Model

- CLI tool customer runs locally: `npx @blackhole/preflight analyze ./aem-project`
- Cloud-hosted option: upload Maven project ZIP for analysis
- CI/CD integration: GitHub Action / Jenkins plugin that runs pre-flight before Cloud Manager deployment

## Consequences

### Positive

- Prevents the single most common and preventable migration delay (1-3 weeks per engagement).
- Positions Black Hole as the bridge between BPA and Cloud Manager — fills an obvious gap.
- CLI tool creates developer adoption and brand awareness.
- Every pre-flight failure caught is a concrete, demonstrable value point.

### Negative

- Cloud Manager rules evolve; must track Adobe's rule updates and keep in sync.
- Cannot guarantee 100% parity with Cloud Manager's actual pipeline (Adobe may have internal rules not documented).
- Requires customer to provide Maven project source code (paid tier).
