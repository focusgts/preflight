# ADR-012: SQLite for Data Persistence

## Status

Accepted

## Date

2026-03-21

## Context

Black Hole for Adobe Marketing Cloud was initially built with an in-memory data store. All migration projects, assessments, and connector configurations were lost on every server restart. For development and demo purposes this is acceptable, but any real usage requires persistence.

Options considered:

1. **PostgreSQL** -- Full-featured relational database. Requires a separate process, connection string configuration, and either a managed service or local installation.
2. **SQLite via better-sqlite3** -- Embedded, zero-configuration database. Single file on disk. Synchronous API that avoids callback complexity in Node.js.
3. **JSON files on disk** -- Simple but lacks indexing, transactions, and concurrent access safety.
4. **Cloud-hosted database (PlanetScale, Supabase)** -- Adds external dependency, network latency, and cost for a single-node application.

## Decision

We chose **SQLite via better-sqlite3** as the persistence layer.

## Rationale

- **Zero configuration**: No database server to install, no connection strings, no Docker containers. The database file is created automatically on first run.
- **Embedded**: Runs in-process with the Node.js server. No network round-trips for queries.
- **Good enough for single-node**: Black Hole is deployed as a single Next.js instance. SQLite handles concurrent reads well with WAL mode, and write contention is minimal for this workload.
- **Easy to upgrade later**: The store API is unchanged. Swapping SQLite for PostgreSQL later requires only reimplementing the `DatabaseWrapper` class -- no changes to route handlers or the rest of the application.
- **Synchronous API**: better-sqlite3 uses the synchronous SQLite C API, which is actually faster than async alternatives for single-connection use. It avoids promise overhead for simple queries.
- **Portable**: The `.data/blackhole.sqlite` file can be copied between machines for debugging or demo resets.

## Consequences

- **Single-node only**: SQLite does not support multi-process writes. If the application scales to multiple server instances, we must migrate to PostgreSQL or a similar networked database.
- **Native dependency**: better-sqlite3 requires a C++ build step. This may complicate deployment to some serverless platforms (though it works fine on Node.js servers, Docker, and most PaaS).
- **File system required**: The server must have a writable file system for the `.data/` directory. This works on standard servers but not on read-only edge runtimes.
- **Fallback**: The store layer falls back to in-memory if SQLite fails to initialise, preserving the original behaviour for edge runtime or testing contexts.

## Schema Design

All complex nested objects (JSON arrays, environment configs) are stored as serialised JSON TEXT columns. This is a pragmatic choice that avoids excessive normalisation while keeping the schema simple. Assessment findings are normalised into their own table because they need to be queried by severity.
