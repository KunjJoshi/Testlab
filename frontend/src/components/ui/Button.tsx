import clsx from 'clsx'
import { LoaderCircle } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react'

type Variant = 'primary' | 'suite' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: ReactNode
  loading?: boolean
  ref?: Ref<HTMLButtonElement>
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-ink text-paper shadow-[inset_0_-2px_0_rgb(0_0_0/0.25)] hover:bg-ink-soft active:translate-y-px',
  suite:
    'bg-suite text-white shadow-[inset_0_-2px_0_rgb(0_0_0/0.18)] hover:brightness-110 active:translate-y-px',
  secondary:
    'bg-card text-ink ring-1 ring-rule ring-inset hover:bg-paper-deep hover:ring-ink-mute/50 active:translate-y-px',
  ghost: 'text-ink-soft hover:bg-ink/5 hover:text-ink',
  danger:
    'bg-danger text-white shadow-[inset_0_-2px_0_rgb(0_0_0/0.2)] hover:brightness-110 active:translate-y-px',
}

const SIZES: Record<Size, string> = {
  sm: 'h-8 gap-1.5 rounded-lg px-3 text-[13px]',
  md: 'h-10 gap-2 rounded-xl px-4 text-sm',
  lg: 'h-12 gap-2.5 rounded-2xl px-6 text-[15px]',
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  loading,
  disabled,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex shrink-0 items-center justify-center font-semibold whitespace-nowrap transition duration-150 select-none',
        'disabled:pointer-events-none disabled:opacity-45',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {loading ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  )
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  tone?: 'default' | 'danger' | 'suite'
  ref?: Ref<HTMLButtonElement>
}

export function IconButton({
  label,
  tone = 'default',
  className,
  children,
  type = 'button',
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={clsx(
        'inline-flex size-8 shrink-0 items-center justify-center rounded-lg transition disabled:pointer-events-none disabled:opacity-40',
        tone === 'default' && 'text-ink-soft hover:bg-ink/6 hover:text-ink',
        tone === 'danger' && 'text-ink-mute hover:bg-danger-soft hover:text-danger',
        tone === 'suite' && 'text-suite hover:bg-suite-soft',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}
