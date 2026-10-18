import clsx from 'clsx'
import { ArrowDown, ArrowUp, GripVertical, ListOrdered, Undo2 } from 'lucide-react'
import { useState, type DragEvent } from 'react'
import { Button, IconButton } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { envColor, envLabel } from '@/lib/environment'
import type { Environment } from '@/lib/types'
import { EnvironmentDot } from './EnvironmentDot'

interface ReorderEnvironmentsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pipeline: Environment[]
  onSave: (ordered: Environment[]) => void
  saving: boolean
  error?: string
}

export function ReorderEnvironmentsModal(props: ReorderEnvironmentsModalProps) {
  return props.open ? <Reorder {...props} /> : null
}

function move<T>(list: T[], from: number, to: number): T[] {
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item!)
  return next
}

function Reorder({
  open,
  onOpenChange,
  pipeline,
  onSave,
  saving,
  error,
}: ReorderEnvironmentsModalProps) {
  const [order, setOrder] = useState(pipeline)
  const [dragging, setDragging] = useState<number | null>(null)
  const changed = order.some((env, i) => env.environment_id !== pipeline[i]?.environment_id)

  const onDragStart = (index: number) => (e: DragEvent) => {
    setDragging(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
  }

  // Re-rank live while hovering, so the list always shows the order you'll save.
  const onDragOver = (index: number) => (e: DragEvent) => {
    e.preventDefault()
    if (dragging === null || dragging === index) return
    setOrder((o) => move(o, dragging, index))
    setDragging(index)
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      icon={<ListOrdered className="size-5" />}
      title="Edit environments"
      description="Drag environments into pipeline order, earliest stage at the top. Moving a suite down this list is a promotion and resets its results; moving it up keeps them."
      footer={
        <>
          {changed && (
            <Button
              variant="ghost"
              icon={<Undo2 className="size-4" />}
              onClick={() => setOrder(pipeline)}
              className="mr-auto"
            >
              Undo changes
            </Button>
          )}
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button loading={saving} disabled={!changed} onClick={() => onSave(order)}>
            Save order
          </Button>
        </>
      }
    >
      <ol className="space-y-2" aria-label="Environments in pipeline order">
        {order.map((env, i) => (
          <li
            key={env.environment_id}
            draggable
            onDragStart={onDragStart(i)}
            onDragOver={onDragOver(i)}
            onDragEnd={() => setDragging(null)}
            onDrop={(e) => e.preventDefault()}
            className={clsx(
              'flex items-center gap-3 rounded-2xl bg-white/80 px-3 py-2.5 ring-1 ring-rule-soft transition ring-inset',
              'cursor-grab active:cursor-grabbing',
              dragging === i && 'opacity-60 shadow-lift ring-2 ring-ink',
            )}
          >
            <GripVertical className="size-4 shrink-0 text-ink-mute" aria-hidden />
            <span className="w-5 text-right font-mono text-xs text-ink-mute">{i + 1}</span>
            <EnvironmentDot color={envColor(i, order.length)} />
            <span className="flex-1 font-mono text-sm font-semibold tracking-[0.06em]">
              {envLabel(env.slug)}
            </span>
            {pipeline[i]?.environment_id !== env.environment_id && (
              <span className="rounded-full bg-progress-soft px-2 py-0.5 text-[10px] font-semibold text-progress">
                moved
              </span>
            )}
            <IconButton
              label={`Move ${envLabel(env.slug)} earlier`}
              disabled={i === 0}
              onClick={() => setOrder((o) => move(o, i, i - 1))}
            >
              <ArrowUp className="size-4" />
            </IconButton>
            <IconButton
              label={`Move ${envLabel(env.slug)} later`}
              disabled={i === order.length - 1}
              onClick={() => setOrder((o) => move(o, i, i + 1))}
            >
              <ArrowDown className="size-4" />
            </IconButton>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-xs leading-relaxed text-ink-mute">
        Saving applies the whole order at once: either every environment moves, or none do.
      </p>
      {error && (
        <p role="alert" className="mt-3 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}
    </Modal>
  )
}
