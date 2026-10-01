import * as Select from '@radix-ui/react-select'
import clsx from 'clsx'
import { Check, ChevronDown } from 'lucide-react'
import { STATUSES, statusMeta } from '@/lib/status'
import type { TestStatus } from '@/lib/types'
import { Tooltip } from '@/components/ui/Tooltip'

export function StatusChip({ status, className }: { status: TestStatus; className?: string }) {
  const meta = statusMeta(status)
  return (
    <span
      className={clsx(
        'inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset',
        meta.chip,
        className,
      )}
    >
      <span
        className={clsx(
          'size-2 rounded-full',
          meta.dot,
          status === 'in_progress' && 'animate-pulse',
        )}
      />
      {meta.label}
    </span>
  )
}

interface StatusSelectProps {
  value: TestStatus
  onChange: (status: TestStatus) => void
  disabled?: boolean
  disabledReason?: string
  testName: string
}

/** Chip-shaped selector: click the chip to set a test's run status. */
export function StatusSelect({
  value,
  onChange,
  disabled,
  disabledReason,
  testName,
}: StatusSelectProps) {
  const meta = statusMeta(value)

  if (disabled) {
    return (
      <Tooltip content={disabledReason}>
        <span className="inline-flex">
          <StatusChip status={value} />
        </span>
      </Tooltip>
    )
  }

  return (
    <Select.Root value={value} onValueChange={(v) => onChange(v as TestStatus)}>
      <Select.Trigger
        aria-label={`Status of “${testName}”: ${meta.label}. Change status`}
        className={clsx(
          'group/status inline-flex h-7 items-center gap-1.5 rounded-full pr-1.5 pl-2.5 text-xs font-semibold whitespace-nowrap ring-1 transition ring-inset',
          'hover:shadow-[0_0_0_3px_rgb(31_27_22/0.06)] focus-visible:outline-2',
          meta.chip,
        )}
      >
        <span
          className={clsx(
            'size-2 rounded-full',
            meta.dot,
            value === 'in_progress' && 'animate-pulse',
          )}
        />
        <Select.Value>{meta.label}</Select.Value>
        <Select.Icon>
          <ChevronDown className="size-3.5 opacity-60 transition group-data-[state=open]/status:rotate-180" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={6}
          className="z-50 min-w-56 animate-fade rounded-2xl bg-card p-1.5 shadow-pop"
        >
          <Select.Viewport>
            <p className="px-3 pt-1.5 pb-1 text-[11px] font-semibold tracking-[0.12em] text-ink-mute uppercase">
              Set status
            </p>
            {STATUSES.map((s) => (
              <Select.Item
                key={s.value}
                value={s.value}
                className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 outline-none select-none data-highlighted:bg-paper-deep"
              >
                <span className={clsx('size-2.5 rounded-full', s.dot)} />
                <span className="flex flex-1 flex-col">
                  <Select.ItemText>
                    <span className="text-sm font-semibold">{s.label}</span>
                  </Select.ItemText>
                  <span className="text-xs text-ink-mute">{s.description}</span>
                </span>
                <Select.ItemIndicator>
                  <Check className="size-4 text-ink" />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  )
}
