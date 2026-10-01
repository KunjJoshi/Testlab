import { Check, Copy, LogOut } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useAuth, useCurrentUser } from '@/auth/context'
import { Avatar } from './ui/Avatar'
import { Logo } from './ui/Brand'
import { MenuContent, MenuItem, MenuLabel, MenuRoot, MenuSeparator, MenuTrigger } from './ui/Menu'

export function AppHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b border-rule-soft bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-4 px-5 sm:px-8">
        <Link to="/" aria-label="Testlab — all suites" className="rounded-xl">
          <Logo />
        </Link>
        <div className="flex min-w-0 flex-1 items-center gap-3">{children}</div>
        <UserMenu />
      </div>
    </header>
  )
}

function UserMenu() {
  const user = useCurrentUser()
  const { logout } = useAuth()
  const [copied, setCopied] = useState(false)

  const copyId = async () => {
    await navigator.clipboard?.writeText(String(user.user_id))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <MenuRoot>
      <MenuTrigger
        className="flex items-center gap-2.5 rounded-full py-1 pr-3 pl-1 ring-1 ring-rule transition ring-inset hover:bg-card data-[state=open]:bg-card"
        aria-label={`Account menu for ${user.username}`}
      >
        <Avatar name={user.username} src={user.avatar_url} seed={user.user_id} size={30} />
        <span className="hidden text-sm font-semibold sm:inline">{user.username}</span>
      </MenuTrigger>
      <MenuContent>
        <div className="flex items-center gap-3 px-3 pt-2 pb-3">
          <Avatar name={user.username} src={user.avatar_url} seed={user.user_id} size={40} />
          <div className="min-w-0">
            <p className="truncate font-semibold">@{user.username}</p>
            <p className="truncate text-xs text-ink-mute">{user.email}</p>
          </div>
        </div>
        <MenuSeparator />
        <MenuLabel>Your Testlab ID</MenuLabel>
        <MenuItem
          icon={copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          label={`#${user.user_id}`}
          description={
            copied ? 'Copied!' : 'Give this to teammates so they can share suites with you'
          }
          onSelect={() => void copyId()}
        />
        <MenuSeparator />
        <MenuItem
          icon={<LogOut className="size-4" />}
          label="Log out"
          description="End your session on this device"
          onSelect={() => void logout()}
          danger
        />
      </MenuContent>
    </MenuRoot>
  )
}
