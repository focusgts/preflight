# ADR-072: Pre-Flight™ Before/After Code Comparison View

## Status: Proposed

## Date: 2026-04-15

## Context

Migration teams need to understand the gap between their AEM 6.5 code and what Cloud Service requires. Currently, they scan their code, get a list of findings, and mentally map each finding to a fix. A side-by-side before/after view would show the complete picture in one screen: "This is your 6.5 code. This is what it needs to look like for AEMaaCS."

This is the visual proof that migration is tractable — and that Pre-Flight™ can guide the way.

## Decision

Add a split-pane comparison view that shows original code on the left and Cloud Service-compatible code on the right.

### Behavior

1. **Split view toggle:** Button to switch from single-editor to side-by-side comparison mode
2. **Left pane:** Original code (read-only, findings highlighted in red)
3. **Right pane:** Auto-fixed code with all deterministic fixes applied (changes highlighted in green)
4. **Inline annotations:** Each changed region annotated with the rule that triggered it
5. **Summary bar:** "X changes applied to make this code Cloud Service-compatible"
6. **Copy right pane:** One-click to copy the fully migrated version
7. **Remaining items:** Non-auto-fixable findings shown as inline comments in the right pane: `// TODO: Manual review required — [rule description]`

### Dependencies

- Requires ADR-071 (fix suggestions) to generate the "after" version
- Diff algorithm reused from ADR-071's diff rendering

### Implementation

- CSS Grid two-column layout with synchronized scrolling
- Both panes use the same monospace code display component
- Highlighted regions use background-color differentiation (red = removed, green = added)
- All processing client-side

## Consequences

**Positive:**
- Most compelling visual in the tool — instant understanding of migration scope
- "Before/After" is the format every stakeholder understands
- Right pane is directly usable code — copy and commit
- Powerful sales artifact: screenshot the comparison, share with the team
- Migration teams would bookmark this as their daily tool

**Negative:**
- Only as good as the auto-fix engine (ADR-071) — gaps in fix coverage create incomplete "after" views
- Synchronized scrolling is tricky for different-length files
- Two-column layout doesn't work well on narrow screens (need mobile fallback)

## Estimated Effort
- Split pane layout with sync scrolling: 4 hours
- "After" code generation (leveraging ADR-071): 2 hours
- Inline annotations and highlighting: 3 hours
- Mobile fallback (tabbed view): 2 hours
- **Total: 11 hours**
