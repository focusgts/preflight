# ADR-028: Migration Cost Calculator

## Status

Accepted

## Context

Prospects evaluating migration platforms need to understand cost implications before engaging with sales. Traditional enterprise software sales relies on gated pricing — requiring a demo call or RFP before revealing costs. This creates friction and reduces top-of-funnel volume.

We need a self-serve tool that creates "sticker shock" — showing prospects exactly how much they would pay a traditional SI (Accenture, Deloitte, Cognizant, etc.) compared to Black Hole's AI-accelerated approach.

## Decision

Build a **free, public, no-auth-required** Migration Cost Calculator at `/calculator` that:

1. **Accepts migration parameters** — type, scale, components, assets, integrations, compliance, company size, AEM version
2. **Calculates side-by-side costs** — traditional SI vs Black Hole
3. **Shows dramatic savings** — animated counters, color-coded comparisons, timeline visualizations
4. **Generates shareable URLs** — pre-filled parameters encoded in the URL path for social sharing
5. **Drives assessment requests** — prominent CTA to convert from calculator to paid engagement

### Pricing Model Methodology

**Traditional SI Model** (based on industry benchmarks):
- Blended hourly rates: $250 (mid-market) to $350 (large enterprise)
- Phase-by-phase duration estimates scaled by site count, component count, and complexity
- 35% contingency buffer (industry standard for SI projects)
- Compliance overhead based on framework (HIPAA adds 240 hours, FedRAMP adds 320)
- Version distance multiplier (AEM 6.1 = 1.6x, AEM 6.5 = 1.0x)

**Black Hole Model**:
- Platform fee: $45K-$150K based on company tier
- 40-80% reduction in SI hours through automation (assessment: 80%, content: 70%, code: 55%)
- Zero contingency (simulation + self-healing prevents overruns)
- Lower risk profile (<20% overrun probability vs 45-85% traditional)

### Conversion Funnel

```
Calculator visit (SEO/social) → Adjust sliders → See savings →
  → Share URL (viral loop) OR
  → "Get Free Assessment" CTA → Assessment request form → Sales engagement
```

### Viral Growth Mechanism

Shareable URLs encode inputs: `/calculator/aem-onprem-to-cloud/25-sites/100-components`

When shared on LinkedIn/Slack/email, recipients see a pre-filled calculator with the sharer's configuration, creating discussion around migration costs within organizations.

## Consequences

### Positive
- Zero-friction top-of-funnel acquisition
- Self-serve sticker shock drives urgency
- Shareable URLs create viral loops within organizations
- SEO value from "AEM migration cost" search queries
- Reduces sales cycle by pre-qualifying prospects on price sensitivity

### Negative
- Published pricing model could be compared against actual quotes
- Competitors can reverse-engineer pricing assumptions
- Over-optimistic savings estimates could damage credibility if not backed by delivery

### Mitigations
- All figures labeled as "estimates based on industry benchmarks"
- Calculator output is directional, not a binding quote
- Assessment provides precise figures validated by simulation
- Cost engine uses conservative automation factors (not best-case)
