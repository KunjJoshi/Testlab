import clsx from 'clsx'
import {
  Check,
  CircleAlert,
  Copy,
  Download,
  FileJson,
  FileUp,
  TriangleAlert,
  Upload,
} from 'lucide-react'
import { useRef, useState, type CSSProperties, type DragEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import {
  MAX_IMPORT_BYTES,
  bulkTemplate,
  parseBulkImport,
  type ParsedImport,
} from '@/lib/bulkImport'
import type { BulkImportRequest } from '@/lib/types'
import { HttpStatus } from './HttpStatus'

interface BulkImportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  suiteId: number
  suiteName: string
  onImport: (request: BulkImportRequest) => void
  importing: boolean
  error?: string
  style?: CSSProperties
}

export function BulkImportModal(props: BulkImportModalProps) {
  return props.open ? <BulkImport {...props} /> : null
}

const FIELDS = [
  [
    'parent_suite_id',
    'number',
    'required',
    'The suite to import into. Pre-filled with this suite’s ID.',
  ],
  ['test_rows', 'array', 'required', 'The tests to create — at least one.'],
  ['test_rows[].test_name', 'string', 'required', 'Name shown in the table.'],
  ['test_rows[].expected_response_status', 'integer', 'required', 'HTTP status code, 100–599.'],
  ['test_rows[].test_description', 'string', 'optional', 'What the test checks.'],
  ['test_rows[].expected_output', 'string', 'optional', 'Expected response body or result.'],
  ['test_rows[].execution_steps', 'string', 'optional', 'Steps separated by newlines (\\n).'],
] as const

type FileState =
  | { kind: 'idle' }
  | { kind: 'error'; fileName: string; errors: string[] }
  | { kind: 'ready'; fileName: string; parsed: ParsedImport }

