# ADR-054: Self-Healing Execution — Real Remediation

## Status: Proposed

## Date: 2026-03-31

## Context

The `HealingEngine` in `src/lib/healing/healing-engine.ts` has a well-designed architecture — diagnosis, remedy lookup, confidence-based decisions, circuit breaker — but `executeRemedy()` only modifies in-memory `MigrationItem` objects. No AEM API calls are made, no files are modified, no redeployments are triggered.

When a migration item fails, the healing engine logs that it "healed" the item by flipping its status flag. The underlying problem remains. For self-healing to be real, remedy execution must perform actual corrective actions against the target AEM instance.

## Decision

### 1. Remedy executor interface

Define a `RemedyExecutor` interface in `src/lib/healing/remedy-executor.ts`:

```typescript
interface RemedyExecutor {
  type: RemedyType;
  execute(target: AEMConnector, context: RemedyContext): Promise<RemedyResult>;
  rollback(target: AEMConnector, context: RemedyContext): Promise<void>;
  validate(target: AEMConnector, context: RemedyContext): Promise<boolean>;
}

interface RemedyResult {
  success: boolean;
  description: string;
  rollbackData: unknown;
  beforeState: unknown;
  afterState: unknown;
}
```

### 2. Remedy executor implementations

- **Content remedies** (`src/lib/healing/executors/content-remedy.ts`):
  Re-transfer failed content items via Sling POST (ADR-050). Delete corrupted target content first, then re-write from source.

- **Permission remedies** (`src/lib/healing/executors/permission-remedy.ts`):
  Fix ACL issues via `POST /content/{path}.modifyAce.html`. Restore expected principal permissions based on source ACLs.

- **Index remedies** (`src/lib/healing/executors/index-remedy.ts`):
  Re-index via Oak index management API. Trigger async re-index for specific index definitions.

- **Bundle remedies** (`src/lib/healing/executors/bundle-remedy.ts`):
  Restart failed OSGi bundles via Felix Console API (`POST /system/console/bundles/{bundleId}` with `action=start`). Applicable to on-prem and AMS only — not AEMaaCS.

- **Deployment remedies** (`src/lib/healing/executors/deployment-remedy.ts`):
  Re-trigger Cloud Manager pipeline (ADR-052) when deployment-related failures are detected.

### 3. Confidence thresholds

Keep the existing confidence-based decision model:
- Auto-apply: confidence > 0.95 — execute immediately without human approval
- Suggest: confidence 0.60-0.80 — present to user with recommendation, require explicit approval
- Escalate: confidence < 0.60 — create incident ticket, do not attempt automated remediation

### 4. Safety

- Each executor provides a `rollback()` function that undoes its action
- Circuit breaker remains at 3 consecutive failures before disabling auto-healing for that item type
- Audit log every remedy execution with before/after state in `src/lib/healing/remedy-audit-log.ts`
- Never auto-apply remedies to production publish instances without explicit configuration flag

## Consequences

**Positive:**
- Migration failures auto-recover without human intervention for high-confidence cases
- Rollback support means failed remedies do not make things worse
- Audit log provides full traceability for compliance
- Circuit breaker prevents runaway remediation loops

**Negative:**
- Auto-remediation on production requires very high confidence to avoid making things worse
- Bundle restart and index operations can cause temporary service degradation
- AEMaaCS restricts some remediation actions (no Felix Console, no direct index management) — executors must detect environment type and degrade gracefully
- Circuit breaker (3 failures) is a critical safety net but may leave items in a failed state that requires manual intervention

**Estimated effort:** 16-20 hours
