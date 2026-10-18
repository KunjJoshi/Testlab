import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Layers,
  ListOrdered,
  PencilLine,
  Plus,
  RotateCcw,
  Trash2,
  Users,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import {
  useCreateEnvironment,
  useDeleteEnvironment,
  useEnvironments,
  useRenameEnvironment,
  useReorderEnvironments,
} from '@/api/environments'
import { useSuites } from '@/api/suites'
import { useCurrentUser } from '@/auth/context'
import { AppHeader } from '@/components/AppHeader'
import { EnvironmentDot } from '@/components/environments/EnvironmentDot'
import { EnvironmentFormModal } from '@/components/environments/EnvironmentFormModal'
import { ReorderEnvironmentsModal } from '@/components/environments/ReorderEnvironmentsModal'
import { Button, IconButton } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Tooltip } from '@/components/ui/Tooltip'
import { ApiError, errorMessage } from '@/lib/api'
import { envColor, envLabel } from '@/lib/environment'
import type { Environment } from '@/lib/types'

type Dialog = { kind: 'add' } | { kind: 'rename'; env: Environment } | { kind: 'reorder' } | null

export function EnvironmentsPage() {
  const user = useCurrentUser()
  const environments = useEnvironments(user.user_id)
  const suites = useSuites()
  const create = useCreateEnvironment(user.user_id)
  const rename = useRenameEnvironment(user.user_id)
  const reorder = useReorderEnvironments(user.user_id)
  const remove = useDeleteEnvironment(user.user_id)

  const [dialog, setDialog] = useState<Dialog>(null)
  const [toDelete, setToDelete] = useState<Environment | null>(null)

  const pipeline = environments.data ?? []
  // Only your own suites can sit in your environments.
  const suitesIn = (env: Environment) =>
    (suites.data?.owned ?? []).filter((s) => s.environment_id === env.environment_id).length

  const open = (d: Dialog) => {
    create.reset()
    rename.reset()
    reorder.reset()
    setDialog(d)
  }
  const close = (isOpen: boolean) => !isOpen && setDialog(null)

  return (
    <>
      <AppHeader>
        <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-2 text-sm md:flex">
          <ChevronRight className="size-4 shrink-0 text-ink-mute" aria-hidden />
          <span aria-current="page" className="truncate font-semibold">
            Environments
          </span>
        </nav>
      </AppHeader>

      <main className="mx-auto max-w-[1100px] px-5 pt-8 pb-24 sm:px-8">
        <Link
          to="/"
          className="group inline-flex items-center gap-2 rounded-xl py-1.5 pr-3 pl-2 text-sm font-semibold text-ink-soft transition hover:bg-card hover:text-ink"
        >
          <ArrowLeft className="size-4 transition group-hover:-translate-x-0.5" aria-hidden />
          Back to all suites
        </Link>

        <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl animate-rise">
            <p className="font-mono text-xs tracking-[0.18em] text-accent uppercase">
              Your pipeline
            </p>
            <h1 className="mt-3 font-display-soft text-5xl font-semibold tracking-tight">
              Environments
            </h1>
            <p className="mt-3 text-ink-soft">
              Environments are the stages a suite moves through as it’s tested, from your machine to
              production. Every suite you own is always in exactly one of them, shown by the badge
              at the top of the suite.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Tooltip
              content={
                pipeline.length < 2
                  ? 'Add at least two environments to reorder them.'
                  : 'Drag environments into a new pipeline order'
              }
            >
              <span className="inline-flex">
                <Button
                  variant="secondary"
                  icon={<ListOrdered className="size-4" />}
                  disabled={pipeline.length < 2}
                  onClick={() => open({ kind: 'reorder' })}
                >
                  Edit environments
                </Button>
              </span>
            </Tooltip>
            <Button icon={<Plus className="size-4" />} onClick={() => open({ kind: 'add' })}>
              Add new
            </Button>
          </div>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <Explainer icon={<ArrowRight className="size-4" />} title="Order is the pipeline">
            Top to bottom is the order suites move in. New suites start in the first environment.
          </Explainer>
          <Explainer icon={<RotateCcw className="size-4" />} title="Promoting starts fresh">
            Moving a suite to a later stage resets all its tests to Untested. Moving it back keeps
            the results.
          </Explainer>
          <Explainer icon={<Users className="size-4" />} title="Shared suites use your list">
            Collaborators with edit access move your suites through <em>your</em> environments, not
            their own.
          </Explainer>
        </div>

        <section className="mt-10" aria-labelledby="pipeline-heading">
          <h2 id="pipeline-heading" className="sr-only">
            Environments in pipeline order
          </h2>

          {environments.isPending ? (
            <div className="space-y-3" aria-label="Loading environments">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-[72px] animate-pulse rounded-2xl bg-paper-deep" />
              ))}
            </div>
          ) : environments.isError ? (
            <p role="alert" className="rounded-2xl bg-danger-soft px-5 py-4 text-danger">
              Couldn’t load your environments. {errorMessage(environments.error)}{' '}
              <button
                className="font-semibold underline"
                onClick={() => void environments.refetch()}
              >
                Try again
              </button>
            </p>
          ) : pipeline.length === 0 ? (
            <div className="flex flex-col items-center rounded-[28px] border-2 border-dashed border-rule px-6 py-14 text-center">
              <span className="flex size-14 items-center justify-center rounded-2xl bg-ink text-paper">
                <Layers className="size-7" aria-hidden />
              </span>
              <h3 className="mt-5 font-display text-2xl font-semibold">No environments yet</h3>
              <p className="mt-2 max-w-md text-sm text-ink-mute">
                You need at least one environment to create suites. Start with where you test first,
                for example <span className="font-mono">local</span>, then add later stages.
              </p>
              <Button
                className="mt-6"
                icon={<Plus className="size-4" />}
                onClick={() => open({ kind: 'add' })}
              >
                Add your first environment
              </Button>
            </div>
          ) : (
            <ol className="relative space-y-3">
              {pipeline.map((env, i) => {
                const count = suitesIn(env)
                const isOnly = pipeline.length === 1
                const deleteBlocked = count > 0 || isOnly
                const deleteReason = isOnly
                  ? 'You need at least one environment. New suites start in the first one.'
                  : count > 0
                    ? `${count} of your suites ${count === 1 ? 'is' : 'are'} in ${envLabel(env.slug)}. Move ${count === 1 ? 'it' : 'them'} to another environment first.`
                    : `Delete ${envLabel(env.slug)}`
                return (
                  <li
                    key={env.environment_id}
                    className="group flex animate-rise flex-wrap items-center gap-4 rounded-2xl bg-card px-5 py-4 shadow-card ring-1 ring-rule-soft"
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    <span className="w-6 text-right font-mono text-sm text-ink-mute">{i + 1}</span>
                    <EnvironmentDot color={envColor(i, pipeline.length)} />
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-base font-semibold tracking-[0.08em]">
                        {envLabel(env.slug)}
                      </p>
                      <p className="text-xs text-ink-mute">
                        {i === 0
                          ? 'First stage · new suites start here'
                          : i === pipeline.length - 1
                            ? 'Final stage'
                            : `Stage ${i + 1} of ${pipeline.length}`}
                      </p>
                    </div>
                    <span className="rounded-full bg-paper-deep px-2.5 py-1 text-xs font-semibold text-ink-soft">
                      {suites.isPending ? '…' : `${count} suite${count === 1 ? '' : 's'}`}
                    </span>
                    <div className="flex items-center gap-1">
                      <IconButton
                        label={`Rename ${envLabel(env.slug)}`}
                        onClick={() => open({ kind: 'rename', env })}
                      >
                        <PencilLine className="size-4" />
                      </IconButton>
                      <Tooltip content={deleteReason}>
                        <span className="inline-flex">
                          <IconButton
                            label={deleteReason}
                            tone="danger"
                            disabled={deleteBlocked}
                            onClick={() => setToDelete(env)}
                          >
                            <Trash2 className="size-4" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
        </section>
      </main>

      <EnvironmentFormModal
        open={dialog?.kind === 'add'}
        onOpenChange={close}
        pipeline={pipeline}
        saving={create.isPending}
        error={create.error ? errorMessage(create.error) : undefined}
        onSubmit={(slug) =>
          create.mutate(
            // Appended to the end of the pipeline.
            { slug, rank: Math.max(0, ...pipeline.map((e) => e.rank)) + 1 },
            {
              onSuccess: () => {
                setDialog(null)
                toast.success(`Added ${envLabel(slug)} to the end of your pipeline`)
              },
            },
          )
        }
      />

      <EnvironmentFormModal
        open={dialog?.kind === 'rename'}
        onOpenChange={close}
        pipeline={pipeline}
        environment={dialog?.kind === 'rename' ? dialog.env : undefined}
        saving={rename.isPending}
        error={rename.error ? errorMessage(rename.error) : undefined}
        onSubmit={(slug) =>
          dialog?.kind === 'rename' &&
          rename.mutate(
            { environment_id: dialog.env.environment_id, slug },
            {
              onSuccess: () => {
                setDialog(null)
                toast.success(`Renamed ${envLabel(dialog.env.slug)} to ${envLabel(slug)}`)
              },
            },
          )
        }
      />

      <ReorderEnvironmentsModal
        open={dialog?.kind === 'reorder'}
        onOpenChange={close}
        pipeline={pipeline}
        saving={reorder.isPending}
        error={reorder.error ? errorMessage(reorder.error) : undefined}
        onSave={(ordered) =>
          reorder.mutate(ordered, {
            onSuccess: () => {
              setDialog(null)
              toast.success(
                `Pipeline reordered: ${ordered.map((e) => envLabel(e.slug)).join(' → ')}`,
              )
            },
          })
        }
      />

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`Delete ${toDelete ? envLabel(toDelete.slug) : ''}?`}
        body={
          <p>
            It will be removed from your pipeline. No suites are in it right now. This can’t be
            undone, but you can add an environment with the same name again later.
          </p>
        }
        confirmLabel="Delete environment"
        loading={remove.isPending}
        onConfirm={() =>
          toDelete &&
          remove.mutate(toDelete.environment_id, {
            onSuccess: () => {
              toast.success(`Deleted ${envLabel(toDelete.slug)}`)
              setToDelete(null)
            },
            onError: (e) =>
              toast.error(
                // The database blocks deleting an environment a suite still uses.
                e instanceof ApiError && e.status === 500
                  ? `Couldn’t delete ${envLabel(toDelete.slug)}. A suite may still be using it. Move that suite to another environment and try again.`
                  : errorMessage(e),
              ),
          })
        }
      />
    </>
  )
}

function Explainer({
  icon,
  title,
  children,
}: {
  icon: ReactNode
  title: string
  children: ReactNode
}) {
  return (
    <div className="rounded-2xl bg-card/70 p-4 ring-1 ring-rule-soft">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <span className="text-accent">{icon}</span>
        {title}
      </p>
      <p className="mt-1.5 text-xs leading-relaxed text-ink-mute">{children}</p>
    </div>
  )
}
