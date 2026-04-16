# ADR-079: Pre-Flight™ Deprecated API Deadline Countdown Banner

## Status: Proposed

## Date: 2026-04-15

## Context

As of March 30, 2026, Adobe began enforcing deprecated API failures in Cloud Manager pipelines. Teams that haven't migrated off deprecated APIs are experiencing hard pipeline failures with no override option. Adobe has published an enforcement timeline with multiple phases — some APIs are already enforced, others have deadlines approaching in the coming months.

Pre-Flight™ already detects deprecated APIs (ADR-078), but detection alone doesn't communicate urgency. Engineers who see a finding in a list may treat it as "someday" work. A visible countdown creates the visceral urgency that matches reality: these APIs will permanently break your pipeline on a specific date, and that date is approaching.

Additionally, many engineers are unaware that Adobe's enforcement is phased — different API categories have different deadlines. A banner that auto-calculates remaining days from the current date makes the threat concrete rather than abstract.

## Decision

Add a persistent visual banner to the top of the Pre-Flight™ results panel that displays a countdown to the next deprecated API enforcement deadline.

### Banner Design

1. **Position:** Full-width banner above the results panel, below the scan input area
2. **Visibility:** Only shown when the scan detects at least one deprecated API finding
3. **Format:** "X days until deprecated APIs fail your pipeline permanently"
4. **Color coding:**
   - > 90 days: Blue (informational)
   - 30-90 days: Yellow/amber (warning)
   - < 30 days: Red with pulse animation (critical)
   - Past deadline: Red with "ENFORCED NOW" label
5. **Link:** "View Adobe's enforcement timeline" linking to the official Adobe deprecation schedule page
6. **Dismiss:** User can dismiss the banner for the current session, but it returns on next scan

### Auto-Calculation Logic

```typescript
interface DeprecationPhase {
  name: string;
  deadline: Date;
  affectedAPIs: string[];
  adobeDocUrl: string;
}

const ENFORCEMENT_PHASES: DeprecationPhase[] = [
  {
    name: 'Phase 1 — Core Deprecated APIs',
    deadline: new Date('2026-03-30'),
    affectedAPIs: ['org.apache.sling.commons.json', 'com.github.jknack.handlebars'],
    adobeDocUrl: 'https://experienceleague.adobe.com/...'
  },
  {
    name: 'Phase 2 — Extended API Enforcement',
    deadline: new Date('2026-06-30'),
    affectedAPIs: ['com.day.cq.commons.Externalizer (deprecated methods)', 'Guava direct usage'],
    adobeDocUrl: 'https://experienceleague.adobe.com/...'
  }
  // Additional phases as Adobe announces them
];
```

- The banner shows the nearest upcoming deadline that affects APIs found in the scan
- If multiple deadlines apply, show the soonest one with a note: "+N more enforcement dates ahead"
- If all detected API deadlines have passed, show "ENFORCED — These APIs are failing your pipeline NOW"

### Banner Content Variants

| State | Banner Text |
|-------|-------------|
| Future deadline | "23 days until `org.apache.sling.commons.json` fails your pipeline permanently. [View timeline]" |
| Imminent (< 7 days) | "6 DAYS until deprecated APIs break your pipeline. Act now. [View timeline]" |
| Past deadline | "ENFORCED: Deprecated APIs are failing Cloud Manager pipelines NOW. [View timeline]" |
| Multiple phases | "23 days until Phase 2 enforcement. Phase 1 already enforced. [View timeline]" |

### Maintenance

- Enforcement phases are defined in a single `deprecation-timeline.ts` file
- When Adobe announces new phases or changes dates, only this file needs updating
- The banner automatically adapts — no UI changes needed

## Consequences

**Positive:**
- Creates immediate urgency that matches reality — deprecated APIs ARE failing pipelines right now
- Extremely timely for Adobe Summit and post-Summit migration wave
- The countdown mechanic is psychologically proven to drive action (loss aversion)
- Links to Adobe's official timeline lend credibility — Pre-Flight™ is the messenger, not the authority
- Engineers can show the banner to their managers as evidence for prioritizing migration work

**Negative:**
- Banner could feel alarmist if the user's code only uses APIs with distant deadlines
- Enforcement dates may shift — Adobe has changed timelines before, requiring updates to our phase data
- A persistent banner reduces screen real estate for findings

**Mitigations:**
- Only show the banner when deprecated APIs are actually detected — not for every scan
- Dismissable per session so it doesn't become banner blindness
- Enforcement phase data is isolated in one file for easy updates

## Estimated Effort
- Enforcement phase data structure: 30 minutes
- Countdown calculation logic: 30 minutes
- Banner UI component with color coding: 45 minutes
- Dismiss/session persistence: 15 minutes
- **Total: 2 hours**
