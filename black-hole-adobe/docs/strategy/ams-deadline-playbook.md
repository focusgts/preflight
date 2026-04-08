# AMS Deadline Playbook — August 31, 2026

**Owner**: Focus GTS
**Date created**: 2026-04-08
**Status**: Active — execution starts immediately

## The Opportunity

Adobe is shutting down AEM Managed Services on **August 31, 2026** — roughly 5 months from today. Every AMS customer must migrate to AEMaaCS or be left without Adobe-hosted infrastructure, security patches, or support. Unlike AEM 6.5 on-prem customers who can technically limp along unpatched, AMS customers lose their hosting entirely. **There is no "do nothing" option.**

This is the single most urgent, most addressable, and most willing-to-pay segment in the AEM ecosystem for the next 150 days. Black Hole's job is to capture as much of it as possible before the deadline.

## Target Customer Profile

### Ideal Customer
- Currently running on Adobe Managed Services for AEM
- 6.4 or 6.5 codebase
- Mid-to-large enterprise (1,000-10,000 employees typical)
- Regulated or compliance-sensitive vertical (finance, healthcare, insurance, government, pharma)
- Moved to AMS between 2018 and 2022 to offload infrastructure
- Has not yet started a Cloud Service migration
- Does not have an in-house AEM expert team
- Already has an Adobe contract (not a greenfield prospect)

### Why This Customer Will Buy
- Deadline is hard and known
- They cannot stay put
- They cannot realistically rewrite to EDS in 5 months
- They need speed more than they need choice
- They already pay Adobe, so procurement friction is lower
- Traditional SIs will quote 8-12 weeks just for assessment — they don't have that time
- Their compliance team will not let them run unsupported software past August 31

### Deal Size Expectations
- **Assessment engagement**: $25K-$75K (2-4 weeks)
- **Full migration with Black Hole**: $300K-$1.5M (8-16 weeks)
- **Post-migration monitoring (recurring)**: $2K-$10K/month

Average deal value: ~$500K-$800K. 10 customers = $5M-$8M revenue.

## The Message

### Primary Headline
**"Adobe Managed Services ends August 31. You have 150 days. Black Hole can finish your migration before then."**

### Elevator Pitch
"If you're on AEM Managed Services, Adobe is ending your hosting on August 31. You cannot stay put. You cannot rewrite to Edge Delivery Services in five months. You must move to AEM as a Cloud Service, and every week you wait shrinks your window. Black Hole gives you a real migration assessment with effort estimates in 48 hours instead of 8 weeks, then executes the migration 10 times faster than a traditional SI. Start this week, finish in June, be stable on Cloud Service well before the deadline."

### Three-Bullet Value Prop
- **48-hour assessment** with real effort estimates — SIs take 8-12 weeks to produce the same document
- **8-16 week migration** execution — SIs quote 6-18 months for comparable scope
- **Cloud Manager pre-flight** included — catches deployment failures before they happen

### Common Objections and Responses

**"We don't have time for a new vendor relationship"**
"You have less time for a bad SI estimate. Our assessment is done in 48 hours — most SIs take longer than that just to staff the meeting. If you don't like what we find, you've lost two days and gained a report. If you do, you start execution immediately."

**"Isn't Adobe pushing us to Edge Delivery Services?"**
"Yes, and for some customers EDS is the right long-term answer. But EDS is not a migration — it's a rewrite. Your 100 custom components become 100 JavaScript blocks. Your OSGi services have no home. Your authors learn a new tool. That takes 12-24 months minimum. You have five. The realistic path is AEMaaCS Sites now, then consider EDS as a phase two over the next 3 years."

**"We'll just use our existing SI"**
"Fine. Ask them for a written commitment to complete the migration before August 31. Ask for a fixed-price quote. Ask them to show you their Cloud Manager pre-flight tooling. If they can't commit or can't show the tooling, you're going to miss the deadline. Black Hole can start in 48 hours."

**"What happens if we miss the deadline?"**
"Adobe stops supporting your hosting. You lose security patches. Your compliance posture breaks immediately. Your insurance may deny coverage for AEM-related incidents. Most importantly, you're running a production website on unsupported infrastructure with no Adobe tickets available. You need to not miss the deadline."

## Go-to-Market Actions

