/**
 * RuVector Embeddings
 *
 * Local embedding generation using character n-gram hashing.
 * Produces 384-dimensional unit vectors suitable for cosine similarity
 * without requiring any external API calls.
 *
 * Method: Hash character trigrams into fixed-size buckets, then L2-normalize
 * to produce a unit vector. This captures local character-level structure
 * and provides meaningful semantic similarity for technical text.
 */

import {
  EMBEDDING_DIMENSIONS,
  NGRAM_SIZE,
} from '@/config/ruvector-config';

// ============================================================
// Types
// ============================================================

/** A fixed-length numeric vector. */
export type EmbeddingVector = number[];

// ============================================================
// Core Functions
// ============================================================

/**
 * Generate a 384-dimensional embedding vector from text.
 *
 * Uses TF-IDF-style hashing of character trigrams:
 * 1. Normalize text (lowercase, collapse whitespace)
 * 2. Extract character trigrams
 * 3. Hash each trigram into one of 384 buckets
 * 4. Apply sub-linear TF scaling (1 + log(count))
 * 5. L2-normalize to unit vector
 */
export function generateEmbedding(text: string): EmbeddingVector {
  const dimensions = EMBEDDING_DIMENSIONS;
  const n = NGRAM_SIZE;
  const vector = new Array<number>(dimensions).fill(0);

  const normalized = normalizeText(text);
  if (normalized.length < n) {
    // For very short text, hash the entire string
    const hash = fnv1aHash(normalized);
    vector[Math.abs(hash) % dimensions] = 1;
    return l2Normalize(vector);
  }

  // Extract character n-grams and accumulate into buckets
  for (let i = 0; i <= normalized.length - n; i++) {
    const ngram = normalized.substring(i, i + n);
    const hash = fnv1aHash(ngram);
    const bucket = Math.abs(hash) % dimensions;
    // Use sign from second hash for better distribution
    const sign = fnv1aHash(ngram + '\x01') > 0 ? 1 : -1;
    vector[bucket] += sign;
  }

  // Sub-linear TF scaling: sign(v) * (1 + log(|v|)) for non-zero entries
  for (let i = 0; i < dimensions; i++) {
    if (vector[i] !== 0) {
      const absVal = Math.abs(vector[i]);
      vector[i] = Math.sign(vector[i]) * (1 + Math.log(absVal));
    }
  }

  // Also incorporate word-level unigrams for better semantic matching
  const words = normalized.split(/\s+/).filter((w) => w.length >= 2);
  for (const word of words) {
    const hash = fnv1aHash('w:' + word);
    const bucket = Math.abs(hash) % dimensions;
    const sign = fnv1aHash('w:' + word + '\x01') > 0 ? 1 : -1;
    vector[bucket] += sign * 0.5;
  }

  // Word bigrams for phrase-level context
  for (let i = 0; i < words.length - 1; i++) {
    const bigram = words[i] + ' ' + words[i + 1];
    const hash = fnv1aHash('b:' + bigram);
    const bucket = Math.abs(hash) % dimensions;
    const sign = fnv1aHash('b:' + bigram + '\x01') > 0 ? 1 : -1;
    vector[bucket] += sign * 0.3;
  }

  return l2Normalize(vector);
}

/**
 * Compute cosine similarity between two embedding vectors.
 * Returns a value in [-1, 1] where 1 means identical direction.
 * For unit vectors this is simply the dot product.
 */
export function cosineSimilarity(a: EmbeddingVector, b: EmbeddingVector): number {
  if (a.length !== b.length) {
    throw new RuVectorEmbeddingError(
      `Vector dimension mismatch: ${a.length} vs ${b.length}`
    );
  }
  if (a.length === 0) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dot / denominator;
}

/**
 * Generate embeddings for multiple texts efficiently.
 * Processes in batch but uses the same n-gram hashing approach.
 */
export function batchEmbed(texts: string[]): EmbeddingVector[] {
  return texts.map(generateEmbedding);
}

// ============================================================
// Internal Helpers
// ============================================================

/**
 * FNV-1a hash function for strings.
 * Fast, well-distributed hash suitable for bucket assignment.
 */
function fnv1aHash(str: string): number {
  let hash = 0x811c9dc5; // FNV offset basis (32-bit)
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193); // FNV prime
  }
  return hash | 0; // Convert to signed 32-bit int
}

/** Normalize text for consistent embedding generation. */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s\-./]/g, ' ')  // Keep word chars, whitespace, hyphens, dots, slashes
    .replace(/\s+/g, ' ')
    .trim();
}

/** L2-normalize a vector to unit length. */
function l2Normalize(vector: number[]): number[] {
  let norm = 0;
  for (let i = 0; i < vector.length; i++) {
    norm += vector[i] * vector[i];
  }
  norm = Math.sqrt(norm);

  if (norm === 0) return vector;

  const result = new Array<number>(vector.length);
  for (let i = 0; i < vector.length; i++) {
    result[i] = vector[i] / norm;
  }
  return result;
}

// ============================================================
// Error Class
// ============================================================

export class RuVectorEmbeddingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RuVectorEmbeddingError';
  }
}
