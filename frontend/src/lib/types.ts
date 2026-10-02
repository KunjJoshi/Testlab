/** Shapes returned by testlab-backend. Field names mirror the Go JSON tags. */

export type AccessScope = 'read' | 'write' | 'admin'

/** What the current user may do in a suite: `owner` for suites they created. */
export type SuiteRole = 'owner' | AccessScope

export type TestStatus = 'untested' | 'in_progress' | 'passed' | 'failed'

export interface Me {
  user_id: number
  username: string
  email: string
  avatar_url: string
  created_at: string
}

export interface Suite {
  suite_id: number
  suite_name: string
  suite_description: string
  owner_id: number
  ownership_type: string
  created_at: string
  updated_at: string
}

export interface SharedSuite extends Suite {
  owner_username: string
  access_scope: AccessScope
}

export interface ListSuitesResponse {
  OwnedSuites: Suite[]
  SharedSuites: SharedSuite[]
}

export interface SuiteInput {
  suite_name: string
  suite_description: string
}

export interface TestRow {
  test_row_id: number
  test_name: string
  parent_suite: number
  test_description: string
  execution_steps: string
  expected_output: string
  expected_response_status: number
  status: TestStatus
  created_at: string
  updated_at: string
}

export interface ListTestRowsResponse {
  tests: TestRow[]
}

/** Body of POST /tests/write-test. */
export interface CreateTestInput {
  test_name: string
  parent_suite: number
  test_description: string
  execution_steps: string
  expected_output: string
  expected_response_status: number
}

/** Body of PATCH /tests/{row_id}; omitted fields are left unchanged. */
export type UpdateTestInput = Partial<
  Omit<CreateTestInput, 'parent_suite'> & { status: TestStatus }
>

/** One entry of `test_rows` in POST /tests/import-bulk. */
export type BulkTestRow = Omit<CreateTestInput, 'parent_suite'>

/** Body of POST /tests/import-bulk. */
export interface BulkImportRequest {
  parent_suite_id: number
  test_rows: BulkTestRow[]
}

export interface Collaborator {
  sharing_id: number
  user_id: number
  provider_id: number
  suite_id: number
  access_scope: AccessScope
  username: string
  avatar_url: string
  created_at: string
  updated_at: string
}

export interface ListCollaboratorsResponse {
  Users: Collaborator[]
}

/** One match from GET /access/search-users. */
export interface UserSearchResult {
  user_id: number
  username: string
  avatar_url: string
  github_user_id: string
}

export interface UserSearchResponse {
  results: UserSearchResult[] | null
}
