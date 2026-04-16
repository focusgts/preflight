# ADR-078: Pre-Flight™ Rule Expansion to 50+ Cloud Manager Quality Gates

## Status: Proposed

## Date: 2026-04-15

## Context

Pre-Flight™ currently implements 16 rules across three categories (SonarQube CQRules, OakPAL, Java Compatibility). Adobe Cloud Manager enforces 50+ quality gate rules that cause pipeline failures. This gap is the single biggest credibility vulnerability: customers who hit a rule we don't cover will lose trust in the tool.

The competitive landscape is completely open — every alternative (aemanalyser-maven-plugin, wttech SonarQube rules, Netcentric aem-cloud-validator) requires Java, Maven, or a running SonarQube server. Pre-Flight™ is the only browser-based tool. But rule coverage is what turns "convenient" into "indispensable."

Additionally, as of March 30, 2026, Adobe began **failing pipelines** (not just warning) on deprecated API usage (AMSCORE-553/S1874). This is actively breaking deployments for teams RIGHT NOW, and we don't check for it.

## Decision

Expand Pre-Flight™ from 16 rules to 50+ rules, covering all Cloud Manager quality gates that can be detected via static pattern matching on code snippets.

### Phase 1: Critical / Blocker Rules (Ship Immediately)

These rules are causing active pipeline failures today.

#### 1.1 Deprecated API Scanner (AMSCORE-553 / S1874)

**Priority: HIGHEST — This is breaking pipelines right now.**

| Rule ID | Name | Severity | Detection |
|---------|------|----------|-----------|
| AMSCORE-553 | Deprecated AEM API Usage | Blocker | Regex match against known deprecated packages and classes |
| S1874 | @Deprecated Method/Class Usage | Major | Detect `@Deprecated` annotation usage patterns |

**Deprecated APIs to detect (active enforcement):**

| Deprecated Package/Class | Replacement |
|--------------------------|-------------|
| `org.apache.sling.commons.json` | `javax.json` / `com.google.gson` |
| `com.github.jknack.handlebars` | HTL (Sightly) |
| `com.day.cq.wcm.api.Page.getDescription()` | `Page.getProperties().get("jcr:description")` |
| `com.day.cq.wcm.api.Page.getTitle()` | `Page.getProperties().get("jcr:title")` |
| `com.day.cq.commons.Externalizer` (deprecated methods) | Updated Externalizer API |
| `com.day.cq.search.QueryBuilder` (deprecated overloads) | Current QueryBuilder API |
| `org.apache.sling.api.resource.ResourceUtil.getOrCreateResource()` | `ResourceResolver.create()` |
| `com.adobe.granite.workflow.exec.WorkItem.getMetaData()` | `WorkItem.getMetaDataMap()` |
| Guava direct usage (`com.google.common.*`) | Java standard library equivalents |
| `org.apache.commons.lang.StringUtils` | `org.apache.commons.lang3.StringUtils` |

**Enforcement timeline display:**
- Show a banner: "⚠️ As of March 30, 2026, deprecated APIs FAIL Cloud Manager pipelines. No override available."
- For each deprecated API found, show the enforcement phase and deadline

#### 1.2 Additional Blocker/Critical CQRules

| Rule ID | Name | Severity | What It Checks |
|---------|------|----------|----------------|
| CQBP-71 | Hardcoded /apps and /libs Paths | Critical | Java code with hardcoded `/apps/` or `/libs/` string paths instead of API constants |
| CQBP-75 | Sling Servlet Registered by Path | Critical | `@SlingServletPaths` or `sling.servlet.paths` property instead of resource type registration |
| AEMSRE-870 | HTTPClient Instance Reuse | Critical | Creating new `CloseableHttpClient` per request instead of reusing |
| CWE-676 | Use of Potentially Dangerous Functions | Critical | `Runtime.exec()`, `ProcessBuilder`, `System.exit()`, `Thread.stop()` |
| CWE-134 | Uncontrolled Format String | Critical | `String.format()` with user-controlled format strings |
| S2259 | Null Pointer Dereference | Blocker | Dereferencing variables that could be null without null check |
| S2095 | Resources Should Be Closed | Critical | `InputStream`, `OutputStream`, `Connection` not in try-with-resources |
| S4502 | Cookies Should Be Secure | Critical | `Cookie` created without `setSecure(true)` and `setHttpOnly(true)` |

