import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import clsx from 'clsx'
import { ArrowDown, ArrowUp, Check, ChevronDown, Layers, RotateCcw } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { toast } from 'sonner'
import { useEnvironments, usePromoteSuite } from '@/api/environments'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Tooltip } from '@/components/ui/Tooltip'
import { errorMessage } from '@/lib/api'
import { envColor, envLabel } from '@/lib/environment'
import type { Environment, Suite, TestRow } from '@/lib/types'
import { EnvironmentDot } from './EnvironmentDot'

interface EnvironmentBadgeProps {
  suite: Suite
  tests: TestRow[]
  canPromote: boolean
  readOnlyReason?: string
  /** Suite colour variables, so portalled menus and dialogs keep the theme. */
  style?: CSSProperties
}

/**
 * Shows the suite's current environment and, for editors, doubles as the
 * control for moving it through the suite owner's pipeline.
 */
export function EnvironmentBadge({
  suite,
  tests,
  canPromote,
  readOnlyReason,
  style,
}: EnvironmentBadgeProps) {
  // The pipeline is always the suite owner's, even when a collaborator is viewing.
  const environments = useEnvironments(suite.owner_id)
  const promote = usePromoteSuite(suite.suite_id)
  const [pendingPromotion, setPendingPromotion] = useState<Environment | null>(null)
  const [glowing, setGlowing] = useState(false)
  const glowTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(glowTimer.current), [])

  const pipeline = environments.data ?? []
  const currentIndex = pipeline.findIndex((e) => e.environment_id === suite.environment_id)
  const current = pipeline[currentIndex]

  if (environments.isPending) {
    return (
      <span
        className="h-8 w-24 animate-pulse rounded-full bg-paper-deep"
        aria-label="Loading environment"
      />
    )
  }
  if (environments.isError || !current) {
    return (
      <Tooltip
        content={
          environments.isError
            ? errorMessage(environments.error)
            : 'This suite’s environment could not be found.'
        }
      >
        <span className="inline-flex h-8 items-center gap-2 rounded-full bg-card px-3 text-xs font-semibold text-ink-mute ring-1 ring-rule ring-inset">
          <Layers className="size-3.5" aria-hidden /> Environment unavailable
        </span>
      </Tooltip>
    )
  }

  const currentColor = envColor(currentIndex, pipeline.length)

  const move = (target: Environment) => {
    const promoting = target.rank > current.rank
    promote.mutate(target.environment_id, {
      onSuccess: (res) => {
        setPendingPromotion(null)
        clearTimeout(glowTimer.current)
        setGlowing(true)
        glowTimer.current = setTimeout(() => setGlowing(false), 3500)
        toast.success(
          promoting
            ? `Promoted to ${envLabel(target.slug)} · ${res.test_rows_updated} test${res.test_rows_updated === 1 ? '' : 's'} reset to Untested`
            : `Moved back to ${envLabel(target.slug)} · test results kept`,
        )
      },
      onError: (e) => toast.error(`Couldn’t change environment: ${errorMessage(e)}`),
    })
  }

  const onSelect = (target: Environment) => {
    if (target.environment_id === current.environment_id) return
    // Promotions wipe results, so they need an explicit confirmation; demotions don't.
    if (target.rank > current.rank) setPendingPromotion(target)
    else move(target)
  }

  const badge = (
    <span
      className={clsx(
        'inline-flex h-8 items-center gap-2 rounded-full bg-card pr-2.5 pl-3 font-mono text-xs font-semibold tracking-[0.08em] text-ink shadow-card ring-1 ring-rule-soft ring-inset',
      )}
    >
      <EnvironmentDot color={currentColor} glowing={glowing} />
      {envLabel(current.slug)}
      {canPromote && (
        <ChevronDown
          className="size-3.5 text-ink-mute transition group-data-[state=open]/env:rotate-180"
          aria-hidden
        />
      )}
    </span>
  )

  if (!canPromote) {
    return (
      <Tooltip content={readOnlyReason ?? 'Current environment'}>
        <span className="inline-flex" aria-label={`Environment: ${envLabel(current.slug)}`}>
          {badge}
        </span>
      </Tooltip>
    )
  }

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          className="group/env rounded-full transition hover:brightness-[0.98] disabled:opacity-60"
          aria-label={`Environment: ${envLabel(current.slug)}. Change environment`}
          disabled={promote.isPending}
        >
          {badge}
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="start"
            sideOffset={8}
            style={style}
            className="z-50 w-80 animate-fade rounded-2xl bg-card p-1.5 shadow-pop"
          >
            <DropdownMenu.Label className="px-3 pt-2 pb-1">
              <span className="block text-[11px] font-semibold tracking-[0.12em] text-ink-mute uppercase">
                Move suite to
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-ink-mute">
                Moving forward resets every test to Untested for a fresh round. Moving back keeps
                results.
              </span>
            </DropdownMenu.Label>
            <DropdownMenu.Separator className="mx-2 my-1.5 h-px bg-rule-soft" />
            {pipeline.map((env, i) => {
              const isCurrent = env.environment_id === current.environment_id
              const direction =
                env.rank > current.rank ? 'up' : env.rank < current.rank ? 'down' : null
              return (
                <DropdownMenu.Item
                  key={env.environment_id}
                  onSelect={() => onSelect(env)}
                  disabled={isCurrent}
                  className={clsx(
                    'flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 outline-none select-none',
                    'data-highlighted:bg-suite-tint',
                    isCurrent && 'cursor-default bg-paper-deep/60',
                  )}
                >
                  <span className="w-4 text-right font-mono text-[11px] text-ink-mute">
                    {i + 1}
                  </span>
                  <EnvironmentDot color={envColor(i, pipeline.length)} />
                  <span className="flex-1 font-mono text-sm font-semibold tracking-[0.06em]">
                    {envLabel(env.slug)}
                  </span>
                  {isCurrent ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-ink">
                      <Check className="size-3.5" aria-hidden /> Current
                    </span>
                  ) : direction === 'up' ? (
                    <span className="inline-flex items-center gap-1 text-xs text-ink-mute">
                      <ArrowUp className="size-3.5" aria-hidden /> Promote · resets
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-ink-mute">
                      <ArrowDown className="size-3.5" aria-hidden /> Move back
                    </span>
                  )}
                </DropdownMenu.Item>
              )
            })}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      {pendingPromotion && (
        <PromoteConfirm
          from={current}
          to={pendingPromotion}
          toColor={envColor(
            pipeline.findIndex((e) => e.environment_id === pendingPromotion.environment_id),
            pipeline.length,
          )}
          tests={tests}
          loading={promote.isPending}
          style={style}
          onCancel={() => setPendingPromotion(null)}
          onConfirm={() => move(pendingPromotion)}
        />
      )}
    </>
  )
}

