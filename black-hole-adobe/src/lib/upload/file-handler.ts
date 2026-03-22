/**
 * File Upload Handler
 *
 * Utilities for saving, parsing, detecting, and cleaning up uploaded files.
 * Supports CSV, JSON, and XML formats with auto-detection.
 */

import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { join, extname } from 'path';
import { randomUUID } from 'crypto';

const UPLOAD_DIR = '/tmp/blackhole-uploads';

export type SupportedFormat = 'csv' | 'json' | 'xml';

export interface UploadedFileMetadata {
  id: string;
  originalName: string;
  storedName: string;
  path: string;
  size: number;
  mimeType: string;
  format: SupportedFormat;
  preview: string[][];
  rowCount: number;
  uploadedAt: string;
}

const ALLOWED_EXTENSIONS: Record<string, SupportedFormat> = {
  '.csv': 'csv',
  '.json': 'json',
  '.xml': 'xml',
};

const ALLOWED_MIME_TYPES = new Set([
  'text/csv',
  'application/json',
  'text/json',
  'application/xml',
  'text/xml',
  'application/octet-stream', // fallback for some browsers
]);

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

/**
 * Ensure the upload directory exists.
 */
export function getUploadDir(): string {
  if (!existsSync(UPLOAD_DIR)) {
    mkdirSync(UPLOAD_DIR, { recursive: true });
  }
  return UPLOAD_DIR;
}

/**
 * Validate the uploaded file before saving.
 */