#### 1.3 Additional Critical OakPAL Rules

| Rule ID | Name | Severity | What It Checks |
|---------|------|----------|----------------|
| BannedPath | Banned Content Paths | Blocker | Content under `/var/audit`, `/tmp`, `/home` in packages |
| ImmutableMutableMixedPackage | Mixed Package Types | Blocker | Package contains both mutable (`/content`, `/etc`) and immutable (`/apps`, `/libs`) content |
| DuplicateOsgiConfigurations | Duplicate OSGi PIDs | Critical | Same OSGi configuration PID defined in multiple locations |
| PackageOverlaps | Overlapping Content Packages | Critical | Multiple packages writing to the same JCR path |
| SupportedRunmode | Unsupported Run Modes | Critical | Run mode folders other than `config.author` / `config.publish` |

### Phase 2: Major Rules (Ship Within 2 Weeks)

| Rule ID | Name | Severity | What It Checks |
|---------|------|----------|----------------|
| AMSCORE-554 | Sling Scheduler Direct Instantiation | Major | `new Scheduler()` instead of OSGi `@Reference` injection |
| InjectAnnotation | @Inject Without @Optional | Major | Sling Model `@Inject` without `@Optional` or `@Required` |
| ThreadSafe | Servlet Thread Safety | Critical | Mutable instance fields in servlets/filters |
| ClassicUIAuthoringMode | Classic UI References | Major | `cq:editConfig` with Classic UI mode, `cq:dialog` without Touch UI |
| ComponentWithOnlyClassicUIDialog | Missing Touch UI Dialog | Major | Component has `dialog.xml` but no `_cq_dialog/.content.xml` |
| StaticTemplateUsage | Static Template Usage | Major | Templates not using editable template framework |
| LegacyFoundationComponentUsage | Foundation Component Usage | Major | Extends or references `/libs/foundation/components/` |
| ReverseReplication | Reverse Replication Agents | Major | Reverse replication agent configurations (not supported in Cloud Service) |
| ConfigAndInstallNodes | Invalid Config Folder Content | Major | Non-OSGi nodes in `config/` or `install/` folders |
| IndexSeedProperty | Missing Index Seed Property | Major | Custom Oak index without `seed` property |
| IndexName | Index Naming Convention | Minor | Custom index not following `<prefix>.<indexName>-<productVersion>-custom-<customVersion>` pattern |

### Phase 3: Security & Best Practice Rules (Ship Within 4 Weeks)

| Rule ID | Name | Severity | What It Checks |
|---------|------|----------|----------------|
| LoggerDeclaration | Logger Best Practice | Minor | Logger not declared as `private static final Logger` |
| CQBP-44-Logging | Logging Level Check | Minor | `LOG.debug()` without `LOG.isDebugEnabled()` guard |
| CQBP-44-StringConcat | String Concatenation in Logging | Minor | String concatenation in log statements instead of parameterized logging |
| ExceptionHandling | Generic Exception Catch | Major | `catch (Exception e)` or `catch (Throwable t)` instead of specific exceptions |
| HardcodedPassword | Hardcoded Credentials | Blocker | String literals that look like passwords, API keys, or tokens |
| XSSPrevention | Cross-Site Scripting Risk | Critical | Unescaped user input in HTL expressions (`${}` without context) |
| SQLInjection | SQL Injection Risk | Critical | String concatenation in SQL/JCR-SQL2 queries |

### Implementation Strategy

All rules are implemented as **regex-based pattern matchers** — the same architecture as the existing 16 rules. Each rule is a function:

```typescript
{
  id: string;
  name: string;
  category: 'CQRules' | 'OakPAL' | 'JavaCompat' | 'Security' | 'DeprecatedAPI';
  severity: 'blocker' | 'critical' | 'major' | 'minor' | 'info';
  languages: Language[];
  description: string;
  docUrl: string;
  check: (content: string, filePath: string) => PreFlightFinding[];
  fix?: (content: string, finding: PreFlightFinding) => FixSuggestion;
}
```

