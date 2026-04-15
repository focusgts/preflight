# ADR-074: Pre-Flight™ Cloud Service Readiness Score

## Status: Proposed

## Date: 2026-04-15

## Context

A list of findings is useful for engineers. A score is useful for everyone. Executives, project managers, and architects need a single number that answers "How ready are we?" without reading through individual rule violations.

A readiness score also enables tracking progress over time ("Last week we were 64%, now we're 78%") and creates a gamification loop that drives repeat usage and sharing.

## Decision

Add a Cloud Service Readiness Score (0-100) and letter grade (A through F) to every scan result.

### Scoring Algorithm

```
Base score: 100
For each finding:
  - Blocker:  -15 points
  - Critical: -10 points
  - Major:    -5 points
  - Minor:    -2 points
  - Info:     -0 points
Floor: 0 (score cannot go negative)
```

### Letter Grades

| Score | Grade | Label | Color |
|-------|-------|-------|-------|
| 90-100 | A | Cloud Service Ready | Green |
| 75-89 | B | Minor Issues | Blue |
| 55-74 | C | Significant Work Needed | Yellow |
| 35-54 | D | Major Refactoring Required | Orange |
| 0-34 | F | Not Cloud Service Compatible | Red |

### Display

1. **Score badge:** Large, prominent circle with score and grade — first thing visible in results
2. **Context line:** "Your code is X% Cloud Service ready" with grade-appropriate messaging
3. **Trend indicator:** If user runs multiple scans in the same session, show improvement/regression arrow
4. **Score in PDF:** Included prominently in the PDF export (ADR-068) header
5. **Score in share URL:** Included in the share link metadata so previews show the grade

### Multi-File Score (with ADR-070)

When scanning multiple files:
- Individual file scores shown per-file
- Overall project score: weighted average by file size
- Dashboard shows score distribution histogram

## Consequences

**Positive:**
- Single number that non-engineers understand and can act on
- Gamification drives repeat usage: "Let's get from C to A"
- Shareable: "Our project scored 47% — we need help" triggers purchase conversations
- Progress tracking creates ongoing engagement with the tool
- PDF reports with a big score on the cover get forwarded to leadership

**Negative:**
- Any scoring algorithm is inherently opinionated — arguments about weighting are inevitable
- A score can create false confidence ("We're an A!") when unchecked rules exist outside Pre-Flight™'s scope
- Grade inflation pressure: if most users score poorly, they may blame the tool rather than their code

**Mitigations:**
- Clear disclaimer: "This score covers the 16 Cloud Manager quality gates checked by Pre-Flight™. Additional Cloud Service requirements may apply."
- Scoring weights are tunable and can be adjusted based on customer feedback

## Estimated Effort
- Scoring algorithm: 1 hour
- Score badge UI component: 2 hours
- Grade messaging and colors: 1 hour
- Integration with PDF export: 1 hour
- Multi-file weighted scoring: 2 hours
- **Total: 7 hours**
