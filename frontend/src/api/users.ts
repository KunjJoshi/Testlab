import { useQuery } from '@tanstack/react-query'
import type { UserSearchResult } from '@/lib/types'

/*
 * MOCK — the user search API is not built yet. Swap the body of `searchUsers`
 * for `api<UserSearchResult[]>(`/users/search?q=${encodeURIComponent(query)}`)`
 * once it exists; nothing else needs to change.
 *
 * Search is by username only. User IDs are used internally to call the
 * sharing API but are never accepted as input or shown.
 */
const SAMPLE_USERS: UserSearchResult[] = [
  { user_id: 2, username: 'ada-lovelace' },
  { user_id: 3, username: 'grace-hopper' },
  { user_id: 4, username: 'linus-t' },
  { user_id: 5, username: 'margaret-h' },
  { user_id: 6, username: 'alan-turing' },
  { user_id: 7, username: 'katherine-j' },
].map((u) => ({ ...u, isSample: true }))

export async function searchUsers(query: string): Promise<UserSearchResult[]> {
  const q = query.trim().toLowerCase().replace(/^@/, '')
  if (!q) return []

  await new Promise((resolve) => setTimeout(resolve, 180))

  return SAMPLE_USERS.filter((user) => user.username.includes(q)).slice(0, 6)
}

export function useUserSearch(query: string) {
  return useQuery({
    queryKey: ['user-search', query.trim().toLowerCase()],
    queryFn: () => searchUsers(query),
    enabled: query.trim().length > 0,
    staleTime: 60_000,
    placeholderData: (previous) => previous,
  })
}
