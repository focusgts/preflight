# ADR-076: Pre-Flight™ Cloud Manager Build Log Comparison

## Status: Proposed

## Date: 2026-04-15

## Context

The most painful moment in an AEM developer's day is watching a Cloud Manager pipeline fail after 45 minutes and scrolling through the build log to find what went wrong. If Pre-Flight™ can parse those build logs and show which failures it would have caught before the pipeline ran, it creates an immediate, visceral proof of value: "You waited 45 minutes. Pre-Flight™ would have told you in 0.3 seconds."

This feature turns a frustrating experience into an acquisition moment.

## Decision

Add a "Paste Build Log" mode that parses Cloud Manager pipeline failure logs and maps them to Pre-Flight™ rules.

### Behavior

1. **Input mode toggle:** Switch between "Paste Code" and "Paste Build Log" modes
2. **Log parsing:** Extract SonarQube violations, OakPAL failures, and Java compatibility errors from Cloud Manager build output
3. **Rule mapping:** Map each extracted violation to the corresponding Pre-Flight™ rule ID
4. **Comparison view:** Show:
   - "Cloud Manager found X issues in 45 minutes"
   - "Pre-Flight™ catches Y of these in under a second"
   - Coverage percentage: "Pre-Flight™ would have caught 87% of these failures before you pushed"
5. **Uncovered findings:** List any Cloud Manager failures NOT covered by Pre-Flight™ rules (transparency builds trust)
6. **CTA:** "Stop waiting. Run Pre-Flight™ before every push."

### Log Formats Supported

- Cloud Manager pipeline build log (plain text)
- SonarQube quality gate report (JSON export)
- Maven build output with SonarQube/OakPAL failures

### Parsing Strategy

- Regex-based extraction of violation patterns:
  - SonarQube: `squid:SxxYY` rule IDs, file paths, line numbers
  - OakPAL: `oakpal:` prefixed violations
  - Java compat: `java.lang.UnsupportedClassVersionError`, deprecated API warnings
- No AI or ML — deterministic parsing only

### Privacy

- Build logs are processed entirely client-side
- No log content is sent to any server
- Build logs often contain internal package names and file paths — extra important to keep local

## Consequences

**Positive:**
- Proves Pre-Flight™ value with the user's own data — most compelling possible demo
- "Would have saved you 45 minutes" is an unarguable value proposition
- Coverage transparency (showing what we don't catch) builds trust
- Turns a frustration moment into a conversion moment
- Engineers who paste one build log will run Pre-Flight™ on every commit

**Negative:**
- Cloud Manager log format is not officially documented and may change between versions
- Log parsing is inherently fragile — new error formats require parser updates
- May overstate coverage if build failures are environment-specific (not code-related)
- Users may expect 100% coverage and be disappointed by gaps

**Mitigations:**
- Clear framing: "Pre-Flight™ covers code quality gates. Environment, build, and deployment failures require different tooling."
- Parser versioning with graceful degradation for unrecognized log formats
- Feedback mechanism: "Log format not recognized? Send it to us" (link to mailto)

## Estimated Effort
- Log format analysis and regex patterns: 4 hours
- Log parser implementation: 4 hours
- Comparison UI: 3 hours
- Coverage calculation: 2 hours
- Testing with real build logs: 3 hours
- **Total: 16 hours**
