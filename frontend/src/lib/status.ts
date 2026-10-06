import type { TestStatus } from './types'

export interface StatusMeta {
  value: TestStatus
  label: string
  description: string
  /** Tailwind classes for the chip. */
  chip: string
  dot: string
  bar: string
}

export const STATUSES: StatusMeta[] = [
  {
    value: 'untested',
    label: 'Untested',
    description: 'Not run yet.',
    chip: 'bg-untested-soft text-untested ring-untested/25',
    dot: 'bg-untested',
    bar: 'bg-untested/60',
  },
  {
    value: 'in_progress',
    label: 'In progress',
    description: 'Someone is running this test now.',
    chip: 'bg-progress-soft text-progress ring-progress/30',
    dot: 'bg-[#d9a400]',
    bar: 'bg-[#e0b21c]',
  },
  {
    value: 'passed',
    label: 'Passed',
    description: 'Ran and matched the expected result.',
    chip: 'bg-passed-soft text-passed ring-passed/25',
    dot: 'bg-passed',
    bar: 'bg-passed',
  },
  {
    value: 'failed',
    label: 'Failed',
    description: 'Ran and did not match the expected result.',
    chip: 'bg-failed-soft text-failed ring-failed/25',
    dot: 'bg-failed',
    bar: 'bg-failed',
  },
]

export function statusMeta(status: TestStatus): StatusMeta {
  return STATUSES.find((s) => s.value === status) ?? STATUSES[0]!
}
