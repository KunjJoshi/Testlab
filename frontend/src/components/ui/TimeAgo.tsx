import clsx from 'clsx'
import { useNow } from '@/hooks/useNow'
import { exactTime, timeAgo } from '@/lib/format'
import { Tooltip } from './Tooltip'

/** "updated 2 hours ago", with the exact timestamp on hover. */
export function TimeAgo({
  iso,
  prefix,
  className,
}: {
  iso: string
  prefix?: string
  className?: string
}) {
  const now = useNow()
  if (!iso) return null
  return (
    <Tooltip content={`${prefix ? `${prefix} ` : ''}${exactTime(iso)}`}>
      <time
        dateTime={iso}
        className={clsx(
          'cursor-help underline decoration-ink-mute/40 decoration-dotted underline-offset-3',
          className,
        )}
      >
        {prefix ? `${prefix} ` : ''}
        {timeAgo(iso, now)}
        <span className="sr-only"> ({exactTime(iso)})</span>
      </time>
    </Tooltip>
  )
}
