import clsx from 'clsx'
import { Check, Pencil, Trash2, X } from 'lucide-react'
import { useState, type KeyboardEvent } from 'react'
import { IconButton } from '@/components/ui/Button'
import { CELL_CONTROL } from '@/components/ui/Field'
import { TimeAgo } from '@/components/ui/TimeAgo'
import { joinSteps } from '@/lib/format'
import type { TestRow, TestStatus, UpdateTestInput } from '@/lib/types'
import { Expandable } from './Expandable'
import { HttpStatus } from './HttpStatus'
import { StatusSelect } from './StatusSelect'
import { StepsList } from './StepsList'

const CELL = 'px-4 py-4 align-top'

interface TestRowViewProps {
  test: TestRow
  canEdit: boolean
  readOnlyReason?: string
  flashing: boolean
  onEdit: () => void
  onDelete: () => void
  onStatusChange: (status: TestStatus) => void
}

export function TestRowView({
  test,
  canEdit,
  readOnlyReason,
  flashing,
  onEdit,
  onDelete,
  onStatusChange,
}: TestRowViewProps) {
  return (
    <tr
      className={clsx(
        'group border-b border-rule-soft transition-colors last:border-b-0 focus-within:bg-suite-tint/60 hover:bg-suite-tint/60',
        flashing && 'animate-flash',
      )}
      onDoubleClick={canEdit ? onEdit : undefined}
    >
      <td className={CELL}>
        <p className="leading-snug font-semibold break-words text-ink">{test.test_name}</p>
      </td>
      <td className={CELL}>
        {test.test_description ? (
          <Expandable>
            <p className="text-[13px] leading-relaxed break-words whitespace-pre-wrap text-ink-soft">
              {test.test_description}
            </p>
          </Expandable>
        ) : (
          <Empty />
        )}
      </td>
      <td className={CELL}>
        <StatusSelect
          value={test.status}
          onChange={onStatusChange}
          disabled={!canEdit}
          disabledReason={readOnlyReason}
          testName={test.test_name}
        />
      </td>
      <td className={CELL}>
        <HttpStatus code={test.expected_response_status} />
      </td>
      <td className={CELL}>
        {test.expected_output ? (
          <Expandable>
            <pre className="rounded-lg bg-paper/70 px-2.5 py-2 font-mono text-[12px] leading-relaxed break-words whitespace-pre-wrap text-ink-soft">
              {test.expected_output}
            </pre>
          </Expandable>
        ) : (
          <Empty />
        )}
      </td>
      <td className={CELL}>
        <StepsList steps={test.execution_steps} />
      </td>
      <td className={clsx(CELL, 'text-xs text-ink-mute')}>
        <TimeAgo iso={test.updated_at} />
      </td>
      <td className={clsx(CELL, 'text-right')}>
        {canEdit && (
          <div
            className={clsx(
              'inline-flex items-center gap-0.5 rounded-xl bg-card p-0.5 shadow-card ring-1 ring-rule-soft transition',
              // Only on hover / keyboard focus; always shown where hovering isn't possible.
              'opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100',
            )}
          >
            <IconButton label={`Edit “${test.test_name}”`} tone="suite" onClick={onEdit}>
              <Pencil className="size-4" />
            </IconButton>
            <IconButton label={`Delete “${test.test_name}”`} tone="danger" onClick={onDelete}>
              <Trash2 className="size-4" />
            </IconButton>
          </div>
        )}
      </td>
    </tr>
  )
}

function Empty() {
  return <span className="text-sm text-ink-mute/70">—</span>
}

interface TestRowEditorProps {
  test: TestRow
  saving: boolean
  onSave: (input: UpdateTestInput) => void
  onCancel: () => void
}

