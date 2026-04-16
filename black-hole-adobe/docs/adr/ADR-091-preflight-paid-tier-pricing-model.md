# ADR-091: Pre-Flight™ Paid Tier Pricing Model

## Status: Proposed

## Date: 2026-04-15

## Context

Pre-Flight™ is currently free with no monetization path. Free tools achieve maximum adoption but generate zero revenue. The tool has been designed from the start to build trust and demonstrate value through free access — this is the correct strategy for market entry. But long-term sustainability requires a pricing model that captures value proportional to what the tool delivers.

The competitive landscape is favorable for monetization:
- **SonarCloud** charges $10-$50/month per project for hosted code analysis
- **Codacy** charges $15/month per user for automated code review
- **Snyk** charges $25/month per developer for security scanning
- **No competitor charges for AEM-specific tooling** — the market is wide open

None of these competitors understand AEM Cloud Service rules, content package structure, or Dispatcher configuration. Pre-Flight™ occupies a unique niche where the value proposition is clear ("will your pipeline fail?") and the alternative is expensive ("hire a consultancy for $50-100K").

The key pricing principle: **detection is free, planning is paid.** Free users get the full scanning engine, all rules, and immediate results. Paid users get the features that turn findings into action: migration roadmaps, historical tracking, team collaboration, and CI/CD integration.

## Decision

Implement a three-tier pricing model for Pre-Flight™: Free, Team, and Enterprise.

### Tier Comparison

| Feature | Free | Team ($15-30/mo per project) | Enterprise (Custom) |
|---------|------|------------------------------|---------------------|
| **Scanning** | | | |
| All 52+ rules | Yes | Yes | Yes |
| Unlimited scans | Yes | Yes | Yes |
| File upload + paste | Yes | Yes | Yes |
| Multi-file scanning | Yes | Yes | Yes |
| Readiness score + grade | Yes | Yes | Yes |
| PDF export | Yes | Yes | Yes |
| Share URLs | Yes | Yes | Yes |
| Cloud Service Ready badge | Static only | Dynamic (auto-updating) | Dynamic |
| **Planning** | | | |
| Migration Roadmap (ADR-086) | Score only | Full roadmap + effort estimates | Full roadmap |
| Jira/CSV export | No | Yes | Yes |
| Timeline calculator | No | Yes | Yes |
| **Tracking** | | | |
| Historical score tracking (ADR-087) | Local (browser only) | Cloud-based (team-shared) | Cloud-based |
| Multi-project comparison | No | Up to 10 projects | Unlimited projects |
| Trend analysis | No | Yes | Yes |
| Compliance reports | No | Yes | Yes + custom branding |
| **Integration** | | | |
| Slack/Teams webhooks (ADR-088) | No | Yes | Yes |
| CI/CD API (ADR-087) | No | Yes | Yes + custom runners |
| GitHub integration | No | Yes | Yes + GitHub Enterprise |
| **AI Features** | | | |
| AI auto-fix (ADR-089) | 5 fixes/scan | Unlimited | Unlimited + custom prompts |
| **Support** | | | |
| Community support | Yes | Email support (48hr response) | Dedicated support (4hr SLA) |
| Priority rule updates | No | Yes — new rules within 48hrs of Adobe announcements | Yes + custom rule development |
| **Administration** | | | |
| SSO/SAML | No | No | Yes |
| RBAC (role-based access) | No | No | Yes |
| Audit logging | No | No | Yes |
| Data residency options | No | No | Yes (US/EU) |
| Custom retention policies | No | No | Yes |

### Pricing Rationale

#### Team Tier: $15-30/month per project

- **Per-project** (not per-user) pricing reduces friction for team adoption
- A "project" is a single AEM codebase / repository
- At $15/month, the cost is negligible compared to the migration work it supports
- At $30/month, it's still less than one hour of a consultant's time
- Annual billing discount: $150/year ($12.50/month) at the $15 price point

**Why per-project, not per-user:**
- Per-user pricing creates friction: "Can I share the login?" "Do we need 8 seats?"
- Per-project pricing aligns with how AEM teams work: one codebase, many contributors
- Simpler purchasing decision: "We have 3 AEM projects migrating → $45-90/month"
- No need to manage seat licenses or user provisioning

#### Enterprise Tier: Custom pricing

- Starting at $500/month for 10 projects + SSO + dedicated support
- Scaling based on: number of projects, number of users, SLA requirements, custom features
- Sales-assisted purchasing — not self-serve
- Annual contracts with quarterly business reviews
- Custom rule development included (e.g., organization-specific coding standards)

### Revenue Projections

Conservative scenario (first 12 months):

