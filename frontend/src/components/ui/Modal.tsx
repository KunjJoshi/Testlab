import * as Dialog from '@radix-ui/react-dialog'
import clsx from 'clsx'
import { X } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'

interface ModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  icon?: ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** Suite colour variables, so portalled content keeps the suite theme. */
  style?: CSSProperties
}

const SIZES = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-2xl', xl: 'max-w-4xl' }

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  icon,
  children,
  footer,
  size = 'md',
  style,
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 animate-fade bg-ink/35 backdrop-blur-[2px]" />
        <Dialog.Content
          style={style}
          className={clsx(
            'fixed top-1/2 left-1/2 z-50 flex max-h-[min(90vh,900px)] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col',
            'overflow-hidden rounded-[28px] bg-card shadow-pop',
            SIZES[size],
          )}
        >
          <div className="h-1.5 shrink-0 bg-suite" aria-hidden />
          <header className="flex shrink-0 items-start gap-4 px-7 pt-6 pb-4">
            {icon && (
              <div className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-2xl bg-suite-soft text-suite-ink">
                {icon}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <Dialog.Title className="font-display text-[26px] leading-tight font-semibold tracking-tight">
                {title}
              </Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1 text-sm leading-relaxed text-ink-soft">
                  {description}
                </Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{title}</Dialog.Description>
              )}
            </div>
            <Dialog.Close
              className="-mt-1 -mr-2 inline-flex size-9 items-center justify-center rounded-xl text-ink-mute transition hover:bg-ink/6 hover:text-ink"
              aria-label="Close"
            >
              <X className="size-5" />
            </Dialog.Close>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-7 pb-6">{children}</div>
          {footer && (
            <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-rule-soft bg-paper/60 px-7 py-4">
              {footer}
            </footer>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
