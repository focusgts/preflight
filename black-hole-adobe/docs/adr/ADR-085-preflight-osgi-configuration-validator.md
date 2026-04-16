# ADR-085: Pre-Flight™ OSGi Configuration Validator

## Status: Proposed

## Date: 2026-04-15

## Context

AEM Cloud Service only supports OSGi configurations in `.cfg.json` format. Legacy formats (`.config`, `.cfg`, `.xml`, `.properties`) that worked on on-premise and AMS environments are silently ignored or cause pipeline failures. This is one of the most common — and most frustrating — migration issues because:

1. Teams have hundreds of `.config` and `.cfg` files accumulated over years
2. The pipeline doesn't always give clear error messages about format issues
3. The naming conventions for factory configurations changed
4. Run mode folder naming is restricted (`config.author` and `config.publish` only — no `config.stage`, no `config.dev`, no custom run modes)
5. Certain OSGi services are immutable in Cloud Service and cannot be configured

Teams discover these issues one at a time, across 30-45 minute pipeline cycles. A validator that catches all format, naming, and compatibility issues before the first push saves days of migration effort.

## Decision

Add an OSGi Configuration Validator to Pre-Flight™ that validates configuration file format, naming conventions, run mode folders, and Cloud Service compatibility.

### Supported Input

- `.cfg.json` files — validate format and content
- `.config` / `.cfg` / `.xml` files — flag as legacy format, suggest migration
- `pom.xml` with `sling-maven-plugin` configuration — validate config generation settings
- Folder structure upload — validate run mode folder naming
- Inline JSON pasted into the editor

### Validation Rules

#### Format Rules

| Rule | Severity | Description |
|------|----------|-------------|
| LegacyConfigFormat | Blocker | File uses `.config`, `.cfg`, or `.xml` format instead of `.cfg.json` — will be ignored in Cloud Service |
| InvalidJSON | Blocker | `.cfg.json` file contains malformed JSON |
| MissingPID | Critical | Configuration doesn't map to a recognizable OSGi PID (service persistent identity) |
| WrongFileExtension | Blocker | File uses `.json` instead of `.cfg.json` — AEM won't recognize it as an OSGi config |

#### Factory Configuration Naming

| Rule | Severity | Description |
|------|----------|-------------|
| LegacyFactoryNaming | Blocker | Factory config uses `PID-alias.cfg.json` (dash separator) instead of `PID~alias.cfg.json` (tilde separator) |
| MissingFactoryAlias | Critical | Factory configuration PID without a tilde and alias — will overwrite instead of creating a new instance |
| DuplicateFactoryAlias | Critical | Two factory configs with the same PID and alias in the same run mode folder |
| InvalidAliasCharacters | Major | Factory alias contains characters not valid in filenames (spaces, special chars) |

#### Run Mode Folder Rules

| Rule | Severity | Description |
|------|----------|-------------|
| UnsupportedRunMode | Blocker | Configuration in `config.stage`, `config.dev`, `config.local`, or any custom run mode folder — only `config`, `config.author`, `config.publish` are supported in Cloud Service |
| RunModeChaining | Blocker | Configuration in chained run mode folder like `config.author.stage` — not supported in Cloud Service |
| MissingBaseConfig | Major | Configuration exists in `config.author` or `config.publish` but not in base `config` — may not apply as expected |
| ConfigInInstallFolder | Major | OSGi configuration placed in `install` folder instead of `config` folder — `install` is for bundles, `config` is for configurations |

#### Cloud Service Immutable Services

| Rule | Severity | Description |
|------|----------|-------------|
| ImmutableServiceConfig | Blocker | Configuration targets a service that is immutable in Cloud Service (managed by Adobe) |
| ReplicationAgentConfig | Blocker | Custom replication agent configuration — Cloud Service manages replication agents |
| WorkflowLauncherConfig | Major | Custom workflow launcher — Cloud Service restricts workflow launcher modifications |
| LoggerConfiguration | Major | Custom `org.apache.sling.commons.log.LogManager.factory.config` — Cloud Service has restricted logging configuration |

**Known immutable services in Cloud Service:**

```typescript
const IMMUTABLE_PIDS = [
  'org.apache.sling.jcr.davex.impl.servlets.SlingDavExServlet',
  'org.apache.sling.servlets.get.DefaultGetServlet',          // some properties
  'com.day.cq.replication.impl.AgentManagerImpl',
  'com.day.cq.replication.impl.ReplicationAgentManagerImpl',
  'org.apache.sling.security.impl.ReferrerFilter',            // some properties
  'com.adobe.granite.repository.impl.RepositoryPermissionsImpl'
];
```

#### Value Type Validation

| Rule | Severity | Description |
|------|----------|-------------|
| InvalidTypeAnnotation | Major | Property uses invalid type annotation (valid: `String`, `Long`, `Double`, `Float`, `Integer`, `Byte`, `Short`, `Character`, `Boolean`) |
| ArrayTypeMismatch | Major | Array contains mixed types where service expects uniform type |
| EmptyRequiredProperty | Critical | Known required properties left empty or missing |

### Migration Helper

For legacy format files, provide automated migration guidance:

```
Legacy (.config):                     Cloud Service (.cfg.json):
─────────────────                     ──────────────────────────
service.ranking=I"100"        →       { "service.ranking:Integer": 100 }
paths=["\/content","\/apps"]  →       { "paths": ["/content", "/apps"] }
enabled=B"true"               →       { "enabled:Boolean": true }
```

Show a side-by-side view with the legacy format on the left and the equivalent `.cfg.json` on the right, with a "Copy converted config" button.

### Bulk Analysis Mode

Teams often have 50-200+ OSGi configuration files. Support:
- Folder/ZIP upload of the entire `config` directory
- Summary table: "147 configurations scanned. 23 need format conversion. 8 use unsupported run modes. 3 target immutable services."
- Sortable/filterable results by severity and issue type

## Consequences

**Positive:**
- Catches the most mechanical (and therefore most frustrating) migration issues — format conversion is tedious but critical
- Run mode folder validation prevents the most confusing class of issues (configs that silently don't apply)
- Factory configuration naming is a subtle gotcha that trips up even experienced AEM developers
- The migration helper (legacy to .cfg.json conversion) provides immediate, tangible value
- Bulk analysis mode makes this useful for project-level migration planning, not just individual file checks
- Complements ADR-083 (Content Package Analyzer) and ADR-084 (RepoInit Validator) to cover the full configuration migration surface

**Negative:**
- The list of immutable services changes across AEM SDK versions — requires maintenance
- Legacy format parsing (`.config` files use a non-standard format) requires a dedicated parser
- Some OSGi PIDs are only recognizable in context (factory PIDs with dynamic aliases)
- Bulk analysis of 200+ files may be slow in the browser without web workers

**Mitigations:**
- Version-tag the immutable services list and document the source
- Use a web worker for bulk analysis to keep the UI responsive
- For unrecognized PIDs, flag as "info" rather than error — avoid false positives on custom services
- Legacy `.config` format parser already exists in several open-source projects — adapt rather than build from scratch

## Estimated Effort
- `.cfg.json` parser and validator: 1 day
- Legacy format detection and migration helper: 2 days
- Run mode folder validation: 1 day
- Factory configuration naming rules: 1 day
- Immutable service detection: 1 day
- Bulk analysis mode with web worker: 1-2 days
- **Total: 1 week**
