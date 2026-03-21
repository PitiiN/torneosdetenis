'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Mail, Lock, User, Phone, Loader2, AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-react'

export default function RegisterPage() {
    const router = useRouter()
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        confirmPassword: '',
        fullName: '',
        phone: '',
    })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value })
    }

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        // Validate passwords match
        if (formData.password !== formData.confirmPassword) {
            setError('Las contraseñas no coinciden')
            setLoading(false)
            return
        }

        // Validate password length
        if (formData.password.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres')
            setLoading(false)
            return
        }

        try {
            const supabase = createClient()

            // Sign up user
            const { data, error: signUpError } = await supabase.auth.signUp({
                email: formData.email,
                password: formData.password,
                options: {
                    data: {
                        full_name: formData.fullName,
                        phone: formData.phone,
                    },
                },
            })

            if (signUpError) {
                setError(signUpError.message)
                return
            }

            if (data.user) {
                // Create profile
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const { error: profileError } = await (supabase
                    .from('profiles') as any)
                    .upsert({
                        id: data.user.id,
                        full_name: formData.fullName,
                        phone: formData.phone,
                    })

                if (profileError) {
                    console.error('Error creating profile:', profileError)
                }

                // Create default user role
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const { error: roleError } = await (supabase
                    .from('user_roles') as any)
                    .upsert({
                        user_id: data.user.id,
                        role: 'USER',
                    })

                if (roleError) {
                    console.error('Error creating role:', roleError)
                }
            }

            setSuccess(true)

            // If email confirmation is not required, redirect to dashboard
            if (data.session) {
                router.push('/dashboard')
                router.refresh()
            }
        } catch {
            setError('Error al registrar. Intenta de nuevo.')
        } finally {
            setLoading(false)
        }
    }

    if (success) {
        return (
            <main className="min-h-screen flex items-center justify-center p-4">
                <Card className="w-full max-w-md">
                    <CardHeader className="text-center">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-success/20 flex items-center justify-center">
                            <CheckCircle className="w-8 h-8 text-success" />
                        </div>
                        <CardTitle className="text-2xl">¡Registro Exitoso!</CardTitle>
                        <CardDescription>
                            Revisa tu email para confirmar tu cuenta. Si la confirmación no es requerida, serás redirigido automáticamente.
                        </CardDescription>
                    </CardHeader>
                    <CardFooter className="justify-center">
                        <Link href="/auth/login" className="text-primary hover:underline">
                            Ir a Iniciar Sesión
                        </Link>
                    </CardFooter>
                </Card>
            </main>
        )
    }

    return (
        <main className="min-h-screen flex items-center justify-center p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-xl gradient-primary flex items-center justify-center">
                        <User className="w-8 h-8 text-white" />
                    </div>
                    <CardTitle className="text-2xl">Crear Cuenta</CardTitle>
                    <CardDescription>
                        Regístrate para comenzar a reservar canchas
                    </CardDescription>
                </CardHeader>
                <form onSubmit={handleRegister}>
                    <CardContent className="space-y-4">
                        {error && (
                            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-destructive text-sm">
                                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                {error}
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="fullName">Nombre Completo</Label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    id="fullName"
                                    name="fullName"
                                    type="text"
                                    placeholder="Juan Pérez"
                                    value={formData.fullName}
                                    onChange={handleChange}
                                    className="pl-10"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    id="email"
                                    name="email"
                                    type="email"
                                    placeholder="tu@email.com"
                                    value={formData.email}
                                    onChange={handleChange}
                                    className="pl-10"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="phone">Teléfono</Label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    id="phone"
                                    name="phone"
                                    type="tel"
                                    placeholder="+56 9 1234 5678"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    className="pl-10"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password">Contraseña</Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    id="password"
                                    name="password"
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="••••••••"
                                    value={formData.password}
                                    onChange={handleChange}
                                    className="pl-10 pr-10"
                                    required
                                    minLength={6}
                                />
                                <button
                                    type="button"
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                    onClick={() => setShowPassword(!showPassword)}
                                    tabIndex={-1}
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword">Confirmar Contraseña</Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    id="confirmPassword"
                                    name="confirmPassword"
                                    type={showConfirmPassword ? 'text' : 'password'}
                                    placeholder="••••••••"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    className="pl-10 pr-10"
                                    required
                                />
                                <button
                                    type="button"
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    tabIndex={-1}
                                >
                                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="flex flex-col gap-4">
                        <Button
                            type="submit"
                            className="w-full gradient-primary border-0 h-12 text-base font-bold shadow-lg hover:shadow-primary/50 transition-all duration-300 hover:scale-[1.02]"
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                                    Registrando...
                                </>
                            ) : (
                                'Crear Cuenta'
                            )}
                        </Button>
                        <p className="text-sm text-muted-foreground text-center">
                            ¿Ya tienes cuenta?{' '}
                            <Link href="/auth/login" className="text-primary hover:underline">
                                Inicia Sesión
                            </Link>
                        </p>
                    </CardFooter>
                </form>
            </Card>
        </main>
    )
}
