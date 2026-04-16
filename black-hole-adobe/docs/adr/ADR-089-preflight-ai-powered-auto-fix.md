# ADR-089: Pre-Flight™ AI-Powered Auto-Fix Code Generation

## Status: Proposed

## Date: 2026-04-15

## Context

Pre-Flight™ currently provides fix suggestions (ADR-071) as human-readable guidance: "Replace `org.apache.sling.commons.json` with `javax.json`" with a code example. This is helpful, but it still requires the developer to manually apply the fix — reading the suggestion, understanding the context, writing the replacement code, and verifying it compiles.

For simple, mechanical fixes (rename a package import, change a file extension, swap a method name), the fix is deterministic and can be expressed as a regex replacement. But many deprecated API migrations require context-aware refactoring: the replacement API has a different method signature, different error handling, different return types. A developer fixing 50 instances of `org.apache.sling.commons.json.JSONObject` needs to understand the Gson or javax.json equivalent for each usage pattern — `put` vs `add`, `getString` vs `get`, `toString(4)` vs `GsonBuilder.setPrettyPrinting()`.

AI (specifically large language models) excels at exactly this kind of transformation: given the old pattern and the new API, generate the replacement code that preserves the original intent. This is a natural extension of Pre-Flight™'s fix suggestions — from "here's what to do" to "here's the code."

## Decision

Enhance Pre-Flight™'s existing fix suggestion system (ADR-071) with AI-generated complete code patches for complex transformations, while keeping simple fixes regex-based.

### Two-Tier Fix System

#### Tier 1: Deterministic Fixes (No AI)

For fixes that are mechanical and context-independent:

| Fix Type | Example | Method |
|----------|---------|--------|
| Import replacement | `org.apache.commons.lang` → `org.apache.commons.lang3` | String replacement |
| File format conversion | `.config` → `.cfg.json` | Format parser + generator |
| Naming convention | `PID-alias.cfg.json` → `PID~alias.cfg.json` | Regex replacement |
| Run mode folder | `config.stage` → `config.publish` | Path rename |
| Annotation addition | Missing `@Optional` on `@Inject` | AST-like insertion |

These fixes run instantly, client-side, with no external calls. They produce predictable, reviewable patches.

#### Tier 2: AI-Assisted Fixes (With Consent)

For fixes that require understanding context and API semantics:

| Fix Type | Example | Why AI is Needed |
|----------|---------|-----------------|
| Deprecated API migration | `JSONObject` → `JsonObject` (javax.json) | Different method signatures, error handling, builder patterns |
| WCMUsePojo → Sling Model | Complete class rewrite with annotations | Structural transformation, not just find/replace |
| Classic UI dialog → Touch UI | XML structure completely different | Requires understanding component intent |
| Foundation component → Core Component | HTL template rewrite | Different property names, different markup patterns |
| Install hook → RepoInit | Completely different DSL | Requires translating permission semantics |

### AI Integration Architecture

```
┌─────────────────────────────────────────────────┐
│ Pre-Flight™ Browser UI                          │
│                                                 │
│  Finding: AMSCORE-553 on line 14               │
│  ┌─────────────────────────────────────────┐   │
│  │ [Quick Fix] Replace import (instant)     │   │
│  │ [AI Fix] Generate complete patch (3s)    │   │
│  └─────────────────────────────────────────┘   │
│         │                                       │
│         │ (only with user consent)              │
│         ▼                                       │
│  ┌─────────────────────────────────────────┐   │
│  │ Code context (surrounding 20 lines) +    │   │
│  │ finding details sent to AI API           │   │
│  └─────────────────────────────────────────┘   │
│         │                                       │
└─────────┼───────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────┐
│ focusgts.com/preflight/api/v1/fix               │
│ (Server-side proxy to Claude API)               │
│                                                 │
│ Prompt:                                         │
│ "Given this AEM Java code using deprecated      │
│  org.apache.sling.commons.json.JSONObject,      │
│  rewrite it to use javax.json.JsonObject.       │
│  Preserve the original logic and error          │
│  handling. Output only the replacement code."   │
│                                                 │
│ Context: [20 lines of surrounding code]         │
│ Finding: [rule details + remediation guidance]   │
└─────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────┐
│ Diff View in Browser                            │
│                                                 │
│ - import org.apache.sling.commons.json.*;       │
│ + import javax.json.*;                          │
│ + import javax.json.stream.*;                   │
│                                                 │
│ - JSONObject obj = new JSONObject();            │
│ - obj.put("name", value);                       │
│ + JsonObjectBuilder builder = Json              │
│ +     .createObjectBuilder()                    │
│ +     .add("name", value);                      │
│ + JsonObject obj = builder.build();             │
│                                                 │
│ [Apply Fix] [Copy Patch] [Reject]              │
└─────────────────────────────────────────────────┘
```

