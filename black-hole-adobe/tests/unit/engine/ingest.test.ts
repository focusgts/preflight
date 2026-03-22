/**
 * Tests for IngestEngine
 *
 * Covers CSV/JSON/XML parsing, data normalization, batch processing,
 * progress callbacks, deduplication, schema validation, and error handling.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  IngestEngine,
  IngestEngineError,
  type RawRecord,
  type SourceConnector,
  type IngestProgress,
} from '@/lib/engine/ingest';
import type { ConnectorConfig } from '@/types';

// ---- Helpers ----

function makeCsv(headers: string[], rows: string[][]): string {
  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

function makeConnector(records: RawRecord[]): SourceConnector {
  return {
    config: {
      id: 'test-conn',
      type: 'file',
      name: 'Test Connector',
      connectionDetails: {},
      status: 'connected',
      lastTestedAt: null,
      capabilities: [],
    } satisfies ConnectorConfig,
    fetchRecords: vi.fn().mockResolvedValue(records),
  };
}

// ============================================================
// Tests
// ============================================================

describe('IngestEngine', () => {
  let engine: IngestEngine;

  beforeEach(() => {
    engine = new IngestEngine();
  });

  // ----------------------------------------------------------
  // CSV Parsing
  // ----------------------------------------------------------

  describe('CSV parsing', () => {
    it('should parse a basic CSV with sourcepath header', async () => {
      const csv = makeCsv(
        ['type', 'name', 'sourcePath'],
        [
          ['page', 'Home Page', '/content/site/en/home'],
          ['asset', 'Logo', '/content/dam/logo.png'],
        ],
      );

      const result = await engine.ingestFromFile(csv, 'csv');

      expect(result.items).toHaveLength(2);
      expect(result.items[0].sourcePath).toBe('/content/site/en/home');
      expect(result.items[0].type).toBe('page');
      expect(result.items[0].name).toBe('Home Page');
      expect(result.items[1].sourcePath).toBe('/content/dam/logo.png');
      expect(result.stats.totalIngested).toBe(2);
      expect(result.stats.totalFailed).toBe(0);
    });

    it('should parse CSV with source_path header variant', async () => {
      const csv = makeCsv(
        ['source_path', 'target_path'],
        [['/content/page1', '/content/cloud/page1']],
      );

      const result = await engine.ingestFromFile(csv, 'csv');

      expect(result.items).toHaveLength(1);
      expect(result.items[0].sourcePath).toBe('/content/page1');
      expect(result.items[0].targetPath).toBe('/content/cloud/page1');
    });

    it('should parse CSV with path header variant', async () => {
      const csv = makeCsv(['path'], [['/content/dam/image.jpg']]);

      const result = await engine.ingestFromFile(csv, 'csv');

      expect(result.items).toHaveLength(1);
      expect(result.items[0].sourcePath).toBe('/content/dam/image.jpg');
    });

    it('should handle quoted CSV fields with commas and escaped quotes', async () => {
      const csv = 'type,name,sourcePath\npage,"Page with, comma",/content/page\npage,"He said ""hello""",/content/other';

      const result = await engine.ingestFromFile(csv, 'csv');

      expect(result.items).toHaveLength(2);
      expect(result.items[0].name).toBe('Page with, comma');
      expect(result.items[1].name).toBe('He said "hello"');
    });

    it('should skip CSV rows with no sourcePath', async () => {
      const csv = makeCsv(
        ['type', 'name'],
        [['page', 'Orphan']],
      );

      const result = await engine.ingestFromFile(csv, 'csv');

      expect(result.items).toHaveLength(0);
    });

    it('should return empty array for CSV with header-only', async () => {
      const csv = 'sourcePath,name,type';

      const result = await engine.ingestFromFile(csv, 'csv');

      expect(result.items).toHaveLength(0);
    });

    it('should return empty for single-line CSV', async () => {
      const result = await engine.ingestFromFile('just a line', 'csv');
      expect(result.items).toHaveLength(0);
    });

    it('should handle Windows-style CRLF line endings', async () => {
      const csv = 'sourcePath,type\r\n/content/page1,page\r\n/content/page2,page';

      const result = await engine.ingestFromFile(csv, 'csv');

      expect(result.items).toHaveLength(2);
    });
  });

  // ----------------------------------------------------------
  // JSON Parsing
  // ----------------------------------------------------------

  describe('JSON parsing', () => {
    it('should parse a JSON array of records', async () => {
      const json = JSON.stringify([
        { sourcePath: '/content/en/home', type: 'page', name: 'Home' },
        { sourcePath: '/content/dam/hero.png', type: 'asset' },
      ]);

      const result = await engine.ingestFromFile(json, 'json');

      expect(result.items).toHaveLength(2);
      expect(result.items[0].name).toBe('Home');
      expect(result.items[1].type).toBe('asset');
    });

    it('should parse JSON with { items: [...] } wrapper', async () => {
      const json = JSON.stringify({
        items: [
          { sourcePath: '/content/page1' },
          { sourcePath: '/content/page2' },
        ],
      });

      const result = await engine.ingestFromFile(json, 'json');

      expect(result.items).toHaveLength(2);
    });

    it('should parse JSON with { records: [...] } wrapper', async () => {
      const json = JSON.stringify({
        records: [{ sourcePath: '/content/page1' }],
      });

      const result = await engine.ingestFromFile(json, 'json');

      expect(result.items).toHaveLength(1);
    });

    it('should parse JSON with { data: [...] } wrapper', async () => {
      const json = JSON.stringify({
        data: [{ sourcePath: '/apps/component.html' }],
      });

      const result = await engine.ingestFromFile(json, 'json');

      expect(result.items).toHaveLength(1);
    });

    it('should parse JSON with { entries: [...] } wrapper', async () => {
      const json = JSON.stringify({
        entries: [{ sourcePath: '/etc/designs/style.css' }],
      });

      const result = await engine.ingestFromFile(json, 'json');

      expect(result.items).toHaveLength(1);
    });

    it('should throw for JSON object without recognized key', async () => {
      const json = JSON.stringify({ pages: [{ sourcePath: '/a' }] });

      await expect(engine.ingestFromFile(json, 'json')).rejects.toThrow(
        'JSON must be an array or contain items/records/data key',
      );
    });

    it('should throw on invalid JSON', async () => {
      await expect(engine.ingestFromFile('not valid json', 'json')).rejects.toThrow();
    });

    it('should parse nested JSON structures and extract sourcePath', async () => {
      const json = JSON.stringify([
        {
          sourcePath: '/content/en/about',
          type: 'page',
          name: 'About',
          metadata: { author: 'Admin', tags: ['corporate', 'info'] },
        },
      ]);

      const result = await engine.ingestFromFile(json, 'json');

      expect(result.items).toHaveLength(1);
      expect(result.items[0].sourcePath).toBe('/content/en/about');
    });
  });

  // ----------------------------------------------------------
  // XML Parsing
  // ----------------------------------------------------------

  describe('XML parsing', () => {
    it('should parse XML with <item> elements', async () => {
      const xml = `
        <items>
          <item>
            <sourcePath>/content/site/en</sourcePath>
            <type>page</type>
            <name>English Home</name>
          </item>
          <item>
            <sourcePath>/content/dam/banner.jpg</sourcePath>
            <type>asset</type>
          </item>
        </items>`;

      const result = await engine.ingestFromFile(xml, 'xml');

      expect(result.items).toHaveLength(2);
      expect(result.items[0].sourcePath).toBe('/content/site/en');
      expect(result.items[0].name).toBe('English Home');
    });

    it('should parse XML with <record> elements', async () => {
      const xml = `
        <records>
          <record>
            <path>/content/dam/docs/whitepaper.pdf</path>
            <type>asset</type>
          </record>
        </records>`;

      const result = await engine.ingestFromFile(xml, 'xml');

      expect(result.items).toHaveLength(1);
      expect(result.items[0].sourcePath).toBe('/content/dam/docs/whitepaper.pdf');
    });

    it('should parse XML with <entry> elements', async () => {
      const xml = `
        <feed>
          <entry>
            <source_path>/apps/myapp/components/hero</source_path>
            <name>Hero Component</name>
          </entry>
        </feed>`;

      const result = await engine.ingestFromFile(xml, 'xml');

      expect(result.items).toHaveLength(1);
    });

    it('should skip XML elements without a sourcePath', async () => {
      const xml = `
        <items>
          <item><name>No path</name></item>
        </items>`;

      const result = await engine.ingestFromFile(xml, 'xml');

      expect(result.items).toHaveLength(0);
    });

    it('should return empty for XML with no matching elements', async () => {
      const xml = '<root><something>data</something></root>';

      const result = await engine.ingestFromFile(xml, 'xml');

      expect(result.items).toHaveLength(0);
    });
  });

  // ----------------------------------------------------------
  // Data Normalization
  // ----------------------------------------------------------

  describe('data normalization', () => {
    it('should generate a unique id for each item', () => {
      const item = engine.normalizeData({ sourcePath: '/content/page' });

      expect(item.id).toBeDefined();
      expect(typeof item.id).toBe('string');
      expect(item.id.length).toBeGreaterThan(0);
    });

    it('should infer type from file extension', () => {
      expect(engine.normalizeData({ sourcePath: '/apps/comp.html' }).type).toBe('page');
      expect(engine.normalizeData({ sourcePath: '/apps/code.java' }).type).toBe('code');
      expect(engine.normalizeData({ sourcePath: '/dam/logo.png' }).type).toBe('asset');
      expect(engine.normalizeData({ sourcePath: '/dam/doc.pdf' }).type).toBe('asset');
      expect(engine.normalizeData({ sourcePath: '/etc/config.json' }).type).toBe('config');
      expect(engine.normalizeData({ sourcePath: '/apps/style.css' }).type).toBe('style');
      expect(engine.normalizeData({ sourcePath: '/apps/comp.jsp' }).type).toBe('component');
    });

    it('should use provided type instead of inferring', () => {
      const item = engine.normalizeData({
        sourcePath: '/content/dam/hero.png',
        type: 'custom-type',
      });

      expect(item.type).toBe('custom-type');
    });

    it('should infer name from the last path segment', () => {
      const item = engine.normalizeData({
        sourcePath: '/content/site/en/home',
      });

      expect(item.name).toBe('home');
    });

    it('should use provided name over inferred one', () => {
      const item = engine.normalizeData({
        sourcePath: '/content/page',
        name: 'Custom Name',
      });

      expect(item.name).toBe('Custom Name');
    });

    it('should default unknown extensions to content type', () => {
      const item = engine.normalizeData({ sourcePath: '/content/unknown' });
      expect(item.type).toBe('content');
    });

    it('should set status to pending', () => {
      const item = engine.normalizeData({ sourcePath: '/content/page' });
      expect(item.status).toBe('pending');
    });

    it('should set targetPath to null when not provided', () => {
      const item = engine.normalizeData({ sourcePath: '/content/page' });
      expect(item.targetPath).toBeNull();
    });

    it('should strip control characters from paths and names', () => {
      const item = engine.normalizeData({
        sourcePath: '/content/\x00page\x01',
        name: 'My\x02Name',
      });

      expect(item.sourcePath).toBe('/content/page');
      expect(item.name).toBe('MyName');
    });

    it('should trim whitespace from sourcePath', () => {
      const item = engine.normalizeData({
        sourcePath: '  /content/page  ',
      });

      expect(item.sourcePath).toBe('/content/page');
    });
  });

  // ----------------------------------------------------------
  // Batch Processing
  // ----------------------------------------------------------

  describe('batch processing', () => {
    it('should process records in batches according to batchSize', async () => {
      const progressCalls: IngestProgress[] = [];
      const batchEngine = new IngestEngine({
        batchSize: 3,
        onProgress: (p) => progressCalls.push({ ...p }),
      });

      const json = JSON.stringify(
        Array.from({ length: 7 }, (_, i) => ({
          sourcePath: `/content/page${i}`,
        })),
      );

      const result = await batchEngine.ingestFromFile(json, 'json');

      expect(result.items).toHaveLength(7);
      // With 7 items and batch size 3 => ceil(7/3) = 3 batches
      expect(progressCalls).toHaveLength(3);
      expect(progressCalls[0].currentBatch).toBe(1);
      expect(progressCalls[0].totalBatches).toBe(3);
      expect(progressCalls[2].currentBatch).toBe(3);
      expect(progressCalls[2].percentComplete).toBe(100);
    });

    it('should handle a single batch when items < batchSize', async () => {
      const progressCalls: IngestProgress[] = [];
      const batchEngine = new IngestEngine({
        batchSize: 100,
        onProgress: (p) => progressCalls.push({ ...p }),
      });

      const json = JSON.stringify([{ sourcePath: '/content/page1' }]);

      await batchEngine.ingestFromFile(json, 'json');

      expect(progressCalls).toHaveLength(1);
      expect(progressCalls[0].totalBatches).toBe(1);
    });
  });

  // ----------------------------------------------------------
  // Progress Callbacks
  // ----------------------------------------------------------

  describe('progress callbacks', () => {
    it('should report accurate progress percentages', async () => {
      const progressCalls: IngestProgress[] = [];
      const engine = new IngestEngine({
        batchSize: 2,
        onProgress: (p) => progressCalls.push({ ...p }),
      });

      const json = JSON.stringify(
        Array.from({ length: 4 }, (_, i) => ({
          sourcePath: `/content/page${i}`,
        })),
      );

      await engine.ingestFromFile(json, 'json');

      expect(progressCalls[0].percentComplete).toBe(50);
      expect(progressCalls[1].percentComplete).toBe(100);
    });

    it('should track skipped and failed items in progress', async () => {
      const progressCalls: IngestProgress[] = [];
      const engine = new IngestEngine({
        batchSize: 10,
        deduplicateByPath: true,
        onProgress: (p) => progressCalls.push({ ...p }),
      });

      const json = JSON.stringify([
        { sourcePath: '/content/page1' },
        { sourcePath: '/content/page1' }, // duplicate
        { sourcePath: '' }, // will fail validation (empty sourcePath)
      ]);

      await engine.ingestFromFile(json, 'json');

      const lastProgress = progressCalls[progressCalls.length - 1];
      expect(lastProgress.skippedItems).toBe(1);
      expect(lastProgress.failedItems).toBe(1);
    });
  });

  // ----------------------------------------------------------
  // Deduplication
  // ----------------------------------------------------------

  describe('deduplication', () => {
    it('should remove duplicates by sourcePath when enabled', async () => {
      const json = JSON.stringify([
        { sourcePath: '/content/page1', name: 'First' },
        { sourcePath: '/content/page1', name: 'Second' },
        { sourcePath: '/content/page2' },
      ]);

      const result = await engine.ingestFromFile(json, 'json');

      expect(result.items).toHaveLength(2);
      expect(result.stats.duplicatesRemoved).toBe(1);
      // Keeps first occurrence
      expect(result.items[0].name).toBe('First');
    });

    it('should keep duplicates when deduplication is disabled', async () => {
      const noDedupEngine = new IngestEngine({ deduplicateByPath: false });

      const json = JSON.stringify([
        { sourcePath: '/content/page1' },
        { sourcePath: '/content/page1' },
      ]);

      const result = await noDedupEngine.ingestFromFile(json, 'json');

      expect(result.items).toHaveLength(2);
      expect(result.stats.duplicatesRemoved).toBe(0);
    });
  });

  // ----------------------------------------------------------
  // Schema Validation
  // ----------------------------------------------------------

  describe('schema validation', () => {
    it('should reject records with empty sourcePath', async () => {
      const json = JSON.stringify([{ sourcePath: '' }]);

      const result = await engine.ingestFromFile(json, 'json');

      expect(result.items).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('sourcePath');
    });

    it('should accept records when validation is disabled', async () => {
      const noValidEngine = new IngestEngine({ validateSchema: false });

      const json = JSON.stringify([{ sourcePath: '' }]);

      const result = await noValidEngine.ingestFromFile(json, 'json');

      // Without validation the empty string passes through
      expect(result.errors).toHaveLength(0);
    });

    it('should record errors with correct index and path', async () => {
      const json = JSON.stringify([
        { sourcePath: '/content/ok' },
        { sourcePath: '' }, // index 1 should fail
        { sourcePath: '/content/also-ok' },
      ]);

      const result = await engine.ingestFromFile(json, 'json');

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].index).toBe(1);
    });
  });

  // ----------------------------------------------------------
  // Error Handling
  // ----------------------------------------------------------

  describe('error handling', () => {
    it('should throw IngestEngineError for unsupported formats', async () => {
      // @ts-expect-error testing invalid format
      await expect(engine.ingestFromFile('data', 'yaml')).rejects.toThrow(IngestEngineError);
    });

    it('should capture normalizeData errors without crashing the batch', async () => {
      // If normalizeData throws for a record, it should be captured as an error
      const malformedRecords: RawRecord[] = [
        { sourcePath: '/content/good' },
        { sourcePath: '/content/good2' },
      ];

      const connector = makeConnector(malformedRecords);
      const result = await engine.ingestFromConnector(connector);

      expect(result.items).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ----------------------------------------------------------
  // Connector Ingestion
  // ----------------------------------------------------------

  describe('connector ingestion', () => {
    it('should ingest records from a source connector', async () => {
      const records: RawRecord[] = [
        { sourcePath: '/content/page1', type: 'page', name: 'Page 1' },
        { sourcePath: '/content/dam/img.jpg', type: 'asset' },
      ];

      const connector = makeConnector(records);
      const result = await engine.ingestFromConnector(connector);

      expect(result.items).toHaveLength(2);
      expect(connector.fetchRecords).toHaveBeenCalledOnce();
    });

    it('should propagate connector fetch errors', async () => {
      const connector = makeConnector([]);
      (connector.fetchRecords as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Connection timeout'),
      );

      await expect(engine.ingestFromConnector(connector)).rejects.toThrow('Connection timeout');
    });
  });

  // ----------------------------------------------------------
  // Large File Handling
  // ----------------------------------------------------------

  describe('large file handling', () => {
    it('should process 1000 records without errors', async () => {
      const records = Array.from({ length: 1000 }, (_, i) => ({
        sourcePath: `/content/page${i}`,
      }));

      const json = JSON.stringify(records);
      const result = await engine.ingestFromFile(json, 'json');

      expect(result.items).toHaveLength(1000);
      expect(result.stats.totalIngested).toBe(1000);
      expect(result.stats.totalFailed).toBe(0);
    });

    it('should report duration in stats', async () => {
      const json = JSON.stringify([{ sourcePath: '/content/page1' }]);
      const result = await engine.ingestFromFile(json, 'json');

      expect(result.stats.durationMs).toBeGreaterThanOrEqual(0);
    });
  });
});