function PromoteConfirm({
  from,
  to,
  toColor,
  tests,
  loading,
  style,
  onCancel,
  onConfirm,
}: {
  from: Environment
  to: Environment
  toColor: string
  tests: TestRow[]
  loading: boolean
  style?: CSSProperties
  onCancel: () => void
  onConfirm: () => void
}) {
  const withResults = tests.filter((t) => t.status !== 'untested')
  const passed = withResults.filter((t) => t.status === 'passed').length
  const failed = withResults.filter((t) => t.status === 'failed').length
  const inProgress = withResults.length - passed - failed

  const breakdown = [
    passed && `${passed} passed`,
    failed && `${failed} failed`,
    inProgress && `${inProgress} in progress`,
  ].filter(Boolean)

  return (
    <Modal
      open
      onOpenChange={(open) => !open && onCancel()}
      size="sm"
      style={style}
      icon={<RotateCcw className="size-5" />}
      title={`Promote to ${envLabel(to.slug)}?`}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="suite" loading={loading} onClick={onConfirm}>
            Promote and reset
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm leading-relaxed text-ink-soft">
        <p className="flex items-center gap-2 font-mono text-xs font-semibold tracking-[0.08em] text-ink">
          {envLabel(from.slug)}
          <span aria-hidden className="text-ink-mute">
            →
          </span>
          <EnvironmentDot color={toColor} />
          {envLabel(to.slug)}
        </p>
        {tests.length === 0 ? (
          <p>This suite has no tests yet, so nothing will be reset.</p>
        ) : (
          <p>
            Promoting to <strong className="text-ink">{envLabel(to.slug)}</strong> will reset{' '}
            <strong className="text-ink">
              {tests.length} test row{tests.length === 1 ? '' : 's'}
            </strong>{' '}
            to <em>Untested</em> so the next round starts clean.
            {withResults.length > 0 && (
              <>
                {' '}
                Results recorded in {envLabel(from.slug)} ({breakdown.join(', ')}) will be cleared.
              </>
            )}
          </p>
        )}
        <p className="text-xs text-ink-mute">
          Moving a suite back to an earlier environment never resets results.
        </p>
      </div>
    </Modal>
  )
}
