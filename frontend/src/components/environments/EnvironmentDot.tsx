import clsx from 'clsx'
import type { CSSProperties } from 'react'

/** The coloured status dot used wherever an environment is shown. */
export function EnvironmentDot({
  color,
  glowing,
  className,
}: {
  color: string
  /** Pulses briefly, e.g. right after the suite changed environment. */
  glowing?: boolean
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={clsx('size-2.5 shrink-0 rounded-full', glowing && 'animate-env-glow', className)}
      style={
        {
          '--env': color,
          background: color,
          boxShadow: glowing
            ? undefined
            : `0 0 0 3px color-mix(in srgb, ${color} 22%, transparent)`,
        } as CSSProperties
      }
    />
  )
}
