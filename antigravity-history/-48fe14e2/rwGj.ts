import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// Routes that don't require authentication
const publicRoutes = ['/', '/auth/login', '/auth/register']

// Routes that require admin role
const adminRoutes = ['/admin']

export async function middleware(request: NextRequest) {
    const { user, supabaseResponse, supabase } = await updateSession(request)
    const { pathname } = request.nextUrl

    // Check if the route is public
    const isPublicRoute = publicRoutes.some(route =>
        pathname === route || pathname.startsWith('/auth/')
    )

    // Check if the route requires admin access
    const isAdminRoute = adminRoutes.some(route =>
        pathname === route || pathname.startsWith('/admin/')
    )

    // If user is not authenticated and trying to access protected route
    if (!user && !isPublicRoute) {
        const loginUrl = new URL('/auth/login', request.url)
        loginUrl.searchParams.set('redirect', pathname)
        return NextResponse.redirect(loginUrl)
    }


    // If user is authenticated and trying to access auth pages
    if (user && pathname.startsWith('/auth/')) {
        return NextResponse.redirect(new URL('/availability', request.url))
    }

    // If trying to access admin route, verify admin role
    if (user && isAdminRoute) {
        const { data: userRole } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id)
            .single()

        const typedRole = userRole as { role: string } | null
        if (!typedRole || typedRole.role !== 'ADMIN') {
            return NextResponse.redirect(new URL('/dashboard', request.url))
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
