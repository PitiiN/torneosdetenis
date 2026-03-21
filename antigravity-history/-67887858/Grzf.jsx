import { useState, useEffect } from 'react'
import {
    Clock,
    Calendar,
    TrendingUp,
    PlayCircle,
    StopCircle,
    Coffee,
    Activity,
    MoreVertical
} from 'lucide-react'
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell
} from 'recharts'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useTimeStore, USER_STATUS } from '../store/timeStore'
import Header from '../components/layout/Header'
import StatCard from '../components/ui/StatCard'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import './Dashboard.css'

/**
 * Dashboard principal
 * Muestra estadísticas, gráficos y controles de marcaje
 */
function Dashboard() {
    const {
        status,
        isLoading,
        clockIn,
        clockOut,
        startBreak,
        endBreak,
        getStats,
        getWeeklyChartData,
        getMonthlyChartData,
        currentEntry,
        currentBreak
    } = useTimeStore()

    const [chartPeriod, setChartPeriod] = useState('weekly')
    const [timer, setTimer] = useState('00:00:00')

    const stats = getStats()
    const weeklyData = getWeeklyChartData()
    const monthlyData = getMonthlyChartData()

    // Timer en tiempo real cuando está trabajando
    useEffect(() => {
        if (status === USER_STATUS.OUT || !currentEntry) {
            setTimer('00:00:00')
            return
        }

        const updateTimer = () => {
            const start = new Date(currentEntry.clockIn)
            const now = new Date()

            // Restar tiempo de pausas
            let breakTime = 0
            currentEntry.breaks?.forEach(b => {
                if (b.endTime) {
                    breakTime += new Date(b.endTime) - new Date(b.startTime)
                } else if (status === USER_STATUS.ON_BREAK) {
                    breakTime += now - new Date(b.startTime)
                }
            })

            const diff = now - start - breakTime
            const hours = Math.floor(diff / 3600000)
            const minutes = Math.floor((diff % 3600000) / 60000)
            const seconds = Math.floor((diff % 60000) / 1000)

            setTimer(
                `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
            )
        }

        updateTimer()
        const interval = setInterval(updateTimer, 1000)

        return () => clearInterval(interval)
    }, [status, currentEntry])

    // Obtener estado actual en español
    const getStatusText = () => {
        switch (status) {
            case USER_STATUS.WORKING:
                return 'Trabajando'
            case USER_STATUS.ON_BREAK:
                return 'En pausa'
            default:
                return 'Fuera'
        }
    }

    const getStatusColor = () => {
        switch (status) {
            case USER_STATUS.WORKING:
                return 'var(--color-success)'
            case USER_STATUS.ON_BREAK:
                return 'var(--color-warning)'
            default:
                return 'var(--color-text-muted)'
        }
    }

    // Handlers de marcaje
    const handleClockIn = async () => {
        await clockIn()
    }

    const handleClockOut = async () => {
        await clockOut()
    }

    const handleBreakToggle = async () => {
        if (status === USER_STATUS.ON_BREAK) {
            await endBreak()
        } else {
            await startBreak()
        }
    }

    // Datos para el gráfico
    const chartData = chartPeriod === 'weekly' ? weeklyData : monthlyData

    return (
        <div className="dashboard">
            <Header
                title="Control Horario"
                subtitle="Gestiona tu tiempo de trabajo"
            />

            <div className="dashboard__content">
                {/* Stats Grid */}
                <div className="dashboard__stats">
                    <StatCard
                        title="Horas Hoy"
                        value={stats.todayHours}
                        unit="hrs"
                        icon={Clock}
                        trend="up"
                        trendValue="+5%"
                    >
                        <div className="dashboard__stat-extra">
                            <span className="dashboard__stat-label">Meta diaria:</span>
                            <span className="dashboard__stat-value">8 hrs</span>
                        </div>
                    </StatCard>

                    <StatCard
                        title="Horas Semana"
                        value={stats.weekHours}
                        unit="hrs"
                        icon={Calendar}
                        variant="default"
                    >
                        <div className="dashboard__stat-extra">
                            <span className="dashboard__stat-label">Meta semanal:</span>
                            <span className="dashboard__stat-value">40 hrs</span>
                        </div>
                    </StatCard>

                    <StatCard
                        title="Horas Mes"
                        value={stats.monthHours}
                        unit="hrs"
                        icon={TrendingUp}
                        variant="default"
                    >
                        <div className="dashboard__stat-extra">
                            <span className="dashboard__stat-label">Promedio/día:</span>
                            <span className="dashboard__stat-value">{stats.avgHours} hrs</span>
                        </div>
                    </StatCard>

                    <StatCard
                        title="Estado Actual"
                        value={getStatusText()}
                        icon={Activity}
                        variant="dark"
                    >
                        <div className="dashboard__status-indicator" style={{ color: getStatusColor() }}>
                            <span className="dashboard__status-dot" style={{ backgroundColor: getStatusColor() }} />
                            {status !== USER_STATUS.OUT && timer}
                        </div>
                    </StatCard>
                </div>

                {/* Main Grid */}
                <div className="dashboard__main">
                    {/* Time Controls */}
                    <Card variant="default" padding="lg" className="dashboard__controls">
                        <div className="dashboard__controls-header">
                            <h3>Control de Tiempo</h3>
                            <span className="dashboard__controls-date">
                                {format(new Date(), "EEEE, d 'de' MMMM", { locale: es })}
                            </span>
                        </div>

                        <div className="dashboard__timer">
                            <span className="dashboard__timer-value">{timer}</span>
                            <span className="dashboard__timer-label">Tiempo trabajado hoy</span>
                        </div>

                        <div className="dashboard__actions">
                            {status === USER_STATUS.OUT ? (
                                <Button
                                    icon={PlayCircle}
                                    size="lg"
                                    fullWidth
                                    loading={isLoading}
                                    onClick={handleClockIn}
                                >
                                    Marcar Entrada
                                </Button>
                            ) : (
                                <>
                                    <Button
                                        icon={Coffee}
                                        variant={status === USER_STATUS.ON_BREAK ? 'primary' : 'secondary'}
                                        size="lg"
                                        loading={isLoading}
                                        onClick={handleBreakToggle}
                                    >
                                        {status === USER_STATUS.ON_BREAK ? 'Terminar Pausa' : 'Iniciar Pausa'}
                                    </Button>
                                    <Button
                                        icon={StopCircle}
                                        variant="danger"
                                        size="lg"
                                        loading={isLoading}
                                        onClick={handleClockOut}
                                    >
                                        Marcar Salida
                                    </Button>
                                </>
                            )}
                        </div>

                        {currentEntry && (
                            <div className="dashboard__entry-info">
                                <div className="dashboard__entry-row">
                                    <span>Entrada:</span>
                                    <strong>{format(new Date(currentEntry.clockIn), 'HH:mm')}</strong>
                                </div>
                                {currentEntry.breaks?.length > 0 && (
                                    <div className="dashboard__entry-row">
                                        <span>Pausas:</span>
                                        <strong>{currentEntry.breaks.length}</strong>
                                    </div>
                                )}
                            </div>
                        )}
                    </Card>

                    {/* Activity Chart */}
                    <Card variant="dark" padding="lg" className="dashboard__chart">
                        <Card.Header>
                            <div className="dashboard__chart-header">
                                <h3>Análisis de Actividad</h3>
                                <div className="dashboard__chart-tabs">
                                    <button
                                        className={`dashboard__chart-tab ${chartPeriod === 'weekly' ? 'active' : ''}`}
                                        onClick={() => setChartPeriod('weekly')}
                                    >
                                        Semanal
                                    </button>
                                    <button
                                        className={`dashboard__chart-tab ${chartPeriod === 'monthly' ? 'active' : ''}`}
                                        onClick={() => setChartPeriod('monthly')}
                                    >
                                        Mensual
                                    </button>
                                </div>
                            </div>
                        </Card.Header>

                        <div className="dashboard__chart-container">
                            <ResponsiveContainer width="100%" height={250}>
                                <BarChart data={chartData} barRadius={[8, 8, 0, 0]}>
                                    <CartesianGrid
                                        strokeDasharray="3 3"
                                        stroke="rgba(255,255,255,0.1)"
                                        vertical={false}
                                    />
                                    <XAxis
                                        dataKey={chartPeriod === 'weekly' ? 'day' : 'month'}
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
                                        tickFormatter={(value) => `${value}h`}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: '#2A2A2A',
                                            border: 'none',
                                            borderRadius: '8px',
                                            color: '#fff'
                                        }}
                                        formatter={(value) => [`${value} horas`, 'Trabajadas']}
                                    />
                                    <Bar
                                        dataKey="hours"
                                        fill="#CCFF00"
                                        radius={[4, 4, 0, 0]}
                                    >
                                        {chartData.map((entry, index) => (
                                            <Cell
                                                key={`cell-${index}`}
                                                fill={entry.isToday || entry.isCurrent ? '#CCFF00' : '#666666'}
                                            />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="dashboard__chart-summary">
                            <div className="dashboard__chart-stat">
                                <span className="dashboard__chart-stat-value">
                                    {chartPeriod === 'weekly' ? stats.weekHours : stats.monthHours}
                                </span>
                                <span className="dashboard__chart-stat-label">
                                    Horas {chartPeriod === 'weekly' ? 'esta semana' : 'este mes'}
                                </span>
                            </div>
                            <div className="dashboard__chart-stat">
                                <span className="dashboard__chart-stat-value">{stats.avgHours}</span>
                                <span className="dashboard__chart-stat-label">Promedio diario</span>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Activity Progress */}
                <Card variant="default" padding="lg" className="dashboard__progress">
                    <h3>Progreso Semanal</h3>
                    <div className="dashboard__progress-bars">
                        <div className="dashboard__progress-item">
                            <div className="dashboard__progress-info">
                                <span>Lunes - Viernes</span>
                                <span>{Math.round((stats.weekHours / 40) * 100)}%</span>
                            </div>
                            <div className="dashboard__progress-bar">
                                <div
                                    className="dashboard__progress-fill dashboard__progress-fill--primary"
                                    style={{ width: `${Math.min((stats.weekHours / 40) * 100, 100)}%` }}
                                />
                            </div>
                        </div>
                        <div className="dashboard__progress-item">
                            <div className="dashboard__progress-info">
                                <span>Horas regulares</span>
                                <span>{stats.weekHours} / 40 hrs</span>
                            </div>
                            <div className="dashboard__progress-bar">
                                <div
                                    className="dashboard__progress-fill dashboard__progress-fill--dark"
                                    style={{ width: `${Math.min((stats.weekHours / 40) * 100, 100)}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    )
}

export default Dashboard
