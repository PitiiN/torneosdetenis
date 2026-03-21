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

// Generar datos mock de ejemplo
const generateMockData = () => {
    const entries = []
    const today = new Date()

    // Generar entradas para los últimos 30 días
    for (let i = 30; i >= 0; i--) {
        const date = new Date(today)
        date.setDate(date.getDate() - i)

        // Saltar fines de semana
        if (date.getDay() === 0 || date.getDay() === 6) continue

        // No generar para hoy (se manejará dinámicamente)
        if (i === 0) continue

        const clockIn = new Date(date)
        clockIn.setHours(8 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 30), 0)

        const clockOut = new Date(date)
        clockOut.setHours(17 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 30), 0)

        const breakDuration = 30 + Math.floor(Math.random() * 30) // 30-60 min

        const totalMinutes = differenceInMinutes(clockOut, clockIn) - breakDuration
        const totalHours = Math.round(totalMinutes / 6) / 10 // Redondear a 1 decimal

        entries.push({
            id: crypto.randomUUID(),
            date: format(date, 'yyyy-MM-dd'),
            clockIn: clockIn.toISOString(),
            clockOut: clockOut.toISOString(),
            totalHours,
            breaks: [
                {
                    id: crypto.randomUUID(),
                    startTime: new Date(date.setHours(13, 0, 0)).toISOString(),
                    endTime: new Date(date.setHours(13, breakDuration, 0)).toISOString(),
                    duration: breakDuration
                }
            ],
            notes: null
        })
    }

    return entries
}

// Recuperar o generar datos mock
const getStoredEntries = () => {
    const stored = localStorage.getItem('control_horario_entries')
    if (stored) {
        try {
            return JSON.parse(stored)
        } catch {
            return generateMockData()
        }
    }
    return generateMockData()
}

export const useTimeStore = create((set, get) => ({
    // Estado
    entries: getStoredEntries(),
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
            todayHours = todayEntry.totalHours || 0
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
            .reduce((acc, e) => acc + (e.totalHours || 0), 0) + (currentEntry ? todayHours : 0)

        // Calcular horas del mes
        const monthHours = entries
            .filter(e => isThisMonth(parseISO(e.date)))
            .reduce((acc, e) => acc + (e.totalHours || 0), 0) + (currentEntry ? todayHours : 0)

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
                hours: entry?.totalHours || 0,
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

            const totalHours = monthEntries.reduce((acc, e) => acc + (e.totalHours || 0), 0)

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
        const { status, entries } = get()

        if (status !== USER_STATUS.OUT) {
            return { success: false, error: 'Ya tienes una entrada registrada' }
        }

        set({ isLoading: true })
        await new Promise(resolve => setTimeout(resolve, 500))

        const now = new Date()
        const entry = {
            id: crypto.randomUUID(),
            date: format(now, 'yyyy-MM-dd'),
            clockIn: now.toISOString(),
            clockOut: null,
            totalHours: null,
            breaks: [],
            notes: null
        }

        set({
            currentEntry: entry,
            status: USER_STATUS.WORKING,
            isLoading: false
        })

        return { success: true }
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
        await new Promise(resolve => setTimeout(resolve, 500))

        const now = new Date()
        const clockIn = parseISO(currentEntry.clockIn)
        const breakMinutes = currentEntry.breaks?.reduce((acc, b) => acc + (b.duration || 0), 0) || 0
        const totalMinutes = differenceInMinutes(now, clockIn) - breakMinutes
        const totalHours = Math.round(totalMinutes / 6) / 10

        const completedEntry = {
            ...currentEntry,
            clockOut: now.toISOString(),
            totalHours
        }

        const updatedEntries = [...entries, completedEntry]

        // Guardar en localStorage
        localStorage.setItem('control_horario_entries', JSON.stringify(updatedEntries))

        set({
            entries: updatedEntries,
            currentEntry: null,
            status: USER_STATUS.OUT,
            isLoading: false
        })

        return { success: true }
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
        await new Promise(resolve => setTimeout(resolve, 300))

        const now = new Date()
        const newBreak = {
            id: crypto.randomUUID(),
            startTime: now.toISOString(),
            endTime: null,
            duration: null
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
        await new Promise(resolve => setTimeout(resolve, 300))

        const now = new Date()
        const startTime = parseISO(currentBreak.startTime)
        const duration = differenceInMinutes(now, startTime)

        const updatedBreak = {
            ...currentBreak,
            endTime: now.toISOString(),
            duration
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
    initialize: () => {
        const entries = getStoredEntries()
        set({ entries })
    }
}))