### Privacy Model

This is the most sensitive aspect of the feature. Pre-Flight™'s core promise is "your code never leaves the browser." AI-assisted fixes necessarily violate that promise for the specific code being fixed.

**Privacy controls:**

1. **Explicit opt-in:** AI fixes are OFF by default. User must toggle "Enable AI-assisted fixes" in settings.
2. **Per-fix consent:** Even with AI enabled, each fix request shows a confirmation: "This will send 20 lines of your code to our AI service for analysis. Continue?"
3. **Minimal context:** Send only the minimum code needed — the finding's surrounding lines, not the entire file
4. **No storage:** Code sent to the AI API is not stored, logged, or used for training. This is contractual (Anthropic's API terms support this).
5. **Transparency:** Show exactly what will be sent before the user confirms
6. **Local alternative:** For users who can't send code externally, provide a "Copy prompt" button that lets them paste the prompt into their own AI tool

### "Apply All Fixes" Workflow

For users with many findings of the same type:

1. "Apply all fixes for AMSCORE-553" button
2. AI generates patches for each instance in sequence
3. Results displayed as a unified diff
4. User reviews all changes in a diff view
5. "Download as .patch file" or "Copy git diff" for application
6. No automatic code modification — the user always reviews and applies manually

### AI Provider

- Primary: Claude API (Anthropic) — aligned with Focus GTS tooling
- The server-side proxy handles API keys and rate limiting — users never need their own AI API key
- Rate limit: 10 AI fix requests per scan (free tier), unlimited (paid tier)
- Latency target: < 5 seconds per fix generation

### Prompt Engineering

Each rule type has a specialized prompt template:

```typescript
const PROMPTS: Record<string, string> = {
  'AMSCORE-553': `You are an AEM Cloud Service migration expert. 
    Rewrite the following Java code to replace the deprecated API with its modern equivalent.
    
    Deprecated: {deprecatedAPI}
    Replacement: {replacementAPI}
    
    Original code:
    \`\`\`java
    {codeContext}
    \`\`\`
    
    Requirements:
    - Preserve the original logic and error handling
    - Use the correct replacement API method signatures
    - Add any new imports needed
    - Output only the replacement code, no explanation`,
    
  'ImmutableMutableMixed': `You are an AEM content package expert.
    The following filter.xml contains both mutable and immutable paths.
    Split it into two separate filter.xml files:
    1. filter.xml for the application package (immutable paths only)
    2. filter.xml for the content package (mutable paths only)
    
    Original filter.xml:
    \`\`\`xml
    {codeContext}
    \`\`\``,
};
```

## Consequences

**Positive:**
- Transforms Pre-Flight™ from "tells you what's wrong" to "fixes what's wrong" — massive value leap
- Complex migrations that take hours of manual work become minutes of review-and-apply
- "Apply all fixes" for deprecated APIs could save teams days of tedious migration work
- The download-as-patch workflow integrates into existing git workflows
- Privacy-conscious design (opt-in, per-fix consent, no storage) maintains trust
- Rate-limited AI calls on free tier create a natural upgrade path to paid tier

**Negative:**
- Server-side AI proxy introduces infrastructure and API costs
- AI-generated code may be incorrect — wrong replacement API usage, missing edge cases, compilation errors
- "Apply all fixes" at scale could generate patches that conflict with each other
- Some organizations prohibit sending any code to external APIs — this feature is unusable for them
- AI latency (3-5 seconds per fix) is noticeably slower than instant deterministic fixes
- Ongoing cost: Claude API calls for every fix request

**Mitigations:**
- AI fixes are always presented as diffs for human review — never auto-applied
- Include a confidence indicator: "High confidence" for common patterns, "Review carefully" for unusual code
- Deterministic fixes (Tier 1) are always available as instant alternatives — AI is additive, not required
- "Copy prompt" button ensures even air-gapped teams can use the approach with their own AI tools
- Prompt templates are tested against known migration patterns with expected outputs
- Rate limiting prevents runaway API costs

## Estimated Effort
- Server-side AI proxy endpoint: 2 days
- Prompt templates for top 10 rule types: 3 days
- Diff view component in browser: 2 days
- Privacy consent flow: 1 day
- "Apply all fixes" batch workflow: 2 days
- Patch file / git diff generation: 1 day
- Rate limiting and error handling: 1 day
- Testing and prompt tuning: 2-3 days
- **Total: 2-3 weeks**
