import { FolderPlus, PencilLine } from 'lucide-react'
import { useState, type CSSProperties, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Field, TextArea, TextInput } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import type { Suite, SuiteInput } from '@/lib/types'

interface SuiteFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Present when editing an existing suite. */
  suite?: Suite
  onSubmit: (input: SuiteInput) => void
  saving: boolean
  error?: string
  style?: CSSProperties
}

export function SuiteFormModal(props: SuiteFormModalProps) {
  return props.open ? <SuiteForm {...props} /> : null
}

function SuiteForm({
  open,
  onOpenChange,
  suite,
  onSubmit,
  saving,
  error,
  style,
}: SuiteFormModalProps) {
  const [name, setName] = useState(suite?.suite_name ?? '')
  const [description, setDescription] = useState(suite?.suite_description ?? '')
  const [touched, setTouched] = useState(false)
  const editing = Boolean(suite)
  const nameError = touched && !name.trim() ? 'Give the suite a name.' : undefined

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (!name.trim()) return
    onSubmit({ suite_name: name.trim(), suite_description: description.trim() })
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      style={style}
      icon={editing ? <PencilLine className="size-5" /> : <FolderPlus className="size-5" />}
      title={editing ? 'Edit suite details' : 'Create a new suite'}
      description={
        editing
          ? 'Rename the suite or update its description. Tests inside it are not affected.'
          : 'A suite is a named collection of related tests — say, everything for the checkout flow.'
      }
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="suite-form" variant="suite" loading={saving}>
            {editing ? 'Save changes' : 'Create suite'}
          </Button>
        </>
      }
    >
      <form id="suite-form" onSubmit={submit} className="space-y-5" noValidate>
        <Field label="Suite name" required error={nameError}>
          {(a11y) => (
            <TextInput
              {...a11y}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setTouched(true)}
              placeholder="e.g. Checkout flow"
              maxLength={120}
              autoFocus
            />
          )}
        </Field>
        <Field
          label="Description"
          hint="What does this suite cover? Shown on the suite card so teammates know what's inside."
        >
          {(a11y) => (
            <TextArea
              {...a11y}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Cart → payment → confirmation, for web and mobile."
              rows={4}
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
