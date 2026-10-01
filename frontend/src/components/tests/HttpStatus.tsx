import clsx from 'clsx'
import { httpClass, httpReason, type HttpClass } from '@/lib/format'
import { Tooltip } from '@/components/ui/Tooltip'

const TONES: Record<HttpClass, string> = {
  success: 'bg-passed-soft/70 text-passed',
  redirect: 'bg-[#d8e2f4] text-[#2f4f8f]',
  client: 'bg-progress-soft/70 text-progress',
  server: 'bg-failed-soft/70 text-failed',
  other: 'bg-untested-soft text-untested',
}

/** The HTTP status code the test expects the endpoint to return. */
export function HttpStatus({ code }: { code: number }) {
  const reason = httpReason(code)
  return (
    <Tooltip content={reason ? `${code} ${reason}` : `HTTP ${code}`}>
      <span
        className={clsx(
          'inline-flex h-7 items-center rounded-lg px-2 font-mono text-[13px] font-semibold tabular-nums',
          TONES[httpClass(code)],
        )}
      >
        {code || '—'}
        {reason && <span className="sr-only"> {reason}</span>}
      </span>
    </Tooltip>
  )
}
