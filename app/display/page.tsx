import { getDisplayData } from '@/lib/actions/staff'
import DisplayClient from './display-client'

export const dynamic = 'force-dynamic'

export default async function DisplayPage() {
  const { counters, nextUp } = await getDisplayData()

  return (
    <DisplayClient
      initialCounters={counters}
      initialNextUp={nextUp}
    />
  )
}
