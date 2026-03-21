'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { createClient } from '@/lib/supabase/client'
import { format, parseISO, addDays, eachDayOfInterval, getDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { Loader2, Plus, Ban, Trash2, CalendarRange, AlertCircle, CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Field } from '@/types/domain'

interface FieldBlock {
    id: string
    field_id: string
    start_at: string
    end_at: string
    reason?: string
    field?: { name: string }
    type?: 'BLOCK' | 'BOOKING'
}

const DAYS_OF_WEEK = [
    { value: 1, label: 'Lunes' },
    { value: 2, label: 'Martes' },
    { value: 3, label: 'Miércoles' },
    { value: 4, label: 'Jueves' },
    { value: 5, label: 'Viernes' },
    { value: 6, label: 'Sábado' },
    { value: 0, label: 'Domingo' },
]

export default function AdminBlocksPage() {
    const [blocks, setBlocks] = useState<FieldBlock[]>([])
    const [fields, setFields] = useState<Field[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Form State
    const [formData, setFormData] = useState({
        fieldId: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        endDate: format(addDays(new Date(), 30), 'yyyy-MM-dd'),
        startTime: '09:00',
        endTime: '10:00',
        reason: '',
        isRecurring: false,
    })
    const [selectedDays, setSelectedDays] = useState<number[]>([])

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        setLoading(true)
        try {
            const blocksResponse = await fetch('/api/admin/blocks')
            const blocksData = await blocksResponse.json()
            setBlocks(blocksData.blocks || [])

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

    const toggleDay = (dayValue: number) => {
        setSelectedDays(prev =>
            prev.includes(dayValue)
                ? prev.filter(d => d !== dayValue)
                : [...prev, dayValue]
        )
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSubmitting(true)
        setError(null)

        try {
            const bookingsToCreate = []

            if (formData.isRecurring) {
                if (selectedDays.length === 0) {
                    setError('Debes seleccionar al menos un día de la semana')
                    setSubmitting(false)
                    return
                }

                const start = parseISO(formData.date)
                const end = parseISO(formData.endDate)

                if (start > end) {
                    setError('La fecha de fin debe ser posterior a la de inicio')
                    setSubmitting(false)
                    return
                }

                const allDays = eachDayOfInterval({ start, end })
                const targetDates = allDays.filter(day => selectedDays.includes(getDay(day)))

                if (targetDates.length === 0) {
                    setError('No hay fechas en el rango seleccionado que coincidan con los días elegidos')
                    setSubmitting(false)
                    return
                }

                for (const date of targetDates) {
                    const dateStr = format(date, 'yyyy-MM-dd')
                    bookingsToCreate.push({
                        fieldId: formData.fieldId,
                        startAt: parseISO(`${dateStr}T${formData.startTime}:00`).toISOString(),
                        endAt: parseISO(`${dateStr}T${formData.endTime}:00`).toISOString(),
                        reason: formData.reason || undefined,
                    })
                }

            } else {
                const startAt = parseISO(`${formData.date}T${formData.startTime}:00`)
                const endAt = parseISO(`${formData.date}T${formData.endTime}:00`)

                if (endAt <= startAt) {
                    setError('La hora de fin debe ser posterior a la hora de inicio')
                    setSubmitting(false)
                    return
                }

                bookingsToCreate.push({
                    fieldId: formData.fieldId,
                    startAt: startAt.toISOString(),
                    endAt: endAt.toISOString(),
                    reason: formData.reason || undefined,
                })
            }

            // Execute creations sequentially to avoid overwhelming execution
            let successCount = 0
            for (const bookingPayload of bookingsToCreate) {
                const response = await fetch('/api/admin/blocks', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(bookingPayload),
                })

                if (response.ok) successCount++
            }

            if (successCount === 0) {
                setError('Error al crear los bloqueos. Puede que existan conflictos de horario.')
            } else {
                fetchData()
                setShowForm(false)
                setFormData((prev) => ({
                    ...prev,
                    reason: '',
                    startTime: '09:00',
                    endTime: '10:00',
                    isRecurring: false,
                }))
                setSelectedDays([])
            }

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

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Bloqueos de Horarios</h2>
                    <p className="text-muted-foreground">
                        Gestiona los bloqueos de horarios para mantenimiento o eventos
                    </p>
                </div>
                {!showForm && (
                    <Button onClick={() => setShowForm(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Nuevo Bloqueo
                    </Button>
                )}
            </div>

            {showForm && (
                <Card className="border-slate-800 bg-slate-900/50">
                    <CardHeader>
                        <CardTitle>Crear Bloqueo</CardTitle>
                        <CardDescription>Define un bloqueo único o periódico</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {error && (
                                <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4" />
                                    {error}
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="fieldId">Cancha</Label>
                                    <Select
                                        value={formData.fieldId}
                                        onValueChange={(val) => setFormData(prev => ({ ...prev, fieldId: val }))}
                                    >
                                        <SelectTrigger id="fieldId">
                                            <SelectValue placeholder="Seleccionar cancha" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {fields.map((field) => (
                                                <SelectItem key={field.id} value={field.id}>
                                                    {field.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="reason">Motivo (opcional)</Label>
                                    <Input
                                        id="reason"
                                        placeholder="Ej: Mantenimiento, Torneo..."
                                        value={formData.reason}
                                        onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                                    />
                                </div>
                            </div>

                            <div className="flex items-center space-x-2 py-2">
                                <Checkbox
                                    id="recurring"
                                    checked={formData.isRecurring}
                                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isRecurring: checked === true }))}
                                />
                                <Label htmlFor="recurring" className="font-medium">Repetir bloqueo</Label>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {formData.isRecurring ? (
                                    <div className="col-span-1 md:col-span-2 space-y-2">
                                        <Label>Rango de Fechas</Label>
                                        <div className="flex gap-2">
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        className={cn(
                                                            "w-full justify-start text-left font-normal",
                                                            !formData.date && "text-muted-foreground"
                                                        )}
                                                    >
                                                        <CalendarRange className="mr-2 h-4 w-4" />
                                                        {formData.date ? (
                                                            formData.endDate ? (
                                                                <>
                                                                    {format(parseISO(formData.date), "dd/MM/yyyy")} - {format(parseISO(formData.endDate), "dd/MM/yyyy")}
                                                                </>
                                                            ) : (
                                                                format(parseISO(formData.date), "dd/MM/yyyy")
                                                            )
                                                        ) : (
                                                            <span>Seleccionar fechas</span>
                                                        )}
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0" align="start">
                                                    <Calendar
                                                        mode="range"
                                                        defaultMonth={parseISO(formData.date)}
                                                        selected={{
                                                            from: parseISO(formData.date),
                                                            to: parseISO(formData.endDate)
                                                        }}
                                                        onSelect={(range) => {
                                                            if (range?.from) {
                                                                setFormData(prev => ({
                                                                    ...prev,
                                                                    date: format(range.from!, 'yyyy-MM-dd'),
                                                                    endDate: range.to ? format(range.to, 'yyyy-MM-dd') : format(range.from!, 'yyyy-MM-dd')
                                                                }))
                                                            }
                                                        }}
                                                        numberOfMonths={2}
                                                    />
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <Label htmlFor="date">Fecha</Label>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    className={cn(
                                                        "w-full justify-start text-left font-normal",
                                                        !formData.date && "text-muted-foreground"
                                                    )}
                                                >
                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                    {formData.date ? format(parseISO(formData.date), "PPP", { locale: es }) : <span>Seleccionar fecha</span>}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0">
                                                <Calendar
                                                    mode="single"
                                                    selected={parseISO(formData.date)}
                                                    onSelect={(date) => date && setFormData(prev => ({ ...prev, date: format(date, 'yyyy-MM-dd') }))}
                                                    initialFocus
                                                />
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <Label>Hora Inicio</Label>
                                    <Input
                                        type="time"
                                        value={formData.startTime}
                                        onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Hora Fin</Label>
                                    <Input
                                        type="time"
                                        value={formData.endTime}
                                        onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                                        required
                                    />
                                </div>
                            </div>

                            {formData.isRecurring && (
                                <div className="space-y-2">
                                    <Label>Días de repetición</Label>
                                    <div className="flex flex-wrap gap-2">
                                        {DAYS_OF_WEEK.map((day) => (
                                            <div key={day.value} className="flex items-center space-x-2 bg-slate-800/50 p-2 rounded-md border border-slate-700">
                                                <Checkbox
                                                    id={`day-${day.value}`}
                                                    checked={selectedDays.includes(day.value)}
                                                    onCheckedChange={() => toggleDay(day.value)}
                                                />
                                                <label
                                                    htmlFor={`day-${day.value}`}
                                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                                >
                                                    {day.label}
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-end gap-2 pt-4">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setShowForm(false)}
                                    disabled={submitting}
                                >
                                    Cancelar
                                </Button>
                                <Button type="submit" disabled={submitting}>
                                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {formData.isRecurring ? 'Crear Bloqueos' : 'Crear Bloqueo'}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Bloqueos Activos</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center p-8">
                            <Loader2 className="h-8 w-8 animate-spin" />
                        </div>
                    ) : blocks.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <Ban className="mx-auto h-12 w-12 opacity-50 mb-2" />
                            <p>No hay bloqueos configurados</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Cancha</TableHead>
                                    <TableHead>Horario</TableHead>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead>Motivo</TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {blocks.map((block) => (
                                    <TableRow key={block.id}>
                                        <TableCell className="font-medium">
                                            {block.field?.name || 'Cancha eliminada'}
                                        </TableCell>
                                        <TableCell>
                                            {format(new Date(block.start_at), 'HH:mm')} -{' '}
                                            {format(new Date(block.end_at), 'HH:mm')}
                                        </TableCell>
                                        <TableCell>
                                            {format(new Date(block.start_at), "EEEE d 'de' MMMM", {
                                                locale: es,
                                            })}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="text-sm">{block.reason || (block.type === 'BOOKING' ? 'Reserva Bloqueada' : 'Sin motivo')}</span>
                                                {block.type === 'BOOKING' && (
                                                    <span className="text-xs text-blue-400">Origen: Disponibilidad</span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                onClick={() => handleDelete(block.id, block.type)}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
