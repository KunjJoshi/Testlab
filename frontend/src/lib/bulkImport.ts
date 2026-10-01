import type { BulkImportRequest, BulkTestRow } from './types'

/*
 * The file format is exactly the body of POST /tests/import-bulk
 * (BulkTestRowsImportRequest in testlab-backend/internal/handlers/test_rows.go).
 * Go's decoder rejects the whole request on a single type mismatch, so every
 * field is checked here first and reported with its location.
 */

export const MAX_IMPORT_BYTES = 2 * 1024 * 1024

const ROW_FIELDS: { key: keyof BulkTestRow; type: 'string' | 'integer'; required: boolean }[] = [
  { key: 'test_name', type: 'string', required: true },
  { key: 'test_description', type: 'string', required: false },
  { key: 'execution_steps', type: 'string', required: false },
  { key: 'expected_output', type: 'string', required: false },
  { key: 'expected_response_status', type: 'integer', required: true },
]

/** Accepted by the backend struct but ignored for bulk import. */
const IGNORED_ROW_FIELDS = new Set(['parent_suite'])

export function bulkTemplate(suiteId: number): BulkImportRequest {
  return {
    parent_suite_id: suiteId,
    test_rows: [
      {
        test_name: 'Login with valid credentials',
        test_description: 'A registered user can sign in and receives a session.',
        execution_steps:
          'Open /login\nEnter a valid email and password\nClick "Sign in"\nCheck the response',
        expected_output: '{"token": "<jwt>"}',
        expected_response_status: 200,
      },
      {
        test_name: 'Login with wrong password',
        test_description: 'Bad credentials are rejected without leaking which field was wrong.',
        execution_steps: 'Open /login\nEnter a valid email and a wrong password\nClick "Sign in"',
        expected_output: '{"error": "invalid credentials"}',
        expected_response_status: 401,
      },
    ],
  }
}

export interface ParsedImport {
  request: BulkImportRequest
  /** The suite id written in the file, if it differs from the open suite. */
  fileSuiteId: number | null
  warnings: string[]
}

export type ImportResult = { ok: true; value: ParsedImport } | { ok: false; errors: string[] }

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

export function parseBulkImport(text: string, currentSuiteId: number): ImportResult {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch (e) {
    return { ok: false, errors: [`Not valid JSON: ${(e as Error).message}`] }
  }

  if (!isRecord(data)) {
    return {
      ok: false,
      errors: ['The file must contain a JSON object with "parent_suite_id" and "test_rows".'],
    }
  }

  const errors: string[] = []
  const warnings: string[] = []

  const rawSuiteId = data.parent_suite_id
  let fileSuiteId: number | null = null
  if (rawSuiteId === undefined) {
    warnings.push(
      `"parent_suite_id" is missing — rows will be imported into suite #${currentSuiteId}.`,
    )
  } else if (!Number.isInteger(rawSuiteId)) {
    errors.push('"parent_suite_id" must be a whole number.')
  } else if (rawSuiteId !== currentSuiteId) {
    fileSuiteId = rawSuiteId as number
    warnings.push(
      `The file targets suite #${fileSuiteId}, but you are in suite #${currentSuiteId}. ` +
        `Rows will be imported into suite #${currentSuiteId}.`,
    )
  }

  const rows = data.test_rows
  if (!Array.isArray(rows)) {
    errors.push('"test_rows" must be an array of tests.')
    return { ok: false, errors }
  }
  if (rows.length === 0) {
    errors.push('"test_rows" is empty — add at least one test.')
  }

  for (const key of Object.keys(data)) {
    if (key !== 'parent_suite_id' && key !== 'test_rows') {
      warnings.push(`Unknown top-level field "${key}" will be ignored.`)
    }
  }

  const testRows: BulkTestRow[] = []
  rows.forEach((row: unknown, index) => {
    const where = `test_rows[${index}]`
    if (!isRecord(row)) {
      errors.push(`${where} must be an object.`)
      return
    }

    const label = typeof row.test_name === 'string' && row.test_name ? ` ("${row.test_name}")` : ''
    const out: Record<string, string | number> = {}

    for (const { key, type, required } of ROW_FIELDS) {
      const value = row[key]
      if (value === undefined || value === null) {
        if (required) errors.push(`${where}${label}: "${key}" is required.`)
        else out[key] = ''
        continue
      }
      if (type === 'string') {
        if (typeof value !== 'string') {
          errors.push(`${where}${label}: "${key}" must be a string.`)
        } else if (required && !value.trim()) {
          errors.push(`${where}${label}: "${key}" cannot be empty.`)
        } else {
          out[key] = value
        }
      } else if (!Number.isInteger(value) || (value as number) < 100 || (value as number) > 599) {
        errors.push(`${where}${label}: "${key}" must be an HTTP status code between 100 and 599.`)
      } else {
        out[key] = value as number
      }
    }

    for (const key of Object.keys(row)) {
      if (IGNORED_ROW_FIELDS.has(key)) continue
      if (!ROW_FIELDS.some((f) => f.key === key)) {
        warnings.push(`${where}${label}: unknown field "${key}" will be ignored.`)
      }
    }

    testRows.push(out as unknown as BulkTestRow)
  })

  if (errors.length) return { ok: false, errors }

  return {
    ok: true,
    value: {
      request: { parent_suite_id: currentSuiteId, test_rows: testRows },
      fileSuiteId,
      warnings,
    },
  }
}
