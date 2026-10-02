'use client'

import { Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

function ProgressBar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [width, setWidth] = useState(0)
  const [opacity, setOpacity] = useState(0)

  useEffect(() => {
    // Page loaded — fade out
    setWidth(100)
    const t1 = setTimeout(() => setOpacity(0), 100)
    const t2 = setTimeout(() => setWidth(0), 500)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [pathname, searchParams])

  return (
    <div
      className="fixed top-0 left-0 z-[9999] h-[3px] bg-[#22C55E] shadow-[0_0_10px_rgba(34,197,94,0.7)] pointer-events-none transition-[width,opacity] duration-300 ease-out"
      style={{ width: `${width}%`, opacity }}
    />
  )
}

export default function NavigationProgress() {
  return (
    <Suspense fallback={null}>
      <ProgressBar />
    </Suspense>
  )
}
