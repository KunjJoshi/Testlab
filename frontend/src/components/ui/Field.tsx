import clsx from 'clsx'
import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react'

const CONTROL =
  'w-full rounded-xl bg-white/70 px-3.5 text-[15px] text-ink ring-1 ring-rule ring-inset transition placeholder:text-ink-mute/70 hover:ring-ink-mute/50 focus:bg-white focus:ring-2 focus:ring-suite focus:outline-none aria-invalid:ring-danger'

interface FieldProps {
  label: string
  hint?: ReactNode
  error?: string
  required?: boolean
  children: (props: {
    id: string
    'aria-describedby'?: string
    'aria-invalid'?: boolean
  }) => ReactNode
  className?: string
  aside?: ReactNode
}

export function Field({ label, hint, error, required, children, className, aside }: FieldProps) {
  const id = useId()
  const hintId = `${id}-hint`
  return (
    <div className={clsx('flex flex-col gap-1.5', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[13px] font-semibold text-ink">
          {label}
          {required ? (
            <span className="ml-0.5 text-accent" aria-hidden>
              *
            </span>
          ) : (
            <span className="ml-1.5 font-normal text-ink-mute">optional</span>
          )}
        </label>
        {aside}
      </div>
      {children({
        id,
        'aria-describedby': hint || error ? hintId : undefined,
        'aria-invalid': error ? true : undefined,
      })}
      {(error || hint) && (
        <p
          id={hintId}
          className={clsx('text-xs leading-relaxed', error ? 'text-danger' : 'text-ink-mute')}
        >
          {error ?? hint}
        </p>
      )}
    </div>
  )
}

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={clsx(CONTROL, 'h-11', className)} {...props} />
}

export function TextArea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={clsx(CONTROL, 'min-h-24 resize-y py-2.5 leading-relaxed', className)}
      {...props}
    />
  )
}

/** Compact controls used inside an editable table row. */
export const CELL_CONTROL =
  'w-full rounded-lg bg-white px-2.5 py-1.5 text-[13px] leading-snug text-ink ring-1 ring-rule ring-inset placeholder:text-ink-mute/70 focus:ring-2 focus:ring-suite focus:outline-none'
