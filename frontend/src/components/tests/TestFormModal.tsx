import clsx from 'clsx'
import { ListPlus } from 'lucide-react'
import { useState, type CSSProperties, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Field, TextArea, TextInput } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { COMMON_STATUS_CODES, httpReason, joinSteps, parseSteps } from '@/lib/format'
import type { CreateTestInput } from '@/lib/types'

type NewTest = Omit<CreateTestInput, 'parent_suite'>

interface TestFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  suiteName: string
  onSubmit: (input: NewTest, keepOpen: boolean) => void
  saving: boolean
  error?: string
  style?: CSSProperties
  /** Bumped after each successful save so "Save & add another" starts blank. */
  resetKey: number
}

export function TestFormModal(props: TestFormModalProps) {
  return props.open ? <TestForm key={props.resetKey} {...props} /> : null
}

const EMPTY = {
  test_name: '',
  test_description: '',
  expected_response_status: '200',
  expected_output: '',
  execution_steps: '',
}

function TestForm({
  open,
  onOpenChange,
  suiteName,
  onSubmit,
  saving,
  error,
  style,
}: TestFormModalProps) {
  const [form, setForm] = useState(EMPTY)
  const [submitted, setSubmitted] = useState(false)

  const code = Number(form.expected_response_status)
  const errors = {
    test_name: !form.test_name.trim() ? 'Give the test a name.' : undefined,
    expected_response_status:
      !Number.isInteger(code) || code < 100 || code > 599
        ? 'Enter an HTTP status code between 100 and 599.'
        : undefined,
  }
  const steps = parseSteps(form.execution_steps)

  const set = (key: keyof typeof EMPTY) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }))

  const submit = (keepOpen: boolean) => (e?: FormEvent) => {
    e?.preventDefault()
    setSubmitted(true)
    if (errors.test_name || errors.expected_response_status) return
    onSubmit(
      {
        test_name: form.test_name.trim(),
        test_description: form.test_description.trim(),
        expected_response_status: code,
        expected_output: form.expected_output,
        execution_steps: joinSteps(form.execution_steps),
      },
      keepOpen,
    )
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      style={style}
      icon={<ListPlus className="size-5" />}
      title="Add a test"
      description={
        <>
          Adds one row to <strong className="text-ink">{suiteName}</strong>. New tests start as{' '}
          <em>Untested</em>; change the status from the table after you run it.
        </>
      }
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={() => submit(true)()} disabled={saving}>
            Save & add another
          </Button>
          <Button type="submit" form="test-form" variant="suite" loading={saving}>
            Add test
          </Button>
        </>
      }
    >
      <form
        id="test-form"
        onSubmit={submit(false)}
        className="grid gap-5 sm:grid-cols-2"
        noValidate
      >
        <Field
          label="Test name"
          required
          className="sm:col-span-2"
          error={submitted ? errors.test_name : undefined}
          hint="Short and specific — this is how the test is identified in the table."
        >
          {(a11y) => (
            <TextInput
              {...a11y}
              value={form.test_name}
              onChange={(e) => set('test_name')(e.target.value)}
              placeholder="e.g. Login with an expired password"
              autoFocus
            />
          )}
        </Field>

        <Field
          label="Description"
          className="sm:col-span-2"
          hint="What behaviour does this test check, and why?"
        >
          {(a11y) => (
            <TextArea
              {...a11y}
              rows={2}
              value={form.test_description}
              onChange={(e) => set('test_description')(e.target.value)}
              placeholder="e.g. Users with an expired password are asked to reset it instead of signing in."
            />
          )}
        </Field>

        <Field
          label="Expected response status"
          required
          className="sm:col-span-2"
          error={submitted ? errors.expected_response_status : undefined}
          hint={
            !errors.expected_response_status && httpReason(code)
              ? `${code} ${httpReason(code)} — the HTTP status the endpoint should return.`
              : 'The HTTP status the endpoint should return when the test passes.'
          }
        >
          {(a11y) => (
            <div className="flex flex-wrap items-center gap-2">
              <TextInput
                {...a11y}
                inputMode="numeric"
                className="w-28 font-mono"
                value={form.expected_response_status}
                onChange={(e) =>
                  set('expected_response_status')(e.target.value.replace(/\D/g, '').slice(0, 3))
                }
              />
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Common status codes">
                {COMMON_STATUS_CODES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => set('expected_response_status')(String(c))}
                    aria-pressed={code === c}
                    title={`${c} ${httpReason(c)}`}
                    className={clsx(
                      'h-8 rounded-lg px-2.5 font-mono text-xs font-semibold ring-1 transition ring-inset',
                      code === c
                        ? 'bg-suite text-white ring-suite'
                        : 'bg-white/60 text-ink-soft ring-rule hover:ring-ink-mute',
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}
        </Field>

        <Field
          label="Expected output"
          hint="The response body or result you expect. JSON, text — anything."
        >
          {(a11y) => (
            <TextArea
              {...a11y}
              rows={7}
              className="font-mono text-[13px]"
              value={form.expected_output}
              onChange={(e) => set('expected_output')(e.target.value)}
              placeholder={'{\n  "error": "password_expired"\n}'}
            />
          )}
        </Field>

        <Field
          label="Execution steps"
          hint="One step per line, in order. Numbering is added for you."
          aside={
            steps.length > 0 && (
              <span className="text-xs font-semibold text-suite">
                {steps.length} step{steps.length === 1 ? '' : 's'}
              </span>
            )
          }
        >
          {(a11y) => (
            <TextArea
              {...a11y}
              rows={7}
              value={form.execution_steps}
              onChange={(e) => set('execution_steps')(e.target.value)}
              placeholder={'Open /login\nEnter user with expired password\nClick "Sign in"'}
            />
          )}
        </Field>

        {error && (
          <p
            role="alert"
            className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger sm:col-span-2"
          >
            {error}
          </p>
        )}
      </form>
    </Modal>
  )
}
