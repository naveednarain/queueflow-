import DisplayClient from './display-client'

// Pure client-side page — no server data fetching.
// DisplayClient fetches all data itself on mount via the Supabase client.
// This eliminates the "page could not load" error that occurred during
// client-side navigation when cookies() / server actions threw an error.
export default function DisplayPage() {
  return (
    <DisplayClient
      initialCounters={[]}
      initialNextUp={[]}
    />
  )
}
