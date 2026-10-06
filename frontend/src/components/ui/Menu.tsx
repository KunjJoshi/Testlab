import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import clsx from 'clsx'
import type { CSSProperties, ReactNode } from 'react'

export const MenuRoot = DropdownMenu.Root
export const MenuTrigger = DropdownMenu.Trigger

export function MenuContent({
  children,
  style,
  align = 'end',
}: {
  children: ReactNode
  style?: CSSProperties
  align?: 'start' | 'end'
}) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align={align}
        sideOffset={8}
        style={style}
        className="z-50 min-w-64 animate-fade rounded-2xl bg-card p-1.5 shadow-pop"
      >
        {children}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  )
}

interface MenuItemProps {
  icon: ReactNode
  label: string
  description?: string
  onSelect: () => void
  danger?: boolean
  disabled?: boolean
  disabledReason?: string
}

export function MenuItem({
  icon,
  label,
  description,
  onSelect,
  danger,
  disabled,
  disabledReason,
}: MenuItemProps) {
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      disabled={disabled}
      className={clsx(
        'flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5 outline-none select-none',
        'data-disabled:cursor-not-allowed data-disabled:opacity-50',
        danger
          ? 'text-danger data-highlighted:bg-danger-soft'
          : 'text-ink data-highlighted:bg-suite-tint',
      )}
    >
      <span className={clsx('mt-0.5 shrink-0', danger ? 'text-danger' : 'text-suite')}>{icon}</span>
      <span className="flex flex-col">
        <span className="text-sm font-semibold">{label}</span>
        {(disabled ? disabledReason : description) && (
          <span className={clsx('text-xs', danger ? 'text-danger/75' : 'text-ink-mute')}>
            {disabled ? disabledReason : description}
          </span>
        )}
      </span>
    </DropdownMenu.Item>
  )
}

export function MenuSeparator() {
  return <DropdownMenu.Separator className="mx-2 my-1.5 h-px bg-rule-soft" />
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return (
    <DropdownMenu.Label className="px-3 pt-2 pb-1 text-[11px] font-semibold tracking-[0.12em] text-ink-mute uppercase">
      {children}
    </DropdownMenu.Label>
  )
}
