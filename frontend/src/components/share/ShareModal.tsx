import * as Select from '@radix-ui/react-select'
import clsx from 'clsx'
import { Check, ChevronDown, LoaderCircle, Search, UserMinus, UserPlus, Users } from 'lucide-react'
import { useState, type CSSProperties } from 'react'
import { toast } from 'sonner'
import { useCollaborators, useRemoveAccess, useShareSuite, useUpdateAccess } from '@/api/access'
import { useUserSearch } from '@/api/users'
import { Avatar } from '@/components/ui/Avatar'
import { Button, IconButton } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { errorMessage } from '@/lib/api'
import { ACCESS_OPTIONS } from '@/lib/permissions'
import type { AccessScope, UserSearchResult } from '@/lib/types'

interface ShareModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  suiteId: number
  suiteName: string
  ownerId: number
  /** Known for suites shared with the current user. */
  ownerName?: string
  currentUserId: number
  style?: CSSProperties
}

export function ShareModal(props: ShareModalProps) {
  return props.open ? <Share {...props} /> : null
}

function Share({
  open,
  onOpenChange,
  suiteId,
  suiteName,
  ownerId,
  ownerName,
  currentUserId,
  style,
}: ShareModalProps) {
  const ownerLabel =
    ownerId === currentUserId ? 'You' : ownerName ? `@${ownerName}` : `User #${ownerId}`
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<UserSearchResult | null>(null)
  const [scope, setScope] = useState<AccessScope>('read')

  const search = useUserSearch(selected ? '' : query)
  const collaborators = useCollaborators(suiteId)
  const share = useShareSuite(suiteId)
  const update = useUpdateAccess(suiteId)
  const remove = useRemoveAccess(suiteId)

  const existing = new Set((collaborators.data ?? []).map((c) => c.user_id))
  const results = (search.data ?? []).filter(
    (u) => u.user_id !== ownerId && u.user_id !== currentUserId,
  )

  const submit = () => {
    if (!selected) return
    share.mutate(
      { userId: selected.user_id, scope },
      {
        onSuccess: () => {
          toast.success(`Shared with ${selected.username}`)
          setSelected(null)
          setQuery('')
        },
      },
    )
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      style={style}
      size="lg"
      icon={<UserPlus className="size-5" />}
      title="Share suite"
      description={
        <>
          Give teammates access to <strong className="text-ink">{suiteName}</strong> and all of its
          tests. They’ll see it under “Shared with you”.
        </>
      }
    >
      <div className="space-y-6">
        {/* Add someone */}
        <div className="rounded-[22px] bg-suite-tint p-5 ring-1 ring-suite/15">
          <label htmlFor="share-search" className="text-[13px] font-semibold">
            Find a Testlab user
          </label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              {selected ? (
                <div className="flex h-11 items-center gap-2.5 rounded-xl bg-white pr-2 pl-2 ring-2 ring-suite">
                  <Avatar
                    name={selected.username}
                    seed={selected.user_id}
                    size={28}
                    src={selected.avatar_url}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                    {selected.username}
                    <span className="ml-2 font-mono text-xs font-normal text-ink-mute">
                      #{selected.user_id}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    className="rounded-lg px-2 py-1 text-xs font-semibold text-ink-mute hover:bg-ink/5 hover:text-ink"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <>
                  <Search
                    className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-mute"
                    aria-hidden
                  />
                  <input
                    id="share-search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Username or user ID, e.g. 42"
                    autoComplete="off"
                    autoFocus
                    role="combobox"
                    aria-expanded={results.length > 0}
                    aria-controls="share-results"
                    className="h-11 w-full rounded-xl bg-white pr-10 pl-10 text-[15px] ring-1 ring-rule ring-inset placeholder:text-ink-mute/70 focus:ring-2 focus:ring-suite focus:outline-none"
                  />
                  {search.isFetching && (
                    <LoaderCircle
                      className="absolute top-1/2 right-3.5 size-4 -translate-y-1/2 animate-spin text-ink-mute"
                      aria-hidden
                    />
                  )}
                </>
              )}

              {!selected && query.trim() && (
                <ul
                  id="share-results"
                  role="listbox"
                  aria-label="Matching users"
                  className="absolute inset-x-0 top-12 z-10 max-h-64 overflow-y-auto rounded-2xl bg-card p-1.5 shadow-pop"
                >
                  {results.length === 0 && !search.isFetching && (
                    <li className="px-3 py-3 text-sm text-ink-mute">No users match “{query}”.</li>
                  )}
                  {results.map((u) => {
                    const already = existing.has(u.user_id)
                    return (
                      <li
                        key={u.user_id}
                        role="option"
                        aria-selected={false}
                        aria-disabled={already}
                      >
                        <button
                          type="button"
                          disabled={already}
                          onClick={() => setSelected(u)}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-suite-tint disabled:opacity-50"
                        >
                          <Avatar name={u.username} seed={u.user_id} size={30} src={u.avatar_url} />
                          <span className="flex-1 text-sm font-semibold">{u.username}</span>
                          {u.isSample && (
                            <span className="rounded-full bg-progress-soft px-2 py-0.5 text-[10px] font-semibold text-progress">
                              sample
                            </span>
                          )}
                          <span className="font-mono text-xs text-ink-mute">
                            {already ? 'already added' : `#${u.user_id}`}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
            <AccessSelect value={scope} onChange={setScope} label="Access to give" />
            <Button
              variant="suite"
              className="h-11"
              disabled={!selected}
              loading={share.isPending}
              onClick={submit}
            >
              Share
            </Button>
          </div>
          <p className="mt-2 text-xs text-ink-mute">
            User search is a preview — names marked <em>sample</em> are placeholders. Typing a
            numeric Testlab ID always shares with that exact account.
          </p>
          {share.error && (
            <p
              role="alert"
              className="mt-3 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger"
            >
              {errorMessage(share.error)}
            </p>
          )}

          <dl className="mt-4 grid gap-2 sm:grid-cols-3">
            {ACCESS_OPTIONS.map((o) => (
              <div
                key={o.value}
                className={clsx(
                  'rounded-xl px-3 py-2 text-xs ring-1 transition ring-inset',
                  scope === o.value ? 'bg-white ring-suite' : 'ring-transparent',
                )}
              >
                <dt className="font-semibold text-ink">{o.label}</dt>
                <dd className="mt-0.5 leading-relaxed text-ink-mute">{o.description}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* People with access */}
        <div>
          <h3 className="flex items-center gap-2 font-display text-lg font-semibold">
            <Users className="size-4 text-suite" aria-hidden />
            People with access
          </h3>
          <ul className="mt-3 divide-y divide-rule-soft rounded-2xl ring-1 ring-rule-soft">
            <li className="flex items-center gap-3 px-4 py-3">
              <Avatar name={ownerName ?? ownerLabel} seed={ownerId} size={32} />
              <span className="flex-1 text-sm">
                <span className="font-semibold">{ownerLabel}</span>
                <span className="ml-2 font-mono text-xs text-ink-mute">#{ownerId}</span>
              </span>
              <span className="rounded-full bg-ink px-2.5 py-1 text-xs font-semibold text-paper">
                Owner
              </span>
            </li>
            {collaborators.isPending && (
              <li className="flex items-center gap-2 px-4 py-4 text-sm text-ink-mute">
                <LoaderCircle className="size-4 animate-spin" aria-hidden /> Loading…
              </li>
            )}
            {collaborators.isError && (
              <li className="px-4 py-3 text-sm text-danger">{errorMessage(collaborators.error)}</li>
            )}
            {collaborators.data?.length === 0 && (
              <li className="px-4 py-4 text-sm text-ink-mute">Not shared with anyone yet.</li>
            )}
            {collaborators.data?.map((c) => (
              <li key={c.sharing_id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <Avatar
                  name={c.username || `#${c.user_id}`}
                  src={c.avatar_url}
                  seed={c.user_id}
                  size={32}
                />
                <span className="min-w-0 flex-1 text-sm">
                  <span className="font-semibold">
                    {c.user_id === currentUserId
                      ? 'You'
                      : c.username
                        ? `@${c.username}`
                        : `User #${c.user_id}`}
                  </span>
                  <span className="ml-2 font-mono text-xs text-ink-mute">#{c.user_id}</span>
                </span>
                <AccessSelect
                  value={c.access_scope}
                  label={`Access for ${c.username || c.user_id}`}
                  compact
                  onChange={(next) =>
                    update.mutate(
                      { userId: c.user_id, scope: next },
                      {
                        onSuccess: () =>
                          toast.success(`Updated access for ${c.username || `#${c.user_id}`}`),
                        onError: (e) => toast.error(errorMessage(e)),
                      },
                    )
                  }
                />
                <IconButton
                  label={`Remove ${c.username || `user #${c.user_id}`}`}
                  tone="danger"
                  disabled={remove.isPending && remove.variables === c.user_id}
                  onClick={() =>
                    remove.mutate(c.user_id, {
                      onSuccess: () => toast.success(`Removed ${c.username || `#${c.user_id}`}`),
                      onError: (e) => toast.error(errorMessage(e)),
                    })
                  }
                >
                  <UserMinus className="size-4" />
                </IconButton>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Modal>
  )
}

function AccessSelect({
  value,
  onChange,
  label,
  compact,
}: {
  value: AccessScope
  onChange: (scope: AccessScope) => void
  label: string
  compact?: boolean
}) {
  const current = ACCESS_OPTIONS.find((o) => o.value === value)
  return (
    <Select.Root value={value} onValueChange={(v) => onChange(v as AccessScope)}>
      <Select.Trigger
        aria-label={label}
        className={clsx(
          'inline-flex items-center justify-between gap-2 rounded-xl bg-white px-3 text-sm font-semibold ring-1 ring-rule ring-inset hover:ring-ink-mute',
          compact ? 'h-9 min-w-32' : 'h-11 min-w-36',
        )}
      >
        <Select.Value>{current?.label}</Select.Value>
        <Select.Icon>
          <ChevronDown className="size-4 text-ink-mute" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={6}
          className="z-[60] w-72 animate-fade rounded-2xl bg-card p-1.5 shadow-pop"
        >
          <Select.Viewport>
            {ACCESS_OPTIONS.map((o) => (
              <Select.Item
                key={o.value}
                value={o.value}
                className="flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2 outline-none data-highlighted:bg-paper-deep"
              >
                <span className="flex flex-1 flex-col">
                  <Select.ItemText>
                    <span className="text-sm font-semibold">{o.label}</span>
                  </Select.ItemText>
                  <span className="text-xs text-ink-mute">{o.description}</span>
                </span>
                <Select.ItemIndicator>
                  <Check className="mt-0.5 size-4" />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  )
}
