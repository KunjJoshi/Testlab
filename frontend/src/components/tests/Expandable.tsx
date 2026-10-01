import clsx from 'clsx'
import { ChevronDown } from 'lucide-react'
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

/** Clamps long cell content and offers a toggle only when it actually overflows. */
export function Expandable({
  children,
  collapsedHeight = 72,
  className,
}: {
  children: ReactNode
  collapsedHeight?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [overflows, setOverflows] = useState(false)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setOverflows(el.scrollHeight > collapsedHeight + 4)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [collapsedHeight, children])

  return (
    <div className={className}>
      <div
        ref={ref}
        className={clsx('relative overflow-hidden', !open && overflows && 'mask-b-from-60%')}
        style={{ maxHeight: open ? undefined : collapsedHeight }}
      >
        {children}
      </div>
      {overflows && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-suite hover:underline"
        >
          {open ? 'Show less' : 'Show more'}
          <ChevronDown className={clsx('size-3.5 transition', open && 'rotate-180')} aria-hidden />
        </button>
      )}
    </div>
  )
}
