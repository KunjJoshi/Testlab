import { Link } from 'react-router'
import { FullPageMessage } from '@/components/ui/FullPage'

export function NotFoundPage() {
  return (
    <FullPageMessage title="Page not found" body="There’s nothing at this address.">
      <Link to="/" className="rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-paper">
        Go to your suites
      </Link>
    </FullPageMessage>
  )
}
