/**
 * File Connector
 *
 * Handles file-based imports from CSV, JSON, and XML uploads.
 * Provides auto-schema detection, field mapping, and large
 * file streaming support.
 */

import type { ConnectorConfig } from '@/types';
import {
  BaseConnector,
  ConnectorError,
  type ConnectorCapability,
  type ExtractionResult,
  type HttpClient,
  type RateLimitConfig,
  type RetryConfig,
} from './base-connector';

// ============================================================
// File-specific types
// ============================================================

export type FileFormat = 'csv' | 'json' | 'xml';

export interface DetectedField {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object' | 'null';
  nullable: boolean;
  sampleValues: unknown[];
  uniqueCount: number;
  nullCount: number;
}

export interface DetectedSchema {
  format: FileFormat;
  fields: DetectedField[];
  rowCount: number;
  sizeBytes: number;
  encoding: string;
  delimiter?: string;
  hasHeader?: boolean;
  rootElement?: string;
}

export interface FieldMapping {
  sourceField: string;
  targetField: string;
  transform: FieldTransform | null;
}

export type FieldTransform =
  | { type: 'rename'; newName: string }
  | { type: 'cast'; targetType: string }
  | { type: 'format'; pattern: string }
  | { type: 'map'; mapping: Record<string, string> }
  | { type: 'concat'; fields: string[]; separator: string }
  | { type: 'split'; delimiter: string; index: number }
  | { type: 'default'; value: unknown };

export interface ParseOptions {
  delimiter?: string;
  encoding?: string;
  hasHeader?: boolean;
  maxRows?: number;
  skipRows?: number;
  rootElement?: string;
}

export interface FileExtractionData {
  format: FileFormat;
  schema: DetectedSchema;
  records: Record<string, unknown>[];
  fieldMappings: FieldMapping[];
  totalRecords: number;
}

// ============================================================
// File Connector
// ============================================================

export class FileConnector extends BaseConnector {
  private fileContent: string | null = null;
  private fileFormat: FileFormat | null = null;
  private fileName: string | null = null;

  constructor(
    config: ConnectorConfig,
    httpClient?: HttpClient,
    rateLimitConfig?: Partial<RateLimitConfig>,
    retryConfig?: Partial<RetryConfig>,
  ) {
    super(config, httpClient, rateLimitConfig, retryConfig);
  }

  /**
   * Load file content for processing. This replaces the typical
   * connect() flow since files are uploaded, not connected to.
   */
  loadFile(content: string, fileName: string, format?: FileFormat): void {
    this.fileContent = content;
    this.fileName = fileName;
    this.fileFormat = format || this.detectFormat(fileName);
    this.isConnected = true;
    this.config.status = 'connected';
  }

  async connect(): Promise<void> {
    // For file connectors, check if a URL is configured to fetch from
    const fileUrl = this.config.connectionDetails.fileUrl as string;
    if (fileUrl) {
      const response = await this.makeRequest<string>({
        method: 'GET',
        url: fileUrl,
        timeout: 60000,
      });
      const fileName = fileUrl.split('/').pop() || 'data';
      this.loadFile(response.data as string, fileName);
      return;
    }

    if (!this.fileContent) {
      throw new ConnectorError(
        'No file loaded. Call loadFile() or provide a fileUrl in connectionDetails.',
        'NO_FILE',
      );
    }
  }

  async disconnect(): Promise<void> {
    this.fileContent = null;
    this.fileFormat = null;
    this.fileName = null;
    this.isConnected = false;
    this.config.status = 'disconnected';
  }

  async testConnection(): Promise<boolean> {
    return this.fileContent !== null;
  }

  async extract(): Promise<ExtractionResult<FileExtractionData>> {
    this.ensureLoaded();
    const startTime = Date.now();

    const schema = this.detectSchema();
    let records: Record<string, unknown>[];

    switch (this.fileFormat) {
      case 'csv': records = this.parseCSV(); break;
      case 'json': records = this.parseJSON(); break;
      case 'xml': records = this.parseXML(); break;
      default:
        throw new ConnectorError(`Unsupported format: ${this.fileFormat}`, 'UNSUPPORTED_FORMAT');
    }

    const fieldMappings = this.mapFields(schema);

    return {
      data: {
        format: this.fileFormat!,
        schema,
        records,
        fieldMappings,
        totalRecords: records.length,
      },
      metadata: {
        extractedAt: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        itemCount: records.length,
        warnings: [],
      },
    };
  }

