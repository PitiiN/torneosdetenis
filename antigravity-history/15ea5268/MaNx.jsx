import { useState, useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import {
    Search,
    Filter,
    Calendar,
    Clock,
    Coffee,
    ChevronLeft,
    ChevronRight
} from 'lucide-react'
import { useTimeStore } from '../store/timeStore'
import Header from '../components/layout/Header'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import './History.css'

/**
 * Página de Historial
 * Muestra todas las jornadas laborales con filtros y paginación
 */
function History() {
    const { getHistory } = useTimeStore()

    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
        search: ''
    })
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 10

    // Obtener historial filtrado
    const entries = useMemo(() => {
        return getHistory(filters)
    }, [getHistory, filters])

    // Paginación
    const totalPages = Math.ceil(entries.length / itemsPerPage)
    const paginatedEntries = entries.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    )

    const handleFilterChange = (e) => {
        const { name, value } = e.target
        setFilters(prev => ({ ...prev, [name]: value }))
        setCurrentPage(1) // Reset a primera página
    }

    const clearFilters = () => {
        setFilters({ startDate: '', endDate: '', search: '' })
        setCurrentPage(1)
    }

    const formatTime = (isoString) => {
        if (!isoString) return '--:--'
        return format(parseISO(isoString), 'HH:mm')
    }

    const formatDate = (dateString) => {
        return format(parseISO(dateString), "EEEE, d 'de' MMMM yyyy", { locale: es })
    }

    const getBreakDuration = (breaks) => {
        if (!breaks || breaks.length === 0) return 0
        return breaks.reduce((acc, b) => acc + (b.duration || 0), 0)
    }

    return (
        <div className="history">
            <Header
                title="Historial"
                subtitle="Revisa tus jornadas laborales anteriores"
            />

            <div className="history__content">
                {/* Filtros */}
                <Card variant="default" padding="md" className="history__filters">
                    <div className="history__filters-row">
                        <div className="history__search">
                            <Search size={18} />
                            <input
                                type="text"
                                name="search"
                                value={filters.search}
                                onChange={handleFilterChange}
                                placeholder="Buscar por fecha o notas..."
                                className="history__search-input"
                            />
                        </div>

                        <div className="history__date-filters">
                            <div className="history__date-field">
                                <Calendar size={16} />
                                <input
                                    type="date"
                                    name="startDate"
                                    value={filters.startDate}
                                    onChange={handleFilterChange}
                                    className="history__date-input"
                                />
                            </div>
                            <span className="history__date-separator">—</span>
                            <div className="history__date-field">
                                <Calendar size={16} />
                                <input
                                    type="date"
                                    name="endDate"
                                    value={filters.endDate}
                                    onChange={handleFilterChange}
                                    className="history__date-input"
                                />
                            </div>
                        </div>

                        {(filters.startDate || filters.endDate || filters.search) && (
                            <Button variant="ghost" size="sm" onClick={clearFilters}>
                                Limpiar filtros
                            </Button>
                        )}
                    </div>

                    <div className="history__summary">
                        <span>{entries.length} registros encontrados</span>
                    </div>
                </Card>

                {/* Lista de entradas */}
                <div className="history__list">
                    {paginatedEntries.length === 0 ? (
                        <Card variant="default" padding="lg" className="history__empty">
                            <div className="history__empty-content">
                                <Clock size={48} />
                                <h3>No hay registros</h3>
                                <p>No se encontraron jornadas con los filtros seleccionados</p>
                            </div>
                        </Card>
                    ) : (
                        paginatedEntries.map(entry => (
                            <Card
                                key={entry.id}
                                variant="default"
                                padding="md"
                                className="history__entry"
                                hoverable
                            >
                                <div className="history__entry-header">
                                    <div className="history__entry-date">
                                        <span className="history__entry-day">
                                            {format(parseISO(entry.date), 'EEEE', { locale: es })}
                                        </span>
                                        <span className="history__entry-full-date">
                                            {format(parseISO(entry.date), "d 'de' MMMM yyyy", { locale: es })}
                                        </span>
                                    </div>
                                    <div className="history__entry-hours">
                                        <span className="history__entry-total">{entry.totalHours || 0}</span>
                                        <span className="history__entry-unit">horas</span>
                                    </div>
                                </div>

                                <div className="history__entry-details">
                                    <div className="history__entry-time">
                                        <Clock size={16} />
                                        <span>Entrada: <strong>{formatTime(entry.clockIn)}</strong></span>
                                    </div>
                                    <div className="history__entry-time">
                                        <Clock size={16} />
                                        <span>Salida: <strong>{formatTime(entry.clockOut)}</strong></span>
                                    </div>
                                    {entry.breaks && entry.breaks.length > 0 && (
                                        <div className="history__entry-time">
                                            <Coffee size={16} />
                                            <span>Pausas: <strong>{getBreakDuration(entry.breaks)} min</strong></span>
                                        </div>
                                    )}
                                </div>

                                {entry.notes && (
                                    <div className="history__entry-notes">
                                        <p>{entry.notes}</p>
                                    </div>
                                )}
                            </Card>
                        ))
                    )}
                </div>

                {/* Paginación */}
                {totalPages > 1 && (
                    <div className="history__pagination">
                        <Button
                            variant="secondary"
                            size="sm"
                            icon={ChevronLeft}
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(p => p - 1)}
                        >
                            Anterior
                        </Button>

                        <div className="history__pagination-info">
                            Página {currentPage} de {totalPages}
                        </div>

                        <Button
                            variant="secondary"
                            size="sm"
                            icon={ChevronRight}
                            iconPosition="right"
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(p => p + 1)}
                        >
                            Siguiente
                        </Button>
                    </div>
                )}
            </div>
        </div>
    )
}

export default History
