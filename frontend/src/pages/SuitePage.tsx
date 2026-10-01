import { ArrowLeft, ChevronRight, Eye, FileUp, FlaskConical, ListPlus, SearchX } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { useDeleteSuite, useSuite, useUpdateSuite } from '@/api/suites'
import { useBulkImport, useCreateTest, useDeleteTest, useTests, useUpdateTest } from '@/api/tests'
import { useCurrentUser } from '@/auth/context'
import { AppHeader } from '@/components/AppHeader'
import { ShareModal } from '@/components/share/ShareModal'
import { SuiteFormModal } from '@/components/suites/SuiteFormModal'
import { SuiteSettingsMenu } from '@/components/suites/SuiteSettingsMenu'
import { BulkImportModal } from '@/components/tests/BulkImportModal'
import { StatusSummary } from '@/components/tests/StatusSummary'
import { TestFormModal } from '@/components/tests/TestFormModal'
import { TestGrid } from '@/components/tests/TestGrid'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { FullPageMessage, FullPageSpinner } from '@/components/ui/FullPage'
import { TimeAgo } from '@/components/ui/TimeAgo'
import { Tooltip } from '@/components/ui/Tooltip'
import { errorMessage } from '@/lib/api'
import { READ_ONLY_HINT, ROLE_LABEL, canEditTests } from '@/lib/permissions'
import { suiteStyle } from '@/lib/suiteColor'
import type { TestRow, TestStatus } from '@/lib/types'

type Dialog = 'edit' | 'share' | 'delete' | 'add-test' | 'import' | null

