# ADR-006: Rule-Based Code Modernisation Engine

## Status: Accepted

## Date: 2026-03-21

## Context

AEM migrations from on-premises (6.x) to Cloud Service require systematic code modernisation. Hundreds of API changes, configuration format updates, and architectural patterns must be applied across potentially thousands of Java files, OSGi configurations, and Sling models. Manual refactoring is error-prone and expensive. Fully autonomous AI refactoring is risky for production code.

The engine must balance automation speed with safety guarantees. Some transformations are mechanical and safe to auto-apply (e.g., replacing a deprecated import). Others require structural changes that need human review (e.g., redesigning a custom replication agent).

## Decision

We implement a rule-based code modernisation engine with the following architecture:

### Rule Structure

Each transformation rule is a self-contained unit:

```typescript
interface TransformationRule {
  id: string;                      // e.g., "SLING-API-001"
  name: string;                    // Human-readable name
  description: string;             // What this rule does
  category: string;                // "api-migration", "config-format", "architecture"
  severity: Severity;              // How important is this change
  compatibilityLevel: CompatibilityLevel;
  pattern: PatternMatcher;         // How to find affected code
  transform: CodeTransformer;      // How to fix it
  validate: TransformValidator;    // How to verify the fix is correct
  requiresHumanReview: boolean;    // Must a human approve before applying?
  estimatedHours: number;          // Manual effort if done without automation
}
```

### Pattern Matching Approach

Rules use a tiered pattern matching strategy:

1. **AST-based matching** for Java/JavaScript code: parse source into an AST, match on node types, method calls, import declarations, class hierarchies
2. **Regex-based matching** for configuration files (OSGi configs, XML descriptors, properties files)
3. **Structural matching** for content patterns (JCR node structures, content policies, editable templates)

### Safety Tiers

| Tier | Auto-Apply | Human Review | Examples |
|------|-----------|-------------|----------|
| Safe | Yes | No | Import replacement, annotation update, config format conversion |
| Guarded | Yes, in staging | Required before production | Method signature changes, dependency updates, OSGi service re-wiring |
| Manual | No | Required | Architectural redesign, custom replication replacement, security model changes |

### Rule Categories

1. **API Migration Rules** (e.g., SlingAdaptable to Adaptable, deprecated Sling API removals)
2. **Configuration Format Rules** (e.g., OSGi config XML to JSON, run mode folder restructuring)
3. **Index Migration Rules** (e.g., Oak index definitions to Cloud Service format)
4. **Dependency Rules** (e.g., remove uber-jar, add Cloud Service SDK, update BOM versions)
5. **Architecture Rules** (e.g., remove custom replication agents, adopt Sling Content Distribution)
6. **Security Rules** (e.g., migrate service users, update ACL definitions)

### Execution Model

1. **Scan:** All rules run their pattern matchers against the source code to produce a finding list
2. **Plan:** Findings are sorted by dependency order (some fixes must be applied before others)
3. **Transform:** Safe rules auto-apply; guarded rules apply to a staging branch; manual rules generate detailed remediation guides
4. **Validate:** Each transformation runs its validator to confirm the fix is correct (compile check, test execution, structural verification)
5. **Report:** All changes are presented in a diff view for human review

## Consequences

**Positive:**
- Deterministic: the same input always produces the same output (unlike pure AI generation)
- Auditable: every change links back to a specific rule ID
- Incremental: rules can be added one at a time as new patterns are identified
- Safe: the three-tier system prevents dangerous changes from auto-applying
- Measurable: each rule has an estimated hours value, enabling accurate cost projections

**Negative:**
- Rule maintenance burden grows with each new AEM version and API change
- AST-based matching requires language-specific parsers (Java, JavaScript, XML)
- Rules cannot handle truly novel code patterns; AI assistance needed for edge cases
- Pattern matching may produce false positives that waste human review time

**Mitigations:**
- AI (Tier 2: Sonnet) assists in writing new rules by analysing Adobe release notes and API diffs
- False positive rate tracked per rule; rules exceeding 5% false positive rate are flagged for revision
- Community-contributed rules planned for v2 (similar to ESLint plugin ecosystem)
- Manual rules include AI-generated remediation guides to accelerate human implementation

## Alternatives Considered

**Pure AI transformation:** Feed entire codebases to Claude and ask for modernised output. High risk of subtle errors, non-deterministic, and impossible to audit at scale. Individual files may be handled well, but cross-file dependencies and side effects are unreliable.

**Adobe's built-in migration tools only:** AEM's Repository Moderniser, Index Converter, and Dispatcher Converter handle specific narrow patterns. They do not cover API migration, custom code modernisation, or cross-cutting concerns. Black Hole wraps these tools where appropriate but needs a broader rule engine.

**Search-and-replace scripts:** Simple but fragile. Cannot handle context-dependent replacements (e.g., a method call that should only be replaced when called on a specific type). AST-based matching is strictly superior for code transformations.
