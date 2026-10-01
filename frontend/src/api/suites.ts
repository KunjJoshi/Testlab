import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { ListSuitesResponse, Suite, SuiteInput, SuiteRole } from '@/lib/types'

export const suitesKey = ['suites'] as const

export function useSuites() {
  return useQuery({
    queryKey: suitesKey,
    queryFn: ({ signal }) => api<ListSuitesResponse>('/suites', { signal }),
    select: (data) => ({
      owned: sortByUpdated(data.OwnedSuites ?? []),
      shared: sortByUpdated(data.SharedSuites ?? []),
    }),
  })
}

/** A suite plus the current user's role in it, resolved from the suites list. */
export function useSuite(suiteId: number) {
  const query = useSuites()
  const owned = query.data?.owned.find((s) => s.suite_id === suiteId)
  const shared = query.data?.shared.find((s) => s.suite_id === suiteId)
  const suite = owned ?? shared
  const role: SuiteRole | undefined = owned ? 'owner' : shared?.access_scope
  return { ...query, suite, role, sharedBy: shared?.owner_username }
}

export function useCreateSuite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: SuiteInput) => api<Suite>('/suites', { method: 'POST', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: suitesKey }),
  })
}

export function useUpdateSuite(suiteId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: Partial<SuiteInput>) =>
      api<Suite>(`/suites/${suiteId}`, { method: 'PATCH', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: suitesKey }),
  })
}

export function useDeleteSuite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (suiteId: number) => api(`/suites/${suiteId}`, { method: 'DELETE' }),
    onSuccess: (_data, suiteId) => {
      qc.removeQueries({ queryKey: ['tests', suiteId] })
      return qc.invalidateQueries({ queryKey: suitesKey })
    },
  })
}

function sortByUpdated<T extends Suite>(suites: T[]): T[] {
  return [...suites].sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))
}
