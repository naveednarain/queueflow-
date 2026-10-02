import { getDisplayData } from '@/lib/actions/staff'
import DisplayClient from './display-client'

export const dynamic = 'force-dynamic'

export default async function DisplayPage() {
  // Gracefully handle server-side failures (e.g. missing auth context on
  // first client-side navigation). The DisplayClient will fetch fresh data
  // itself via refreshBoard() on mount, so empty initial data is fine.
  let counters: Awaited<ReturnType<typeof getDisplayData>>['counters'] = []
  let nextUp: Awaited<ReturnType<typeof getDisplayData>>['nextUp'] = []

  try {
    const data = await getDisplayData()
    counters = data.counters
    nextUp = data.nextUp
  } catch {
    // Fall through with empty arrays — client will self-refresh
  }

  return (
    <DisplayClient
      initialCounters={counters}
      initialNextUp={nextUp}
    />
  )
}
