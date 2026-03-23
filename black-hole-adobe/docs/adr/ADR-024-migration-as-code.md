# ADR-024: Migration-as-Code

**Status:** Accepted
**Date:** 2026-03-22
**Decision Makers:** Platform Engineering Team

## Context

Migration projects involve numerous configuration decisions: source and target
environments, content scope, transformation rules, compliance requirements, and
rollback policies. Historically these are configured through UI wizards and
stored in opaque database records that cannot be reviewed, versioned, or
reproduced.

DevOps teams expect infrastructure-as-code patterns where configuration is
declarative, version-controlled, and auditable. We need an equivalent for
migration projects.

## Decision

We adopt a **Migration-as-Code (MaC)** pattern where the entire migration
definition is expressed as a single declarative YAML configuration file.

### YAML over JSON

We chose YAML as the primary format for the following reasons:

1. **Comments**: YAML supports inline comments, which are essential for
   self-documenting migration configs. JSON does not support comments.
2. **Readability**: YAML's indentation-based structure reads naturally for
   hierarchical config. Templates can include extensive inline documentation.
3. **Ecosystem fit**: Kubernetes, Terraform, Ansible, GitHub Actions, and most
   DevOps tools use YAML. Teams already have YAML tooling in their editors.
4. **JSON interop**: The parser accepts both YAML and JSON. Teams that prefer
   JSON or generate configs programmatically can use JSON.

### Environment Variable Security

Credentials are **never** stored inline in config files. Auth sections use
`${ENV_VAR}` references that are resolved at execution time. This prevents
secrets from leaking into Git history.

The Zod schema enforces this with a regex validator that rejects any auth
credentials value that does not match the `${VAR_NAME}` pattern.

### Template Strategy

Pre-built templates cover the most common migration paths:

- AEM 6.5 On-Prem to Cloud Service
- AEM Managed Services to Cloud Service
- WordPress to AEM Sites
- Sitecore to AEM Sites
- Google Analytics to CJA
- Campaign Standard to Campaign v8
- Audience Manager to RTCDP

Each template includes extensive YAML comments explaining every option, so teams
can use them as learning resources. Templates are served via API and loaded into
the in-browser YAML editor.

### GitOps Workflow

The intended workflow is:

1. Generate a template via the UI or API
2. Customize it for the specific migration
3. Commit it to a Git repository
4. Review changes via pull request
5. Execute the migration from the config via API or UI
6. Track the config alongside the migration for reproducibility

Configs can be diffed to compare iterations, and existing migrations can be
exported back to YAML for documentation.

## Alternatives Considered

1. **UI-only configuration**: Rejected because it lacks version control,
   auditability, and reproducibility.
2. **JSON Schema without YAML**: Rejected because JSON lacks comments, which are
   critical for self-documenting configs.
3. **Terraform provider**: Considered but premature. A Terraform provider could
   wrap the MaC API in the future.
4. **Custom DSL**: Rejected due to learning curve. YAML is universally known.

## Consequences

### Positive

- Migrations are reproducible and auditable
- Configs can be reviewed in PRs before execution
- Templates accelerate onboarding for new migration types
- Credential security is enforced at the schema level
- Existing CI/CD pipelines can trigger migrations programmatically

### Negative

- YAML indentation errors can be confusing for non-technical users
- Complex migrations may produce large config files
- Schema evolution requires backward-compatibility discipline

### Mitigations

- The YAML editor provides syntax highlighting and validation feedback
- Dry-run mode lets users preview what a config will do before executing
- Schema validation provides detailed, actionable error messages
- Templates provide working starting points to reduce errors

## Related ADRs

- ADR-009: Migration Phases (phase types referenced in config)
- ADR-007: Compliance by Design (compliance section in config)
- ADR-014: SSE over WebSocket (execution progress streaming)
