# ADR-084: Pre-Flight™ RepoInit Script Validator

## Status: Proposed

## Date: 2026-04-15

## Context

Sling Repository Initialization (RepoInit) is the mandatory mechanism for provisioning repository structures, service users, and ACLs in AEM Cloud Service. It replaces legacy approaches (install hooks, rep:policy nodes in content packages, manual CRX/DE setup) that are not supported in the ephemeral Cloud Service architecture.

Every AEM Cloud Service migration requires converting existing permission models into RepoInit scripts. These scripts use a specialized DSL (Domain-Specific Language) with its own syntax rules, and errors in RepoInit scripts cause deployment failures that are extremely difficult to debug. The error messages from Sling's RepoInit parser are cryptic, and there's no way to validate scripts before deploying — teams push to Cloud Manager, wait 30-45 minutes for the pipeline, and discover their script has a syntax error on line 47.

**No standalone RepoInit validator exists anywhere.** Not from Adobe, not from Sling, not from any community tool. The only way to validate a RepoInit script today is to deploy it and see if it fails. This is an absurd workflow for a DSL that controls production security permissions.

## Decision

Add a RepoInit Script Validator to Pre-Flight™ that parses and validates Sling RepoInit statements entirely client-side, catching syntax errors and unsupported operations before deployment.

### Supported Input

- `.txt` files containing RepoInit statements
- OSGi configuration files (`.cfg.json`) containing `scripts` or `references` properties for `org.apache.sling.jcr.repoinit.RepositoryInitializer`
- Inline RepoInit scripts pasted into the Pre-Flight™ editor
- Auto-detection: content starting with `create path`, `create service user`, `set ACL`, or other RepoInit keywords

### RepoInit Grammar

The validator implements a parser for the Sling RepoInit DSL. Key statement types:

```
create path (mixin mix:Type) /content/mysite
create service user my-service-user with path system/myapp
set ACL for my-service-user
    allow jcr:read on /content/mysite
    deny jcr:write on /content/mysite/protected
end

set ACL on /content/mysite
    allow jcr:read for my-service-user
end

create group my-group with path /home/groups/myapp
add my-service-user to group my-group

set properties on /content/mysite
    set sling:resourceType{String} to myapp/components/page
end

register nodetypes
<<===
<'myapp'='http://myapp.example.com/1.0'>
[myapp:customType] > nt:unstructured
===>>

disable service user my-old-service-user : "Reason for disabling"
```

### Validation Rules

#### Syntax Rules

| Rule | Severity | Description |
|------|----------|-------------|
| InvalidStatement | Blocker | Statement doesn't match any known RepoInit command pattern |
| UnclosedACLBlock | Blocker | `set ACL` without matching `end` statement |
| UnclosedPropertyBlock | Blocker | `set properties` without matching `end` |
| UnclosedCNDBlock | Blocker | `register nodetypes <<===` without matching `===>>` |
| InvalidPath | Critical | JCR path doesn't start with `/` or contains invalid characters |
| InvalidPrivilege | Critical | Unknown JCR privilege (e.g., `jcr:readd` instead of `jcr:read`) |
| InvalidPrincipal | Major | Service user referenced in ACL but not created in the same script (warning, not error — may be created elsewhere) |
| DuplicateServiceUser | Major | Same service user created twice in the same script |
| EmptyACLBlock | Minor | `set ACL for user ... end` with no permission statements inside |

#### Known JCR Privileges

```typescript
const VALID_PRIVILEGES = [
  'jcr:read', 'jcr:modifyProperties', 'jcr:addChildNodes',
  'jcr:removeNode', 'jcr:removeChildNodes', 'jcr:readAccessControl',
  'jcr:modifyAccessControl', 'jcr:lockManagement', 'jcr:versionManagement',
  'jcr:nodeTypeManagement', 'jcr:retentionManagement', 'jcr:lifecycleManagement',
  'jcr:write', 'jcr:all', 'rep:write', 'rep:readNodes', 'rep:readProperties',
  'rep:addProperties', 'rep:alterProperties', 'rep:removeProperties',
  'rep:indexDefinitionManagement', 'rep:privilegeManagement',
  'rep:userManagement', 'crx:replicate'
];
```

#### Cloud Service Compatibility Rules

