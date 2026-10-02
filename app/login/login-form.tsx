'use client'

import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'
import { Ticket, Eye, EyeOff, Loader2, ArrowLeft, KeyRound, MailCheck } from 'lucide-react'
import { login, requestPasswordReset } from '@/lib/actions/auth'
import { useSearchParams, useRouter } from 'next/navigation'

export default function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const message = searchParams.get('message')

  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [failedAttempts, setFailedAttempts] = useState(0)
  const [sendingReset, setSendingReset] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
    } else {
      router.push('/')
    }
  }

  async function handlePasswordRecovery() {
    if (!email || !email.includes('@')) {
      toast.error('Please enter your email address first.')
      return
    }
    setSendingReset(true)
    try {
      const redirectUrl = typeof window !== 'undefined' ? `${window.location.origin}/reset-password` : undefined
      const res = await requestPasswordReset(email, redirectUrl)
      if (res?.error) {
        toast.error(res.error)
      } else {
        setResetSent(true)
        toast.success('Password recovery link sent to your email!')
      }
    } catch {
      toast.error('Failed to send recovery email. Please try again.')
    } finally {
      setSendingReset(false)
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (loading) return
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    try {
      const result = await login(formData)
      if (result?.error) {
        toast.error(result.error)
        setFailedAttempts((prev) => prev + 1)
        setLoading(false)
      }
    } catch {
      // redirect() throws internally on success — ignore
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F5F5F5] px-4 py-8">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2 font-bold text-xl mb-8">
        <div className="w-9 h-9 rounded-xl bg-[#22C55E] flex items-center justify-center shadow-lg shadow-green-200">
          <Ticket className="w-5 h-5 text-white" />
        </div>
        <span className="text-gray-900">QueueFlow</span>
      </Link>

      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-8 relative">
        <div className="mb-4">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 border border-gray-200 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
            title="Go back"
            aria-label="Go back"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-1">Welcome back</h1>
        <p className="text-sm text-gray-500 mb-6">
          Sign in to your account to continue.
        </p>

        {message && (
          <div className="mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" id="login-form">
          <div>
            <label
              htmlFor="login-email"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Email address
            </label>
            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={200}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#22C55E] focus:border-transparent transition"
            />
          </div>

          <div>
            <label
              htmlFor="login-password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="login-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                maxLength={100}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2.5 pr-10 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#22C55E] focus:border-transparent transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Conditionally shown ONLY after 1 or more failed attempts */}
          {failedAttempts >= 1 && (
            <div className="p-3.5 bg-amber-50/90 border border-amber-200/80 rounded-xl flex items-start gap-2.5 animate-in fade-in slide-in-from-top-1 duration-200">
              <KeyRound className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <div className="flex-1 text-xs">
                <p className="text-amber-900 font-medium mb-1">
                  Trouble signing in?
                </p>
                {resetSent ? (
                  <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
                    <MailCheck className="w-3.5 h-3.5" />
                    <span>Recovery link sent to your email!</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <span className="text-amber-700">Forgot your password?</span>
                    <button
                      type="button"
                      onClick={handlePasswordRecovery}
                      disabled={sendingReset}
                      className="font-semibold text-emerald-600 hover:text-emerald-700 underline cursor-pointer disabled:opacity-50 inline-flex items-center gap-1"
                    >
                      {sendingReset && <Loader2 className="w-3 h-3 animate-spin" />}
                      {sendingReset ? 'Sending…' : 'Send recovery link'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          <button
            id="login-submit-btn"
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-[#22C55E] text-white font-semibold py-2.5 px-4 rounded-xl hover:bg-[#16A34A] transition-colors shadow-lg shadow-green-200 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Don&apos;t have an account?{' '}
          <Link
            href="/register"
            className="font-medium text-[#22C55E] hover:text-[#16A34A]"
          >
            Create one
          </Link>
        </p>
      </div>
    </div>
  )
}

