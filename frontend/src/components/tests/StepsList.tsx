import clsx from 'clsx'
import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { parseSteps } from '@/lib/format'

const PREVIEW = 2

/** Execution steps as a numbered list, collapsed after the first couple. */
export function StepsList({ steps, compact = true }: { steps: string; compact?: boolean }) {
  const items = parseSteps(steps)
  const [open, setOpen] = useState(false)

  if (items.length === 0) return <span className="text-sm text-ink-mute italic">No steps</span>

  const visible = compact && !open ? items.slice(0, PREVIEW) : items
  const hidden = items.length - visible.length

  return (
    <div>
      <ol className="space-y-1.5">
        {visible.map((step, i) => (
          <li key={i} className="flex gap-2 text-[13px] leading-snug">
            <span className="mt-px flex size-[18px] shrink-0 items-center justify-center rounded-full bg-suite-soft font-mono text-[10px] font-bold text-suite-ink">
              {i + 1}
            </span>
            <span className="text-ink-soft">{step}</span>
          </li>
        ))}
      </ol>
      {compact && items.length > PREVIEW && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="mt-1.5 ml-[26px] inline-flex items-center gap-1 text-xs font-semibold text-suite hover:underline"
        >
          {open ? 'Show fewer' : `+${hidden} more step${hidden === 1 ? '' : 's'}`}
          <ChevronDown className={clsx('size-3.5 transition', open && 'rotate-180')} aria-hidden />
        </button>
      )}
    </div>
  )
}
