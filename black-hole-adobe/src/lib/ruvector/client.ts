/**
 * RuVector Client
 *
 * In-process vector store using array-based storage with cosine similarity.
 * Designed as a drop-in replacement for pgvector -- the storage interface
 * is identical so swapping to PostgreSQL + pgvector requires only changing
 * the persistence layer, not any calling code.
 *
 * Supports 14 namespaces (7 Navigator + 7 Black Hole migration), JSON file
 * persistence, and thread-safe operations via a mutation lock.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { cosineSimilarity, type EmbeddingVector } from './embeddings';
import {
  VALID_NAMESPACES,
  RUVECTOR_NAMESPACES,
  DEFAULT_RUVECTOR_CONFIG,
  type RuVectorConfig,
} from '@/config/ruvector-config';

// ============================================================
// Types
// ============================================================

export interface VectorEntry {
  key: string;
  namespace: string;
  value: string;
  embedding: EmbeddingVector;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
}

export interface SearchResult {
  entry: VectorEntry;
  similarity: number;
}

export interface VectorStoreStats {
  totalVectors: number;
  namespaceCounts: Record<string, number>;
  persistencePath: string;
  lastSavedAt: string | null;
}

interface SerializedStore {
  version: number;
  savedAt: string;
  entries: VectorEntry[];
}

// ============================================================
// Client
// ============================================================

export class RuVectorClient {
  private entries: Map<string, VectorEntry> = new Map();
  private namespaceIndex: Map<string, Set<string>> = new Map();
  private config: RuVectorConfig;
  private lastSavedAt: string | null = null;
  private mutationLock = false;

  constructor(config?: Partial<RuVectorConfig>) {
    this.config = { ...DEFAULT_RUVECTOR_CONFIG, ...config };

    // Initialize namespace indexes
    for (const ns of VALID_NAMESPACES) {
      this.namespaceIndex.set(ns, new Set());
    }

    // Load persisted data if available
    if (this.config.features.persistenceEnabled) {
      this.loadFromDisk();
    }
  }

  // ----------------------------------------------------------
  // Public API
  // ----------------------------------------------------------

  /**
   * Store a vector with metadata in a namespace.
   * If the key already exists in that namespace, it is overwritten.
   */
  async store(
    namespace: string,
    key: string,
    value: string,
    embedding: EmbeddingVector,
    tags: string[] = [],
    metadata: Record<string, unknown> = {},
  ): Promise<VectorEntry> {
    this.validateNamespace(namespace);
    this.validateEmbedding(embedding);

    await this.acquireLock();
    try {
      const compositeKey = this.compositeKey(namespace, key);
      const now = new Date().toISOString();

      const existing = this.entries.get(compositeKey);
      const entry: VectorEntry = {
        key,
        namespace,
        value,
        embedding,
        tags,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        metadata,
      };

      this.entries.set(compositeKey, entry);

      // Update namespace index
      let nsSet = this.namespaceIndex.get(namespace);
      if (!nsSet) {
        nsSet = new Set();
        this.namespaceIndex.set(namespace, nsSet);
      }
      nsSet.add(compositeKey);

      // Enforce max entries per namespace
      this.enforceNamespaceLimit(namespace);

      if (this.config.features.autoSaveOnMutation) {
        this.saveToDisk();
      }

      return entry;
    } finally {
      this.releaseLock();
    }
  }

  /**
   * Find similar vectors by cosine similarity within a namespace.
   * Returns results sorted by descending similarity, filtered by threshold.
   */
  async search(
    namespace: string,
    queryEmbedding: EmbeddingVector,
    limit: number = 10,
    threshold?: number,
  ): Promise<SearchResult[]> {
    this.validateNamespace(namespace);
    this.validateEmbedding(queryEmbedding);

    const effectiveThreshold = threshold ?? this.getDefaultThreshold(namespace);
    const nsKeys = this.namespaceIndex.get(namespace);
    if (!nsKeys || nsKeys.size === 0) return [];

    const results: SearchResult[] = [];

    for (const compositeKey of nsKeys) {
      const entry = this.entries.get(compositeKey);
      if (!entry) continue;

      const similarity = cosineSimilarity(queryEmbedding, entry.embedding);
      if (similarity >= effectiveThreshold) {
        results.push({ entry, similarity });
      }
    }

    // Sort by similarity descending
    results.sort((a, b) => b.similarity - a.similarity);

    return results.slice(0, limit);
  }

  /**
   * Retrieve a specific entry by namespace and key.
   */
  async retrieve(namespace: string, key: string): Promise<VectorEntry | null> {
    this.validateNamespace(namespace);
    const compositeKey = this.compositeKey(namespace, key);
    return this.entries.get(compositeKey) ?? null;
  }

  /**
   * List entries in a namespace, ordered by most recently updated.
   */
  async list(namespace: string, limit: number = 50): Promise<VectorEntry[]> {
    this.validateNamespace(namespace);
    const nsKeys = this.namespaceIndex.get(namespace);
    if (!nsKeys || nsKeys.size === 0) return [];

    const entries: VectorEntry[] = [];
    for (const compositeKey of nsKeys) {
      const entry = this.entries.get(compositeKey);
      if (entry) entries.push(entry);
    }

    // Sort by updatedAt descending
    entries.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    return entries.slice(0, limit);
  }

  /**
   * Remove an entry by namespace and key.
   * Returns true if the entry existed and was removed.
   */
  async delete(namespace: string, key: string): Promise<boolean> {
    this.validateNamespace(namespace);

    await this.acquireLock();
    try {
      const compositeKey = this.compositeKey(namespace, key);
      const existed = this.entries.delete(compositeKey);

      if (existed) {
        const nsSet = this.namespaceIndex.get(namespace);
        nsSet?.delete(compositeKey);

        if (this.config.features.autoSaveOnMutation) {
          this.saveToDisk();
        }
      }

      return existed;
    } finally {
      this.releaseLock();
    }
  }

  /**
   * Get statistics about the vector store.
   */
  getStats(): VectorStoreStats {
    const namespaceCounts: Record<string, number> = {};
    for (const [ns, keys] of this.namespaceIndex) {
      namespaceCounts[ns] = keys.size;
    }

    return {
      totalVectors: this.entries.size,
      namespaceCounts,
      persistencePath: this.config.persistence.vectorStorePath,
      lastSavedAt: this.lastSavedAt,
    };
  }

  /**
   * Force a save to disk. Useful for manual checkpoint.
   */
  saveToDisk(): void {
    if (!this.config.features.persistenceEnabled) return;

    const storePath = this.config.persistence.vectorStorePath;
    const dir = dirname(storePath);

    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const serialized: SerializedStore = {
      version: 1,
      savedAt: new Date().toISOString(),
      entries: Array.from(this.entries.values()),
    };

    writeFileSync(storePath, JSON.stringify(serialized), 'utf-8');
    this.lastSavedAt = serialized.savedAt;
  }

  /**
   * Load data from disk. Called automatically on construction
   * when persistence is enabled.
   */
  loadFromDisk(): void {
    const storePath = this.config.persistence.vectorStorePath;
    if (!existsSync(storePath)) return;

    try {
      const raw = readFileSync(storePath, 'utf-8');
      const data: SerializedStore = JSON.parse(raw);

      if (data.version !== 1) {
        throw new RuVectorClientError(
          `Unsupported store version: ${data.version}`
        );
      }

      this.entries.clear();
      for (const ns of this.namespaceIndex.values()) {
        ns.clear();
      }

      for (const entry of data.entries) {
        const compositeKey = this.compositeKey(entry.namespace, entry.key);
        this.entries.set(compositeKey, entry);

        let nsSet = this.namespaceIndex.get(entry.namespace);
        if (!nsSet) {
          nsSet = new Set();
          this.namespaceIndex.set(entry.namespace, nsSet);
        }
        nsSet.add(compositeKey);
      }

      this.lastSavedAt = data.savedAt;
    } catch (error) {
      if (error instanceof RuVectorClientError) throw error;
      // Corrupted file - start fresh
      console.warn(
        `RuVector: Failed to load from ${storePath}, starting fresh:`,
        error
      );
    }
  }

  /**
   * Clear all entries in a namespace or all namespaces.
   */
  async clear(namespace?: string): Promise<void> {
    await this.acquireLock();
    try {
      if (namespace) {
        this.validateNamespace(namespace);
        const nsKeys = this.namespaceIndex.get(namespace);
        if (nsKeys) {
          for (const key of nsKeys) {
            this.entries.delete(key);
          }
          nsKeys.clear();
        }
      } else {
        this.entries.clear();
        for (const nsSet of this.namespaceIndex.values()) {
          nsSet.clear();
        }
      }

      if (this.config.features.autoSaveOnMutation) {
        this.saveToDisk();
      }
    } finally {
      this.releaseLock();
    }
  }

  // ----------------------------------------------------------
  // Internal Helpers
  // ----------------------------------------------------------

  private compositeKey(namespace: string, key: string): string {
    return `${namespace}::${key}`;
  }

  private validateNamespace(namespace: string): void {
    if (!VALID_NAMESPACES.includes(namespace)) {
      throw new RuVectorClientError(
        `Invalid namespace "${namespace}". Valid namespaces: ${VALID_NAMESPACES.join(', ')}`
      );
    }
  }

  private validateEmbedding(embedding: EmbeddingVector): void {
    if (
      !Array.isArray(embedding) ||
      embedding.length !== this.config.embeddingDimensions
    ) {
      throw new RuVectorClientError(
        `Embedding must be an array of ${this.config.embeddingDimensions} numbers, got ${embedding?.length ?? 'undefined'}`
      );
    }
  }

  private getDefaultThreshold(namespace: string): number {
    const def = RUVECTOR_NAMESPACES[namespace];
    return def?.defaultThreshold ?? 0.7;
  }

  private enforceNamespaceLimit(namespace: string): void {
    const nsKeys = this.namespaceIndex.get(namespace);
    if (!nsKeys) return;

    const max = this.config.persistence.maxEntriesPerNamespace;
    if (nsKeys.size <= max) return;

    // Remove oldest entries (by createdAt) to bring under limit
    const entries: Array<{ compositeKey: string; createdAt: string }> = [];
    for (const ck of nsKeys) {
      const entry = this.entries.get(ck);
      if (entry) {
        entries.push({ compositeKey: ck, createdAt: entry.createdAt });
      }
    }

    entries.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    const toRemove = entries.slice(0, entries.length - max);
    for (const { compositeKey } of toRemove) {
      this.entries.delete(compositeKey);
      nsKeys.delete(compositeKey);
    }
  }

  private async acquireLock(): Promise<void> {
    // Simple cooperative lock for single-process concurrency
    while (this.mutationLock) {
      await new Promise((resolve) => setTimeout(resolve, 1));
    }
    this.mutationLock = true;
  }

  private releaseLock(): void {
    this.mutationLock = false;
  }
}

// ============================================================
// Error Class
// ============================================================

export class RuVectorClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RuVectorClientError';
  }
}
