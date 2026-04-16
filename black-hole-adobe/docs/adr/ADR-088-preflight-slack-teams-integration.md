# ADR-088: Pre-Flight™ Slack and Teams Integration

## Status: Proposed

## Date: 2026-04-15

## Context

Development teams live in Slack and Microsoft Teams. Scan results that only exist in a browser tab or PDF attachment don't reach the people who need to see them at the moment they're relevant. A webhook notification that posts scan results directly into a team channel creates visibility without requiring anyone to visit the tool.

This pattern is proven across every successful developer tool: GitHub, CircleCI, SonarCloud, Datadog — all of them offer Slack/Teams webhooks because that's where team awareness happens. A scan result posted to `#aem-migration` is seen by the tech lead, the architect, the PM, and the other developers — all without anyone forwarding a PDF.

Combined with the CI/CD API (ADR-087), this enables a fully automated loop: commit triggers pipeline, pipeline runs Pre-Flight™ scan, scan results post to Slack. The team sees migration progress on every merge without lifting a finger.

## Decision

Add webhook integration that posts Pre-Flight™ scan results to Slack and Microsoft Teams channels.

### Message Format

#### Slack (Block Kit)

```json
{
  "blocks": [
    {
      "type": "header",
      "text": { "type": "plain_text", "text": "Pre-Flight™ Scan Results" }
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*ACME Corp — ui.apps*\nScore: *78% (B)* — up from 72%\n3 critical issues remaining"
      },
      "accessory": {
        "type": "image",
        "image_url": "https://focusgts.com/preflight/badge/proj_abc123.svg",
        "alt_text": "Readiness Score"
      }
    },
    {
      "type": "section",
      "fields": [
        { "type": "mrkdwn", "text": "*Blockers:* 0" },
        { "type": "mrkdwn", "text": "*Critical:* 3" },
        { "type": "mrkdwn", "text": "*Major:* 8" },
        { "type": "mrkdwn", "text": "*Minor:* 12" }
      ]
    },
    {
      "type": "actions",
      "elements": [
        {
          "type": "button",
          "text": { "type": "plain_text", "text": "View Full Report" },
          "url": "https://focusgts.com/preflight/report/abc123"
        }
      ]
    }
  ]
}
```

#### Microsoft Teams (Adaptive Card)

```json
{
  "type": "message",
  "attachments": [{
    "contentType": "application/vnd.microsoft.card.adaptive",
    "content": {
      "type": "AdaptiveCard",
      "body": [
        { "type": "TextBlock", "text": "Pre-Flight™ Scan Results", "weight": "bolder", "size": "large" },
        { "type": "TextBlock", "text": "**ACME Corp — ui.apps**" },
        { "type": "TextBlock", "text": "Score: **78% (B)** — up from 72%" },
        { "type": "ColumnSet", "columns": [
          { "type": "Column", "items": [{ "type": "TextBlock", "text": "Blockers: 0" }] },
          { "type": "Column", "items": [{ "type": "TextBlock", "text": "Critical: 3" }] },
          { "type": "Column", "items": [{ "type": "TextBlock", "text": "Major: 8" }] }
        ]}
      ],
      "actions": [
        { "type": "Action.OpenUrl", "title": "View Full Report", "url": "https://focusgts.com/preflight/report/abc123" }
      ]
    }
  }]
}
```

### Configuration

#### In-Browser Setup (Manual Scans)

1. User goes to Pre-Flight™ Settings
2. Enters a Slack Incoming Webhook URL or Teams Incoming Webhook URL
3. Optionally selects notification threshold: "Only notify on score changes" or "Notify on every scan"
4. Tests the webhook with a sample message
5. Webhook URL stored in browser localStorage (never sent to our servers)

#### CI/CD Setup (Automated Scans)

```yaml
# GitHub Actions example
- name: Post Pre-Flight results to Slack
  run: |
    curl -X POST ${{ secrets.SLACK_WEBHOOK_URL }} \
      -H "Content-Type: application/json" \
      -d "$(preflight scan --output=slack-webhook ./ui.apps)"
```

Pre-Flight™ CLI (or API) outputs scan results pre-formatted for Slack/Teams webhook consumption.

### Notification Types

| Trigger | Message | When |
|---------|---------|------|
| Scan complete | Full results summary | Every scan (or per threshold setting) |
| Score improved | "Score improved from C (58%) to B (76%)" | Score crosses a grade boundary upward |
| Score declined | "Score dropped from B (76%) to C (62%) — 5 new critical findings" | Score crosses a grade boundary downward |
| All blockers resolved | "All blocker findings resolved! Score: A (94%)" | Blocker count reaches 0 |
| New rule violations | "3 new deprecated API findings detected in latest scan" | Previously clean rules now have findings |

### Trend Indicator

Include a directional indicator in every message:
- Score improved from last scan
- Score unchanged from last scan
- Score declined from last scan
- First scan (no comparison available)

### Privacy

- Webhook URLs are stored locally or in the user's project settings (ADR-087)
- Messages contain findings metadata only (rule IDs, counts, scores) — never actual code
- The "View Full Report" link requires authentication if the project is private (ADR-087)
- Webhook payloads are sent directly from the client (manual scans) or the CI runner (automated scans) — Pre-Flight™ servers never see the webhook URL

## Consequences

**Positive:**
- Puts scan results where the team already lives — no behavioral change required
- Trend indicators create a passive awareness of migration progress across the entire team
- "View Full Report" button drives traffic back to Pre-Flight™ — marketing loop from team channels
- Score improvement notifications create celebration moments that reinforce tool usage
- CI/CD integration makes notifications automatic — zero manual effort after setup
- Extremely low implementation cost for high visibility impact

**Negative:**
- Webhook URLs are secrets that could be accidentally exposed
- Noisy notifications (every scan, no threshold) could lead to channel fatigue and webhook muting
- Slack/Teams webhook APIs change occasionally, requiring maintenance
- Client-side webhook calls from browser may be blocked by corporate firewalls/CORS policies

**Mitigations:**
- Default to "notify on grade changes only" to minimize noise
- Clear documentation on securing webhook URLs (use environment variables in CI, don't commit to repos)
- Webhook format validation before sending — graceful failure if API changes
- For corporate environments with CORS restrictions, provide the CLI/CI approach instead of browser-side calls

## Estimated Effort
- Slack Block Kit message builder: 3 hours
- Teams Adaptive Card message builder: 3 hours
- Settings UI for webhook configuration: 3 hours
- Notification threshold logic: 2 hours
- Test webhook functionality: 1 hour
- CLI output formatter (--output=slack-webhook): 3 hours
- Documentation: 1 hour
- **Total: 1 week**
