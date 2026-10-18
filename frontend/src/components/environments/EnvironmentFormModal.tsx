import { Layers, PencilLine } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Field, TextInput } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { SLUG_MAX, envLabel, normaliseSlug, validateSlug } from '@/lib/environment'
import type { Environment } from '@/lib/types'

interface EnvironmentFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Existing environments, for duplicate checks and the "added after" hint. */
  pipeline: Environment[]
  /** Present when renaming. */
  environment?: Environment
  onSubmit: (slug: string) => void
  saving: boolean
  error?: string
}

export function EnvironmentFormModal(props: EnvironmentFormModalProps) {
  return props.open ? <EnvironmentForm {...props} /> : null
}

function EnvironmentForm({
  open,
  onOpenChange,
  pipeline,
  environment,
  onSubmit,
  saving,
  error,
}: EnvironmentFormModalProps) {
  const renaming = Boolean(environment)
  const [value, setValue] = useState(environment?.slug ?? '')
  const [touched, setTouched] = useState(false)

  const slug = normaliseSlug(value)
  const validation = validateSlug(slug, pipeline, environment?.environment_id)
  const unchanged = renaming && slug === environment?.slug
  const last = pipeline[pipeline.length - 1]

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (validation || unchanged) return
    onSubmit(slug)
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      icon={renaming ? <PencilLine className="size-5" /> : <Layers className="size-5" />}
      title={renaming ? `Rename ${envLabel(environment!.slug)}` : 'Add an environment'}
      description={
        renaming
          ? 'Its position in the pipeline stays the same. Suites already in this environment follow the new name.'
          : last
            ? `New environments are added at the end of your pipeline, after ${envLabel(last.slug)}. Use “Edit environments” to move it.`
            : 'This will be the first stage of your pipeline. New suites start here.'
      }
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="environment-form" loading={saving} disabled={unchanged}>
            {renaming ? 'Save name' : 'Add environment'}
          </Button>
        </>
      }
    >
      <form id="environment-form" onSubmit={submit} className="space-y-4" noValidate>
        <Field
          label="Name"
          required
          error={touched && validation ? validation : undefined}
          hint={
            slug && !validation
              ? `Saved as “${slug}” · shown on badges as ${envLabel(slug)}`
              : 'e.g. staging, uat, perf. Lowercase letters, numbers and hyphens.'
          }
        >
          {(a11y) => (
            <TextInput
              {...a11y}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onBlur={() => setTouched(true)}
              placeholder="staging"
              maxLength={SLUG_MAX + 8}
              autoComplete="off"
              autoFocus
              className="font-mono"
            />
          )}
        </Field>
        {error && (
          <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}
      </form>
    </Modal>
  )
}