| Month | Free Users | Team Conversions | Enterprise | MRR |
|-------|-----------|-----------------|------------|-----|
| 1-3 | 500 | 5 projects ($15) | 0 | $75 |
| 4-6 | 2,000 | 25 projects ($20 avg) | 1 ($500) | $1,000 |
| 7-9 | 5,000 | 75 projects ($20 avg) | 3 ($600 avg) | $3,300 |
| 10-12 | 10,000 | 150 projects ($22 avg) | 5 ($700 avg) | $6,800 |
| **12-month ARR** | | | | **~$82K** |

Optimistic scenario with strong Summit traction:

| Month | Free Users | Team Conversions | Enterprise | MRR |
|-------|-----------|-----------------|------------|-----|
| 1-3 | 2,000 | 20 projects ($20) | 1 ($500) | $900 |
| 4-6 | 8,000 | 100 projects ($22 avg) | 5 ($700 avg) | $5,700 |
| 7-9 | 20,000 | 300 projects ($25 avg) | 10 ($800 avg) | $15,500 |
| 10-12 | 40,000 | 600 projects ($25 avg) | 20 ($900 avg) | $33,000 |
| **12-month ARR** | | | | **~$396K** |

### Billing Infrastructure

- **Payment processor:** Stripe — standard for SaaS, supports subscriptions, invoicing, and usage-based billing
- **Account management:** Supabase Auth (aligns with ADR-087 backend) or Auth0
- **Subscription management:** Stripe Billing with customer portal for self-service upgrades/downgrades/cancellations
- **Invoicing:** Stripe automatic invoicing for enterprise accounts
- **Tax handling:** Stripe Tax for global tax compliance

### Upgrade Prompts

Strategic placement of upgrade prompts at moments of maximum perceived value:

| Trigger | Prompt |
|---------|--------|
| First scan with 10+ findings | "Your project has 47 findings. Unlock the Migration Roadmap to see a prioritized remediation plan." |
| Second scan in same session | "Track your progress over time with Historical Score Tracking." |
| AI fix limit reached | "You've used 5 of 5 AI-assisted fixes. Upgrade for unlimited AI fixes." |
| Score improves significantly | "Great progress! Track this improvement over time with Team Dashboard." |
| Share URL generated | "Add an auto-updating badge to your README with Team tier." |
| PDF downloaded | "Want to generate this report automatically from your CI pipeline? Upgrade to Team." |

### What Stays Free Forever

Commitment to free tier viability:

1. All scanning rules — never gate-keep rule coverage behind a paywall
2. Unlimited scans — no scan count limits
3. PDF export — always available
4. Share URLs — always available
5. Readiness score and grade — always visible
6. Fix suggestions (text-based) — always available

The free tier must be genuinely useful on its own. It's not a trial — it's a product. The paid tier adds planning, tracking, and automation on top of a complete free product.

## Consequences

**Positive:**
- Creates a sustainable revenue stream that funds ongoing development and rule maintenance
- Per-project pricing minimizes adoption friction — no seat counting or user management
- Free tier remains genuinely useful — builds trust and drives organic growth
- Enterprise tier opens conversations with Adobe SI partners who manage dozens of AEM instances
- Revenue projections are conservative — even the low scenario covers development costs
- Pricing is dramatically lower than the consultancy alternative ($15-30/month vs. $50-100K engagement)

**Negative:**
- Billing infrastructure is significant non-product engineering work
- Upgrade prompts must be carefully designed — too aggressive drives users away, too subtle gets ignored
- Per-project pricing requires defining what constitutes a "project" (potential for gaming/confusion)
- Enterprise sales cycle is long (3-6 months) — revenue takes time to materialize
- Support obligations increase with paid tiers — must staff accordingly
- Free-to-paid conversion rates in developer tools are typically 2-5% — need large free user base

**Mitigations:**
- Use Stripe for billing to minimize custom infrastructure
- A/B test upgrade prompt placement and messaging
- Define "project" clearly: one repository URL = one project (or one project name for non-GitHub users)
- Enterprise tier is sales-assisted — only pursue when inbound interest exists
- Self-serve Team tier requires zero sales effort — scales with product growth
- Focus on free user acquisition first — monetization follows adoption, not the reverse

## Estimated Effort
- Stripe integration (subscriptions, customer portal): 1 week
- Authentication system (Supabase Auth): 3-4 days
- Account/project management UI: 1 week
- Feature gating logic (free vs. Team vs. Enterprise): 2-3 days
- Upgrade prompt system: 2-3 days
- Billing documentation and legal (terms of service, privacy policy): 3-4 days
- Enterprise SSO/SAML integration: 1-2 weeks
- **Total: ongoing (billing infrastructure alone is 3-4 weeks; enterprise features are additional)**