| Rule | Severity | Description |
|------|----------|-------------|
| AdminUserReference | Blocker | Script references `admin` user — not available in Cloud Service |
| SystemUserPath | Major | Service user created without explicit path — should use `with path system/...` for Cloud Service |
| ReplicationPrivilege | Major | `crx:replicate` privilege granted — replication model differs in Cloud Service |
| AbsoluteHomePath | Critical | ACLs set on `/home/users/...` with absolute paths — user paths are not stable in Cloud Service |
| DeprecatedSyntax | Major | Old RepoInit syntax that's been superseded (e.g., `create service user` without `with forced path` when needed) |
| UnsupportedOperation | Blocker | Operations not supported in Cloud Service RepoInit context (e.g., workspace manipulation) |

#### Best Practice Rules

| Rule | Severity | Description |
|------|----------|-------------|
| OverlyBroadPermissions | Major | `allow jcr:all on /` or similarly broad permission grants |
| MissingDenyDefault | Info | ACL doesn't include explicit deny for paths that should be restricted |
| ServiceUserNaming | Minor | Service user doesn't follow `componentname-servicename` naming convention |
| ScriptOrdering | Minor | Service users should be created before ACLs referencing them (ordering matters) |
| LargeScript | Info | Script exceeds 100 statements — consider splitting into multiple scripts for maintainability |

### Parser Implementation

```typescript
interface RepoInitStatement {
  type: 'create-path' | 'create-service-user' | 'create-group' | 'set-acl' |
        'set-properties' | 'register-nodetypes' | 'disable-service-user' |
        'add-to-group' | 'remove-from-group' | 'delete-service-user' | 'delete-group';
  line: number;
  raw: string;
  parsed: Record<string, unknown>;  // type-specific parsed data
}

interface ACLEntry {
  action: 'allow' | 'deny';
  privileges: string[];
  principal?: string;
  path?: string;
  restrictions?: Record<string, string>;
}

function parseRepoInit(content: string): {
  statements: RepoInitStatement[];
  errors: ParseError[];
  warnings: ParseWarning[];
}
```

The parser processes scripts line-by-line, using state tracking for multi-line blocks (ACL blocks, property blocks, CND blocks). Each statement is parsed independently, then cross-referenced for consistency (e.g., are all referenced service users created?).

### Remediation Examples

| Finding | Remediation |
|---------|-------------|
| `admin` user referenced | "Replace `admin` with a dedicated service user. Create: `create service user my-admin-service with path system/myapp`" |
| Missing `end` keyword | "Add `end` statement to close the ACL block opened on line 12" |
| Invalid privilege `jcr:readd` | "Did you mean `jcr:read`? Valid privileges: jcr:read, jcr:write, jcr:all, ..." |
| Overly broad `jcr:all on /` | "Grant specific privileges on specific paths instead of `jcr:all on /`. Example: `allow jcr:read on /content/mysite`" |

## Consequences

**Positive:**
- **No standalone RepoInit validator exists anywhere** — genuine first-to-market opportunity
- Saves teams hours of pipeline-fail-fix-retry cycles for what are often simple syntax errors
- Cloud Service compatibility rules catch migration-breaking patterns before deployment
- Security best practice rules help teams avoid over-permissioning during migration rush
- Natural companion to ADR-083 (Content Package Analyzer) — teams fixing install hooks need RepoInit migration guidance
- Positions Pre-Flight™ as essential tooling for the migration workflow, not just a code scanner

**Negative:**
- RepoInit DSL has evolved across Sling versions — older syntax variants may not parse correctly
- Some statements are valid syntactically but semantically incorrect (e.g., path doesn't exist) — cannot catch these without a running repository
- Cross-script validation (service user created in script A, referenced in script B) requires multi-file awareness
- Parser maintenance as Sling adds new RepoInit operations

**Mitigations:**
- Target the RepoInit version supported by the latest AEM Cloud Service SDK
- Clearly state: "Validates syntax and Cloud Service compatibility. Runtime path validation requires a running AEM instance."
- Support multi-file upload for cross-script validation
- Monitor Sling release notes for RepoInit DSL changes

## Estimated Effort
- RepoInit DSL parser (statement types + multi-line blocks): 4-5 days
- Syntax validation rules: 2 days
- Cloud Service compatibility rules: 2 days
- Best practice rules: 1 day
- Integration with scan UI and findings system: 1 day
- Testing against real customer RepoInit scripts: 1-2 days
- **Total: 1-2 weeks**
