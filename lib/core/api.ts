// CANONICAL: client-side API helper for FamComply dashboard pages.
// Every page talks to /api/* through this one wrapper, so the response envelope
// { data, error, code, status, meta } is parsed in exactly one place.

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

export class ApiError extends Error {
  readonly code: string
  readonly status: number

  constructor(message: string, code: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

interface Envelope<T> {
  data: T | null
  error: string | null
  code?: string
  status?: number
  meta?: PaginationMeta
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit
): Promise<{ data: T; meta?: PaginationMeta }> {
  let response: Response
  try {
    response = await fetch(path, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    })
  } catch {
    throw new ApiError(
      'We could not reach FamComply. Check your connection and try again.',
      'NETWORK_ERROR',
      0
    )
  }

  let body: Envelope<T> | null = null
  try {
    body = (await response.json()) as Envelope<T>
  } catch {
    body = null
  }

  if (!response.ok || body === null || body.error) {
    const message = body?.error ?? 'Our side hit a snag just now. Please try again in a moment.'
    const code = body?.code ?? 'UNKNOWN_ERROR'
    throw new ApiError(message, code, response.status)
  }

  return { data: body.data as T, meta: body.meta }
}

export function friendlyError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message
  }
  return 'Our side hit a snag just now. Please try again in a moment.'
}

export function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401
}
