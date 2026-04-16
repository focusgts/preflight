# ADR-082: Pre-Flight™ HTL/Sightly Template Linting

## Status: Proposed

## Date: 2026-04-15

## Context

HTL (HTML Template Language, formerly Sightly) is the mandatory server-side template language for AEM. Every AEM component uses HTL files for rendering. Despite this, there is no standalone, accessible HTL linting tool available to front-end developers.

The closest alternatives are:
- **wttech AEM Rules for SonarQube** — requires a running SonarQube server, Java, Maven, and enterprise SonarQube configuration. Most teams don't have this set up.
- **Adobe's HTL specification** — documents the language but provides no validation tooling.
- **IDE plugins** — IntelliJ has basic HTL support, but VS Code (the dominant AEM front-end editor) has extremely limited HTL tooling.

Front-end developers are the most underserved persona in the AEM ecosystem. They write HTL daily but have no way to validate their templates against Cloud Service best practices before committing. They hit issues only when the pipeline fails or — worse — when the component silently renders incorrectly in production because of an unescaped expression or deprecated data-sly attribute.

Cloud Service migration amplifies this gap: Classic UI component patterns that worked for years must be rewritten for Touch UI and Core Components, and HTL templates are where those patterns live.

## Decision

Add an HTL/Sightly template linter to Pre-Flight™ that validates HTL syntax, detects deprecated patterns, and enforces Cloud Service best practices entirely client-side.

### Supported Input

- `.html` files containing HTL expressions (AEM's HTL files use `.html` extension)
- Inline HTL snippets pasted into the Pre-Flight™ editor
- Auto-detection: if content contains `data-sly-*` attributes or `${...}` expressions with HTL syntax, treat as HTL

### Linting Rules

#### Syntax Validation

| Rule | Severity | Description |
|------|----------|-------------|
| InvalidExpression | Blocker | Malformed `${}` expressions (unclosed brackets, invalid operators) |
| UnknownBlockStatement | Major | Unrecognized `data-sly-*` attributes (typos like `data-sly-repat` instead of `data-sly-repeat`) |
| InvalidUseClass | Major | `data-sly-use` referencing a class path that follows deprecated patterns |
| NestedBlockConflict | Major | Conflicting `data-sly-*` attributes on the same element (e.g., `data-sly-test` and `data-sly-unwrap` producing unexpected behavior) |

#### Security Rules

| Rule | Severity | Description |
|------|----------|-------------|
| MissingDisplayContext | Critical | `${}` expression without an explicit display context where auto-context detection may fail (e.g., in `<script>` blocks, event handlers, or `style` attributes) |
| UnsafeContext | Blocker | `${expression @ context='unsafe'}` — explicitly disables XSS protection |
| UnescapedHtmlContext | Major | `${expression @ context='html'}` used without justification comment — allows raw HTML injection |
| ScriptBlockExpression | Critical | HTL expression inside `<script>` tag without `@context='scriptString'` |
| StyleExpression | Major | HTL expression in `style` attribute without `@context='styleString'` |

#### Deprecated Pattern Detection

| Rule | Severity | Description |
|------|----------|-------------|
| DeprecatedDataSlyUnwrap | Major | `data-sly-unwrap` used where `data-sly-element` or `<sly>` tag is more appropriate |
| ClassicUIEditConfig | Critical | `cq:editConfig` referencing Classic UI editor configurations |
| DeprecatedComponentGroup | Major | `componentGroup` set to Classic UI groups (`.hidden` patterns from pre-Touch UI) |
| LegacyParsysInclude | Critical | Direct inclusion of Classic parsys (`/libs/foundation/components/parsys`) instead of responsive grid or layout container |
| DeprecatedUseAPI | Major | `data-sly-use` with WCMUsePojo (deprecated) instead of Sling Models |
| ClassicUIDialog | Critical | Component has `dialog.xml` (Classic UI) without corresponding `_cq_dialog/.content.xml` (Touch UI) |
| FoundationComponentExtend | Critical | Component extends `/libs/foundation/components/*` instead of Core Components |

#### Best Practice Rules

| Rule | Severity | Description |
|------|----------|-------------|
| UseOverInclude | Minor | `data-sly-include` used where `data-sly-use` with a template would be more maintainable |
| ResourceTypeHardcoded | Major | Hardcoded `sling:resourceType` paths instead of relative references |
| EmptyExpression | Minor | `${}` empty expression (likely leftover from development) |
| ComplexExpressionLogic | Minor | Expression with more than 3 logical operators (suggests logic should move to Sling Model) |
| MissingSlyTag | Info | `<div>` used as a wrapper solely for `data-sly-*` logic where `<sly>` tag would avoid unnecessary DOM nodes |
| InlineStylesDetected | Minor | Inline `style` attributes that should be in a CSS file for maintainability |
| MissingClientLib | Info | Component HTML references CSS/JS files directly instead of via clientlib includes |

### HTL Parser Implementation

```typescript
interface HTLExpression {
  raw: string;
  line: number;
  column: number;
  options: Map<string, string>;  // @ context, i18n, etc.
  context?: string;              // display context if specified
}

interface HTLBlockStatement {
  type: string;           // 'use', 'test', 'list', 'repeat', 'include', 'resource', 'template', 'call', 'unwrap', 'set', 'element'
  element: string;        // HTML element it's attached to
  expression: string;     // the attribute value
  line: number;
}

function parseHTL(content: string): {
  expressions: HTLExpression[];
  blocks: HTLBlockStatement[];
  errors: ParseError[];
}
```

The parser extracts HTL expressions and block statements from HTML content using a combination of regex and lightweight HTML parsing. Full HTML DOM parsing is not required — HTL validation focuses on attribute values and expression syntax.

### Integration with Existing Scanning

- HTL linting is a new language option alongside Java, XML, and JavaScript
- Auto-detect HTL when pasted content contains `data-sly-*` attributes
- HTL findings use the same severity/score system as Java findings (ADR-074)
- HTL findings appear in PDF reports (ADR-068) with code highlighting

## Consequences

**Positive:**
- **No standalone HTL linting tool exists** — fills a genuine gap in the AEM tooling ecosystem
- Front-end developers get a validation tool they've literally never had access to
- Security rules catch XSS vulnerabilities that are extremely common in HTL templates
- Deprecated pattern detection is essential for Cloud Service migration — Classic UI patterns must be found and replaced
- Positions Pre-Flight™ as a tool for the entire AEM team, not just Java backend developers
- Significantly expands the addressable audience (front-end developers outnumber AEM Java developers)

**Negative:**
- HTL expression parsing is non-trivial — the language has implicit behaviors that are hard to validate statically
- False positives on legitimate `@context='unsafe'` usage (sometimes necessary for trusted content)
- Front-end developers may not know what "Cloud Service" means — messaging must be clearer for this audience
- No formal HTL grammar specification makes parser edge cases likely

**Mitigations:**
- Start with high-confidence rules (syntax errors, missing display contexts, deprecated patterns) before adding nuanced best-practice rules
- Allow inline suppression comments (`<!-- data-sly-ignore: MissingDisplayContext -->`)
- Test against Core Components HTL files (known-good) and real customer components (known-messy)
- Front-end-friendly messaging: "This expression could allow script injection" rather than "Missing XSS context"

## Estimated Effort
- HTL expression parser: 3 days
- Block statement parser: 2 days
- Security rules (5 rules): 2 days
- Deprecated pattern rules (7 rules): 2 days
- Best practice rules (7 rules): 2 days
- Integration with existing scan UI: 1 day
- Testing against real HTL files: 2 days
- **Total: 2 weeks**
