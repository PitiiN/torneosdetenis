'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import type { UserRole } from '@/types/db'
import {
    LayoutDashboard,
    CalendarDays,
    Clock,
    Settings,
    LogOut,
    Menu,
    X,
    Shield,
    ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface DashboardLayoutProps {
    children: React.ReactNode
}

const userNavItems = [
    { href: '/dashboard', label: 'Panel', icon: LayoutDashboard },
    { href: '/bookings', label: 'Mis Reservas', icon: CalendarDays },
    { href: '/availability', label: 'Disponibilidad', icon: Clock },
]

const adminNavItems = [
    { href: '/admin', label: 'Panel Admin', icon: Shield },
    { href: '/admin/bookings', label: 'Verificación', icon: CalendarDays },
    { href: '/admin/blocks', label: 'Bloqueos', icon: Clock },
]

export default function DashboardLayout({ children }: DashboardLayoutProps) {
    const router = useRouter()
    const pathname = usePathname()
    const [user, setUser] = useState<User | null>(null)
    const [userRole, setUserRole] = useState<UserRole>('USER')
    const [loading, setLoading] = useState(true)
    const [sidebarOpen, setSidebarOpen] = useState(false)

    useEffect(() => {
        const supabase = createClient()

        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            setUser(user)

            if (user) {
                const { data: roleData } = await supabase
                    .from('user_roles')
                    .select('role')
                    .eq('user_id', user.id)
                    .single()

                const typedRoleData = roleData as { role: string } | null
                if (typedRoleData) {
                    setUserRole(typedRoleData.role as UserRole)
                }
            }

            setLoading(false)
        }

        getUser()

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                setUser(session?.user ?? null)
                if (!session?.user) {
                    router.push('/auth/login')
                }
            }
        )

        return () => subscription.unsubscribe()
    }, [router])

    const handleLogout = async () => {
        const supabase = createClient()
        await supabase.auth.signOut()
        router.push('/auth/login')
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    const isAdminRoute = pathname.startsWith('/admin')
    const navItems = isAdminRoute && userRole === 'ADMIN'
        ? [...adminNavItems, ...userNavItems]
        : userRole === 'ADMIN'
            ? [...userNavItems, ...adminNavItems]
            : userNavItems

    return (
        <div className="min-h-screen flex">
            {/* Mobile sidebar backdrop */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={cn(
                    'fixed lg:static inset-y-0 left-0 z-50 w-64 bg-card border-r border-border transform transition-transform duration-200 lg:translate-x-0',
                    sidebarOpen ? 'translate-x-0' : '-translate-x-full'
                )}
            >
                <div className="flex flex-col h-full">
                    {/* Logo */}
                    <div className="p-6 border-b border-border flex items-center justify-between">
                        <Link href="/dashboard" className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
                                <CalendarDays className="w-4 h-4 text-white" />
                            </div>
                            <span className="font-semibold">ArriendoCanchas</span>
                        </Link>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="lg:hidden"
                            onClick={() => setSidebarOpen(false)}
                        >
                            <X className="w-5 h-5" />
                        </Button>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 p-4 space-y-1">
                        {navItems.map((item) => {
                            const isActive = pathname === item.href
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={cn(
                                        'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                                        isActive
                                            ? 'bg-primary text-primary-foreground'
                                            : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                                    )}
                                    onClick={() => setSidebarOpen(false)}
                                >
                                    <item.icon className="w-5 h-5" />
                                    {item.label}
                                    {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
                                </Link>
                            )
                        })}
                    </nav>

                    {/* User section */}
                    <div className="p-4 border-t border-border">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                                <span className="text-primary font-semibold">
                                    {user?.email?.charAt(0).toUpperCase() || 'U'}
                                </span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{user?.email}</p>
                                <p className="text-xs text-muted-foreground capitalize">{userRole.toLowerCase()}</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="flex-1"
                                onClick={() => router.push('/settings/profile')}
                            >
                                <Settings className="w-4 h-4" />
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="flex-1"
                                onClick={handleLogout}
                            >
                                <LogOut className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main content */}
            <div className={cn(
                "flex-1 flex flex-col min-h-screen transition-all duration-200",
                sidebarOpen ? "ml-64" : "ml-0",
                "lg:ml-0" // Desktop always 0, sidebar is static
            )}>
                {/* Mobile header */}
                <header className={cn(
                    "lg:hidden fixed top-0 right-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border p-4 flex items-center gap-4 transition-all duration-200",
                    sidebarOpen ? "left-64" : "left-0"
                )}>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                    >
                        {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </Button>
                    <span className="font-semibold">ArriendoCanchas</span>
                </header>

                {/* Page content */}
                <main className="flex-1 p-6 pt-20 lg:pt-6">
                    {children}
                </main>
            </div>
        </div>
    )
}
