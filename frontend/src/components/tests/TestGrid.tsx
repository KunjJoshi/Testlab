import { Info } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Tooltip } from '@/components/ui/Tooltip'
import type { TestRow, TestStatus, UpdateTestInput } from '@/lib/types'
import { TestRowEditor, TestRowView } from './TestRow'

const COLUMNS: { key: string; label: string; help: string; width: string }[] = [
  {
    key: 'name',
    label: 'Test name',
    help: 'A short, unique name for what is being tested.',
    width: 'w-[14%]',
  },
  {
    key: 'description',
    label: 'Description',
    help: 'Why this test exists and what behaviour it checks.',
    width: 'w-[16%]',
  },
  {
    key: 'status',
    label: 'Status',
    help: 'The result of the latest run. Click the chip to change it: Untested, In progress, Passed or Failed.',
    width: 'w-[10%]',
  },
  {
    key: 'http',
    label: 'Expected status',
    help: 'The HTTP status code the endpoint should return when the test passes (e.g. 200, 404).',
    width: 'w-[8%]',
  },
  {
    key: 'output',
    label: 'Expected output',
    help: 'The response body or result you expect to see.',
    width: 'w-[15%]',
  },
  {
    key: 'steps',
    label: 'Execution steps',
    help: 'What to do, in order, to run this test by hand.',
    width: 'w-[18%]',
  },
  {
    key: 'updated',
    label: 'Last updated',
    help: 'When this test was last changed. Tests are sorted newest first. Hover for the exact time.',
    width: 'w-[10%]',
  },
]

interface TestGridProps {
  tests: TestRow[]
  canEdit: boolean
  readOnlyReason?: string
  onUpdate: (rowId: number, input: UpdateTestInput, done?: () => void) => void
  onDelete: (row: TestRow) => void
  savingRowId: number | null
}

export function TestGrid({
  tests,
  canEdit,
  readOnlyReason,
  onUpdate,
  onDelete,
  savingRowId,
}: TestGridProps) {
  const [editingId, setEditingId] = useState<number | null>(null)
  const [flashId, setFlashId] = useState<number | null>(null)
  const flashTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => () => clearTimeout(flashTimer.current), [])

  const flash = (rowId: number) => {
    clearTimeout(flashTimer.current)
    setFlashId(rowId)
    flashTimer.current = setTimeout(() => setFlashId(null), 1700)
  }

  const save = (rowId: number, input: UpdateTestInput) =>
    onUpdate(rowId, input, () => {
      setEditingId(null)
      flash(rowId)
    })

  const setStatus = (rowId: number, status: TestStatus) =>
    onUpdate(rowId, { status }, () => flash(rowId))

  return (
    <div className="overflow-hidden rounded-[24px] bg-card shadow-card ring-1 ring-rule-soft">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1180px] table-fixed border-collapse text-left">
          <caption className="sr-only">
            Tests in this suite, most recently updated first.
            {canEdit ? ' Hover a row to edit or delete it.' : ''}
          </caption>
          <colgroup>
            {COLUMNS.map((c) => (
              <col key={c.key} className={c.width} />
            ))}
            <col className="w-[9%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-rule bg-suite-tint">
              {COLUMNS.map((c) => (
                <th key={c.key} scope="col" className="px-4 py-3 align-bottom">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.1em] text-suite-ink/80 uppercase">
                    {c.label}
                    <Tooltip content={c.help}>
                      <button
                        type="button"
                        className="rounded text-suite-ink/45 transition hover:text-suite-ink"
                        aria-label={`About the ${c.label} column: ${c.help}`}
                      >
                        <Info className="size-3.5" aria-hidden />
                      </button>
                    </Tooltip>
                  </span>
                </th>
              ))}
              <th scope="col" className="px-4 py-3 text-right align-bottom">
                <span className="text-[11px] font-semibold tracking-[0.1em] text-suite-ink/80 uppercase">
                  {canEdit ? 'Actions' : ''}
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {tests.map((test) =>
              editingId === test.test_row_id ? (
                <TestRowEditor
                  key={test.test_row_id}
                  test={test}
                  saving={savingRowId === test.test_row_id}
                  onSave={(input) => save(test.test_row_id, input)}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <TestRowView
                  key={test.test_row_id}
                  test={test}
                  canEdit={canEdit}
                  readOnlyReason={readOnlyReason}
                  flashing={flashId === test.test_row_id}
                  onEdit={() => setEditingId(test.test_row_id)}
                  onDelete={() => onDelete(test)}
                  onStatusChange={(status) => setStatus(test.test_row_id, status)}
                />
              ),
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