function validateFile(name: string, size: number, mimeType: string): SupportedFormat {
  if (size > MAX_FILE_SIZE) {
    throw new FileUploadError(
      'FILE_TOO_LARGE',
      `File exceeds maximum size of ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
    );
  }

  const ext = extname(name).toLowerCase();
  const format = ALLOWED_EXTENSIONS[ext];

  if (!format) {
    throw new FileUploadError(
      'INVALID_FORMAT',
      `Unsupported file type "${ext}". Accepted formats: CSV, JSON, XML`,
    );
  }

  // Allow application/octet-stream as a fallback when the browser doesn't
  // recognise the MIME type — we rely on extension validation above.
  if (!ALLOWED_MIME_TYPES.has(mimeType) && mimeType !== 'application/octet-stream') {
    throw new FileUploadError(
      'INVALID_MIME',
      `Unsupported MIME type "${mimeType}"`,
    );
  }

  return format;
}

/**
 * Save an uploaded file to the temp directory and return metadata with a preview.
 */
export async function saveUploadedFile(
  file: File,
): Promise<UploadedFileMetadata> {
  const format = validateFile(file.name, file.size, file.type);
  const dir = getUploadDir();

  const fileId = randomUUID().slice(0, 12);
  const ext = extname(file.name).toLowerCase();
  const storedName = `${fileId}${ext}`;
  const filePath = join(dir, storedName);

  const buffer = Buffer.from(await file.arrayBuffer());
  writeFileSync(filePath, buffer);

  const content = buffer.toString('utf-8');
  const preview = parseFilePreview(content, format);

  return {
    id: fileId,
    originalName: file.name,
    storedName,
    path: filePath,
    size: file.size,
    mimeType: file.type,
    format,
    preview: preview.rows,
    rowCount: preview.totalRows,
    uploadedAt: new Date().toISOString(),
  };
}

/**
 * Auto-detect format from file content when extension is ambiguous.
 */
export function detectFileFormat(content: string): SupportedFormat {
  const trimmed = content.trimStart();

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return 'json';
  }

  if (trimmed.startsWith('<?xml') || trimmed.startsWith('<')) {
    return 'xml';
  }

  return 'csv';
}

interface PreviewResult {
  rows: string[][];
  totalRows: number;
}

/**
 * Parse the first 5 rows of a file for preview display.
 */
export function parseFilePreview(
  content: string,
  format: SupportedFormat,
  maxRows = 5,
): PreviewResult {
  switch (format) {
    case 'csv':
      return parseCsvPreview(content, maxRows);
    case 'json':
      return parseJsonPreview(content, maxRows);
    case 'xml':
      return parseXmlPreview(content, maxRows);
  }
}

function parseCsvPreview(content: string, maxRows: number): PreviewResult {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const totalRows = Math.max(0, lines.length - 1); // exclude header

  const rows: string[][] = [];
  const limit = Math.min(lines.length, maxRows + 1); // +1 for header

  for (let i = 0; i < limit; i++) {
    rows.push(parseCsvLine(lines[i]));
  }

  return { rows, totalRows };
}

/**
 * Basic CSV line parser that handles quoted fields.
 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        fields.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
  }

  fields.push(current.trim());
  return fields;
}

function parseJsonPreview(content: string, maxRows: number): PreviewResult {
  try {
    const parsed = JSON.parse(content);
    const items = Array.isArray(parsed) ? parsed : parsed.data ?? parsed.items ?? [parsed];

    if (items.length === 0) {
      return { rows: [], totalRows: 0 };
    }

    const headers = Object.keys(items[0]);
    const rows: string[][] = [headers];

    const limit = Math.min(items.length, maxRows);
    for (let i = 0; i < limit; i++) {
      rows.push(headers.map((h) => String(items[i][h] ?? '')));
    }

    return { rows, totalRows: items.length };
  } catch {
    return { rows: [['Error: Invalid JSON']], totalRows: 0 };
  }
}

function parseXmlPreview(content: string, maxRows: number): PreviewResult {
  // Lightweight XML preview using regex — no external XML parser needed.
  // Extracts top-level repeating elements and their child text nodes.
  const rows: string[][] = [];

  // Find repeating child elements (e.g., <item>, <record>, <row>)
  const rootMatch = content.match(/<(\w+)[\s>]/);
  if (!rootMatch) {
    return { rows: [['Error: Could not parse XML']], totalRows: 0 };
  }

  // Find all second-level element groups
  const childTagMatch = content.match(/<\w+[^>]*>\s*<(\w+)[\s>]/);
  const childTag = childTagMatch?.[1];
  if (!childTag) {
    return { rows: [['(XML structure preview not available)']], totalRows: 0 };
  }

  const itemRegex = new RegExp(`<${childTag}[^>]*>([\\s\\S]*?)<\\/${childTag}>`, 'g');
  const items: Record<string, string>[] = [];
  let match;

  while ((match = itemRegex.exec(content)) !== null) {
    const inner = match[1];
    const fields: Record<string, string> = {};
    const fieldRegex = /<(\w+)>([^<]*)<\/\1>/g;
    let fieldMatch;

    while ((fieldMatch = fieldRegex.exec(inner)) !== null) {
      fields[fieldMatch[1]] = fieldMatch[2];
    }

    items.push(fields);
  }

  if (items.length === 0) {
    return { rows: [['(No repeating elements found)']], totalRows: 0 };
  }

  const headers = Object.keys(items[0]);
  rows.push(headers);

  const limit = Math.min(items.length, maxRows);
  for (let i = 0; i < limit; i++) {
    rows.push(headers.map((h) => items[i][h] ?? ''));
  }

  return { rows, totalRows: items.length };
}

/**
 * Delete a temporary uploaded file.
 */
export function cleanupFile(filePath: string): void {
  // Sanitize: only allow deletion within the upload directory
  const normalised = join(filePath);
  if (!normalised.startsWith(UPLOAD_DIR)) {
    throw new FileUploadError('INVALID_PATH', 'Cannot delete files outside upload directory');
  }

  if (existsSync(normalised)) {
    unlinkSync(normalised);
  }
}

/**
 * Read file contents from the upload directory.
 */
export function readUploadedFile(filePath: string): string {
  const normalised = join(filePath);
  if (!normalised.startsWith(UPLOAD_DIR)) {
    throw new FileUploadError('INVALID_PATH', 'Cannot read files outside upload directory');
  }

  return readFileSync(normalised, 'utf-8');
}

/**
 * Custom error class for file upload operations.
 */
export class FileUploadError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'FileUploadError';
  }
}
