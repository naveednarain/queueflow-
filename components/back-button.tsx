'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

interface BackButtonProps {
  fallbackHref?: string
  label?: string
  className?: string
  variant?: 'light' | 'dark' | 'ghost'
}

export default function BackButton({
  fallbackHref = '/',
  label = 'Back',
  className = '',
  variant = 'light',
}: BackButtonProps) {
  const router = useRouter()

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
    } else {
      router.push(fallbackHref)
    }
  }

  const baseStyles =
    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer select-none'

  const variantStyles = {
    light:
      'bg-white hover:bg-gray-50 text-gray-700 hover:text-gray-900 border border-gray-200 shadow-xs',
    dark:
      'bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 shadow-xs',
    ghost:
      'text-gray-600 hover:text-gray-900 hover:bg-gray-100/80',
  }

  return (
    <button
      type="button"
      onClick={handleBack}
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
      title="Go back to previous page"
      aria-label={label}
    >
      <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5]" />
      <span>{label}</span>
    </button>
  )
}
