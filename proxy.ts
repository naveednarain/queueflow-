import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — IMPORTANT: do not add code between createServerClient and getUser()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Routes that require authentication
  const customerRoutes = ['/book', '/token', '/my']
  const staffRoutes = ['/staff']
  const managerRoutes = ['/manager']
  const adminRoutes = ['/admin']

  const isCustomerRoute = customerRoutes.some((r) => pathname.startsWith(r))
  const isStaffRoute = staffRoutes.some((r) => pathname.startsWith(r))
  const isManagerRoute = managerRoutes.some((r) => pathname.startsWith(r))
  const isAdminRoute = adminRoutes.some((r) => pathname.startsWith(r))

  const isProtected =
    isCustomerRoute || isStaffRoute || isManagerRoute || isAdminRoute

  if (!user && isProtected) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/login'
    redirectUrl.searchParams.set('message', 'Please sign in to continue.')
    return NextResponse.redirect(redirectUrl)
  }

  // Role-based protection (only check if user is authenticated)
  if (user && (isStaffRoute || isManagerRoute || isAdminRoute)) {
    // Fetch the user's role from profiles
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = profile?.role as string | undefined

    if (isStaffRoute) {
      const allowed = ['staff', 'manager', 'admin']
      if (!role || !allowed.includes(role)) {
        const redirectUrl = request.nextUrl.clone()
        redirectUrl.pathname = '/login'
        redirectUrl.searchParams.set(
          'message',
          'You need staff access to view that page.'
        )
        return NextResponse.redirect(redirectUrl)
      }
    }

    if (isManagerRoute) {
      const allowed = ['manager', 'admin']
      if (!role || !allowed.includes(role)) {
        const redirectUrl = request.nextUrl.clone()
        redirectUrl.pathname = '/login'
        redirectUrl.searchParams.set(
          'message',
          'You need manager access to view that page.'
        )
        return NextResponse.redirect(redirectUrl)
      }
    }

    if (isAdminRoute) {
      if (role !== 'admin') {
        const redirectUrl = request.nextUrl.clone()
        redirectUrl.pathname = '/login'
        redirectUrl.searchParams.set(
          'message',
          'You need administrator access to view that page.'
        )
        return NextResponse.redirect(redirectUrl)
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