/** The same row, with every cell turned into an input. */
export function TestRowEditor({ test, saving, onSave, onCancel }: TestRowEditorProps) {
  const [draft, setDraft] = useState({
    test_name: test.test_name,
    test_description: test.test_description,
    status: test.status,
    expected_response_status: String(test.expected_response_status || ''),
    expected_output: test.expected_output,
    execution_steps: test.execution_steps ?? '',
  })
  const [submitted, setSubmitted] = useState(false)

  const code = Number(draft.expected_response_status)
  const nameError = !draft.test_name.trim()
  const codeError = !Number.isInteger(code) || code < 100 || code > 599

  const set = <K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) =>
    setDraft((d) => ({ ...d, [key]: value }))

  const submit = () => {
    setSubmitted(true)
    if (nameError || codeError) return

    const next: UpdateTestInput = {
      test_name: draft.test_name.trim(),
      test_description: draft.test_description.trim(),
      status: draft.status,
      expected_response_status: code,
      expected_output: draft.expected_output,
      execution_steps: joinSteps(draft.execution_steps),
    }
    // Send only what changed.
    const changed = Object.fromEntries(
      Object.entries(next).filter(
        ([k, v]) => v !== (test as unknown as Record<string, unknown>)[k],
      ),
    ) as UpdateTestInput
    if (Object.keys(changed).length === 0) return onCancel()
    onSave(changed)
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <tr
      className="border-b border-rule-soft bg-suite-tint shadow-[inset_4px_0_0_var(--suite)]"
      onKeyDown={onKeyDown}
      aria-label={`Editing ${test.test_name}`}
    >
      <td className={CELL}>
        <input
          aria-label="Test name"
          className={clsx(
            CELL_CONTROL,
            'font-semibold',
            submitted && nameError && 'ring-2 ring-danger',
          )}
          value={draft.test_name}
          onChange={(e) => set('test_name', e.target.value)}
          autoFocus
        />
        {submitted && nameError && <p className="mt-1 text-xs text-danger">Name is required.</p>}
      </td>
      <td className={CELL}>
        <textarea
          aria-label="Description"
          className={clsx(CELL_CONTROL, 'min-h-24 resize-y')}
          value={draft.test_description}
          onChange={(e) => set('test_description', e.target.value)}
        />
      </td>
      <td className={CELL}>
        <StatusSelect
          value={draft.status}
          onChange={(s) => set('status', s)}
          testName={draft.test_name || test.test_name}
        />
      </td>
      <td className={CELL}>
        <input
          aria-label="Expected HTTP status code"
          inputMode="numeric"
          className={clsx(
            CELL_CONTROL,
            'font-mono',
            submitted && codeError && 'ring-2 ring-danger',
          )}
          value={draft.expected_response_status}
          onChange={(e) =>
            set('expected_response_status', e.target.value.replace(/\D/g, '').slice(0, 3))
          }
          placeholder="200"
        />
        {submitted && codeError && <p className="mt-1 text-xs text-danger">100–599</p>}
      </td>
      <td className={CELL}>
        <textarea
          aria-label="Expected output"
          className={clsx(CELL_CONTROL, 'min-h-24 resize-y font-mono text-[12px]')}
          value={draft.expected_output}
          onChange={(e) => set('expected_output', e.target.value)}
        />
      </td>
      <td className={CELL}>
        <textarea
          aria-label="Execution steps, one per line"
          className={clsx(CELL_CONTROL, 'min-h-24 resize-y')}
          value={draft.execution_steps}
          onChange={(e) => set('execution_steps', e.target.value)}
          placeholder={'One step per line'}
        />
        <p className="mt-1 text-[11px] text-ink-mute">One step per line</p>
      </td>
      <td className={clsx(CELL, 'text-xs')}>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-suite-soft px-2 py-0.5 font-semibold text-suite-ink">
          <Pencil className="size-3" aria-hidden /> Editing
        </span>
        <p className="mt-2 leading-relaxed text-ink-mute">
          <kbd className="font-mono">⌘/Ctrl ↵</kbd> save
          <br />
          <kbd className="font-mono">Esc</kbd> cancel
        </p>
      </td>
      <td className={clsx(CELL, 'text-right')}>
        <div className="inline-flex flex-col items-end gap-1.5">
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-suite px-3 text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
          >
            <Check className="size-3.5" aria-hidden />
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-ink-soft ring-1 ring-rule transition ring-inset hover:bg-card"
          >
            <X className="size-3.5" aria-hidden />
            Cancel
          </button>
        </div>
      </td>
    </tr>
  )
}
