# ADR-007: Compliance by Design with Privacy-First Architecture

## Status: Accepted

## Date: 2026-03-21

## Context

Black Hole customers operate in regulated industries: financial services (SOX, PCI-DSS), healthcare (HIPAA), European markets (GDPR), and US state regulations (CCPA). During migration, sensitive data moves between environments. Content may contain PII (names, emails, addresses in content fragments), PHI (health information in healthcare customer content), and payment data (PCI-scoped fields in commerce integrations).

A migration platform that moves regulated data without compliance controls is a liability, not an asset. Compliance cannot be bolted on after the fact; it must be woven into every layer of the architecture.

## Decision

We adopt a compliance-by-design approach with the following pillars:

### 1. Automated PII/PHI Detection

A scanning pipeline runs during the assessment phase that:
- Scans all content (pages, assets, content fragments, forms) for PII patterns (email addresses, phone numbers, national IDs, credit card numbers)
- Uses named entity recognition (NER) via AI to identify contextual PII that regex alone cannot catch (e.g., "John Smith" in a content fragment)
- Flags PHI indicators for healthcare customers (diagnosis codes, medication names, patient identifiers)
- Classifies each detected field by regulation applicability (GDPR Article 9 special categories, HIPAA identifiers, PCI cardholder data)
- Produces a Data Protection Impact Assessment (DPIA) report

### 2. Consent Migration

When migrating from platforms with consent management (cookie consent, marketing preferences):
- Maps source consent records to target consent framework (Adobe Consent XDM schema)
- Validates that no user receives communications they have not consented to after migration
- Produces a consent parity report showing before/after comparison
- Flags any consent records that cannot be cleanly mapped for manual review

### 3. Data Residency Enforcement

- Migration configuration includes explicit source and target data residency regions
- The engine validates that data does not transit through non-permitted regions
- Cloud Service environment region is verified against compliance requirements before migration begins
- AEP dataset residency is validated against the customer's data governance policies

### 4. Audit Trail

Every action in the migration lifecycle is logged to an immutable audit trail:
- Who initiated each phase
- What data was accessed, transformed, and written
- When each operation occurred
- What AI models processed which data
- Whether PII was present in AI model inputs (and if so, which redaction rules were applied)

### 5. AI Data Handling

- PII is redacted before being sent to AI models for analysis
- Content containing PHI is processed locally (never sent to external APIs) when HIPAA compliance is required
- AI model inputs and outputs are logged (with PII redacted) for audit purposes
- Customers can opt out of AI-assisted analysis entirely, falling back to rule-based-only assessment

### Compliance Framework Mapping

| Framework | Key Controls in Black Hole |
|-----------|--------------------------|
| GDPR | PII detection, consent migration, data residency, right to erasure verification, DPIA generation |
| CCPA | Consumer data inventory, opt-out preference migration, data sale tracking |
| HIPAA | PHI detection, local processing mode, BAA-compatible audit trail, encryption at rest and in transit |
| FedRAMP | US-region-only processing, FIPS-compliant encryption, access control logging |
| PCI-DSS | Cardholder data detection, network segmentation verification, encryption validation |
| SOX | Change audit trail, segregation of duties logging, approval workflow enforcement |
| Section 508 | Accessibility validation in the migration validation suite |

## Consequences

**Positive:**
- Compliance is a feature, not a constraint: customers see Black Hole as reducing compliance risk, not adding it
- Automated PII detection catches issues that manual review misses
- Consent migration prevents the most common post-migration compliance failure (sending emails to unsubscribed users)
- Audit trail satisfies auditor requirements without manual documentation
- Data residency enforcement prevents accidental cross-border data transfers

**Negative:**
- PII scanning adds time to the assessment phase (typically 10-20% longer)
- Local processing mode for HIPAA eliminates AI-assisted analysis, reducing assessment quality
- Audit trail storage grows linearly with migration size; requires retention policy
- False positive PII detection (e.g., product names that look like person names) creates review overhead

**Mitigations:**
- PII scanning runs in parallel with other assessment tasks to minimise timeline impact
- HIPAA local mode still uses rule-based analysis; only AI enhancement is disabled
- Audit trail uses structured logging with configurable retention (default: 7 years for SOX)
- PII detection model is tuned per customer vertical to reduce false positives (e.g., healthcare-specific dictionaries)

## Alternatives Considered

**Compliance as an add-on module:** Keeps the core platform simpler but creates risk of non-compliant migrations when the module is not activated. Unacceptable for a platform targeting regulated industries.

**Third-party compliance scanning:** Integrate with tools like OneTrust or BigID for PII detection. Adds external dependency and cost. We implement core detection in-house and provide integration points for third-party tools as optional enhancement.

**Manual compliance review only:** Does not scale. A migration with 50,000 content pages cannot be manually reviewed for PII. Automated detection with human review of flagged items is the only viable approach.
