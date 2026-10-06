const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
const absolute = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 60 * 60 * 24 * 365],
  ['month', 60 * 60 * 24 * 30],
  ['week', 60 * 60 * 24 * 7],
  ['day', 60 * 60 * 24],
  ['hour', 60 * 60],
  ['minute', 60],
]

/** "just now", "5 minutes ago", "yesterday", … */
export function timeAgo(iso: string, now = Date.now()): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000)
  if (Math.abs(seconds) < 45) return 'just now'
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit)
  }
  return relative.format(Math.round(seconds / 60), 'minute')
}

/** "Oct 1, 2026, 9:42 AM" in the viewer's locale. */
export function exactTime(iso: string): string {
  return absolute.format(new Date(iso))
}

const STEP_PREFIX = /^\s*(?:\d+[.)]|[-*•])\s+/

/** Execution steps are stored as one string, one step per line. */
export function parseSteps(steps: string | null | undefined): string[] {
  if (!steps) return []
  return steps
    .split(/\r?\n/)
    .map((line) => line.replace(STEP_PREFIX, '').trim())
    .filter(Boolean)
}

export function joinSteps(steps: string): string {
  return parseSteps(steps).join('\n')
}

const REASONS: Record<number, string> = {
  200: 'OK',
  201: 'Created',
  202: 'Accepted',
  204: 'No Content',
  301: 'Moved Permanently',
  302: 'Found',
  304: 'Not Modified',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  409: 'Conflict',
  410: 'Gone',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
}

export function httpReason(code: number): string {
  return REASONS[code] ?? ''
}

export type HttpClass = 'success' | 'redirect' | 'client' | 'server' | 'other'

export function httpClass(code: number): HttpClass {
  if (code >= 200 && code < 300) return 'success'
  if (code >= 300 && code < 400) return 'redirect'
  if (code >= 400 && code < 500) return 'client'
  if (code >= 500 && code < 600) return 'server'
  return 'other'
}

export const COMMON_STATUS_CODES = [200, 201, 204, 400, 401, 403, 404, 422, 500]
