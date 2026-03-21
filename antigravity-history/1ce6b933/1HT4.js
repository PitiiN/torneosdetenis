import { create } from 'zustand'
import {
    format,
    startOfDay,
    endOfDay,
    startOfWeek,
    endOfWeek,
    startOfMonth,
    endOfMonth,
    differenceInMinutes,
    isToday,
    isThisWeek,
    isThisMonth,
    parseISO
} from 'date-fns'
import { es } from 'date-fns/locale'
import { supabase } from '../lib/supabaseClient'
import { useAuthStore } from './authStore'

/**
 * Store de registros horarios
 * Maneja entradas/salidas, pausas y estadísticas
 */

// Estados posibles del usuario
export const USER_STATUS = {
    OUT: 'out',           // Fuera (sin entrada)
    WORKING: 'working',   // Trabajando
    ON_BREAK: 'on_break'  // En pausa
}

export const useTimeStore = create((set, get) => ({
    // Estado
    entries: [],
    currentEntry: null,
    currentBreak: null,
    status: USER_STATUS.OUT,
    isLoading: false,
    error: null,

    // Getters computados

    /**
     * Obtener estadísticas de horas trabajadas
     */
    getStats: () => {
        const { entries, currentEntry } = get()
        const now = new Date()

        // Calcular horas del día actual (incluyendo entrada activa)
        let todayHours = 0
        const todayEntry = entries.find(e => e.date === format(now, 'yyyy-MM-dd'))

        if (todayEntry) {
            todayHours = Number(todayEntry.totalHours || 0)
        } else if (currentEntry) {
            // Si hay entrada sin salida, calcular tiempo transcurrido
            const clockIn = parseISO(currentEntry.clockIn)
            const minutesWorked = differenceInMinutes(now, clockIn)
            const breakMinutes = currentEntry.breaks?.reduce((acc, b) => acc + (b.duration || 0), 0) || 0
            todayHours = Math.round((minutesWorked - breakMinutes) / 6) / 10
        }

        // Calcular horas de la semana
        const weekHours = entries
            .filter(e => {
                const date = parseISO(e.date)
                return isThisWeek(date, { locale: es, weekStartsOn: 1 })
            })
            .reduce((acc, e) => acc + Number(e.totalHours || 0), 0) + (currentEntry ? todayHours : 0)

        // Calcular horas del mes
        const monthHours = entries
            .filter(e => isThisMonth(parseISO(e.date)))
            .reduce((acc, e) => acc + Number(e.totalHours || 0), 0) + (currentEntry ? todayHours : 0)

        // Calcular promedio diario del mes
        const monthEntries = entries.filter(e => isThisMonth(parseISO(e.date)))
        const avgHours = monthEntries.length > 0
            ? Math.round(monthHours / monthEntries.length * 10) / 10
            : 0

        return {
            todayHours: Math.round(todayHours * 10) / 10,
            weekHours: Math.round(weekHours * 10) / 10,
            monthHours: Math.round(monthHours * 10) / 10,
            avgHours
        }
    },

    /**
     * Obtener datos para gráficos semanales
     */
    getWeeklyChartData: () => {
        const { entries } = get()
        const days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
        const now = new Date()
        const weekStart = startOfWeek(now, { weekStartsOn: 1 })

        return days.map((day, index) => {
            const date = new Date(weekStart)
            date.setDate(date.getDate() + index)
            const dateStr = format(date, 'yyyy-MM-dd')

            const entry = entries.find(e => e.date === dateStr)

            return {
                day,
                date: dateStr,
                hours: Number(entry?.totalHours || 0),
                isToday: isToday(date)
            }
        })
    },

    /**
     * Obtener datos para gráficos mensuales
     */
    getMonthlyChartData: () => {
        const { entries } = get()
        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
        const now = new Date()
        const currentMonth = now.getMonth()

        // Mostrar últimos 7 meses
        return Array.from({ length: 7 }, (_, i) => {
            const monthIndex = (currentMonth - 6 + i + 12) % 12
            const year = monthIndex > currentMonth ? now.getFullYear() - 1 : now.getFullYear()

            const monthEntries = entries.filter(e => {
                const date = parseISO(e.date)
                return date.getMonth() === monthIndex && date.getFullYear() === year
            })

            const totalHours = monthEntries.reduce((acc, e) => acc + Number(e.totalHours || 0), 0)

            return {
                month: months[monthIndex],
                hours: Math.round(totalHours),
                isCurrent: monthIndex === currentMonth
            }
        })
    },

    // Acciones

    /**
     * Marcar entrada
     */
    clockIn: async () => {
        const { status } = get()
        // Obtener user id del otro store
        const user = useAuthStore.getState().user

        if (!user) return { success: false, error: 'No usuario autenticado' }
        if (status !== USER_STATUS.OUT) {
            return { success: false, error: 'Ya tienes una entrada registrada' }
        }

        set({ isLoading: true })

        try {
            const now = new Date()
            const { data, error } = await supabase
                .from('time_entries')
                .insert({
                    user_id: user.id,
                    date: format(now, 'yyyy-MM-dd'),
                    clock_in: now.toISOString(),
                })
                .select()
                .single()

            if (error) throw error

            // Normalizar campos para el frontend (camelCase)
            const entry = {
                id: data.id,
                date: data.date,
                clockIn: data.clock_in,
                clockOut: data.clock_out,
                totalHours: data.total_hours,
                breaks: [],
                notes: data.notes
            }

            set({
                currentEntry: entry,
                status: USER_STATUS.WORKING,
                isLoading: false
            })
            return { success: true }
        } catch (error) {
            set({ isLoading: false, error: error.message })
            return { success: false, error: error.message }
        }
    },

    /**
     * Marcar salida
     */
    clockOut: async () => {
        const { status, currentEntry, entries } = get()

        if (status === USER_STATUS.OUT) {
            return { success: false, error: 'No tienes una entrada registrada' }
        }

        if (status === USER_STATUS.ON_BREAK) {
            // Finalizar pausa primero
            await get().endBreak()
        }

        set({ isLoading: true })

        try {
            const now = new Date()
            const clockIn = parseISO(currentEntry.clockIn)
            const breakMinutes = currentEntry.breaks?.reduce((acc, b) => acc + (b.duration || 0), 0) || 0
            const totalMinutes = differenceInMinutes(now, clockIn) - breakMinutes
            const totalHours = Math.round(totalMinutes / 6) / 10

            const { data, error } = await supabase
                .from('time_entries')
                .update({
                    clock_out: now.toISOString(),
                    total_hours: totalHours
                })
                .eq('id', currentEntry.id)
                .select()
                .single()

            if (error) throw error

            const completedEntry = {
                ...currentEntry,
                clockOut: data.clock_out,
                totalHours: data.total_hours
            }

            set({
                entries: [completedEntry, ...entries], // Add to top usually, but let's keep array order logic simple
                currentEntry: null,
                status: USER_STATUS.OUT,
                isLoading: false
            })
            // Recargar entradas para asegurar sync
            get().initialize()

            return { success: true }
        } catch (error) {
            set({ isLoading: false, error: error.message })
            return { success: false, error: error.message }
        }
    },

    /**
     * Iniciar pausa
     */
    startBreak: async () => {
        const { status, currentEntry } = get()

        if (status !== USER_STATUS.WORKING) {
            return { success: false, error: 'Debes estar trabajando para iniciar una pausa' }
        }

        set({ isLoading: true })

        try {
            const now = new Date()
            const { data, error } = await supabase
                .from('breaks')
                .insert({
                    entry_id: currentEntry.id,
                    start_time: now.toISOString()
                })
                .select()
                .single()

            if (error) throw error

            const newBreak = {
                id: data.id,
                startTime: data.start_time,
                endTime: data.end_time,
                duration: data.duration_minutes
            }

            set({
                currentBreak: newBreak,
                currentEntry: {
                    ...currentEntry,
                    breaks: [...(currentEntry.breaks || []), newBreak]
                },
                status: USER_STATUS.ON_BREAK,
                isLoading: false
            })

            return { success: true }
        } catch (error) {
            set({ isLoading: false, error: error.message })
            return { success: false, error: error.message }
        }
    },

    /**
     * Finalizar pausa
     */
    endBreak: async () => {
        const { status, currentEntry, currentBreak } = get()

        if (status !== USER_STATUS.ON_BREAK) {
            return { success: false, error: 'No tienes una pausa activa' }
        }

        set({ isLoading: true })

        try {
            const now = new Date()
            const startTime = parseISO(currentBreak.startTime)
            const duration = differenceInMinutes(now, startTime)

            const { data, error } = await supabase
                .from('breaks')
                .update({
                    end_time: now.toISOString(),
                    duration_minutes: duration
                })
                .eq('id', currentBreak.id)
                .select()
                .single()

            if (error) throw error

            const updatedBreak = {
                id: data.id,
                startTime: data.start_time,
                endTime: data.end_time,
                duration: data.duration_minutes
            }

            const updatedBreaks = currentEntry.breaks.map(b =>
                b.id === currentBreak.id ? updatedBreak : b
            )

            set({
                currentBreak: null,
                currentEntry: {
                    ...currentEntry,
                    breaks: updatedBreaks
                },
                status: USER_STATUS.WORKING,
                isLoading: false
            })

            return { success: true }
        } catch (error) {
            set({ isLoading: false, error: error.message })
            return { success: false, error: error.message }
        }
    },

    /**
     * Obtener historial con filtros
     */
    getHistory: (filters = {}) => {
        const { entries } = get()
        let filtered = [...entries]

        if (filters.startDate) {
            filtered = filtered.filter(e => e.date >= filters.startDate)
        }

        if (filters.endDate) {
            filtered = filtered.filter(e => e.date <= filters.endDate)
        }

        if (filters.search) {
            const search = filters.search.toLowerCase()
            filtered = filtered.filter(e =>
                e.date.includes(search) ||
                e.notes?.toLowerCase().includes(search)
            )
        }

        // Ordenar por fecha descendente
        filtered.sort((a, b) => b.date.localeCompare(a.date))

        return filtered
    },

    /**
     * Inicializar store (recuperar estado)
     */
    initialize: async () => {
        set({ isLoading: true })
        const user = useAuthStore.getState().user
        if (!user) {
            set({ entries: [], currentEntry: null, status: USER_STATUS.OUT, isLoading: false })
            return
        }

        try {
            // Cargar entradas recientes (último mes por ejemplo, o todas si no son muchas)
            // Para simplicidad cargamos últimos 50
            const { data: entriesData, error } = await supabase
                .from('time_entries')
                .select(`
                    *,
                    breaks (*)
                `)
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(50)

            if (error) throw error

            const entries = entriesData.map(e => ({
                id: e.id,
                date: e.date,
                clockIn: e.clock_in,
                clockOut: e.clock_out,
                totalHours: e.total_hours,
                notes: e.notes,
                breaks: e.breaks.map(b => ({
                    id: b.id,
                    startTime: b.start_time,
                    endTime: b.end_time,
                    duration: b.duration_minutes
                }))
            }))

            // Determinar estado actual
            // Buscar si hay alguna entrada sin clockOut hoy (o reciente)
            const activeEntry = entries.find(e => !e.clockOut)
            let status = USER_STATUS.OUT
            let currentBreak = null

            if (activeEntry) {
                // Verificar si hay pausa activa
                const activeBreak = activeEntry.breaks.find(b => !b.endTime)
                if (activeBreak) {
                    status = USER_STATUS.ON_BREAK
                    currentBreak = activeBreak
                } else {
                    status = USER_STATUS.WORKING
                }
            }

            set({
                entries,
                currentEntry: activeEntry || null,
                currentBreak,
                status,
                isLoading: false
            })

        } catch (error) {
            console.error('Error initializing time store:', error)
            set({ isLoading: false, error: error.message })
        }
    }
}))
