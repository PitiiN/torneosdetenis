import { useState, useMemo } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO, isWeekend } from 'date-fns'
import { es } from 'date-fns/locale'
import {
    BarChart,
    Bar,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell
} from 'recharts'
import {
    Download,
    Calendar,
    TrendingUp,
    Clock,
    FileText
} from 'lucide-react'
import { useTimeStore } from '../store/timeStore'
import Header from '../components/layout/Header'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import StatCard from '../components/ui/StatCard'
import './Reports.css'

/**
 * Página de Reportes
 * Muestra estadísticas y gráficos de horas trabajadas
 */
function Reports() {
    const { entries, getStats, getMonthlyChartData } = useTimeStore()
    const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'))

    const stats = getStats()
    const monthlyData = getMonthlyChartData()

    // Calcular datos del mes seleccionado
    const monthData = useMemo(() => {
        const [year, month] = selectedMonth.split('-').map(Number)
        const start = startOfMonth(new Date(year, month - 1))
        const end = endOfMonth(start)

        const monthEntries = entries.filter(e => {
            const date = parseISO(e.date)
            return date >= start && date <= end
        })

        const totalHours = monthEntries.reduce((acc, e) => acc + (e.totalHours || 0), 0)
        const totalDays = monthEntries.length
        const avgHours = totalDays > 0 ? Math.round(totalHours / totalDays * 10) / 10 : 0

        // Días laborables en el mes (sin fines de semana)
        const allDays = eachDayOfInterval({ start, end })
        const workDays = allDays.filter(d => !isWeekend(d)).length

        // Datos diarios para el gráfico
        const dailyData = allDays.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd')
            const entry = monthEntries.find(e => e.date === dateStr)
            return {
                day: format(day, 'd'),
                date: dateStr,
                hours: entry?.totalHours || 0,
                isWeekend: isWeekend(day)
            }
        })

        return {
            totalHours,
            totalDays,
            avgHours,
            workDays,
            attendance: totalDays > 0 ? Math.round((totalDays / workDays) * 100) : 0,
            dailyData
        }
    }, [selectedMonth, entries])

    // Datos para gráfico de distribución
    const distributionData = [
        { name: 'Trabajado', value: monthData.totalHours, color: '#CCFF00' },
        { name: 'Pendiente', value: Math.max(0, (monthData.workDays * 8) - monthData.totalHours), color: '#3A3A3A' }
    ]

    // Generar lista de meses para selector
    const availableMonths = useMemo(() => {
        const months = []
        const now = new Date()
        for (let i = 0; i < 12; i++) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
            months.push({
                value: format(date, 'yyyy-MM'),
                label: format(date, 'MMMM yyyy', { locale: es })
            })
        }
        return months
    }, [])

    // Exportar a CSV
    const handleExportCSV = () => {
        const [year, month] = selectedMonth.split('-').map(Number)
        const start = startOfMonth(new Date(year, month - 1))
        const end = endOfMonth(start)

        const monthEntries = entries.filter(e => {
            const date = parseISO(e.date)
            return date >= start && date <= end
        })

        const headers = ['Fecha', 'Entrada', 'Salida', 'Pausas (min)', 'Total Horas']
        const rows = monthEntries.map(e => [
            e.date,
            e.clockIn ? format(parseISO(e.clockIn), 'HH:mm') : '',
            e.clockOut ? format(parseISO(e.clockOut), 'HH:mm') : '',
            e.breaks?.reduce((acc, b) => acc + (b.duration || 0), 0) || 0,
            e.totalHours || 0
        ])

        const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = `reporte_${selectedMonth}.csv`
        link.click()
    }

    return (
        <div className="reports">
            <Header
                title="Reportes"
                subtitle="Estadísticas y análisis de tu tiempo trabajado"
            />

            <div className="reports__content">
                {/* Controles */}
                <div className="reports__controls">
                    <div className="reports__month-selector">
                        <Calendar size={20} />
                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="reports__month-select"
                        >
                            {availableMonths.map(m => (
                                <option key={m.value} value={m.value}>
                                    {m.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <Button
                        variant="secondary"
                        icon={Download}
                        onClick={handleExportCSV}
                    >
                        Exportar CSV
                    </Button>
                </div>

                {/* Stats resumen */}
                <div className="reports__stats">
                    <StatCard
                        title="Total Horas"
                        value={monthData.totalHours}
                        unit="hrs"
                        icon={Clock}
                        variant="accent"
                    />
                    <StatCard
                        title="Días Trabajados"
                        value={monthData.totalDays}
                        unit={`/ ${monthData.workDays}`}
                        icon={Calendar}
                    />
                    <StatCard
                        title="Promedio Diario"
                        value={monthData.avgHours}
                        unit="hrs"
                        icon={TrendingUp}
                    />
                    <StatCard
                        title="Asistencia"
                        value={monthData.attendance}
                        unit="%"
                        icon={FileText}
                    />
                </div>

                {/* Gráficos */}
                <div className="reports__charts">
                    {/* Gráfico de barras diarias */}
                    <Card variant="default" padding="lg" className="reports__chart reports__chart--wide">
                        <h3>Horas por Día</h3>
                        <div className="reports__chart-container">
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={monthData.dailyData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" vertical={false} />
                                    <XAxis
                                        dataKey="day"
                                        stroke="#888"
                                        fontSize={11}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <YAxis
                                        stroke="#888"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={(value) => `${value}h`}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: '#1A1A1A',
                                            border: 'none',
                                            borderRadius: '8px',
                                            color: '#fff'
                                        }}
                                        formatter={(value) => [`${value} horas`, 'Trabajadas']}
                                        labelFormatter={(label) => `Día ${label}`}
                                    />
                                    <Bar
                                        dataKey="hours"
                                        fill="#CCFF00"
                                        radius={[4, 4, 0, 0]}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>

                    {/* Gráfico de distribución */}
                    <Card variant="dark" padding="lg" className="reports__chart">
                        <h3>Distribución del Mes</h3>
                        <div className="reports__chart-container reports__chart-container--pie">
                            <ResponsiveContainer width="100%" height={200}>
                                <PieChart>
                                    <Pie
                                        data={distributionData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {distributionData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: '#2A2A2A',
                                            border: 'none',
                                            borderRadius: '8px',
                                            color: '#fff'
                                        }}
                                        formatter={(value) => [`${value} horas`, '']}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="reports__chart-legend">
                                {distributionData.map((item, index) => (
                                    <div key={index} className="reports__chart-legend-item">
                                        <span
                                            className="reports__chart-legend-color"
                                            style={{ backgroundColor: item.color }}
                                        />
                                        <span>{item.name}: {item.value} hrs</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </Card>

                    {/* Tendencia mensual */}
                    <Card variant="default" padding="lg" className="reports__chart">
                        <h3>Tendencia Anual</h3>
                        <div className="reports__chart-container">
                            <ResponsiveContainer width="100%" height={200}>
                                <LineChart data={monthlyData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                                    <XAxis
                                        dataKey="month"
                                        stroke="#888"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <YAxis
                                        stroke="#888"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: '#1A1A1A',
                                            border: 'none',
                                            borderRadius: '8px',
                                            color: '#fff'
                                        }}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="hours"
                                        stroke="#CCFF00"
                                        strokeWidth={3}
                                        dot={{ fill: '#CCFF00', strokeWidth: 2 }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    )
}

export default Reports