### Week 1 (Starting Monday)
1. **Landing page variant** — Create `/ams` route on the Black Hole landing page focused exclusively on the August 31 deadline. Countdown timer to Aug 31, not Feb 2027.
2. **Email template** — Draft cold outreach specifically for AMS customers. Subject line: "150 days until AEM Managed Services ends. Are you ready?"
3. **Partner conversation** — Talk to Adobe Navigator contacts about the AMS migration list. Adobe has this list. Adobe needs these customers migrated. Ask for warm intros.
4. **LinkedIn post** — Publish a post about the August 31 deadline. Use specific language: "If you're on Adobe Managed Services, you have 150 days." Boost with a small paid budget targeting AEM job titles at mid-market enterprises.

### Weeks 2-3
5. **AMS detection in Black Hole** — Enhance the health score scanner to specifically detect AMS hosting patterns (certain header signatures, hostname patterns, SSL certificate issuers). When detected, show a high-urgency AMS-specific message.
6. **AMS cost calculator variant** — Add "Current environment: AMS" as an input. Show the accelerated timeline and cost specifically for AMS → AEMaaCS.
7. **Partner collateral** — Create a one-page PDF that Navigator partners can send to their AMS customers. "Your deadline is real. Here's how to meet it."
8. **Case study outline** — Even without a completed migration, draft the case study template. First pilot customer becomes the case study.

### Weeks 4-8
9. **Pilot migration** — Land the first AMS customer. Run the full assessment → execution flow. Document everything.
10. **Webinar** — "How to migrate from AMS to AEMaaCS in 90 days." Partner with an Adobe Navigator or a known AEM community voice if possible. Record and use for sales enablement.
11. **Sales collateral** — Assessment report template, statement of work template, fixed-price quote framework.

### Weeks 9-16
12. **Scale up** — If the first pilot succeeds, go aggressive on outreach. Target 20-30 conversations, close 5-10 deals.
13. **Second pilot** — Larger scope, more complex customer. Build confidence for enterprise sales.

## Metrics to Track Weekly

| Metric | Target by Week 4 | Target by Week 12 |
|--------|------------------|-------------------|
| AMS-focused landing page visits | 500+ | 5,000+ |
| Health score scans on AMS-hosted sites | 50+ | 500+ |
| Assessment inquiries | 10+ | 100+ |
| Paid assessments booked | 2 | 15 |
| Migration contracts signed | 0 | 5 |
| Revenue booked | $50K | $2M |

## Assumptions and Risks

### Assumptions
- AMS customers are indeed aware of the deadline. (If they're not, the problem is even worse and the urgency message works harder.)
- Focus GTS can actually execute 5-10 migrations in parallel by Q3.
- Navigator partners will make warm intros if asked directly.
- Black Hole's execution engines (ADRs 050-054) are stable enough for real customer work after Pilot 1 validates them.

### Risks
- **We may not have enough engineering capacity to execute 5+ concurrent migrations.** Mitigation: use Navigator engineers on a per-migration basis, keep Focus GTS in the orchestration/review seat.
- **Adobe may extend the AMS deadline.** Mitigation: this is a known risk. Even if extended by 6 months, the urgency still holds. Build the playbook assuming no extension.
- **An early migration could fail publicly.** Mitigation: start with a friendly pilot customer. Do not take a customer whose brand recognition would amplify a failure.
- **Our execution engines have bugs we haven't found yet.** Mitigation: Pilot 1 (internal, Focus GTS sandbox dual-sandbox test) must be completed before any paid engagement.
- **Adobe's Experience Modernization Agent may steal some AMS customers.** Mitigation: the agent only targets EDS. AMS customers who go to EDS are doing a 12-24 month project, not a 5-month migration. They're not our customer anyway.

## The Honest Framing

This playbook assumes Black Hole can deliver paid migrations by late May 2026 at the latest. That means:
- Pilot 1 (internal) must complete by end of April
- Pilot 2 (Navigator friendly) must complete by mid-May
- First paid customer must start by late May

**If any of those dates slip, the AMS deadline opportunity shrinks proportionally.** Every week of slippage is a week of deals we can't close.

This is high-urgency, high-reward, high-risk. If it works, Black Hole has a case study, a revenue track record, and a real market position by Q3 2026. If it doesn't, we've learned what breaks under real customer conditions and we still have the February 2027 on-prem deadline as a second shot.

## Next Step

**Decide this week**: are we committing to the AMS fast-track play or not? If yes, Week 1 actions start Monday. If no, shelve this doc and focus on the slower on-prem timeline.

Written because the deadline does not move. The decision about whether to pursue it does.
