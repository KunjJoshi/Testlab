import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { sortByRank } from '@/lib/environment'
import type { Environment, ListEnvironmentsResponse, PromoteSuiteResponse } from '@/lib/types'
import { suitesKey } from './suites'
import { testsKey } from './tests'

export const environmentsKey = (userId: number) => ['environments', userId] as const

/**
 * A user's pipeline, in rank order. Readable for any user, so collaborators can
 * see the suite owner's environments before promoting.
 */
export function useEnvironments(userId: number | undefined) {
  return useQuery({
    queryKey: environmentsKey(userId ?? 0),
    queryFn: ({ signal }) => api<ListEnvironmentsResponse>(`/environments/${userId}`, { signal }),
    select: (data) => sortByRank(data.environments ?? []),
    enabled: userId !== undefined,
  })
}

export function useCreateEnvironment(userId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { slug: string; rank: number }) =>
      api<Environment>('/environments', { method: 'POST', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: environmentsKey(userId) }),
  })
}

export function useRenameEnvironment(userId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { environment_id: number; slug: string }) =>
      api<Environment>('/environments/rename', { method: 'PATCH', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: environmentsKey(userId) }),
  })
}

/** Commits a whole new order in one transactional call: all ranks change or none do. */
export function useReorderEnvironments(userId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ordered: Environment[]) =>
      api<{ success: boolean; updated_count: number }>('/environments/reorder', {
        method: 'PATCH',
        body: {
          environment_updates: ordered.map((env, i) => ({
            environment_id: env.environment_id,
            rank: i + 1,
          })),
        },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: environmentsKey(userId) }),
  })
}

export function useDeleteEnvironment(userId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (environmentId: number) =>
      api(`/environments/${environmentId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: environmentsKey(userId) }),
  })
}

/** Moves a suite to another stage of its owner's pipeline. Promotions reset results. */
export function usePromoteSuite(suiteId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (environmentId: number) =>
      api<PromoteSuiteResponse>(`/suites/promote-environment/${suiteId}`, {
        method: 'PATCH',
        body: { environment_id: environmentId },
      }),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: suitesKey }),
        qc.invalidateQueries({ queryKey: testsKey(suiteId) }),
      ]),
  })
}
