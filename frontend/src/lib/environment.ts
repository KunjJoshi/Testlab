import type { Environment } from './types'

/** Environments in pipeline order. Always sort by rank, never by id. */
export function sortByRank(envs: Environment[]): Environment[] {
  return [...envs].sort((a, b) => a.rank - b.rank || a.environment_id - b.environment_id)
}

/** Badge text: slugs are stored lowercase (`qa`) and displayed as labels (`QA`). */
export function envLabel(slug: string): string {
  return slug.toUpperCase()
}

/**
 * Dot colour by position in the pipeline: the first stage is green, the last is
 * red, with amber and orange in between. Four stages land exactly on the four
 * stops; longer pipelines blend between neighbouring stops. Position is
 * relative, so a custom stage slots into the scale automatically.
 */
const COLOR_STOPS: [h: number, s: number, l: number][] = [
  [142, 64, 38], // green
  [43, 92, 44], // amber
  [24, 88, 48], // orange
  [2, 70, 48], // red
]

export function envColor(index: number, total: number): string {
  const t = total <= 1 ? 0 : index / (total - 1)
  const pos = t * (COLOR_STOPS.length - 1)
  const i = Math.min(Math.floor(pos), COLOR_STOPS.length - 2)
  const f = pos - i
  const [h1, s1, l1] = COLOR_STOPS[i]!
  const [h2, s2, l2] = COLOR_STOPS[i + 1]!
  const mix = (a: number, b: number) => Math.round(a + (b - a) * f)
  return `hsl(${mix(h1, h2)} ${mix(s1, s2)}% ${mix(l1, l2)}%)`
}

export function envColorFor(env: Environment, pipeline: Environment[]): string {
  const sorted = sortByRank(pipeline)
  const index = sorted.findIndex((e) => e.environment_id === env.environment_id)
  return envColor(Math.max(index, 0), sorted.length)
}

export const SLUG_MAX = 24

/** Lowercase, trimmed, spaces → hyphens: `" User Acceptance "` → `user-acceptance`. */
export function normaliseSlug(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, '-')
}

/** Returns an error message, or null when the slug is acceptable. */
export function validateSlug(
  slug: string,
  existing: Environment[],
  ignoreId?: number,
): string | null {
  if (!slug) return 'Give the environment a name.'
  if (slug.length > SLUG_MAX) return `Keep it to ${SLUG_MAX} characters or fewer.`
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(slug)) {
    return 'Use letters, numbers, hyphens or underscores (starting with a letter or number).'
  }
  if (existing.some((e) => e.slug === slug && e.environment_id !== ignoreId)) {
    return `You already have an environment called “${envLabel(slug)}”.`
  }
  return null
}
