'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertCircle, CheckCircle, Loader2, Save, User as UserIcon, Mail, Phone as PhoneIcon } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

export default function ProfilePage() {
    const [loading, setLoading] = useState(true)
    const [updating, setUpdating] = useState(false)
    const [userId, setUserId] = useState<string | null>(null)

    // Form states
    const [fullName, setFullName] = useState('')
    const [phone, setPhone] = useState('')
    const [email, setEmail] = useState('')
    const [newEmail, setNewEmail] = useState('')

    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

    useEffect(() => {
        const fetchProfile = async () => {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()

            if (user) {
                setUserId(user.id)
                setEmail(user.email || '')
                setNewEmail(user.email || '') // Init with current

                const { data: profile } = await supabase
                    .from('profiles')
                    .select('full_name, phone')
                    .eq('id', user.id)
                    .single()

                if (profile) {
                    setFullName(profile.full_name || '')
                    setPhone(profile.phone || '')
                }
            }
            setLoading(false)
        }

        fetchProfile()
    }, [])

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!userId) return

        setUpdating(true)
        setMessage(null)

        try {
            const supabase = createClient()

            // 1. Update Profile Data (Name, Phone)
            const { error: profileError } = await supabase
                .from('profiles')
                .update({
                    full_name: fullName,
                    phone: phone,
                    updated_at: new Date().toISOString()
                })
                .eq('id', userId)

            if (profileError) throw profileError

            // 2. Check if Email changed
            if (newEmail !== email) {
                const { error: emailError } = await supabase.auth.updateUser({ email: newEmail })
                if (emailError) throw emailError

                setMessage({
                    type: 'success',
                    text: 'Perfil actualizado. Se ha enviado un correo de confirmación a tu nueva dirección de email.'
                })
            } else {
                setMessage({
                    type: 'success',
                    text: 'Perfil actualizado correctamente.'
                })
            }

        } catch (error: any) {
            console.error(error)
            setMessage({
                type: 'error',
                text: error.message || 'Error al actualizar el perfil'
            })
        } finally {
            setUpdating(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Mi Perfil</h1>
                <p className="text-muted-foreground">Administra tu información personal</p>
            </div>

            <form onSubmit={handleUpdateProfile}>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <UserIcon className="w-5 h-5 text-primary" />
                            Información Personal
                        </CardTitle>
                        <CardDescription>
                            Actualiza tus datos de contacto y acceso.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {message && (
                            <Alert variant={message.type === 'error' ? 'destructive' : 'default'} className={message.type === 'success' ? 'border-green-500/50 bg-green-500/10 text-green-500' : ''}>
                                {message.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                                <AlertTitle>{message.type === 'success' ? 'Éxito' : 'Error'}</AlertTitle>
                                <AlertDescription>{message.text}</AlertDescription>
                            </Alert>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="fullName">Nombre Completo</Label>
                            <div className="relative">
                                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    id="fullName"
                                    value={fullName}
                                    onChange={e => setFullName(e.target.value)}
                                    className="pl-10"
                                    placeholder="Tu nombre"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="phone">Teléfono</Label>
                            <div className="relative">
                                <PhoneIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    id="phone"
                                    value={phone}
                                    onChange={e => setPhone(e.target.value)}
                                    className="pl-10"
                                    placeholder="+56 9 1234 5678"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email">Correo Electrónico</Label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    id="email"
                                    type="email"
                                    value={newEmail}
                                    onChange={e => setNewEmail(e.target.value)}
                                    className="pl-10"
                                    placeholder="tu@email.com"
                                />
                            </div>
                            {newEmail !== email && (
                                <p className="text-sm text-yellow-500 flex items-center gap-1 mt-1">
                                    <AlertCircle className="w-3 h-3" />
                                    Cambiar el correo requerirá nueva verificación.
                                </p>
                            )}
                        </div>

                    </CardContent>
                    <CardFooter className="flex justify-between">
                        <Button variant="ghost" type="button" onClick={() => window.history.back()}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={updating} className="min-w-[120px]">
                            {updating ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Guardando...
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4 mr-2" />
                                    Guardar Cambios
                                </>
                            )}
                        </Button>
                    </CardFooter>
                </Card>
            </form>
        </div>
    )
}
