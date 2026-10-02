'use client'

import { Suspense, useEffect, useState, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

function ProgressBarInner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [progress, setProgress] = useState(0)
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // Start progress bar animation
  const startLoading = () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (timerRef.current) clearTimeout(timerRef.current)

    setVisible(true)
    setProgress(20)

    // Simulate progressive loading bar
    intervalRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          if (intervalRef.current) clearInterval(intervalRef.current)
          return 90
        }
        // Decelerating growth curve
        const remaining = 90 - prev
        return prev + Math.max(1, remaining * 0.15)
      })
    }, 100)
  }

  // Complete progress bar animation
  const finishLoading = () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    setProgress(100)

    timerRef.current = setTimeout(() => {
      setVisible(false)
      setTimeout(() => setProgress(0), 300)
    }, 250)
  }

  // Listen to pathname & searchParams changes to finish loading
  useEffect(() => {
    finishLoading()
    // Reset body cursor
    if (typeof document !== 'undefined') {
      document.body.style.cursor = ''
    }
  }, [pathname, searchParams])

  // Intercept all link clicks globally to start loading INSTANTLY on click (0ms feedback!)
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('a')
      if (!target) return

      const href = target.getAttribute('href')
      if (!href) return

      // Don't intercept external links, new tabs, downloads, or anchor jumps
      if (
        target.target === '_blank' ||
        target.hasAttribute('download') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        href.startsWith('http://') ||
        href.startsWith('https://') ||
        href.startsWith('#')
      ) {
        return
      }

      // Check if it's the exact same page
      const currentUrl = window.location.pathname + window.location.search
      if (href === currentUrl || href === window.location.pathname) {
        return
      }

      // Start progress bar immediately!
      startLoading()
      document.body.style.cursor = 'progress'
    }

    document.addEventListener('click', handleClick, { capture: true })

    return () => {
      document.removeEventListener('click', handleClick, { capture: true })
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [pathname])

  if (!visible && progress === 0) return null

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[99999] pointer-events-none h-1 bg-transparent"
      aria-hidden="true"
    >
      <div
        className="h-full bg-gradient-to-r from-[#22C55E] via-[#4ADE80] to-[#16A34A] shadow-[0_0_12px_rgba(34,197,94,0.9)] transition-all duration-200 ease-out"
        style={{
          width: `${progress}%`,
          opacity: visible ? 1 : 0,
          transitionProperty: 'width, opacity',
        }}
      />
    </div>
  )
}

export default function NavigationProgress() {
  return (
    <Suspense fallback={null}>
      <ProgressBarInner />
    </Suspense>
  )
}