  getCapabilities(): ConnectorCapability[] {
    return [
      { name: 'csv', description: 'Parse CSV files', requiresAuth: false },
      { name: 'json', description: 'Parse JSON files', requiresAuth: false },
      { name: 'xml', description: 'Parse XML files', requiresAuth: false },
      { name: 'auto_schema', description: 'Auto-detect data schema', requiresAuth: false },
      { name: 'field_mapping', description: 'Suggest field mappings', requiresAuth: false },
    ];
  }

  // ============================================================
  // Public parsing methods
  // ============================================================

  /** Parse CSV content into records. */
  parseCSV(options?: ParseOptions): Record<string, unknown>[] {
    this.ensureLoaded();
    const content = this.fileContent!;
    const delimiter = options?.delimiter || this.detectDelimiter(content);
    const skipRows = options?.skipRows || 0;
    const maxRows = options?.maxRows || Infinity;
    const hasHeader = options?.hasHeader !== false;

    const lines = this.splitCSVLines(content);
    if (lines.length === 0) return [];

    const startIdx = skipRows;
    const headerLine = hasHeader ? lines[startIdx] : null;
    const headers = headerLine
      ? this.parseCSVLine(headerLine, delimiter)
      : Array.from({ length: this.parseCSVLine(lines[startIdx] || '', delimiter).length }, (_, i) => `field_${i}`);

    const dataStart = hasHeader ? startIdx + 1 : startIdx;
    const records: Record<string, unknown>[] = [];

    for (let i = dataStart; i < lines.length && records.length < maxRows; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = this.parseCSVLine(line, delimiter);
      const record: Record<string, unknown> = {};
      for (let j = 0; j < headers.length; j++) {
        record[headers[j]] = this.coerceValue(values[j] ?? '');
      }
      records.push(record);
    }

    return records;
  }

