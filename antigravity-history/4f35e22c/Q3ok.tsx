'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Clock,
    Plus,
    Trash2,
    AlertCircle,
    Loader2,
    X,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Field } from '@/types/domain'

interface FieldBlock {
    id: string
    field_id: string
    start_at: string
    end_at: string
    reason?: string
    field?: { name: string }
    type?: 'BLOCK' | 'BOOKING'
}

export default function AdminBlocksPage() {
    const [blocks, setBlocks] = useState<FieldBlock[]>([])
    const [fields, setFields] = useState<Field[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [formData, setFormData] = useState({
        fieldId: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        startTime: '09:00',
        endTime: '10:00',
        reason: '',
    })

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        setLoading(true)
        try {
            // Fetch blocks
            const blocksResponse = await fetch('/api/admin/blocks')
            const blocksData = await blocksResponse.json()
            setBlocks(blocksData.blocks || [])

            // Fetch fields
            const supabase = createClient()
            const { data: fieldsData } = await supabase
                .from('fields')
                .select('*')
                .eq('is_active', true)
                .order('name')

            if (fieldsData) {
                const typedFields = fieldsData as Field[]
                setFields(typedFields)
                if (typedFields.length > 0 && !formData.fieldId) {
                    setFormData((prev) => ({ ...prev, fieldId: typedFields[0].id }))
                }
            }
        } catch (error) {
            console.error('Error fetching data:', error)
        }
        setLoading(false)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSubmitting(true)
        setError(null)

        try {
            const startAt = parseISO(`${formData.date}T${formData.startTime}:00`)
            const endAt = parseISO(`${formData.date}T${formData.endTime}:00`)

            if (endAt <= startAt) {
                setError('La hora de fin debe ser posterior a la hora de inicio')
                setSubmitting(false)
                return
            }

            const response = await fetch('/api/admin/blocks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fieldId: formData.fieldId,
                    startAt: startAt.toISOString(),
                    endAt: endAt.toISOString(),
                    reason: formData.reason || undefined,
                }),
            })

            if (!response.ok) {
                const data = await response.json()
                setError(data.error || 'Error al crear bloqueo')
                return
            }

            fetchData()
            setShowForm(false)
            setFormData((prev) => ({
                ...prev,
                reason: '',
                startTime: '09:00',
                endTime: '10:00',
            }))
        } catch {
            setError('Error de conexión')
        } finally {
            setSubmitting(false)
        }
    }

    const handleDelete = async (id: string, type: 'BLOCK' | 'BOOKING' = 'BLOCK') => {
        if (!confirm('¿Estás seguro de eliminar este bloqueo?')) return

        try {
            const response = await fetch(`/api/admin/blocks/${id}?type=${type}`, {
                method: 'DELETE',
            })

            if (response.ok) {
                fetchData()
            }
        } catch (error) {
            console.error('Error deleting block:', error)
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
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Bloqueos de Horarios</h1>
                    <p className="text-muted-foreground">
                        Gestiona los bloqueos de horarios para mantenimiento o eventos
                    </p>
                </div>
                <Button onClick={() => setShowForm(!showForm)}>
                    {showForm ? <X className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                    {showForm ? 'Cancelar' : 'Nuevo Bloqueo'}
                </Button>
            </div>

            {/* Create Form */}
            {showForm && (
                <Card>
                    <CardHeader>
                        <CardTitle>Crear Bloqueo</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {error && (
                                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-destructive text-sm">
                                    <AlertCircle className="w-4 h-4" />
                                    {error}
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="fieldId">Cancha</Label>
                                    <select
                                        id="fieldId"
                                        value={formData.fieldId}
                                        onChange={(e) =>
                                            setFormData((prev) => ({ ...prev, fieldId: e.target.value }))
                                        }
                                        className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground"
                                        required
                                    >
                                        {fields.map((field) => (
                                            <option key={field.id} value={field.id}>
                                                {field.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="date">Fecha</Label>
                                    <Input
                                        id="date"
                                        type="date"
                                        value={formData.date}
                                        onChange={(e) =>
                                            setFormData((prev) => ({ ...prev, date: e.target.value }))
                                        }
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="startTime">Hora Inicio</Label>
                                    <Input
                                        id="startTime"
                                        type="time"
                                        value={formData.startTime}
                                        onChange={(e) =>
                                            setFormData((prev) => ({ ...prev, startTime: e.target.value }))
                                        }
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="endTime">Hora Fin</Label>
                                    <Input
                                        id="endTime"
                                        type="time"
                                        value={formData.endTime}
                                        onChange={(e) =>
                                            setFormData((prev) => ({ ...prev, endTime: e.target.value }))
                                        }
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="reason">Motivo (opcional)</Label>
                                <Input
                                    id="reason"
                                    type="text"
                                    placeholder="Ej: Mantenimiento, Torneo, etc."
                                    value={formData.reason}
                                    onChange={(e) =>
                                        setFormData((prev) => ({ ...prev, reason: e.target.value }))
                                    }
                                />
                            </div>

                            <Button type="submit" disabled={submitting}>
                                {submitting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Creando...
                                    </>
                                ) : (
                                    <>
                                        <Plus className="w-4 h-4 mr-2" />
                                        Crear Bloqueo
                                    </>
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            )}

            {/* Blocks List */}
            {blocks.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                        <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No hay bloqueos configurados</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {blocks.map((block) => (
                        <Card key={block.id}>
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="flex items-center gap-3 mb-1">
                                            <h3 className="font-medium">{block.field?.name || 'Cancha'}</h3>
                                        </div>
                                        <p className="text-sm text-muted-foreground">
                                            {format(new Date(block.start_at), "EEEE, d 'de' MMMM yyyy", {
                                                locale: es,
                                            })}
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            {format(new Date(block.start_at), 'HH:mm')} -{' '}
                                            {format(new Date(block.end_at), 'HH:mm')}
                                        </p>
                                        {block.reason && (
                                            <p className="text-sm text-primary mt-1">Motivo: {block.reason}</p>
                                        )}
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={() => handleDelete(block.id)}
                                    >
                                        <Trash2 className="w-4 h-4 text-destructive" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
