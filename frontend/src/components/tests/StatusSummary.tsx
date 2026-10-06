import clsx from 'clsx'
import { X } from 'lucide-react'
import { STATUSES } from '@/lib/status'
import type { TestRow, TestStatus } from '@/lib/types'

interface StatusSummaryProps {
  tests: TestRow[]
  filter: TestStatus | null
  onFilter: (status: TestStatus | null) => void
}

/** Progress bar of run results; each legend entry doubles as a filter. */
export function StatusSummary({ tests, filter, onFilter }: StatusSummaryProps) {
  const total = tests.length
  const counts = Object.fromEntries(
    STATUSES.map((s) => [s.value, tests.filter((t) => t.status === s.value).length]),
  ) as Record<TestStatus, number>
  const run = counts.passed + counts.failed
  const passRate = run ? Math.round((counts.passed / run) * 100) : null

  return (
    <div className="rounded-[22px] bg-card p-5 shadow-card ring-1 ring-rule-soft">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-ink-soft">
          <span className="font-display text-2xl font-semibold text-ink">{total}</span> test
          {total === 1 ? '' : 's'}
          {passRate !== null && (
            <>
              {' · '}
              <span className="font-semibold text-ink">{passRate}%</span> of completed runs passed
            </>
          )}
        </p>
        {filter && (
          <button
            type="button"
            onClick={() => onFilter(null)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-suite hover:underline"
          >
            <X className="size-3.5" aria-hidden /> Clear filter
          </button>
        )}
      </div>

      <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-paper-deep" aria-hidden>
        {STATUSES.map((s) =>
          counts[s.value] ? (
            <div
              key={s.value}
              className={clsx(
                'h-full transition-all duration-500',
                s.bar,
                filter && filter !== s.value && 'opacity-25',
              )}
              style={{ width: `${(counts[s.value] / total) * 100}%` }}
            />
          ) : null,
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Filter tests by status">
        {STATUSES.map((s) => (
          <button
            key={s.value}
            type="button"
            aria-pressed={filter === s.value}
            onClick={() => onFilter(filter === s.value ? null : s.value)}
            title={`Show only ${s.label.toLowerCase()} tests`}
            className={clsx(
              'inline-flex h-8 items-center gap-2 rounded-full px-3 text-xs font-semibold ring-1 transition ring-inset',
              filter === s.value ? s.chip : 'text-ink-soft ring-rule hover:bg-paper',
            )}
          >
            <span className={clsx('size-2 rounded-full', s.dot)} />
            {s.label}
            <span className="font-mono tabular-nums opacity-70">{counts[s.value]}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
