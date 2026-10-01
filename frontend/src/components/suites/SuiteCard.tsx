import clsx from 'clsx'
import { ArrowUpRight, Plus } from 'lucide-react'
import { Link } from 'react-router'
import { Avatar } from '@/components/ui/Avatar'
import { TimeAgo } from '@/components/ui/TimeAgo'
import { ROLE_LABEL } from '@/lib/permissions'
import { suitePalette, suiteStyle } from '@/lib/suiteColor'
import type { SharedSuite, Suite } from '@/lib/types'

/* Organic shapes; each suite gets one, so neighbouring cards don't look stamped. */
const BLOBS = [
  'M43.1,-57.3C55.1,-49.3,63.8,-36.2,68.6,-21.6C73.4,-7,74.3,9.1,68.7,22.5C63.1,35.9,51,46.6,37.5,55.6C24,64.6,9.1,71.9,-6.7,73.1C-22.5,74.3,-39.2,69.4,-51.6,59C-64,48.6,-72.1,32.7,-74.7,15.9C-77.3,-0.9,-74.4,-18.6,-65.6,-32.3C-56.8,-46,-42.1,-55.7,-27.6,-62.4C-13.1,-69.1,1.2,-72.8,15.2,-70.7C29.2,-68.6,31.1,-65.3,43.1,-57.3Z',
  'M51.6,-62.2C64.5,-50.7,71.2,-32.6,72.5,-15.1C73.8,2.4,69.7,19.3,60.8,32.6C51.9,45.9,38.2,55.6,22.7,62.5C7.2,69.4,-10.1,73.5,-25.4,69C-40.7,64.5,-54,51.4,-63.4,35.7C-72.8,20,-78.3,1.7,-74.5,-14.4C-70.7,-30.5,-57.6,-44.4,-43,-55.6C-28.4,-66.8,-12.3,-75.3,3.6,-79.6C19.5,-83.9,38.7,-73.7,51.6,-62.2Z',
  'M36.9,-44.9C49.6,-34.9,62.8,-24.1,67.3,-9.8C71.8,4.5,67.5,22.3,57.3,35C47.1,47.7,31,55.3,14.3,60.6C-2.4,65.9,-19.7,68.9,-34.4,62.8C-49.1,56.7,-61.2,41.5,-67.3,24.4C-73.4,7.3,-73.5,-11.7,-65.6,-26.2C-57.7,-40.7,-41.8,-50.7,-27.1,-59.9C-12.4,-69.1,1.1,-77.5,13,-74.4C24.9,-71.3,24.2,-54.9,36.9,-44.9Z',
  'M47.5,-55.4C60.3,-45.6,68.4,-29.3,71.1,-12.3C73.8,4.7,71.1,22.4,62,35.6C52.9,48.8,37.4,57.5,21,63.4C4.6,69.3,-12.7,72.4,-28.4,67.3C-44.1,62.2,-58.2,48.9,-66.5,32.7C-74.8,16.5,-77.3,-2.6,-71.6,-18.9C-65.9,-35.2,-52,-48.7,-37.2,-58C-22.4,-67.3,-6.7,-72.4,8.4,-71.9C23.5,-71.4,34.7,-65.2,47.5,-55.4Z',
]

interface SuiteCardProps {
  suite: Suite | SharedSuite
  index: number
}

function isShared(suite: Suite | SharedSuite): suite is SharedSuite {
  return 'access_scope' in suite
}

export function SuiteCard({ suite, index }: SuiteCardProps) {
  const palette = suitePalette(suite.suite_id)
  const shared = isShared(suite)
  const initial = suite.suite_name.trim().charAt(0).toUpperCase() || '#'

  return (
    <Link
      to={`/suites/${suite.suite_id}`}
      style={{ ...suiteStyle(suite.suite_id), animationDelay: `${Math.min(index, 10) * 45}ms` }}
      aria-label={`Open suite ${suite.suite_name}`}
      className={clsx(
        'group relative isolate flex min-h-64 animate-rise flex-col overflow-hidden rounded-[30px] bg-card p-6 shadow-card ring-1 ring-rule-soft',
        'transition duration-300 hover:-translate-y-1 hover:shadow-lift hover:ring-suite/40',
      )}
    >
      <svg
        viewBox="0 0 200 200"
        aria-hidden
        className="absolute -top-14 -right-14 -z-10 size-44 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-12"
      >
        <path
          d={BLOBS[suite.suite_id % BLOBS.length]}
          fill={palette.soft}
          transform="translate(100 100)"
        />
      </svg>
      <span
        aria-hidden
        className="absolute top-5 right-6 font-display-soft text-5xl font-semibold text-suite-ink/80"
      >
        {initial}
      </span>

      <p className="flex items-center gap-2 font-mono text-[11px] tracking-[0.14em] text-suite uppercase">
        <span className="size-2 rounded-full bg-suite" />
        Suite #{suite.suite_id}
      </p>

      <h3 className="mt-3 line-clamp-2 pr-16 font-display text-[26px] leading-[1.1] font-semibold tracking-tight">
        {suite.suite_name}
      </h3>

      <p
        className={clsx(
          'mt-3 line-clamp-3 pr-6 text-[15px] leading-relaxed',
          suite.suite_description ? 'text-ink-soft' : 'text-ink-mute italic',
        )}
      >
        {suite.suite_description || 'No description yet.'}
      </p>

      <div className="mt-auto flex items-center gap-3 border-t border-dashed border-rule pt-4 text-xs text-ink-mute">
        {shared ? (
          <>
            <Avatar name={suite.owner_username} seed={suite.owner_id} size={24} />
            <span className="min-w-0 truncate">
              Shared by <span className="font-semibold text-ink">@{suite.owner_username}</span>
            </span>
            <span className="ml-auto shrink-0 rounded-full bg-suite-soft px-2 py-0.5 font-semibold text-suite-ink">
              {ROLE_LABEL[suite.access_scope]}
            </span>
          </>
        ) : (
          <>
            <TimeAgo iso={suite.updated_at} prefix="Updated" />
            <span className="ml-auto inline-flex items-center gap-1 font-semibold text-suite opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
              Open <ArrowUpRight className="size-3.5" aria-hidden />
            </span>
          </>
        )}
      </div>
      {shared && (
        <div className="mt-2 text-xs text-ink-mute">
          <TimeAgo iso={suite.updated_at} prefix="Updated" />
        </div>
      )}
    </Link>
  )
}

export function NewSuiteCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-64 animate-rise flex-col items-center justify-center gap-3 rounded-[30px] border-2 border-dashed border-rule text-ink-mute transition hover:border-ink-mute hover:bg-card/60 hover:text-ink"
    >
      <span className="flex size-14 items-center justify-center rounded-2xl bg-ink text-paper transition group-hover:scale-105 group-hover:-rotate-6">
        <Plus className="size-6" aria-hidden />
      </span>
      <span className="font-display text-xl font-semibold text-ink">New suite</span>
      <span className="max-w-52 text-center text-sm">
        A suite groups related tests — one per feature, service or release.
      </span>
    </button>
  )
}

export function SuiteCardSkeleton() {
  return <div className="min-h-64 animate-pulse rounded-[30px] bg-paper-deep" aria-hidden />
}
