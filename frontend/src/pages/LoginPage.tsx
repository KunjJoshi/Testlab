import { ArrowRight, Info, ShieldCheck } from 'lucide-react'
import { Navigate, useSearchParams } from 'react-router'
import { useAuth } from '@/auth/context'
import { GithubMark, Logo } from '@/components/ui/Brand'
import { Button } from '@/components/ui/Button'
import { FullPageSpinner } from '@/components/ui/FullPage'
import { StatusChip } from '@/components/tests/StatusSelect'
import { suitePalette } from '@/lib/suiteColor'
import type { TestStatus } from '@/lib/types'

const NEXT_KEY = 'testlab:after-login'

const REASONS: Record<string, string> = {
  expired: 'Your session expired. Sign in again to pick up where you left off.',
  'signed-out': 'You have been logged out.',
}

export function LoginPage() {
  const { status, login } = useAuth()
  const [params] = useSearchParams()
  const reason = REASONS[params.get('reason') ?? '']
  const error = params.get('error')

  if (status === 'loading') return <FullPageSpinner label="Checking your session…" />
  if (status === 'signed-in') {
    const next = readNext(params.get('next'))
    return <Navigate to={next} replace />
  }

  const signIn = () => {
    const next = params.get('next')
    try {
      if (next) sessionStorage.setItem(NEXT_KEY, next)
    } catch {
      // Storage unavailable; we just land on the home page.
    }
    login()
  }

  return (
    <main className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <section className="flex flex-col justify-between gap-12 px-6 py-10 sm:px-12 lg:px-16">
        <Logo />

        <div className="max-w-md animate-rise">
          <p className="mb-5 font-mono text-xs tracking-[0.18em] text-accent uppercase">
            End-to-end test notebook
          </p>
          <h1 className="font-display-soft text-5xl leading-[1.02] font-semibold tracking-tight sm:text-6xl">
            Every test, every run, <em className="text-accent">written down.</em>
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-ink-soft">
            Group tests into suites, record the steps and the response you expect, and mark each one
            as it passes or fails. Share a suite and your whole team works from the same page.
          </p>

          {(reason || error) && (
            <p
              role="status"
              className="mt-8 flex items-start gap-2.5 rounded-2xl bg-card px-4 py-3 text-sm text-ink-soft ring-1 ring-rule"
            >
              <Info className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
              {error ? `GitHub sign-in didn’t complete: ${error}` : reason}
            </p>
          )}

          <Button
            size="lg"
            onClick={signIn}
            className="mt-8 w-full sm:w-auto"
            icon={<GithubMark className="size-5" />}
          >
            Log in with GitHub
            <ArrowRight className="size-4 opacity-70" aria-hidden />
          </Button>

          <p className="mt-4 flex items-start gap-2 text-sm leading-relaxed text-ink-mute">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
            You’ll be taken to GitHub to approve access, then brought straight back here. Testlab
            only asks to read your GitHub profile and email address.
          </p>
        </div>

        <p className="text-xs text-ink-mute">Open source · Sign-in requires a GitHub account</p>
      </section>

      <HeroCollage />
    </main>
  )
}

function readNext(fromQuery: string | null): string {
  let next = fromQuery
  try {
    next ??= sessionStorage.getItem(NEXT_KEY)
    sessionStorage.removeItem(NEXT_KEY)
  } catch {
    // ignore
  }
  // Only same-app paths; never an absolute URL.
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/'
}

const SAMPLE: { id: number; name: string; tests: [string, number, TestStatus][] }[] = [
  {
    id: 0,
    name: 'Checkout flow',
    tests: [
      ['Pay with saved card', 201, 'passed'],
      ['Expired coupon is rejected', 422, 'failed'],
      ['Guest checkout', 200, 'in_progress'],
    ],
  },
  { id: 5, name: 'Auth & sessions', tests: [['Refresh an expired token', 401, 'untested']] },
  { id: 1, name: 'Search API', tests: [['Empty query returns 400', 400, 'passed']] },
]

function HeroCollage() {
  return (
    <section
      aria-hidden
      className="relative hidden overflow-hidden border-l border-rule-soft bg-paper-deep lg:block"
    >
      <svg className="absolute -top-24 -right-24 size-[520px] opacity-90" viewBox="0 0 200 200">
        <path
          fill={suitePalette(0).soft}
          d="M44.7,-58.5C57.1,-47.6,65.6,-32.4,70.1,-15.6C74.6,1.2,75.1,19.6,67.3,33.8C59.5,48,43.4,58,26.3,64.5C9.2,71,-8.9,74,-26.6,69.5C-44.3,65,-61.6,53,-70,36.5C-78.4,20,-78,-1,-71.2,-18.9C-64.4,-36.8,-51.2,-51.6,-36.2,-62C-21.2,-72.4,-4.4,-78.4,11.5,-76.5C27.4,-74.6,32.3,-69.4,44.7,-58.5Z"
          transform="translate(100 100)"
        />
      </svg>
      <svg className="absolute -bottom-32 -left-20 size-[460px]" viewBox="0 0 200 200">
        <path
          fill={suitePalette(1).soft}
          d="M39.5,-49.8C50.4,-38.7,58.1,-25.4,62.6,-10.2C67.1,5,68.4,22.1,61,34.4C53.6,46.7,37.5,54.2,21.2,59.7C4.9,65.2,-11.6,68.7,-27.4,64.3C-43.2,59.9,-58.3,47.6,-66.1,31.6C-73.9,15.6,-74.4,-4.1,-67.6,-20.1C-60.8,-36.1,-46.7,-48.4,-32.1,-58.6C-17.5,-68.8,-2.4,-76.9,10.6,-74.5C23.6,-72.1,28.6,-60.9,39.5,-49.8Z"
          transform="translate(100 100)"
        />
      </svg>

      <div className="relative flex h-full items-center justify-center p-16">
        <div className="relative w-full max-w-md">
          {SAMPLE.map((suite, i) => {
            const p = suitePalette(suite.id)
            return (
              <div
                key={suite.name}
                className="absolute w-full animate-rise rounded-[28px] bg-card p-6 shadow-lift"
                style={{
                  top: `${i * 64}px`,
                  left: `${i * 28}px`,
                  rotate: `${[-3, 2.5, -1.5][i]}deg`,
                  zIndex: 3 - i,
                  animationDelay: `${120 + i * 110}ms`,
                }}
              >
                <div className="mb-4 flex items-center gap-3">
                  <span className="size-3 rounded-full" style={{ background: p.base }} />
                  <span className="font-display text-xl font-semibold">{suite.name}</span>
                </div>
                <ul className="space-y-2.5">
                  {suite.tests.map(([name, code, status]) => (
                    <li key={name} className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate text-ink-soft">{name}</span>
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-xs text-ink-mute">{code}</span>
                        <StatusChip status={status} />
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
          <div className="h-[340px]" />
        </div>
      </div>
    </section>
  )
}