**No server-side components.** All pattern matching runs client-side in the browser.

**Fix suggestions** (ADR-071) will be added for rules where deterministic fixes exist:
- AMSCORE-553: Show replacement API for each deprecated usage
- CQBP-71: Replace hardcoded path with API constant
- S2095: Wrap in try-with-resources
- ImmutableMutableMixedPackage: Show recommended package restructuring
- SupportedRunmode: Rename to supported run mode folder

### What We Cannot Check (Transparency)

Some Cloud Manager gates cannot be replicated via static pattern matching on code snippets:

| Gate | Why We Can't Check It | Alternative |
|------|----------------------|-------------|
| Unit test coverage | Requires running tests | Link to coverage tools |
| Integration tests | Requires running AEM instance | N/A |
| Experience Audit (Lighthouse) | Requires live URL | ADR-015 (future: Lighthouse API) |
| Deployment verification | Requires Cloud Manager environment | N/A |
| Load testing | Requires running application | N/A |
| Security scanning (DAST) | Requires running application | N/A |

Pre-Flight™ will clearly state: "Covers code quality and content package gates. Runtime gates (tests, performance, security scanning) require a running environment."

## Rule Count Summary

| Category | Current | Adding | Total |
|----------|---------|--------|-------|
| SonarQube CQRules | 6 | 12 | 18 |
| OakPAL | 6 | 10 | 16 |
| Java Compatibility | 4 | 2 | 6 |
| Deprecated API | 0 | 3 | 3 |
| Security | 0 | 5 | 5 |
| Best Practice | 0 | 4 | 4 |
| **Total** | **16** | **36** | **52** |

## Consequences

### Positive

- **Credibility leap:** "52 Cloud Manager rules" vs "16 rules" is the difference between a demo and a real tool
- **Deprecated API scanner is the most timely feature possible** — teams are failing pipelines TODAY
- **ImmutableMutableMixedPackage alone** would justify the expansion — it's the #1 most common deployment failure
- **Security rules** (hardcoded passwords, XSS, SQL injection) add a dimension no AEM-specific competitor covers
- **Transparency about what we can't check** builds trust rather than overselling

### Negative

- 36 new rules is significant implementation effort (~80-100 hours)
- More rules = more potential false positives to tune
- Deprecated API list requires ongoing maintenance as Adobe updates enforcement
- Some rules may overlap with each other (e.g., CQBP-84 and S2095 both check resource closing)

### Mitigations

- Phase the rollout: ship Phase 1 (blockers/critical) first, then Phase 2, then Phase 3
- Each rule has independent unit tests with known-good and known-bad samples
- Deprecated API list sourced from Adobe's official documentation with version tracking
- Overlapping rules de-duplicated in findings display

## Estimated Effort

| Phase | Rules | Effort | Ship Target |
|-------|-------|--------|-------------|
| Phase 1: Blockers/Critical | 15 rules | 30-40 hours | Immediate |
| Phase 2: Major | 12 rules | 25-30 hours | +2 weeks |
| Phase 3: Security/Best Practice | 9 rules | 20-25 hours | +4 weeks |
| **Total** | **36 rules** | **75-95 hours** | 4-6 weeks |

## References

- [Custom Code Quality Rules — Adobe](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/using-cloud-manager/test-results/custom-code-quality-rules)
- [Code Quality Testing — Adobe](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/implementing/using-cloud-manager/test-results/code-quality-testing)
- [Deprecated and Removed Features — Adobe](https://experienceleague.adobe.com/en/docs/experience-manager-cloud-service/content/release-notes/deprecated-removed-features)
- [OakPAL Checks Documentation](https://github.com/adamcin/oakpal)
- [Netcentric aem-cloud-validator](https://github.com/Netcentric/aem-cloud-validator)
- [wttech AEM Rules for SonarQube](https://github.com/wttech/AEM-Rules-for-SonarQube)
- [aemanalyser-maven-plugin](https://github.com/adobe/aemanalyser-maven-plugin)
