# ADR-004: Plugin-Based Connector Architecture

## Status: Accepted

## Date: 2026-03-21

## Context

Black Hole must connect to a wide variety of source and target platforms: AEM (on-premises, AMS, Cloud Service), Adobe Analytics, CJA, Adobe Campaign (Standard, Classic, v8), AEP/RTCDP, AAM, Workfront, Marketo, and third-party platforms (WordPress, Sitecore, Drupal, Google Analytics, Salesforce Marketing Cloud, Shopify, HubSpot). Each platform has its own authentication model, API surface, rate limits, and data formats.

New connector types will be added regularly as customer demand grows. The architecture must support adding a new connector without modifying the core migration engine.

## Decision

We implement a plugin-based connector architecture with the following structure:

### BaseConnector Abstract Class

All connectors extend `BaseConnector`, which defines the standard lifecycle:

```typescript
abstract class BaseConnector {
  abstract type: string;
  abstract connect(config: ConnectionDetails): Promise<ConnectionResult>;
  abstract testConnection(): Promise<TestResult>;
  abstract disconnect(): Promise<void>;
  abstract getCapabilities(): ConnectorCapability[];

  // Optional lifecycle hooks
  onBeforeMigration?(): Promise<void>;
  onAfterMigration?(): Promise<void>;
  onError?(error: Error): Promise<void>;
}
```

### Capability-Based Interface

Rather than a single monolithic interface, connectors declare their capabilities:

- `ContentReader` — reads pages, assets, content fragments
- `ContentWriter` — writes content to target platform
- `CodeScanner` — scans source code for compatibility issues
- `ConfigExporter` — exports platform configuration
- `ConfigImporter` — imports configuration into target
- `SchemaMapper` — maps data schemas between platforms
- `AudienceReader` — reads audience/segment definitions
- `AnalyticsReader` — reads analytics configuration and data

### Factory Pattern

`ConnectorFactory` instantiates the appropriate connector based on the `type` field in `ConnectorConfig`:

```typescript
class ConnectorFactory {
  static create(config: ConnectorConfig): BaseConnector {
    const ConnectorClass = connectorRegistry.get(config.type);
    if (!ConnectorClass) throw new UnsupportedConnectorError(config.type);
    return new ConnectorClass(config);
  }
}
```

### Registration

Connectors self-register via a decorator or explicit registration call:

```typescript
connectorRegistry.register('aem', AEMConnector);
connectorRegistry.register('wordpress', WordPressConnector);
connectorRegistry.register('google-analytics', GoogleAnalyticsConnector);
```

## Consequences

**Positive:**
- New connectors can be added by creating a single file that extends BaseConnector and registers itself
- Capability-based interfaces prevent bloated connector implementations (a GA connector does not need ContentWriter)
- Factory pattern centralises instantiation and enables dependency injection for testing
- Connection testing is standardised across all connector types
- The `ConnectorConfig` type in the API is flat and simple; complexity lives in the connector implementation

**Negative:**
- Abstract class inheritance can become rigid if the base class grows too many methods
- Capability interfaces add indirection; callers must check `implements ContentReader` before calling read methods
- Plugin discovery requires either explicit registration or a dynamic import mechanism
- Testing requires mock implementations of each capability interface

**Mitigations:**
- Keep BaseConnector minimal (5 abstract methods maximum)
- Use TypeScript type guards for capability checking: `if (isContentReader(connector))`
- Explicit registration preferred over dynamic imports for bundler compatibility
- Provide `MockConnector` base class in test utilities

## Alternatives Considered

**Monolithic connector interface:** Every connector implements every method, throwing `NotSupported` for irrelevant operations. Simpler initially but creates confusion about which operations are actually supported, and forces implementors to write stub methods.

**Configuration-driven adapters:** Define connectors entirely through configuration (JSON/YAML) with generic HTTP adapters. Works for simple REST APIs but cannot handle the complexity of AEM's CRX repository, SFMC's SOAP API, or WordPress's mixed REST/GraphQL surface.

**Microservice per connector:** Each connector runs as an independent service. Provides maximum isolation but dramatically increases operational complexity. Inappropriate for MVP; may revisit for enterprise multi-tenant deployment.
