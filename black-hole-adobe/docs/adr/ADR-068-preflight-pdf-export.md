# ADR-068: Pre-Flight™ PDF Report Export

## Status: Proposed

## Date: 2026-04-15

## Context

Engineers who run Pre-Flight™ scans need to share findings with their team leads, architects, and managers — people who won't paste code into a browser tool. A downloadable PDF report branded with Navigator makes findings portable, shareable, and professional. Every PDF that circulates inside a customer org is a branded lead that reaches decision-makers who never visited the tool directly.

Currently, findings only exist in the browser session and are lost on refresh.

## Decision

Add a "Download Report" button to the results panel that generates a branded PDF entirely client-side.

### Report Contents

1. **Header:** Navigator logo, "Pre-Flight™ Report", date/time, code language
2. **Summary:** Total findings by severity (Blocker / Critical / Major / Minor / Info), pass/fail verdict, scan duration
3. **Findings table:** Each finding with rule ID, severity badge, line reference, description, and remediation guidance
4. **Code snippet:** The scanned code with finding locations highlighted
5. **Footer:** "Powered by Focus GTS Navigator" with link to navigator.focusgts.com, security note ("This report was generated locally — no code was transmitted")

### Implementation

- Use `jspdf` + `jspdf-autotable` for client-side PDF generation (no server required)
- Maintain the zero-network-call guarantee — PDF is generated entirely in the browser
- Include the Pre-Flight™ trademark on the cover
- Brand colors: navy (#06265F), purple (#9966F0), gold (#FFB701)

### Privacy

- PDF generation happens client-side — code never leaves the browser
- No watermarking with user email (that would feel invasive)
- Report includes a timestamp but no user-identifying information

## Consequences

**Positive:**
- Findings become shareable artifacts that circulate inside customer organizations
- Decision-makers see Navigator branding without visiting the tool
- Engineers can attach reports to Jira tickets and migration plans
- Strengthens the "real tool, not a toy" perception

**Negative:**
- Adds ~80KB to bundle size (jspdf)
- PDF layout requires maintenance as findings format evolves
- Risk of reports being shared out of context (findings without code context)

## Estimated Effort
- PDF generation library integration: 2 hours
- Report template design: 3 hours
- Testing across browsers: 1 hour
- **Total: 6 hours**
