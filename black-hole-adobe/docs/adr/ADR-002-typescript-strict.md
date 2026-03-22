# ADR-002: Strict TypeScript with Full Type Safety

## Status: Accepted

## Date: 2026-03-21

## Context

Black Hole processes sensitive enterprise data including PII, credentials, and compliance-regulated content. The migration engine transforms code, configuration, and content across heterogeneous Adobe platforms where type mismatches can cause data loss or security vulnerabilities. The API surface is complex, with deeply nested response types (assessments contain findings, risk factors, timeline estimates, and cost projections).

A loosely typed codebase in this domain would create unacceptable risk:
- A migration item status typo could silently corrupt state machines
- An assessment score passed as a string instead of a number could break risk calculations
- A connector credential object missing a field could fail silently at runtime

## Decision

We enforce strict TypeScript across the entire codebase with the following configuration:

- `strict: true` in tsconfig.json (enables strictNullChecks, strictFunctionTypes, strictBindCallApply, noImplicitAny, noImplicitThis, alwaysStrict)
- `noUncheckedIndexedAccess: true` to prevent unsafe property access on records and arrays
- All public API types defined in `src/types/index.ts` as the single source of truth
- Zod schemas for runtime validation of all API request bodies, bridging the compile-time/runtime gap
- No use of `any` except in third-party library type shims (enforced by ESLint rule)
- All API responses wrapped in `ApiResponse<T>` or `PaginatedResponse<T>` generic types

## Consequences

**Positive:**
- Compile-time errors catch type mismatches before they reach production
- IDE autocompletion works across the entire stack, from API route to React component
- Refactoring is safe: renaming a field in `MigrationProject` immediately reveals all callsites
- Zod schemas provide runtime validation that mirrors compile-time types, creating defence in depth
- New team members can understand data shapes by reading `src/types/index.ts` without running the application
- Discriminated unions on enums (MigrationStatus, Severity, etc.) enable exhaustive switch checking

**Negative:**
- Initial development velocity is slightly slower due to type ceremony
- Some third-party libraries have incomplete or incorrect type definitions
- Generic types like `ApiResponse<T>` and `PaginatedResponse<T>` add cognitive overhead for junior developers
- Zod schemas partially duplicate type definitions (mitigated by Zod's type inference in v4)

**Mitigations:**
- Created comprehensive enum types (MigrationStatus, MigrationType, AdobeProduct, etc.) to eliminate string literals
- Zod v4 supports `z.infer<typeof schema>` to derive TypeScript types from schemas, reducing duplication
- ESLint rules prevent `any` usage from creeping in over time
- Types file kept under 400 lines with clear section headers for discoverability

## Alternatives Considered

**Loose TypeScript (no strict mode):** Faster initial development but creates a false sense of safety. `strictNullChecks: false` alone would mask dozens of potential null pointer exceptions in the migration engine where operations frequently return null/undefined.

**JSDoc typing without TypeScript:** Provides some IDE support but no compile-time enforcement. Unacceptable for a platform handling enterprise credentials and compliance-regulated data.

**Runtime-only validation (Zod without TypeScript):** Catches issues at runtime but loses IDE support and compile-time refactoring safety. The combination of both provides the strongest guarantees.