function BulkImport({
  open,
  onOpenChange,
  suiteId,
  suiteName,
  onImport,
  importing,
  error,
  style,
}: BulkImportModalProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<FileState>({ kind: 'idle' })
  const [dragging, setDragging] = useState(false)
  const [copied, setCopied] = useState(false)

  const example = JSON.stringify(bulkTemplate(suiteId), null, 2)

  const readFile = async (f: File) => {
    if (f.size > MAX_IMPORT_BYTES) {
      setFile({ kind: 'error', fileName: f.name, errors: ['File is larger than 2 MB.'] })
      return
    }
    // The file is only read here; its parsed contents are what get sent.
    const result = parseBulkImport(await f.text(), suiteId)
    setFile(
      result.ok
        ? { kind: 'ready', fileName: f.name, parsed: result.value }
        : { kind: 'error', fileName: f.name, errors: result.errors },
    )
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) void readFile(f)
  }

  const copyExample = async () => {
    await navigator.clipboard?.writeText(example)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([example + '\n'], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `testlab-suite-${suiteId}-import.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const rows = file.kind === 'ready' ? file.parsed.request.test_rows : []

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="xl"
      style={style}
      icon={<FileUp className="size-5" />}
      title="Bulk import tests"
      description={
        <>
          Upload a <code className="font-mono text-ink">.json</code> file to add many tests to{' '}
          <strong className="text-ink">{suiteName}</strong> at once. Testlab reads the file in your
          browser, checks it, and sends its contents — the file itself is never uploaded.
        </>
      }
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="suite"
            icon={<Upload className="size-4" />}
            disabled={file.kind !== 'ready'}
            loading={importing}
            onClick={() => file.kind === 'ready' && onImport(file.parsed.request)}
          >
            {file.kind === 'ready'
              ? `Import ${rows.length} test${rows.length === 1 ? '' : 's'}`
              : 'Import tests'}
          </Button>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        {/* Left: upload + result */}
        <div className="flex flex-col gap-4">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={clsx(
              'flex flex-col items-center justify-center gap-3 rounded-[22px] border-2 border-dashed px-6 py-10 text-center transition',
              dragging
                ? 'border-suite bg-suite-tint'
                : 'border-rule hover:border-suite/60 hover:bg-suite-tint/60',
            )}
          >
            <span className="flex size-12 items-center justify-center rounded-2xl bg-suite-soft text-suite-ink">
              <FileJson className="size-6" aria-hidden />
            </span>
            <span className="font-semibold">
              {file.kind === 'idle'
                ? 'Drop a JSON file here, or click to choose'
                : 'Choose a different file'}
            </span>
            <span className="text-xs text-ink-mute">.json · up to 2 MB</span>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void readFile(f)
              e.target.value = ''
            }}
          />

          {file.kind === 'error' && (
            <div role="alert" className="rounded-2xl bg-danger-soft p-4 text-sm text-danger">
              <p className="flex items-center gap-2 font-semibold">
                <CircleAlert className="size-4" aria-hidden />
                {file.fileName} can’t be imported
              </p>
              <ul className="mt-2 max-h-48 list-disc space-y-1 overflow-y-auto pl-6 font-mono text-xs">
                {file.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
              <p className="mt-3 text-xs">
                Fix these and choose the file again. Nothing has been imported.
              </p>
            </div>
          )}

          {file.kind === 'ready' && (
            <div className="rounded-2xl bg-card ring-1 ring-rule-soft">
              <p className="flex items-center gap-2 border-b border-rule-soft px-4 py-3 text-sm font-semibold">
                <Check className="size-4 text-passed" aria-hidden />
                {file.fileName} looks good — {rows.length} test{rows.length === 1 ? '' : 's'} ready
              </p>
              {file.parsed.warnings.length > 0 && (
                <ul className="space-y-1 border-b border-rule-soft bg-progress-soft/40 px-4 py-3 text-xs text-progress">
                  {file.parsed.warnings.map((w, i) => (
                    <li key={i} className="flex gap-2">
                      <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
                      {w}
                    </li>
                  ))}
                </ul>
              )}
              <ol className="max-h-56 divide-y divide-rule-soft overflow-y-auto">
                {rows.map((r, i) => (
                  <li key={i} className="flex items-center gap-3 px-4 py-2 text-sm">
                    <span className="w-6 font-mono text-xs text-ink-mute">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate">{r.test_name}</span>
                    <HttpStatus code={r.expected_response_status} />
                  </li>
                ))}
              </ol>
            </div>
          )}

          {error && (
            <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
              {error}
            </p>
          )}
        </div>

        {/* Right: format reference */}
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-lg font-semibold">Required file format</h3>
            <div className="flex gap-1.5">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void copyExample()}
                icon={copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              >
                {copied ? 'Copied' : 'Copy'}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={downloadTemplate}
                icon={<Download className="size-3.5" />}
              >
                Template
              </Button>
            </div>
          </div>
          <p className="text-xs leading-relaxed text-ink-mute">
            The file must match the body of the backend’s{' '}
            <code className="font-mono text-ink-soft">POST /tests/import-bulk</code> exactly.
            Imported tests start as <em>Untested</em>.
          </p>
          <pre className="max-h-64 overflow-auto rounded-2xl bg-ink p-4 font-mono text-[12px] leading-relaxed text-[#efe6d4]">
            {example}
          </pre>
          <div className="overflow-hidden rounded-2xl ring-1 ring-rule-soft">
            <table className="w-full table-fixed text-left text-xs">
              <colgroup>
                <col className="w-[48%]" />
                <col className="w-[15%]" />
                <col />
              </colgroup>
              <thead className="bg-paper-deep/70 text-ink-mute">
                <tr>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    Field
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    Type
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    Meaning
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule-soft">
                {FIELDS.map(([name, type, req, meaning]) => (
                  <tr key={name}>
                    <td className="px-3 py-2 align-top font-mono text-[11px] [overflow-wrap:anywhere] text-ink">
                      {name}
                      {req === 'required' && <span className="text-accent"> *</span>}
                    </td>
                    <td className="px-3 py-2 align-top font-mono text-[11px] text-ink-mute">
                      {type}
                    </td>
                    <td className="px-3 py-2 align-top text-ink-soft">{meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Modal>
  )
}
