/**
 * Black Hole - Ingestion Engine
 *
 * Accepts data from source connectors and file uploads,
 * normalizes it into MigrationItem format for downstream processing.
 */

import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import type {
  ConnectorConfig,
  MigrationItem,
  CompatibilityLevel,
} from '@/types';

// ============================================================
// Types
// ============================================================

export interface IngestOptions {
  batchSize: number;
  validateSchema: boolean;
  deduplicateByPath: boolean;
  onProgress?: (progress: IngestProgress) => void;
}

export interface IngestProgress {
  totalItems: number;
  processedItems: number;
  skippedItems: number;
  failedItems: number;
  percentComplete: number;
  currentBatch: number;
  totalBatches: number;
}

export interface IngestResult {
  items: MigrationItem[];
  errors: IngestError[];
  stats: IngestStats;
}

export interface IngestStats {
  totalIngested: number;
  totalSkipped: number;
  totalFailed: number;
  duplicatesRemoved: number;
  durationMs: number;
}

export interface IngestError {
  index: number;
  path: string;
  message: string;
  raw: unknown;
}

export interface RawRecord {
  type?: string;
  name?: string;
  sourcePath: string;
  targetPath?: string;
  metadata?: Record<string, unknown>;
}

/** Minimal interface for a source connector that yields raw records. */
export interface SourceConnector {
  config: ConnectorConfig;
  fetchRecords(): Promise<RawRecord[]>;
}

// ============================================================
// Schemas
// ============================================================

