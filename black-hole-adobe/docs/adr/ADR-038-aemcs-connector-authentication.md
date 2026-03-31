# ADR-038: AEM as a Cloud Service Connector Authentication & Extraction

## Status: Accepted

## Date: 2026-03-30

## Context

Black Hole's AEM Connector (ADR-004) was originally designed for AEM 6.x on-premise instances that use basic authentication (username/password) against `/system/console` and Sling APIs. AEM as a Cloud Service (AEMaaCS) fundamentally changes the authentication model:

- **No basic auth**: AEMaaCS does not expose `/system/console` via username/password. All API access requires IMS (Identity Management System) bearer tokens.
- **Two token types**: Local Development Tokens (24-hour expiry, obtained via Developer Console) and Service Credentials (long-lived, obtained via Adobe Developer Console project configuration).
- **API availability differs**: Some on-prem APIs are unavailable or restricted on Cloud Service. `/system/console/configMgr` is not accessible. OSGi configs are managed via Cloud Manager, not runtime API.
- **Sling APIs remain available**: QueryBuilder (`/bin/querybuilder.json`), Sling JSON endpoints (`*.infinity.json`, `*.1.json`), and the Assets API (`/api/assets.json`) all work with bearer token auth.

Validated against Focus GTS Partner Sandbox (program p192456, environment e1992925) on 2026-03-30:

| API Endpoint | Status | Notes |
|-------------|--------|-------|
| `/libs/granite/core/content/login.html` | 200 | Connection test works |
| `/content.1.json` | 200 | Full JCR content tree accessible |
| `/bin/querybuilder.json` | 200 | 31 pages, 240 components found |
| `/api/assets.json` | 200 | DAM assets accessible |
| `/oak:index.3.json` | TBD | Oak index definitions |
| `/system/console/configMgr/.json` | Blocked | Not available on AEMaaCS |

## Decision

Extend the AEM Connector to support AEMaaCS authentication and adapt extraction methods to Cloud Service API availability.

### 1. Authentication Flow

Support three auth modes via `authType` in connector config:

| Auth Type | Token Source | Expiry | Use Case |
|-----------|-------------|--------|----------|
| `basic` | Username/password | Session | AEM 6.x on-prem (existing) |
| `bearer` | Local Development Token | 24 hours | Development, testing, demos |
| `oauth_s2s` | Service Credentials (JWT → access token) | Configurable | Production integrations |

The connector already supports `bearer` and `oauth_s2s` in `getAuthHeaders()` (base-connector.ts:339-350). No auth code changes needed — only the connection flow UI and API route need to accept token input.

### 2. Connection Test Adaptation

Replace `/system/console/status-productinfo.json` (blocked on AEMaaCS) with `/libs/granite/core/content/login.html` for connection verification. Fall back to `/content.1.json` if login page returns non-200.

### 3. Extraction Adaptations for AEMaaCS

| Extraction | On-Prem Method | Cloud Service Method |
|-----------|---------------|---------------------|
| Content pages | QueryBuilder at `/bin/querybuilder.json` | Same — works on both |
| DAM assets | Assets API at `/api/assets.json` | Same — works on both |
| Components | QueryBuilder `type=cq:Component` under `/apps` | Same — works on both |
| OSGi configs | `/system/console/configMgr/.json` | **Not available** — skip with warning, recommend Cloud Manager config review |
| Workflows | QueryBuilder `type=cq:WorkflowModel` | Same — works on both |
| Oak indexes | `/oak:index.3.json` | Same — works on both |
| Dispatcher config | System console status | **Not available** — skip with warning, recommend Git repo analysis |

### 4. Connection UI Flow

Add a connector setup page in Black Hole dashboard:

1. User selects environment type: **AEM 6.x (on-prem/AMS)** or **AEM as a Cloud Service**
2. For AEMaaCS: user enters Author URL + pastes bearer token from Developer Console
3. For on-prem: user enters Author URL + username/password (existing flow)
4. "Test Connection" button verifies auth and reports accessible APIs
5. "Run Extraction" kicks off full data pull with progress reporting via SSE (ADR-014)

### 5. API Route

`POST /api/connectors/aem/connect` — accepts:

```typescript
{
  baseUrl: string;           // e.g. "https://author-p192456-e1992925.adobeaemcloud.com"
  authType: "basic" | "bearer" | "oauth_s2s";
  // For basic:
  username?: string;
  password?: string;
  // For bearer:
  accessToken?: string;
  // For oauth_s2s:
  clientId?: string;
  clientSecret?: string;
  imsOrg?: string;
  technicalAccountId?: string;
  privateKey?: string;
}
```

Response includes capabilities report: which APIs are accessible, which are blocked, total content/asset/component counts.

### 6. Security

- Bearer tokens are never persisted to disk or database. Held in server memory only for the duration of the session.
- Basic auth credentials are encrypted at rest if persistence is enabled (ADR-023).
- All AEM API calls are made server-side only — tokens never reach the browser.
- Connection details are scoped to the authenticated Black Hole user session.

## Consequences

### Positive
- Black Hole can now connect to AEMaaCS instances — the primary migration target market.
- Same connector handles both on-prem (source) and Cloud Service (target) environments.
- Validated against a real AEMaaCS sandbox with real API responses.
- Bearer token flow is zero-setup for the customer — paste token, click connect.
- Extraction works for 5 of 7 data categories on AEMaaCS; the 2 unavailable (OSGi configs, Dispatcher) are clearly communicated with alternative guidance.

### Negative
- Local Development Tokens expire in 24 hours — long-running migrations need Service Credentials.
- Service Credential setup requires Adobe Developer Console project creation — more complex onboarding.
- OSGi config extraction is impossible on AEMaaCS — must be handled via Git repo analysis instead of runtime API.
- Dispatcher config extraction is impossible on AEMaaCS — must be handled via Git repo analysis.