export function SuitePage() {
  const suiteId = Number(useParams().suiteId)
  const user = useCurrentUser()
  const navigate = useNavigate()

  const { suite, role, sharedBy, isPending, isError, error, refetch } = useSuite(suiteId)
  const tests = useTests(suiteId)

  const updateSuite = useUpdateSuite(suiteId)
  const deleteSuite = useDeleteSuite()
  const createTest = useCreateTest(suiteId)
  const bulkImport = useBulkImport(suiteId)
  const updateTest = useUpdateTest(suiteId)
  const deleteTest = useDeleteTest(suiteId)

  const [dialog, setDialog] = useState<Dialog>(null)
  const [testToDelete, setTestToDelete] = useState<TestRow | null>(null)
  const [filter, setFilter] = useState<TestStatus | null>(null)
  const [addResetKey, setAddResetKey] = useState(0)

  const style = suiteStyle(suiteId)

  if (!Number.isInteger(suiteId)) return <NotFound />
  if (isPending) return <FullPageSpinner label="Opening suite…" />
  if (isError) {
    return (
      <FullPageMessage title="Couldn’t load this suite" body={errorMessage(error)}>
        <Button onClick={() => void refetch()}>Try again</Button>
      </FullPageMessage>
    )
  }
  if (!suite || !role) return <NotFound />

  const editable = canEditTests(role)
  const allTests = tests.data ?? []
  const visible = filter ? allTests.filter((t) => t.status === filter) : allTests

  const open = (d: Dialog) => {
    updateSuite.reset()
    createTest.reset()
    bulkImport.reset()
    setDialog(d)
  }
  const close = (isOpen: boolean) => !isOpen && setDialog(null)

  return (
    <div
      style={style}
      className="min-h-dvh bg-[linear-gradient(to_bottom,var(--suite-tint)_0,var(--suite-tint)_340px,transparent_560px)]"
    >
      <AppHeader>
        <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-2 text-sm md:flex">
          <ChevronRight className="size-4 shrink-0 text-ink-mute" aria-hidden />
          <Link to="/" className="shrink-0 text-ink-mute hover:text-ink">
            Suites
          </Link>
          <ChevronRight className="size-4 shrink-0 text-ink-mute" aria-hidden />
          <span aria-current="page" className="truncate font-semibold">
            {suite.suite_name}
          </span>
        </nav>
      </AppHeader>

      <main className="mx-auto max-w-[1400px] px-5 pt-8 pb-24 sm:px-8">
        <div className="flex items-center justify-between gap-4">
          <Link
            to="/"
            className="group inline-flex items-center gap-2 rounded-xl py-1.5 pr-3 pl-2 text-sm font-semibold text-ink-soft transition hover:bg-card hover:text-ink"
          >
            <ArrowLeft className="size-4 transition group-hover:-translate-x-0.5" aria-hidden />
            Back to all suites
          </Link>
          <SuiteSettingsMenu
            role={role}
            style={style}
            onEdit={() => open('edit')}
            onShare={() => open('share')}
            onDelete={() => open('delete')}
          />
        </div>

        {/* Suite header */}
        <header className="mt-6 animate-rise">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs tracking-[0.14em] text-suite uppercase">
            <span className="inline-flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-suite" /> Suite #{suite.suite_id}
            </span>
          </p>
          <h1 className="mt-3 max-w-4xl font-display-soft text-5xl leading-[1.05] font-semibold tracking-tight break-words text-ink sm:text-6xl">
            {suite.suite_name}
          </h1>
          <p
            className={`mt-4 max-w-3xl text-lg leading-relaxed ${suite.suite_description ? 'text-ink-soft' : 'text-ink-mute italic'}`}
          >
            {suite.suite_description || 'No description yet.'}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-mute">
            {role === 'owner' ? (
              <span className="inline-flex items-center gap-2">
                <Avatar name={user.username} src={user.avatar_url} seed={user.user_id} size={22} />
                Owned by you
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <Avatar name={sharedBy ?? ''} seed={suite.owner_id} size={22} />
                Shared by <span className="font-semibold text-ink">@{sharedBy}</span>
              </span>
            )}
            <span className="rounded-full bg-suite-soft px-2.5 py-0.5 text-xs font-semibold text-suite-ink">
              {ROLE_LABEL[role]}
            </span>
            <TimeAgo iso={suite.updated_at} prefix="Updated" />
          </div>
        </header>

        {!editable && (
          <p className="mt-6 flex items-center gap-2.5 rounded-2xl bg-card px-4 py-3 text-sm text-ink-soft ring-1 ring-rule-soft">
            <Eye className="size-4 shrink-0 text-suite" aria-hidden />
            You have view-only access. Ask <strong className="text-ink">@{sharedBy}</strong> for
            “Can edit” access to change statuses or add tests.
          </p>
        )}

        {/* Toolbar */}
        <div className="mt-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-semibold">Tests</h2>
            <p className="mt-1 text-sm text-ink-mute">
              Each row is one end-to-end test. Most recently updated first.
              {editable && ' Hover a row to edit or delete it.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Tooltip
              content={editable ? 'Upload a JSON file to add many tests at once' : READ_ONLY_HINT}
            >
              <span className="inline-flex">
                <Button
                  variant="secondary"
                  icon={<FileUp className="size-4" />}
                  onClick={() => open('import')}
                  disabled={!editable}
                >
                  Bulk import tests
                </Button>
              </span>
            </Tooltip>
            <Tooltip content={editable ? 'Add a single test to this suite' : READ_ONLY_HINT}>
              <span className="inline-flex">
                <Button
                  variant="suite"
                  icon={<ListPlus className="size-4" />}
                  onClick={() => open('add-test')}
                  disabled={!editable}
                >
                  Add test row
                </Button>
              </span>
            </Tooltip>
          </div>
        </div>

        <div className="mt-5 space-y-5">
          {tests.isPending ? (
            <div
              className="h-64 animate-pulse rounded-[24px] bg-card/70"
              aria-label="Loading tests"
            />
          ) : tests.isError ? (
            <p role="alert" className="rounded-2xl bg-danger-soft px-5 py-4 text-danger">
              Couldn’t load tests. {errorMessage(tests.error)}{' '}
              <button className="font-semibold underline" onClick={() => void tests.refetch()}>
                Try again
              </button>
            </p>
          ) : allTests.length === 0 ? (
            <EmptyTests
              editable={editable}
              onAdd={() => open('add-test')}
              onImport={() => open('import')}
            />
          ) : (
            <>
              <StatusSummary tests={allTests} filter={filter} onFilter={setFilter} />
              {visible.length === 0 ? (
                <p className="rounded-2xl bg-card px-5 py-8 text-center text-sm text-ink-mute ring-1 ring-rule-soft">
                  No tests with this status.
                </p>
              ) : (
                <TestGrid
                  tests={visible}
                  canEdit={editable}
                  readOnlyReason={READ_ONLY_HINT}
                  savingRowId={updateTest.isPending ? (updateTest.variables?.rowId ?? null) : null}
                  onDelete={setTestToDelete}
                  onUpdate={(rowId, input, done) =>
                    updateTest.mutate(
                      { rowId, input },
                      {
                        onSuccess: () => {
                          done?.()
                          if (!('status' in input && Object.keys(input).length === 1))
                            toast.success('Test updated')
                        },
                        onError: (e) => toast.error(`Couldn’t save: ${errorMessage(e)}`),
                      },
                    )
                  }
                />
              )}
            </>
          )}
        </div>
      </main>

      {/* Dialogs */}
      <SuiteFormModal
        open={dialog === 'edit'}
        onOpenChange={close}
        suite={suite}
        style={style}
        saving={updateSuite.isPending}
        error={updateSuite.error ? errorMessage(updateSuite.error) : undefined}
        onSubmit={(input) =>
          updateSuite.mutate(input, {
            onSuccess: () => {
              setDialog(null)
              toast.success('Suite updated')
            },
          })
        }
      />

      <ShareModal
        open={dialog === 'share'}
        onOpenChange={close}
        suiteId={suiteId}
        suiteName={suite.suite_name}
        ownerId={suite.owner_id}
        ownerName={sharedBy}
        currentUserId={user.user_id}
        style={style}
      />

      <ConfirmDialog
        open={dialog === 'delete'}
        onOpenChange={close}
        style={style}
        title="Delete this suite?"
        body={
          <p>
            <strong className="text-ink">{suite.suite_name}</strong> and all{' '}
            <strong className="text-ink">{allTests.length}</strong> of its tests will be deleted for
            everyone it’s shared with. This can’t be undone.
          </p>
        }
        typeToConfirm={suite.suite_name}
        confirmLabel="Delete suite"
        loading={deleteSuite.isPending}
        onConfirm={() =>
          deleteSuite.mutate(suiteId, {
            onSuccess: () => {
              toast.success(`Deleted “${suite.suite_name}”`)
              void navigate('/', { replace: true })
            },
            onError: (e) => toast.error(errorMessage(e)),
          })
        }
      />

      <TestFormModal
        open={dialog === 'add-test'}
        onOpenChange={close}
        suiteName={suite.suite_name}
        style={style}
        resetKey={addResetKey}
        saving={createTest.isPending}
        error={createTest.error ? errorMessage(createTest.error) : undefined}
        onSubmit={(input, keepOpen) =>
          createTest.mutate(input, {
            onSuccess: (row) => {
              toast.success(`Added “${row.test_name}”`)
              setFilter(null)
              if (keepOpen) setAddResetKey((k) => k + 1)
              else setDialog(null)
            },
          })
        }
      />

      <BulkImportModal
        open={dialog === 'import'}
        onOpenChange={close}
        suiteId={suiteId}
        suiteName={suite.suite_name}
        style={style}
        importing={bulkImport.isPending}
        error={bulkImport.error ? errorMessage(bulkImport.error) : undefined}
        onImport={(request) =>
          bulkImport.mutate(request, {
            onSuccess: (res) => {
              setDialog(null)
              setFilter(null)
              toast.success(`Imported ${res.inserted} test${res.inserted === 1 ? '' : 's'}`)
            },
          })
        }
      />

      <ConfirmDialog
        open={testToDelete !== null}
        onOpenChange={(o) => !o && setTestToDelete(null)}
        style={style}
        title="Delete this test?"
        body={
          <p>
            <strong className="text-ink">{testToDelete?.test_name}</strong> will be removed from
            this suite for everyone. This can’t be undone.
          </p>
        }
        confirmLabel="Delete test"
        loading={deleteTest.isPending}
        onConfirm={() =>
          testToDelete &&
          deleteTest.mutate(testToDelete.test_row_id, {
            onSuccess: () => {
              toast.success(`Deleted “${testToDelete.test_name}”`)
              setTestToDelete(null)
            },
            onError: (e) => toast.error(errorMessage(e)),
          })
        }
      />
    </div>
  )
}

function EmptyTests({
  editable,
  onAdd,
  onImport,
}: {
  editable: boolean
  onAdd: () => void
  onImport: () => void
}) {
  return (
    <div className="flex flex-col items-center rounded-[28px] border-2 border-dashed border-suite/30 bg-card/60 px-6 py-16 text-center">
      <span className="flex size-16 items-center justify-center rounded-3xl bg-suite-soft text-suite-ink">
        <FlaskConical className="size-8" aria-hidden />
      </span>
      <h3 className="mt-5 font-display text-2xl font-semibold">No tests in this suite yet</h3>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-mute">
        A test describes one thing to check: the steps to run it, the HTTP status and output you
        expect, and whether it passed.
      </p>
      {editable && (
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button variant="secondary" icon={<FileUp className="size-4" />} onClick={onImport}>
            Import from JSON
          </Button>
          <Button variant="suite" icon={<ListPlus className="size-4" />} onClick={onAdd}>
            Add your first test
          </Button>
        </div>
      )}
    </div>
  )
}

function NotFound() {
  return (
    <FullPageMessage
      title="Suite not found"
      body="It may have been deleted, or it hasn’t been shared with you."
    >
      <Link
        to="/"
        className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-paper"
      >
        <SearchX className="size-4" aria-hidden /> Back to all suites
      </Link>
    </FullPageMessage>
  )
}
