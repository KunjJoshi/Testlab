import { FlaskConical, LoaderCircle } from 'lucide-react'
import type { ReactNode } from 'react'

export function FullPageSpinner({ label }: { label: string }) {
  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-center gap-3 text-ink-mute"
      role="status"
    >
      <LoaderCircle className="size-6 animate-spin" aria-hidden />
      <p className="text-sm">{label}</p>
    </div>
  )
}

export function FullPageMessage({
  title,
  body,
  children,
}: {
  title: string
  body: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-ink text-paper">
        <FlaskConical className="size-7" aria-hidden />
      </div>
      <h1 className="font-display text-3xl font-semibold">{title}</h1>
      <p className="max-w-md text-ink-soft">{body}</p>
      {children}
    </div>
  )
}