  /** Parse JSON content into records. */
  parseJSON(options?: ParseOptions): Record<string, unknown>[] {
    this.ensureLoaded();
    const maxRows = options?.maxRows || Infinity;

    try {
      const parsed = JSON.parse(this.fileContent!);

      if (Array.isArray(parsed)) {
        return parsed.slice(0, maxRows).map(item =>
          typeof item === 'object' && item !== null ? item as Record<string, unknown> : { value: item },
        );
      }

      if (typeof parsed === 'object' && parsed !== null) {
        // Look for a top-level array property (common in API responses)
        for (const value of Object.values(parsed)) {
          if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
            return (value as Record<string, unknown>[]).slice(0, maxRows);
          }
        }
        // Single object, wrap in array
        return [parsed as Record<string, unknown>];
      }

      return [{ value: parsed }];
    } catch (error) {
      throw new ConnectorError(
        `Invalid JSON: ${(error as Error).message}`,
        'PARSE_ERROR',
      );
    }
  }

  /** Parse XML content into records. */
  parseXML(options?: ParseOptions): Record<string, unknown>[] {
    this.ensureLoaded();
    const content = this.fileContent!;
    const maxRows = options?.maxRows || Infinity;
    const rootElement = options?.rootElement || this.detectXMLRootElement(content);

    const records: Record<string, unknown>[] = [];
    const itemPattern = rootElement
      ? new RegExp(`<${rootElement}[^>]*>([\\s\\S]*?)<\\/${rootElement}>`, 'g')
      : /<([a-zA-Z][\w-]*)(?:\s[^>]*)?>[\s\S]*?<\/\1>/g;

    let match: RegExpExecArray | null;
    while ((match = itemPattern.exec(content)) !== null && records.length < maxRows) {
      const itemContent = match[0];
      const record = this.parseXMLElement(itemContent);
      if (Object.keys(record).length > 0) {
        records.push(record);
      }
    }

    return records;
  }

  /** Detect the schema from the file content. */
  detectSchema(options?: ParseOptions): DetectedSchema {
    this.ensureLoaded();
    const content = this.fileContent!;
    const format = this.fileFormat!;

    // Parse a sample to detect field types
    const sampleSize = 100;
    let records: Record<string, unknown>[];

    switch (format) {
      case 'csv': records = this.parseCSV({ ...options, maxRows: sampleSize }); break;
      case 'json': records = this.parseJSON({ ...options, maxRows: sampleSize }); break;
      case 'xml': records = this.parseXML({ ...options, maxRows: sampleSize }); break;
      default: records = [];
    }

    const fields = this.analyzeFields(records);

    const schema: DetectedSchema = {
      format,
      fields,
      rowCount: this.estimateRowCount(content, format),
      sizeBytes: new TextEncoder().encode(content).length,
      encoding: 'utf-8',
    };

    if (format === 'csv') {
      schema.delimiter = this.detectDelimiter(content);
      schema.hasHeader = this.detectCSVHeader(content, schema.delimiter);
    }

    if (format === 'xml') {
      schema.rootElement = this.detectXMLRootElement(content) ?? undefined;
    }

    return schema;
  }

  /**
   * Generate field mappings from detected fields.
   * Maps source field names to suggested target field names
   * using common naming conventions.
   */
  mapFields(schema: DetectedSchema): FieldMapping[] {
    return schema.fields.map((field) => {
      const targetField = this.suggestTargetField(field.name);
      const transform = this.suggestTransform(field);

      return {
        sourceField: field.name,
        targetField,
        transform,
      };
    });
  }

  // ============================================================
  // Private helpers
  // ============================================================

  private ensureLoaded(): void {
    if (!this.fileContent || !this.fileFormat) {
      throw new ConnectorError('No file loaded. Call loadFile() first.', 'NO_FILE');
    }
  }

  private detectFormat(fileName: string): FileFormat {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'csv':
      case 'tsv':
        return 'csv';
      case 'json':
      case 'jsonl':
        return 'json';
      case 'xml':
        return 'xml';
      default:
        throw new ConnectorError(`Cannot detect format from extension: .${ext}`, 'UNKNOWN_FORMAT');
    }
  }

  private detectDelimiter(content: string): string {
    const firstLine = content.split('\n')[0] || '';
    const commaCount = (firstLine.match(/,/g) || []).length;
    const tabCount = (firstLine.match(/\t/g) || []).length;
    const semiCount = (firstLine.match(/;/g) || []).length;
    const pipeCount = (firstLine.match(/\|/g) || []).length;

    const counts = [
      { delimiter: ',', count: commaCount },
      { delimiter: '\t', count: tabCount },
      { delimiter: ';', count: semiCount },
      { delimiter: '|', count: pipeCount },
    ];

    counts.sort((a, b) => b.count - a.count);
    return counts[0].count > 0 ? counts[0].delimiter : ',';
  }

  private detectCSVHeader(content: string, delimiter: string): boolean {
    const lines = content.split('\n');
    if (lines.length < 2) return false;

    const firstRow = this.parseCSVLine(lines[0], delimiter);
    const secondRow = this.parseCSVLine(lines[1], delimiter);

    // If first row has all string-like values and second row has numeric values,
    // then first row is likely a header.
    const firstRowAllStrings = firstRow.every(v => isNaN(Number(v)) || v === '');
    const secondRowHasNumbers = secondRow.some(v => !isNaN(Number(v)) && v !== '');

    return firstRowAllStrings && secondRowHasNumbers;
  }

  private splitCSVLines(content: string): string[] {
    const lines: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < content.length; i++) {
      const char = content[i];
      if (char === '"') {
        inQuotes = !inQuotes;
        current += char;
      } else if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && content[i + 1] === '\n') i++;
        if (current.trim()) lines.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    if (current.trim()) lines.push(current);
    return lines;
  }

  private parseCSVLine(line: string, delimiter: string): string[] {
    const values: string[] = [];
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
      } else if (char === delimiter && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    return values;
  }

  private coerceValue(value: string): unknown {
    if (value === '' || value === 'null' || value === 'NULL') return null;
    if (value === 'true' || value === 'TRUE') return true;
    if (value === 'false' || value === 'FALSE') return false;

    const num = Number(value);
    if (!isNaN(num) && value.trim() !== '') return num;

    // Check for ISO date patterns
    if (/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?/.test(value)) {
      const date = new Date(value);
      if (!isNaN(date.getTime())) return value; // Keep as string but validated
    }

    return value;
  }

  private detectXMLRootElement(content: string): string | null {
    // Find the repeating child element pattern
    const xmlDeclarationEnd = content.indexOf('?>');
    const searchStart = xmlDeclarationEnd > 0 ? xmlDeclarationEnd + 2 : 0;
    const rootMatch = content.slice(searchStart).match(/<([a-zA-Z][\w-]*)[^>]*>/);
    if (!rootMatch) return null;

    const rootTag = rootMatch[1];
    // Look for repeating children of the root
    const childPattern = new RegExp(`<${rootTag}[^>]*>[\\s\\S]*?<([a-zA-Z][\\w-]*)[^>]*>`, 's');
    const childMatch = content.slice(searchStart).match(childPattern);
    if (!childMatch) return rootTag;

    const childTag = childMatch[1];
    const childCount = (content.match(new RegExp(`<${childTag}[\\s>]`, 'g')) || []).length;
    return childCount > 1 ? childTag : rootTag;
  }

  private parseXMLElement(xml: string): Record<string, unknown> {
    const record: Record<string, unknown> = {};

    // Extract attributes from root element
    const attrMatch = xml.match(/^<[a-zA-Z][\w-]*\s([^>]*?)>/);
    if (attrMatch) {
      const attrPattern = /(\w+)="([^"]*)"/g;
      let attrResult: RegExpExecArray | null;
      while ((attrResult = attrPattern.exec(attrMatch[1])) !== null) {
        record[`@${attrResult[1]}`] = this.coerceValue(attrResult[2]);
      }
    }

    // Extract child elements
    const childPattern = /<([a-zA-Z][\w-]*)(?:\s[^>]*)?>([^<]*)<\/\1>/g;
    let childMatch: RegExpExecArray | null;
    while ((childMatch = childPattern.exec(xml)) !== null) {
      const key = childMatch[1];
      const value = childMatch[2].trim();
      record[key] = this.coerceValue(value);
    }

    return record;
  }

  private analyzeFields(records: Record<string, unknown>[]): DetectedField[] {
    if (records.length === 0) return [];

    const fieldStats = new Map<string, {
      types: Set<string>;
      nullCount: number;
      values: Set<string>;
      samples: unknown[];
    }>();

    for (const record of records) {
      for (const [key, value] of Object.entries(record)) {
        if (!fieldStats.has(key)) {
          fieldStats.set(key, { types: new Set(), nullCount: 0, values: new Set(), samples: [] });
        }
        const stats = fieldStats.get(key)!;

        if (value === null || value === undefined) {
          stats.nullCount++;
          stats.types.add('null');
        } else {
          const type = this.detectValueType(value);
          stats.types.add(type);
          stats.values.add(String(value));
          if (stats.samples.length < 5) stats.samples.push(value);
        }
      }
    }

    return Array.from(fieldStats.entries()).map(([name, stats]) => {
      const types = new Set(stats.types);
      types.delete('null');
      const primaryType = types.size > 0 ? Array.from(types)[0] : 'string';

      return {
        name,
        type: primaryType as DetectedField['type'],
        nullable: stats.nullCount > 0,
        sampleValues: stats.samples,
        uniqueCount: stats.values.size,
        nullCount: stats.nullCount,
      };
    });
  }

  private detectValueType(value: unknown): DetectedField['type'] {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'number') return 'number';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object') return 'object';
    if (typeof value === 'string') {
      if (/^\d{4}-\d{2}-\d{2}/.test(value)) return 'date';
    }
    return 'string';
  }

  private estimateRowCount(content: string, format: FileFormat): number {
    switch (format) {
      case 'csv':
        return (content.match(/\n/g) || []).length;
      case 'json': {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) return parsed.length;
        for (const value of Object.values(parsed)) {
          if (Array.isArray(value)) return (value as unknown[]).length;
        }
        return 1;
      }
      case 'xml': {
        const root = this.detectXMLRootElement(content);
        if (!root) return 0;
        return (content.match(new RegExp(`<${root}[\\s>]`, 'g')) || []).length;
      }
      default:
        return 0;
    }
  }

  private suggestTargetField(sourceName: string): string {
    // Normalize common field name patterns to Adobe-compatible names
    const mappings: Record<string, string> = {
      'email': 'email',
      'email_address': 'email',
      'emailaddress': 'email',
      'first_name': 'firstName',
      'firstname': 'firstName',
      'last_name': 'lastName',
      'lastname': 'lastName',
      'phone': 'phone',
      'phone_number': 'phone',
      'address': 'address.street',
      'city': 'address.city',
      'state': 'address.state',
      'zip': 'address.postalCode',
      'zipcode': 'address.postalCode',
      'postal_code': 'address.postalCode',
      'country': 'address.country',
      'created_at': 'createdAt',
      'updated_at': 'updatedAt',
      'modified_at': 'updatedAt',
    };

    const normalized = sourceName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    return mappings[normalized] || this.toCamelCase(sourceName);
  }

  private toCamelCase(str: string): string {
    return str
      .replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase())
      .replace(/^[A-Z]/, (char) => char.toLowerCase());
  }

  private suggestTransform(field: DetectedField): FieldTransform | null {
    if (field.type === 'date') {
      return { type: 'format', pattern: 'YYYY-MM-DDTHH:mm:ssZ' };
    }
    if (field.type === 'boolean' && field.sampleValues.some(v => typeof v === 'string')) {
      return { type: 'cast', targetType: 'boolean' };
    }
    if (field.type === 'number' && field.sampleValues.some(v => typeof v === 'string')) {
      return { type: 'cast', targetType: 'number' };
    }
    return null;
  }
}