const RawRecordSchema = z.object({
  type: z.string().optional(),
  name: z.string().optional(),
  sourcePath: z.string().min(1, 'sourcePath is required'),
  targetPath: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// ============================================================
// Engine
// ============================================================

const DEFAULT_OPTIONS: IngestOptions = {
  batchSize: 100,
  validateSchema: true,
  deduplicateByPath: true,
};

export class IngestEngine {
  private readonly options: IngestOptions;

  constructor(options: Partial<IngestOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  // ----------------------------------------------------------
  // Public API
  // ----------------------------------------------------------

  /**
   * Ingest records from an external source connector.
   * The connector is responsible for fetching raw data; this engine
   * normalizes the results.
   */
  async ingestFromConnector(
    connector: SourceConnector,
  ): Promise<IngestResult> {
    const raw = await connector.fetchRecords();
    return this.processBatches(raw);
  }

  /**
   * Ingest records from a file buffer.
   * Supports CSV, JSON, and XML content types.
   */
  async ingestFromFile(
    content: string,
    format: 'csv' | 'json' | 'xml',
  ): Promise<IngestResult> {
    let raw: RawRecord[];

    switch (format) {
      case 'csv':
        raw = this.parseCsv(content);
        break;
      case 'json':
        raw = this.parseJson(content);
        break;
      case 'xml':
        raw = this.parseXml(content);
        break;
      default:
        throw new IngestEngineError(`Unsupported format: ${format as string}`);
    }

    return this.processBatches(raw);
  }

  /**
   * Normalize a single raw record into a MigrationItem.
   */
  normalizeData(raw: RawRecord): MigrationItem {
    const sanitized = this.sanitize(raw);
    return {
      id: uuid(),
      type: sanitized.type ?? this.inferType(sanitized.sourcePath),
      name: sanitized.name ?? this.inferName(sanitized.sourcePath),
      sourcePath: sanitized.sourcePath,
      targetPath: sanitized.targetPath ?? null,
      status: 'pending',
      compatibilityLevel: 'compatible' as CompatibilityLevel,
      autoFixed: false,
      validationResult: null,
      error: null,
      processedAt: null,
    };
  }

  // ----------------------------------------------------------
  // Batch processing
  // ----------------------------------------------------------

  private async processBatches(raw: RawRecord[]): Promise<IngestResult> {
    const start = Date.now();
    const items: MigrationItem[] = [];
    const errors: IngestError[] = [];
    let skipped = 0;
    let duplicatesRemoved = 0;
    const seenPaths = new Set<string>();

    const totalBatches = Math.max(1, Math.ceil(raw.length / this.options.batchSize));

    for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
      const batchStart = batchIdx * this.options.batchSize;
      const batchEnd = Math.min(batchStart + this.options.batchSize, raw.length);
      const batch = raw.slice(batchStart, batchEnd);

      for (let i = 0; i < batch.length; i++) {
        const globalIndex = batchStart + i;
        const record = batch[i];

        // Validate
        if (this.options.validateSchema) {
          const parseResult = RawRecordSchema.safeParse(record);
          if (!parseResult.success) {
            errors.push({
              index: globalIndex,
              path: record?.sourcePath ?? '<unknown>',
              message: parseResult.error.issues.map((iss) => iss.message).join('; '),
              raw: record,
            });
            continue;
          }
        }

        // Deduplicate
        if (this.options.deduplicateByPath && seenPaths.has(record.sourcePath)) {
          duplicatesRemoved++;
          skipped++;
          continue;
        }
        seenPaths.add(record.sourcePath);

        try {
          items.push(this.normalizeData(record));
        } catch (err) {
          errors.push({
            index: globalIndex,
            path: record.sourcePath,
            message: err instanceof Error ? err.message : String(err),
            raw: record,
          });
        }
      }

      this.options.onProgress?.({
        totalItems: raw.length,
        processedItems: batchEnd,
        skippedItems: skipped,
        failedItems: errors.length,
        percentComplete: Math.round((batchEnd / raw.length) * 100),
        currentBatch: batchIdx + 1,
        totalBatches,
      });

      // Yield control between batches to avoid starving the event loop
      await this.yieldTick();
    }

    return {
      items,
      errors,
      stats: {
        totalIngested: items.length,
        totalSkipped: skipped,
        totalFailed: errors.length,
        duplicatesRemoved,
        durationMs: Date.now() - start,
      },
    };
  }

  // ----------------------------------------------------------
  // File Parsers
  // ----------------------------------------------------------

  private parseCsv(content: string): RawRecord[] {
    const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) return [];

    const headers = this.parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
    const records: RawRecord[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCsvLine(lines[i]);
      const obj: Record<string, string> = {};
      for (let h = 0; h < headers.length; h++) {
        obj[headers[h]] = values[h] ?? '';
      }

      const sourcePath =
        obj['sourcepath'] || obj['source_path'] || obj['path'] || obj['source'] || '';
      if (!sourcePath) continue;

      records.push({
        type: obj['type'] || undefined,
        name: obj['name'] || undefined,
        sourcePath,
        targetPath: obj['targetpath'] || obj['target_path'] || obj['target'] || undefined,
      });
    }

    return records;
  }

  /**
   * Parse a single CSV line respecting quoted fields.
   */
  private parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  }

  private parseJson(content: string): RawRecord[] {
    const parsed: unknown = JSON.parse(content);

    if (Array.isArray(parsed)) {
      return parsed as RawRecord[];
    }

    // Accept { items: [...] } or { records: [...] } wrappers
    if (typeof parsed === 'object' && parsed !== null) {
      const obj = parsed as Record<string, unknown>;
      for (const key of ['items', 'records', 'data', 'entries']) {
        if (Array.isArray(obj[key])) {
          return obj[key] as RawRecord[];
        }
      }
    }

    throw new IngestEngineError('JSON must be an array or contain items/records/data key');
  }

  private parseXml(content: string): RawRecord[] {
    const records: RawRecord[] = [];

    // Lightweight XML parser - extracts <item> or <record> elements
    const itemRegex = /<(?:item|record|entry)[^>]*>([\s\S]*?)<\/(?:item|record|entry)>/gi;
    let match: RegExpExecArray | null;

    while ((match = itemRegex.exec(content)) !== null) {
      const block = match[1];
      const getField = (name: string): string | undefined => {
        const fieldMatch = new RegExp(
          `<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`,
          'i',
        ).exec(block);
        return fieldMatch ? fieldMatch[1].trim() : undefined;
      };

      const sourcePath =
        getField('sourcePath') || getField('source_path') || getField('path') || '';
      if (!sourcePath) continue;

      records.push({
        type: getField('type'),
        name: getField('name'),
        sourcePath,
        targetPath: getField('targetPath') || getField('target_path'),
      });
    }

    return records;
  }

  // ----------------------------------------------------------
  // Helpers
  // ----------------------------------------------------------

  private sanitize(record: RawRecord): RawRecord {
    return {
      ...record,
      sourcePath: record.sourcePath.replace(/[\x00-\x1f]/g, '').trim(),
      name: record.name?.replace(/[\x00-\x1f]/g, '').trim(),
      targetPath: record.targetPath?.replace(/[\x00-\x1f]/g, '').trim(),
    };
  }

  private inferType(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase() ?? '';
    const typeMap: Record<string, string> = {
      html: 'page',
      htm: 'page',
      jsp: 'component',
      java: 'code',
      js: 'code',
      ts: 'code',
      tsx: 'code',
      jsx: 'code',
      css: 'style',
      scss: 'style',
      less: 'style',
      png: 'asset',
      jpg: 'asset',
      jpeg: 'asset',
      gif: 'asset',
      svg: 'asset',
      pdf: 'asset',
      mp4: 'asset',
      json: 'config',
      xml: 'config',
      yaml: 'config',
      yml: 'config',
    };
    return typeMap[ext] ?? 'content';
  }

  private inferName(path: string): string {
    const segments = path.split('/').filter(Boolean);
    return segments[segments.length - 1] ?? path;
  }

  private yieldTick(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }
}

// ============================================================
// Error Class
// ============================================================

export class IngestEngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IngestEngineError';
  }
}
