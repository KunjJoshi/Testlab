import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { AccessScope, Collaborator, ListCollaboratorsResponse } from '@/lib/types'

export const accessKey = (suiteId: number) => ['access', suiteId] as const

export function useCollaborators(suiteId: number, enabled = true) {
  return useQuery({
    queryKey: accessKey(suiteId),
    queryFn: ({ signal }) =>
      api<ListCollaboratorsResponse>(`/access/list-users/${suiteId}`, { signal }),
    select: (data) => data.Users ?? [],
    enabled,
  })
}

interface AccessChange {
  userId: number
  scope: AccessScope
}

export function useShareSuite(suiteId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, scope }: AccessChange) =>
      api<Collaborator>('/access/provide', {
        method: 'POST',
        body: { user_id: userId, suite_id: suiteId, access_scope: scope },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: accessKey(suiteId) }),
  })
}

export function useUpdateAccess(suiteId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, scope }: AccessChange) =>
      api<Collaborator>('/access/update-access', {
        method: 'PATCH',
        body: { user_id: userId, suite_id: suiteId, access_scope: scope },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: accessKey(suiteId) }),
  })
}

export function useRemoveAccess(suiteId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (userId: number) =>
      api('/access/remove-user', {
        method: 'DELETE',
        body: { user_id: userId, suite_id: suiteId },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: accessKey(suiteId) }),
  })
}
