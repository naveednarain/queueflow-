'use client'

import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'
import { Ticket, Eye, EyeOff, Loader2, ArrowLeft } from 'lucide-react'
import { login } from '@/lib/actions/auth'
import { useSearchParams, useRouter } from 'next/navigation'

export default function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const message = searchParams.get('message')

  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
    } else {
      router.push('/')
    }
  }

  const handleSelectDemo = (demoEmail: string) => {
    setEmail(demoEmail)
    setPassword('Demo@12345')
    toast.info(`Filled credentials for ${demoEmail}`)
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

        {/* Demo accounts hint with 1-click auto-fill */}
        <div className="mt-6 pt-5 border-t border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-600">
              Demo Accounts
            </span>
            <span className="text-[11px] text-[#22C55E] font-medium">Click to auto-fill</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            {[
              { email: 'admin@demo.com', role: 'Admin' },
              { email: 'manager@demo.com', role: 'Manager' },
              { email: 'staff@demo.com', role: 'Staff 1' },
              { email: 'staff2@demo.com', role: 'Staff 2' },
              { email: 'customer@demo.com', role: 'Customer 1' },
              { email: 'customer2@demo.com', role: 'Customer 2' },
            ].map((d) => (
              <button
                type="button"
                key={d.email}
                onClick={() => handleSelectDemo(d.email)}
                className="bg-gray-50 hover:bg-emerald-50 hover:border-emerald-200 border border-gray-200/80 rounded-xl p-2 text-left transition-all cursor-pointer group"
                title={`Click to fill ${d.role} credentials`}
              >
                <div className="font-bold text-gray-800 group-hover:text-[#22C55E] text-xs leading-none">
                  {d.role}
                </div>
                <div className="truncate text-[10px] text-gray-400 group-hover:text-gray-600 mt-1">
                  {d.email}
                </div>
              </button>
            ))}
          </div>
          <p className="text-[10px] text-gray-400 text-center mt-2.5">
            Password: <strong className="text-gray-600 font-mono">Demo@12345</strong>
          </p>
        </div>
      </div>
    </div>
  )
}

