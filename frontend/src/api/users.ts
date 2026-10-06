import { useQuery } from '@tanstack/react-query'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { api } from '@/lib/api'
import type { UserSearchResponse } from '@/lib/types'

/** Strips a leading "@" so "@ada" and "ada" search the same. */
function normalise(query: string) {
  return query.trim().replace(/^@/, '').trim()
}

/** Case-insensitive username search (GET /access/search-users), at most 5 matches. */
export function useUserSearch(query: string) {
  const current = normalise(query)
  const q = useDebouncedValue(current, 250)
  const result = useQuery({
    queryKey: ['user-search', q.toLowerCase()],
    queryFn: ({ signal }) =>
      api<UserSearchResponse>(`/access/search-users?query=${encodeURIComponent(q)}`, { signal }),
    // The backend returns `null` instead of an empty list when nothing matches.
    select: (data) => data.results ?? [],
    enabled: q.length > 0,
    staleTime: 30_000,
    placeholderData: (previous) => previous,
  })
  // True while typing hasn't settled yet, so the UI doesn't flash "no matches".
  return { ...result, isSettling: current !== q || result.isFetching }
}
