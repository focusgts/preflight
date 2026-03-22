# ADR-011: Claude AI Integration Architecture

## Status: Accepted

## Date: 2026-03-21

## Context

Black Hole's rule-based classification engine (SortEngine) and pattern-matching assessment engine (AssessmentEngine) provide deterministic, fast results but are limited by the keyword patterns and BPA definitions they contain. They cannot reason about novel code patterns, understand semantic relationships in content, or generate human-readable migration plans that account for cross-cutting concerns.

We need an AI service layer that enhances -- but does not replace -- the existing rule-based engines. The AI layer must degrade gracefully when unavailable (no API key, rate limits exceeded, API outage) so that the application remains fully functional in demo and offline modes.

## Decision

We implement a Claude AI integration layer at `src/lib/ai/` with the following architecture:

### Module Structure

```
src/lib/ai/
  claude-client.ts   - Anthropic SDK wrapper with retries, rate limiting, cost tracking
  prompts.ts         - All prompt templates as typed functions
  classifier.ts      - AI-powered classification enhancing SortEngine
  code-analyzer.ts   - AI-powered code analysis enhancing AssessmentEngine
  index.ts           - Barrel exports
src/config/
  ai-config.ts       - Model configs, feature flags, cost tracking, rate limits
```

### Three-Tier Model Routing

Per ADR-003, tasks are routed to the appropriate Claude model:

| Task | Model | Rationale |
|------|-------|-----------|
| Classification | Haiku | High volume, low complexity, fast turnaround |
| Code compatibility analysis | Sonnet | Medium complexity, needs accurate findings |
| Content quality analysis | Sonnet | Semantic understanding of content structure |
| Schema mapping | Sonnet | Pattern matching with domain knowledge |
| Risk assessment | Sonnet | Structured reasoning over assessment data |
| Test case generation | Sonnet | Structured output from findings |
| Code refactoring | Opus | Complex multi-step transformations |
| Migration planning | Opus | Cross-cutting architectural reasoning |

### Fallback Strategy

Every AI-powered operation has a deterministic fallback:

1. **Classification**: Falls back to `SortEngine.classifyItem()` keyword-based classification
2. **Code analysis**: Falls back to heuristic regex pattern matching (same patterns as BPA)
3. **OSGi conversion**: Falls back to basic XML property extraction
4. **Code refactoring**: Returns original code with a warning that manual refactoring is needed
5. **Test generation**: Generates template-based test cases from findings

Fallback triggers:
- `ANTHROPIC_API_KEY` environment variable not set
- Feature flag `enableAI` set to false
- API call fails after all retry attempts
- Rate limit exceeded and wait timeout reached
- AI confidence below threshold (configurable, default 0.6)

### Confidence Blending

For classification, when AI confidence is between the threshold and 0.85, the classifier blends AI and rule-based results using a weighted average. This prevents low-confidence AI results from overriding reliable rule-based classifications.

### Cost Management

- Every API call records input/output tokens, cost, duration, and task type
- `CostTracker` provides real-time summaries by tier and task
- Rate limiting prevents exceeding per-minute request and token caps
- Batch processing with configurable concurrency and inter-batch delays

### Security

- API key is read exclusively from `ANTHROPIC_API_KEY` environment variable
- Never logged, never included in error messages, never sent to the client
- All AI responses are validated and sanitised before use (enum validation, range clamping)

## Consequences

**Positive:**
- AI-powered classification achieves higher accuracy on ambiguous items
- Code analysis can detect issues beyond predefined BPA patterns
- Users get actionable, natural-language migration plans
- Application works fully without AI (demo mode, air-gapped environments)
- Cost is trackable and predictable per migration

**Negative:**
- Additional latency for AI-enhanced operations (200ms-8s per call depending on tier)
- Prompt engineering requires ongoing maintenance as models are updated
- AI responses are non-deterministic; same input may produce slightly different outputs
- Token costs scale with migration size (mitigated by Haiku for high-volume tasks)

**Mitigations:**
- Streaming support for long-running Opus operations provides progressive feedback
- Retry logic with exponential backoff handles transient failures
- Response validation prevents malformed AI output from corrupting downstream data
- Feature flags allow per-task AI disable without code changes

## Alternatives Considered

**AI-only approach (no fallback):** Simpler but would make the application non-functional without an API key. Unacceptable for demos, CI/CD pipelines, and air-gapped deployments.

**LangChain / LlamaIndex middleware:** Adds framework complexity and abstraction layers without clear benefit. The Anthropic SDK is sufficient for our use cases. Direct SDK usage gives us full control over prompt construction and response handling.

**Server-side AI gateway:** A separate microservice for AI calls would add operational complexity. Since Black Hole runs as a Next.js application, co-locating AI calls in API routes is simpler and has lower latency.

## Related Decisions

- ADR-003: Three-Tier AI Model Strategy (establishes the Haiku/Sonnet/Opus tiering)
- ADR-005: Assessment Scoring (defines the scoring model that AI enhances)
- ADR-006: Code Modernization Rules (defines BPA patterns that AI extends)
