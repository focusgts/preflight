/**
 * POST /api/upload
 *
 * Accepts multipart/form-data file uploads.
 * Validates type (CSV, JSON, XML) and size (100MB max).
 * Returns file metadata with a parsed preview of the first 5 rows.
 */

import { type NextRequest } from 'next/server';
import { saveUploadedFile, FileUploadError } from '@/lib/upload/file-handler';
import { success, error } from '@/lib/api/response';

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') ?? '';

    if (!contentType.includes('multipart/form-data')) {
      return error(
        'INVALID_CONTENT_TYPE',
        'Expected multipart/form-data',
        400,
      );
    }

    const formData = await request.formData();
    const files = formData.getAll('files');

    if (files.length === 0) {
      return error('NO_FILES', 'No files provided in the "files" field', 400);
    }

    const results = [];

    for (const entry of files) {
      if (!(entry instanceof File)) {
        continue;
      }

      const metadata = await saveUploadedFile(entry);
      results.push(metadata);
    }

    if (results.length === 0) {
      return error('NO_VALID_FILES', 'No valid files found in the upload', 400);
    }

    console.log(`[API] POST /api/upload - ${results.length} file(s) saved`);
    return success(results, 201);
  } catch (err) {
    if (err instanceof FileUploadError) {
      console.warn(`[API] Upload validation error: ${err.code} - ${err.message}`);
      return error(err.code, err.message, 400);
    }

    console.error('[API] POST /api/upload error:', err);
    return error('INTERNAL_ERROR', 'Failed to process file upload', 500);
  }
}
