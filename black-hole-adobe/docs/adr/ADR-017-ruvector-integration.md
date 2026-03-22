# ADR-017: RuVector Integration Layer

## Status

Accepted

## Context

Black Hole for Adobe Marketing Cloud needs a vector database layer to power:
- Pattern matching for proven code fixes
- Risk prediction from historical migration outcomes
- Duplicate content detection across migrations
- Timeline estimation based on similar past projects
- Integration template lookup by source/target type

Several options were evaluated:
- **pgvector on PostgreSQL**: Production-grade, but requires a database server
- **Pinecone**: Managed service, but adds external dependency and per-query cost
- **Supabase pgvector**: Hosted option, but ties to Supabase infrastructure
- **RuVector (Focus GTS proprietary)**: In-house vector database with Navigator integration

## Decision

We chose **RuVector** as the vector storage layer for the following reasons:

1. **Proprietary moat**: RuVector is Focus GTS's own technology. Using it creates a competitive advantage that cannot be replicated by competitors using commodity vector databases.

2. **Navigator integration**: RuVector already powers the Navigator platform with 7 established namespaces (knowledge, tickets, time_patterns, roi_patterns, assignment_patterns, transcripts, memories). Black Hole adds 7 migration-specific namespaces, creating a unified knowledge graph across both products.

3. **Zero marginal cost**: No per-query API fees, no managed service charges. The in-process implementation has zero infrastructure cost during development.

4. **Designed for swap**: The current in-process array-based store uses the same interface that pgvector will use. When ready for production scale, we swap the persistence layer without changing any calling code.

5. **Self-learning trajectory recording**: Built-in trajectory capture (query, result, feedback, outcome) feeds the continuous learning loop. This is architecturally integrated, not bolted on.

## Architecture

### 14 Namespace Model

Navigator namespaces (7):
- `knowledge` - General knowledge base entries
- `tickets` - Support ticket patterns
- `time_patterns` - Scheduling and estimation patterns
- `roi_patterns` - Return on investment data
- `assignment_patterns` - Resource allocation patterns
- `transcripts` - Meeting and conversation data
- `memories` - Agent and system memory

Black Hole migration namespaces (7):
- `migration_patterns` - Recorded migration strategies
- `code_fingerprints` - Code structural fingerprints
- `content_signatures` - Content hashes for duplicate detection
- `risk_outcomes` - Historical risk assessment outcomes
- `assessment_profiles` - Migration assessment snapshots
- `fix_library` - Proven code fixes indexed by problem
- `integration_templates` - Integration configs by source/target

### Embedding Approach

We use local character n-gram hashing (384 dimensions) instead of API-based embedding:

- **No API dependency**: Embeddings are generated in-process with zero latency
- **No cost**: No per-token embedding charges
- **Deterministic**: Same text always produces same embedding
- **Method**: FNV-1a hash of character trigrams + word unigrams + word bigrams into 384 buckets, L2-normalized to unit vector
- **Trade-off**: Lower semantic quality than transformer-based embeddings, but sufficient for technical text matching in our domain

### Data Persistence

- Vectors persist to `data/ruvector.json`
- Trajectories persist to `data/trajectories.json`
- Auto-save on mutation with configurable interval
- JSON format chosen for simplicity; binary format can be added when needed

### Trajectory Recording

Every search query, result selection, and outcome is recorded:
1. **Query**: What was searched, how many results, top similarity score
2. **Feedback**: Whether the returned result was useful
3. **Outcome**: Whether the recommended fix actually worked

This creates a feedback loop that will improve matching quality as the system accumulates data.

## Future Migration Path

When scaling to production:
1. Replace array-based store with PostgreSQL + pgvector
2. Add HNSW indexing for sub-millisecond search at scale
3. Enable GNN-enhanced search from full RuVector
4. Enable SONA auto-tuning for threshold optimization
5. Connect to Navigator's RuVector instance for cross-product search

Feature flags in `ruvector-config.ts` control which capabilities are active.

## Consequences

### Positive
- Zero infrastructure cost during development
- Full control over the vector storage implementation
- Unified namespace model across Navigator and Black Hole
- Built-in learning loop via trajectory recording
- Clean upgrade path to pgvector

### Negative
- In-process store does not scale beyond single-server deployment
- Character n-gram embeddings have lower semantic quality than transformer models
- JSON persistence is not suitable for large-scale production data
- No concurrent write safety across multiple processes (single-process lock only)

### Risks
- If Navigator changes its namespace schema, Black Hole must adapt
- Large vector stores (>100k entries) may cause memory pressure in-process
- JSON serialization of high-dimensional vectors produces large files
