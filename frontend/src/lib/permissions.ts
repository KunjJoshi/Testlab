import type { AccessScope, SuiteRole } from './types'

/* Mirrors the checks in testlab-backend so the UI never offers a doomed action. */

export const canEditTests = (role: SuiteRole) => role !== 'read'
export const canEditSuite = (role: SuiteRole) => role !== 'read'
export const canShareSuite = (role: SuiteRole) => role === 'owner' || role === 'admin'
export const canDeleteSuite = (role: SuiteRole) => role === 'owner' || role === 'admin'

export const ROLE_LABEL: Record<SuiteRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  write: 'Can edit',
  read: 'View only',
}

export const ACCESS_OPTIONS: { value: AccessScope; label: string; description: string }[] = [
  { value: 'read', label: 'View only', description: 'Can see the suite and its tests.' },
  {
    value: 'write',
    label: 'Can edit',
    description: 'Can add, edit, import and delete tests, and rename the suite.',
  },
  {
    value: 'admin',
    label: 'Admin',
    description: 'Everything above, plus sharing and deleting the suite.',
  },
]

export const READ_ONLY_HINT = 'You have view-only access to this suite.'
