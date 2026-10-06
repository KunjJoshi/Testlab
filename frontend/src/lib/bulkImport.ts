import type { BulkImportRequest, BulkTestRow } from './types'

/*
 * The import file is a JSON array of tests. Each entry is one element of
 * `test_rows` in POST /tests/import-bulk (BulkTestRowsImportRequest in
 * testlab-backend/internal/handlers/test_rows.go); the app supplies
 * `parent_suite_id` from the suite that is open. Go's decoder rejects the whole
 * request on a single type mismatch, so every field is checked here first and
 * reported with its location.
 */

export const MAX_IMPORT_BYTES = 2 * 1024 * 1024

const ROW_FIELDS: { key: keyof BulkTestRow; type: 'string' | 'integer'; required: boolean }[] = [
  { key: 'test_name', type: 'string', required: true },
  { key: 'test_description', type: 'string', required: false },
  { key: 'execution_steps', type: 'string', required: false },
  { key: 'expected_output', type: 'string', required: false },
  { key: 'expected_response_status', type: 'integer', required: true },
]

export const BULK_TEMPLATE: BulkTestRow[] = [
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
]

export interface ParsedImport {
  request: BulkImportRequest
  warnings: string[]
}

export type ImportResult = { ok: true; value: ParsedImport } | { ok: false; errors: string[] }

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

export function parseBulkImport(text: string, suiteId: number): ImportResult {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch (e) {
    return { ok: false, errors: [`Not valid JSON: ${(e as Error).message}`] }
  }

  if (!Array.isArray(data)) {
    const hint =
      isRecord(data) && Array.isArray(data.test_rows)
        ? ' It looks like the tests are wrapped in an object — keep just the array that "test_rows" holds.'
        : ''
    return {
      ok: false,
      errors: [`The file must be a JSON array of tests: [ { … }, { … } ].${hint}`],
    }
  }
  if (data.length === 0) {
    return { ok: false, errors: ['The array is empty — add at least one test.'] }
  }

  const errors: string[] = []
  const warnings: string[] = []
  const testRows: BulkTestRow[] = []

  data.forEach((row: unknown, index) => {
    const where = `Test ${index + 1}`
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
      if (key === 'parent_suite' || key === 'parent_suite_id') {
        warnings.push(`${where}${label}: "${key}" is ignored — tests go into the open suite.`)
      } else if (!ROW_FIELDS.some((f) => f.key === key)) {
        warnings.push(`${where}${label}: unknown field "${key}" will be ignored.`)
      }
    }

    testRows.push(out as unknown as BulkTestRow)
  })

  if (errors.length) return { ok: false, errors }

  return {
    ok: true,
    value: { request: { parent_suite_id: suiteId, test_rows: testRows }, warnings },
  }
}
