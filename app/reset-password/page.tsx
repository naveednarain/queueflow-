'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Ticket, Eye, EyeOff, Loader2, KeyRound, CheckCircle2, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [hasValidSession, setHasValidSession] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    async function checkAuth() {
      try {
        // If there's a code in search params (PKCE flow)
        if (typeof window !== 'undefined') {
          const url = new URL(window.location.href)
          const code = url.searchParams.get('code')
          if (code) {
            await supabase.auth.exchangeCodeForSession(code)
          }
        }

        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          setHasValidSession(true)
        } else {
          // Listen to state change in case hash is being processed by Supabase
          const { data: authListener } = supabase.auth.onAuthStateChange(
            (event, session) => {
              if (event === 'PASSWORD_RECOVERY' || session) {
                setHasValidSession(true)
              }
            }
          )
          return () => {
            authListener.subscription.unsubscribe()
          }
        }
      } catch (err) {
        console.error('Session check error:', err)
      } finally {
        setCheckingSession(false)
      }
    }

    checkAuth()
  }, [supabase])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (loading) return

    if (password.length < 8) {
      toast.error('Password must be at least 8 characters long.')
      return
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      })

      if (error) {
        toast.error(error.message || 'Failed to update password.')
      } else {
        setDone(true)
        toast.success('Your password has been updated successfully!')
        setTimeout(() => {
          router.push('/login')
        }, 2000)
      }
    } catch {
      toast.error('Failed to update password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F5F5F5] px-4 py-8">
      <Link href="/" className="flex items-center gap-2 font-bold text-xl mb-8">
        <div className="w-9 h-9 rounded-xl bg-[#22C55E] flex items-center justify-center shadow-lg shadow-green-200">
          <Ticket className="w-5 h-5 text-white" />
        </div>
        <span className="text-gray-900">QueueFlow</span>
      </Link>

      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        {checkingSession ? (
          <div className="text-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-[#22C55E] mx-auto mb-3" />
            <p className="text-sm text-gray-500">Verifying security token…</p>
          </div>
        ) : done ? (
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Password Updated!</h1>
            <p className="text-sm text-gray-600 mb-6">
              Your password has been reset. Redirecting you to sign in...
            </p>
            <Link
              href="/login"
              className="inline-flex items-center justify-center w-full bg-[#22C55E] text-white font-semibold py-2.5 px-4 rounded-xl hover:bg-[#16A34A] transition shadow-lg shadow-green-200"
            >
              Go to Sign in
            </Link>
          </div>
        ) : !hasValidSession ? (
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Invalid or Expired Link</h1>
            <p className="text-sm text-gray-600 mb-6">
              This recovery link is invalid or has expired. Please request a new recovery link from the login page.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center justify-center w-full bg-[#22C55E] text-white font-semibold py-2.5 px-4 rounded-xl hover:bg-[#16A34A] transition shadow-lg shadow-green-200"
            >
              Back to Login
            </Link>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <KeyRound className="w-4 h-4" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Set new password</h1>
            </div>
            <p className="text-sm text-gray-500 mb-6">
              Enter your new password below to regain access to your account.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="new-password"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  New Password
                </label>
                <div className="relative">
                  <input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    maxLength={100}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="w-full px-3 py-2.5 pr-10 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#22C55E] focus:border-transparent transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="confirm-password"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Confirm New Password
                </label>
                <input
                  id="confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  maxLength={100}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your password"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#22C55E] focus:border-transparent transition"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-[#22C55E] text-white font-semibold py-2.5 px-4 rounded-xl hover:bg-[#16A34A] transition-colors shadow-lg shadow-green-200 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? 'Updating…' : 'Update Password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
