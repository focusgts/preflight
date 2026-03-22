# ADR-003: Three-Tier AI Model Strategy

## Status: Accepted

## Date: 2026-03-21

## Context

Black Hole uses AI at multiple stages of the migration lifecycle: classifying migration types, analysing code compatibility, generating remediation guides, transforming code patterns, and producing natural-language reports. These tasks vary dramatically in complexity, latency tolerance, and cost sensitivity.

A single-model approach (always using the most capable model) would be prohibitively expensive at scale. A customer with 50,000 content pages and 200 OSGi bundles could generate thousands of individual AI calls during a single assessment. Conversely, using only a small model would produce unacceptable quality for complex code refactoring tasks.

## Decision

We implement a three-tier AI model routing strategy using Anthropic's Claude model family:

### Tier 1: Claude Haiku (Classification and Routing)
- **Use cases:** Migration type classification, severity categorisation, finding deduplication, simple pattern matching, metadata extraction
- **Latency:** ~200-500ms per call
- **Cost:** ~$0.00025 per 1K tokens
- **Volume:** High (thousands of calls per assessment)
- **Quality bar:** 90%+ accuracy sufficient; errors are caught by downstream tiers

### Tier 2: Claude Sonnet (Analysis and Assessment)
- **Use cases:** Code compatibility analysis, integration dependency mapping, risk factor identification, content health assessment, XDM schema mapping, compliance gap detection
- **Latency:** ~1-3s per call
- **Cost:** ~$0.003 per 1K tokens
- **Volume:** Medium (tens to hundreds of calls per assessment)
- **Quality bar:** 95%+ accuracy required; results directly inform customer-facing reports

### Tier 3: Claude Opus (Complex Reasoning and Transformation)
- **Use cases:** Multi-file code refactoring, architectural migration planning, complex OSGi bundle modernisation, custom replication agent redesign, cross-cutting concern analysis
- **Latency:** ~3-8s per call
- **Cost:** ~$0.015 per 1K tokens
- **Volume:** Low (single-digit to tens of calls per migration)
- **Quality bar:** Near-human expert level; outputs require human review but should be production-viable

### Routing Logic

The model router selects the tier based on:
1. **Task type** (hardcoded routing for well-understood tasks)
2. **Input complexity** (token count, number of dependencies, nesting depth)
3. **Confidence requirement** (customer-facing vs. internal intermediate result)
4. **Budget constraints** (per-migration cost cap set by customer tier)

```
if task.type in CLASSIFICATION_TASKS → Haiku
else if task.complexity < 0.3 → Haiku
else if task.complexity < 0.7 → Sonnet
else → Opus
```

## Consequences

**Positive:**
- 80-90% cost reduction compared to always-Opus approach
- Haiku's speed enables real-time classification during content scanning
- Opus quality on complex tasks exceeds what cheaper models can deliver
- Budget predictability: customers can estimate costs before starting a migration
- Graceful degradation: if Opus is unavailable, Sonnet can handle most tasks with slightly lower quality

**Negative:**
- Three models mean three sets of prompt engineering and evaluation
- Routing logic adds latency (though minimal, <10ms for rule-based routing)
- Model version updates may affect all three tiers simultaneously
- Complexity of maintaining quality benchmarks across tiers

**Mitigations:**
- Centralised prompt templates in `src/lib/ai/` with per-tier variants
- Automated quality evaluation pipeline comparing outputs across tiers
- Model version pinning with gradual rollout
- Fallback chain: if a tier is unavailable, escalate to the next tier up

## Alternatives Considered

**Single model (always Opus):** Simplest implementation but costs $0.015/1K tokens for trivial classification tasks. A large migration could cost $500+ in AI calls alone. Unacceptable for self-service pricing tiers.

**Two tiers (Haiku + Opus):** Misses the middle ground. Many analysis tasks are too complex for Haiku but do not need Opus-level reasoning. Sonnet fills this gap at 5x lower cost than Opus.

**Open-source models (Llama, Mistral):** Lower per-token cost but requires GPU infrastructure, adds operational complexity, and currently cannot match Claude's quality on code analysis tasks. May revisit as open-source models improve.

**Fine-tuned models:** Could reduce per-call cost and improve quality on domain-specific tasks. However, fine-tuning requires a training dataset we do not yet have. Planned for v2 after collecting sufficient migration data.
