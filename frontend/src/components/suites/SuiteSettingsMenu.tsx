import { Menu, PencilLine, Settings2, Trash2, UserPlus } from 'lucide-react'
import type { CSSProperties } from 'react'
import {
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuRoot,
  MenuSeparator,
  MenuTrigger,
} from '@/components/ui/Menu'
import { canDeleteSuite, canEditSuite, canShareSuite } from '@/lib/permissions'
import type { SuiteRole } from '@/lib/types'

interface SuiteSettingsMenuProps {
  role: SuiteRole
  style: CSSProperties
  onEdit: () => void
  onShare: () => void
  onDelete: () => void
}

const NEEDS_EDIT = 'Needs “Can edit” access or higher'
const NEEDS_ADMIN = 'Only the owner or an admin can do this'

export function SuiteSettingsMenu({
  role,
  style,
  onEdit,
  onShare,
  onDelete,
}: SuiteSettingsMenuProps) {
  return (
    <MenuRoot>
      <MenuTrigger
        aria-label="Suite settings: edit, share or delete this suite"
        className="inline-flex h-11 items-center gap-2 rounded-2xl bg-card px-4 text-sm font-semibold shadow-card ring-1 ring-rule-soft transition hover:ring-suite/50 data-[state=open]:ring-2 data-[state=open]:ring-suite"
      >
        <Settings2 className="size-4 text-suite" aria-hidden />
        <span className="hidden sm:inline">Suite settings</span>
        <Menu className="size-4 text-ink-mute" aria-hidden />
      </MenuTrigger>
      <MenuContent style={style}>
        <MenuLabel>This suite</MenuLabel>
        <MenuItem
          icon={<PencilLine className="size-4" />}
          label="Edit suite details"
          description="Rename it or change the description"
          onSelect={onEdit}
          disabled={!canEditSuite(role)}
          disabledReason={NEEDS_EDIT}
        />
        <MenuItem
          icon={<UserPlus className="size-4" />}
          label="Share suite"
          description="Invite people and manage their access"
          onSelect={onShare}
          disabled={!canShareSuite(role)}
          disabledReason={NEEDS_ADMIN}
        />
        <MenuSeparator />
        <MenuItem
          icon={<Trash2 className="size-4" />}
          label="Delete suite"
          description="Permanently removes the suite and all its tests"
          onSelect={onDelete}
          disabled={!canDeleteSuite(role)}
          disabledReason={NEEDS_ADMIN}
          danger
        />
      </MenuContent>
    </MenuRoot>
  )
}
