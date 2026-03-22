/**
 * Tests for FileConnector
 *
 * Since the project uses the IngestEngine for file parsing,
 * these tests validate file-based ingestion through the IngestEngine
 * (which is the de facto file connector), covering CSV, JSON, XML
 * parsing, auto-schema detection, field mapping, and edge cases.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { IngestEngine, type RawRecord } from '@/lib/engine/ingest';

// ---- Helpers ----

function detectFormat(content: string): 'csv' | 'json' | 'xml' {
  const trimmed = content.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json';
  if (trimmed.startsWith('<')) return 'xml';
  return 'csv';
}

function detectSchema(content: string, format: 'csv' | 'json' | 'xml'): string[] {
  if (format === 'csv') {
    const firstLine = content.split(/\r?\n/)[0] || '';
    return firstLine.split(',').map((h) => h.trim().toLowerCase());
  }
  if (format === 'json') {
    const parsed = JSON.parse(content);
    const firstItem = Array.isArray(parsed) ? parsed[0] : null;
    return firstItem ? Object.keys(firstItem) : [];
  }
  return [];
}

function mapFields(
  records: RawRecord[],
  mapping: Record<string, string>,
): RawRecord[] {
  return records.map((r) => {
    const mapped: Record<string, unknown> = { ...r };
    for (const [from, to] of Object.entries(mapping)) {
      if (from in mapped) {
        (mapped as Record<string, unknown>)[to] = mapped[from];
        if (from !== to) delete mapped[from];
      }
    }
    return mapped as unknown as RawRecord;
  });
}

// ============================================================
// Tests
// ============================================================

describe('FileConnector (via IngestEngine)', () => {
  let engine: IngestEngine;

  beforeEach(() => {
    engine = new IngestEngine();
  });

  // ----------------------------------------------------------
  // CSV Parsing with Headers
  // ----------------------------------------------------------

  describe('CSV parsing with headers', () => {
    it('should parse CSV with standard headers', async () => {
      const csv = 'sourcePath,name,type\n/content/en/home,Home,page\n/content/dam/img.png,Image,asset';
      const result = await engine.ingestFromFile(csv, 'csv');

      expect(result.items).toHaveLength(2);
      expect(result.items[0].type).toBe('page');
      expect(result.items[1].type).toBe('asset');
    });

    it('should be case-insensitive for header matching', async () => {
      const csv = 'SourcePath,Name,Type\n/content/page,Page,page';
      const result = await engine.ingestFromFile(csv, 'csv');

      expect(result.items).toHaveLength(1);
      expect(result.items[0].sourcePath).toBe('/content/page');
    });

    it('should handle extra columns gracefully', async () => {
      const csv = 'sourcePath,name,type,extra1,extra2\n/content/page,Page,page,foo,bar';
      const result = await engine.ingestFromFile(csv, 'csv');

      expect(result.items).toHaveLength(1);
      expect(result.items[0].sourcePath).toBe('/content/page');
    });

    it('should handle fewer values than headers', async () => {
      const csv = 'sourcePath,name,type\n/content/page';
      const result = await engine.ingestFromFile(csv, 'csv');

      expect(result.items).toHaveLength(1);
      expect(result.items[0].sourcePath).toBe('/content/page');
    });

    it('should handle the source header variant', async () => {
      const csv = 'source,target\n/content/old,/content/new';
      const result = await engine.ingestFromFile(csv, 'csv');

      expect(result.items).toHaveLength(1);
      expect(result.items[0].sourcePath).toBe('/content/old');
      expect(result.items[0].targetPath).toBe('/content/new');
    });
  });

  // ----------------------------------------------------------
  // JSON Parsing
  // ----------------------------------------------------------

  describe('JSON parsing', () => {
    it('should parse flat JSON array', async () => {
      const json = JSON.stringify([
        { sourcePath: '/content/page1', type: 'page' },
        { sourcePath: '/content/page2', type: 'page' },
      ]);
      const result = await engine.ingestFromFile(json, 'json');

      expect(result.items).toHaveLength(2);
    });

    it('should parse JSON with nested metadata', async () => {
      const json = JSON.stringify([
        {
          sourcePath: '/content/page',
          type: 'page',
          metadata: {
            author: 'Admin',
            tags: ['tag1', 'tag2'],
            nested: { deep: true },
          },
        },
      ]);
      const result = await engine.ingestFromFile(json, 'json');

      expect(result.items).toHaveLength(1);
    });

    it('should handle all wrapper key variations', async () => {
      for (const key of ['items', 'records', 'data', 'entries']) {
        const json = JSON.stringify({ [key]: [{ sourcePath: '/content/x' }] });
        const result = await engine.ingestFromFile(json, 'json');
        expect(result.items).toHaveLength(1);
      }
    });
  });

  // ----------------------------------------------------------
  // XML Parsing
  // ----------------------------------------------------------

  describe('XML parsing', () => {
    it('should parse XML with item elements', async () => {
      const xml = '<items><item><sourcePath>/content/page</sourcePath><type>page</type></item></items>';
      const result = await engine.ingestFromFile(xml, 'xml');

      expect(result.items).toHaveLength(1);
    });

    it('should parse XML with record elements', async () => {
      const xml = '<root><record><path>/dam/asset.png</path></record></root>';
      const result = await engine.ingestFromFile(xml, 'xml');

      expect(result.items).toHaveLength(1);
    });

    it('should parse XML with entry elements', async () => {
      const xml = '<feed><entry><source_path>/content/blog</source_path><name>Blog</name></entry></feed>';
      const result = await engine.ingestFromFile(xml, 'xml');

      expect(result.items).toHaveLength(1);
    });

    it('should handle XML with attributes on elements', async () => {
      const xml = '<items><item id="1"><sourcePath>/content/page</sourcePath></item></items>';
      const result = await engine.ingestFromFile(xml, 'xml');

      expect(result.items).toHaveLength(1);
    });
  });

  // ----------------------------------------------------------
  // Auto-Schema Detection
  // ----------------------------------------------------------

  describe('auto-schema detection', () => {
    it('should detect JSON format from content', () => {
      expect(detectFormat('[{"sourcePath": "/page"}]')).toBe('json');
      expect(detectFormat('{"items": []}')).toBe('json');
    });

    it('should detect XML format from content', () => {
      expect(detectFormat('<items><item/></items>')).toBe('xml');
      expect(detectFormat('<?xml version="1.0"?><root/>')).toBe('xml');
    });

    it('should detect CSV format as fallback', () => {
      expect(detectFormat('sourcePath,name,type')).toBe('csv');
      expect(detectFormat('a,b,c\n1,2,3')).toBe('csv');
    });

    it('should detect CSV headers from first line', () => {
      const headers = detectSchema('sourcePath,name,type\n/page,Home,page', 'csv');
      expect(headers).toEqual(['sourcepath', 'name', 'type']);
    });

    it('should detect JSON fields from first object', () => {
      const fields = detectSchema('[{"sourcePath":"/page","name":"Home"}]', 'json');
      expect(fields).toContain('sourcePath');
      expect(fields).toContain('name');
    });
  });

  // ----------------------------------------------------------
  // Field Mapping
  // ----------------------------------------------------------

  describe('field mapping', () => {
    it('should map custom fields to standard fields', () => {
      const records: RawRecord[] = [
        { sourcePath: '/content/page', name: 'Home' } as RawRecord,
      ];
      const mapped = mapFields(records, { name: 'customName' });

      expect((mapped[0] as Record<string, unknown>)['customName']).toBe('Home');
    });

    it('should preserve unmapped fields', () => {
      const records: RawRecord[] = [
        { sourcePath: '/content/page', type: 'page' } as RawRecord,
      ];
      const mapped = mapFields(records, { type: 'contentType' });

      expect(mapped[0].sourcePath).toBe('/content/page');
      expect((mapped[0] as Record<string, unknown>)['contentType']).toBe('page');
    });
  });

  // ----------------------------------------------------------
  // Edge Cases
  // ----------------------------------------------------------

  describe('edge cases', () => {
    it('should handle empty CSV file', async () => {
      const result = await engine.ingestFromFile('', 'csv');
      expect(result.items).toHaveLength(0);
    });

    it('should handle empty JSON array', async () => {
      const result = await engine.ingestFromFile('[]', 'json');
      expect(result.items).toHaveLength(0);
    });

    it('should handle empty XML', async () => {
      const result = await engine.ingestFromFile('<root></root>', 'xml');
      expect(result.items).toHaveLength(0);
    });

    it('should handle CSV with only whitespace rows', async () => {
      const csv = 'sourcePath\n   \n   \n';
      const result = await engine.ingestFromFile(csv, 'csv');
      expect(result.items).toHaveLength(0);
    });

    it('should handle JSON with empty wrapper', async () => {
      const json = JSON.stringify({ items: [] });
      const result = await engine.ingestFromFile(json, 'json');
      expect(result.items).toHaveLength(0);
    });

    it('should handle large CSV with 500 rows', async () => {
      const header = 'sourcePath,name,type';
      const rows = Array.from({ length: 500 }, (_, i) =>
        `/content/page${i},Page ${i},page`,
      );
      const csv = [header, ...rows].join('\n');
      const result = await engine.ingestFromFile(csv, 'csv');

      expect(result.items).toHaveLength(500);
    });

    it('should handle CSV with special characters in values', async () => {
      const csv = 'sourcePath,name\n/content/page,"Name with ""quotes"" and, commas"';
      const result = await engine.ingestFromFile(csv, 'csv');

      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe('Name with "quotes" and, commas');
    });

    it('should handle XML with whitespace in paths', async () => {
      const xml = '<items><item><sourcePath>  /content/page  </sourcePath></item></items>';
      const result = await engine.ingestFromFile(xml, 'xml');

      // The XML parser trims, then sanitize trims again
      expect(result.items).toHaveLength(1);
      expect(result.items[0].sourcePath).toBe('/content/page');
    });
  });
});
