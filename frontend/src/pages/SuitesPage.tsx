import { FolderOpen, Plus, Users } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useCreateSuite, useSuites } from '@/api/suites'
import { useCurrentUser } from '@/auth/context'
import { AppHeader } from '@/components/AppHeader'
import { NewSuiteCard, SuiteCard, SuiteCardSkeleton } from '@/components/suites/SuiteCard'
import { SuiteFormModal } from '@/components/suites/SuiteFormModal'
import { Button } from '@/components/ui/Button'
import { errorMessage } from '@/lib/api'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export function SuitesPage() {
  const user = useCurrentUser()
  const navigate = useNavigate()
  const suites = useSuites()
  const createSuite = useCreateSuite()
  const [creating, setCreating] = useState(false)

  const owned = suites.data?.owned ?? []
  const shared = suites.data?.shared ?? []

  const openCreate = () => {
    createSuite.reset()
    setCreating(true)
  }

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-[1400px] px-5 pt-12 pb-24 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="animate-rise">
            <p className="font-mono text-xs tracking-[0.18em] text-accent uppercase">
              {greeting()}, @{user.username}
            </p>
            <h1 className="mt-3 font-display-soft text-5xl font-semibold tracking-tight">
              Test suites
            </h1>
            <p className="mt-3 max-w-2xl text-ink-soft">
              Each suite is a folder of end-to-end tests. Open one to see its tests, record results
              and share it with your team.
            </p>
          </div>
          <Button size="lg" icon={<Plus className="size-5" />} onClick={openCreate}>
            New suite
          </Button>
        </div>

        {suites.isError && (
          <p role="alert" className="mt-10 rounded-2xl bg-danger-soft px-5 py-4 text-danger">
            Couldn’t load your suites. {errorMessage(suites.error)}{' '}
            <button className="font-semibold underline" onClick={() => void suites.refetch()}>
              Try again
            </button>
          </p>
        )}

        <Section
          icon={<FolderOpen className="size-5" />}
          title="Your suites"
          count={suites.isPending ? undefined : owned.length}
          description="Suites you created. You own them: you can edit, share and delete them."
        >
          {suites.isPending ? (
            <SkeletonGrid />
          ) : (
            <Grid>
              <NewSuiteCard onClick={openCreate} />
              {owned.map((suite, i) => (
                <SuiteCard key={suite.suite_id} suite={suite} index={i + 1} />
              ))}
            </Grid>
          )}
        </Section>

        <Divider label="Shared with you" />

        <Section
          icon={<Users className="size-5" />}
          title="Shared suites"
          count={suites.isPending ? undefined : shared.length}
          description="Suites teammates have shared with you. The badge shows what you're allowed to do in each."
        >
          {suites.isPending ? (
            <SkeletonGrid count={2} />
          ) : shared.length === 0 ? (
            <div className="rounded-[30px] border-2 border-dashed border-rule px-8 py-12 text-center">
              <p className="font-display text-xl font-semibold">Nothing shared with you yet</p>
              <p className="mx-auto mt-2 max-w-md text-sm text-ink-mute">
                When someone shares a suite with you, it shows up here. They’ll need your Testlab ID
                — <span className="font-mono font-semibold text-ink">#{user.user_id}</span> — which
                you can also copy from your account menu.
              </p>
            </div>
          ) : (
            <Grid>
              {shared.map((suite, i) => (
                <SuiteCard key={suite.suite_id} suite={suite} index={i} />
              ))}
            </Grid>
          )}
        </Section>
      </main>

      <SuiteFormModal
        open={creating}
        onOpenChange={setCreating}
        saving={createSuite.isPending}
        error={createSuite.error ? errorMessage(createSuite.error) : undefined}
        onSubmit={(input) =>
          createSuite.mutate(input, {
            onSuccess: (suite) => {
              setCreating(false)
              toast.success(`Created “${suite.suite_name}”`)
              void navigate(`/suites/${suite.suite_id}`)
            },
          })
        }
      />
    </>
  )
}

function Section({
  icon,
  title,
  count,
  description,
  children,
}: {
  icon: ReactNode
  title: string
  count?: number
  description: string
  children: ReactNode
}) {
  return (
    <section className="mt-12" aria-labelledby={`${title}-heading`}>
      <div className="mb-6 flex items-start gap-3">
        <span className="mt-1 text-ink-mute">{icon}</span>
        <div>
          <h2
            id={`${title}-heading`}
            className="flex items-baseline gap-3 font-display text-2xl font-semibold"
          >
            {title}
            {count !== undefined && (
              <span className="rounded-full bg-ink/6 px-2.5 py-0.5 font-mono text-sm font-medium text-ink-soft">
                {count}
              </span>
            )}
          </h2>
          <p className="mt-1 text-sm text-ink-mute">{description}</p>
        </div>
      </div>
      {children}
    </section>
  )
}

function Grid({ children }: { children: ReactNode }) {
  return <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">{children}</div>
}

function SkeletonGrid({ count = 3 }: { count?: number }) {
  return (
    <Grid>
      {Array.from({ length: count }, (_, i) => (
        <SuiteCardSkeleton key={i} />
      ))}
    </Grid>
  )
}

function Divider({ label }: { label: string }) {
  return (
    <div className="mt-16 flex items-center gap-5" role="separator" aria-label={label}>
      <span className="h-px flex-1 bg-[repeating-linear-gradient(90deg,var(--color-rule)_0_8px,transparent_8px_14px)]" />
      <span className="flex items-center gap-2 font-mono text-xs tracking-[0.2em] text-ink-mute uppercase">
        <span aria-hidden>✦</span> {label} <span aria-hidden>✦</span>
      </span>
      <span className="h-px flex-1 bg-[repeating-linear-gradient(90deg,var(--color-rule)_0_8px,transparent_8px_14px)]" />
    </div>
  )
}
