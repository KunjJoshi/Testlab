import { TriangleAlert } from 'lucide-react'
import { useState, type CSSProperties, type ReactNode } from 'react'
import { Button } from './Button'
import { Field, TextInput } from './Field'
import { Modal } from './Modal'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  body: ReactNode
  confirmLabel: string
  onConfirm: () => void
  loading?: boolean
  /** When set, the user must type this exact text to enable the button. */
  typeToConfirm?: string
  style?: CSSProperties
}

export function ConfirmDialog(props: ConfirmDialogProps) {
  // Remount on open so the typed confirmation resets each time.
  return props.open ? <ConfirmDialogInner {...props} /> : null
}

function ConfirmDialogInner({
  open,
  onOpenChange,
  title,
  body,
  confirmLabel,
  onConfirm,
  loading,
  typeToConfirm,
  style,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState('')
  const blocked = typeToConfirm !== undefined && typed.trim() !== typeToConfirm.trim()

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      style={
        {
          ...style,
          '--suite': 'var(--color-danger)',
          '--suite-soft': 'var(--color-danger-soft)',
          '--suite-ink': 'var(--color-danger)',
        } as CSSProperties
      }
      icon={<TriangleAlert className="size-5" />}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Keep it
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={loading} disabled={blocked}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm leading-relaxed text-ink-soft">
        {body}
        {typeToConfirm !== undefined && (
          <Field label={`Type “${typeToConfirm}” to confirm`} required>
            {(a11y) => (
              <TextInput
                {...a11y}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                autoFocus
              />
            )}
          </Field>
        )}
      </div>
    </Modal>
  )
}
