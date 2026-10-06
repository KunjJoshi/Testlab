import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type {
  BulkImportRequest,
  CreateTestInput,
  ListTestRowsResponse,
  TestRow,
  UpdateTestInput,
} from '@/lib/types'
import { suitesKey } from './suites'

export const testsKey = (suiteId: number) => ['tests', suiteId] as const

export function useTests(suiteId: number) {
  return useQuery({
    queryKey: testsKey(suiteId),
    queryFn: ({ signal }) => api<ListTestRowsResponse>(`/tests/${suiteId}`, { signal }),
    // Most recently updated first.
    select: (data) =>
      [...(data.tests ?? [])].sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at)),
  })
}

export function useCreateTest(suiteId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: Omit<CreateTestInput, 'parent_suite'>) =>
      api<TestRow>('/tests/write-test', {
        method: 'POST',
        body: { ...input, parent_suite: suiteId },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: testsKey(suiteId) }),
  })
}

export function useBulkImport(suiteId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (request: BulkImportRequest) =>
      api<{ status: string; inserted: number }>('/tests/import-bulk', {
        method: 'POST',
        body: request,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: testsKey(suiteId) }),
  })
}

export function useUpdateTest(suiteId: number) {
  const qc = useQueryClient()
  const key = testsKey(suiteId)
  return useMutation({
    mutationFn: ({ rowId, input }: { rowId: number; input: UpdateTestInput }) =>
      api<TestRow>(`/tests/${rowId}`, { method: 'PATCH', body: input }),
    // Status flips feel instant; everything else is reconciled from the server.
    onMutate: async ({ rowId, input }) => {
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<ListTestRowsResponse>(key)
      if (previous) {
        qc.setQueryData<ListTestRowsResponse>(key, {
          tests: previous.tests.map((t) => (t.test_row_id === rowId ? { ...t, ...input } : t)),
        })
      }
      return { previous }
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) qc.setQueryData(key, context.previous)
    },
    onSuccess: (row) => {
      qc.setQueryData<ListTestRowsResponse>(key, (old) =>
        old ? { tests: old.tests.map((t) => (t.test_row_id === row.test_row_id ? row : t)) } : old,
      )
    },
    onSettled: () => qc.invalidateQueries({ queryKey: suitesKey }),
  })
}

export function useDeleteTest(suiteId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (rowId: number) => api(`/tests/${rowId}`, { method: 'DELETE' }),
    onSuccess: (_data, rowId) => {
      qc.setQueryData<ListTestRowsResponse>(testsKey(suiteId), (old) =>
        old ? { tests: old.tests.filter((t) => t.test_row_id !== rowId) } : old,
      )
    },
  })
}
