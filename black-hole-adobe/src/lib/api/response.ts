/**
 * API Response Helpers
 *
 * Standardised response builders for all API routes.
 * Every response conforms to ApiResponse<T> or PaginatedResponse<T>.
 */

import { v4 as uuidv4 } from 'uuid';
import type { ApiResponse, PaginatedResponse } from '@/types';

/** Build a successful JSON response. */
export function success<T>(data: T, status = 200): Response {
  const body: ApiResponse<T> = {
    success: true,
    data,
    error: null,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: uuidv4(),
    },
  };
  return Response.json(body, { status });
}

/** Build an error JSON response. */
export function error(
  code: string,
  message: string,
  status = 400,
  details: Record<string, unknown> | null = null,
): Response {
  const body: ApiResponse<null> = {
    success: false,
    data: null,
    error: { code, message, details },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: uuidv4(),
    },
  };
  return Response.json(body, { status });
}

/** Build a paginated JSON response. */
export function paginated<T>(
  data: T[],
  page: number,
  pageSize: number,
  totalItems: number,
): Response {
  const totalPages = Math.ceil(totalItems / pageSize);
  const body: PaginatedResponse<T> = {
    success: true,
    data,
    error: null,
    meta: {
      timestamp: new Date().toISOString(),
      requestId: uuidv4(),
    },
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages,
    },
  };
  return Response.json(body, { status: 200 });
}
