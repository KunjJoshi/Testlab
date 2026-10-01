import clsx from 'clsx'
import { useState } from 'react'
import { suitePalette } from '@/lib/suiteColor'

export function Avatar({
  name,
  src,
  seed,
  size = 32,
  className,
}: {
  name: string
  src?: string
  seed: number
  size?: number
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  const palette = suitePalette(seed)
  const initials = name
    .replace(/^User #/, '#')
    .replace(/[^a-zA-Z0-9#]/g, ' ')
    .trim()
    .slice(0, 2)
    .toUpperCase()

  if (src && !failed) {
    return (
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        onError={() => setFailed(true)}
        className={clsx('shrink-0 rounded-full object-cover ring-2 ring-card', className)}
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <span
      aria-hidden
      className={clsx(
        'inline-flex shrink-0 items-center justify-center rounded-full font-mono font-semibold ring-2 ring-card',
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: palette.soft,
        color: palette.ink,
      }}
    >
      {initials || '?'}
    </span>
  )
}
