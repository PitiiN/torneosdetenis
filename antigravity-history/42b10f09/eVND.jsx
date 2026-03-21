import './StatCard.css'

/**
 * Componente StatCard para mostrar estadísticas
 * Similar al diseño de "Energy Used", "Heart Rate", etc.
 */
function StatCard({
    title,
    value,
    unit,
    icon: Icon,
    trend,
    trendValue,
    variant = 'default',
    size = 'md',
    className = '',
    children,
    ...props
}) {
    const classes = [
        'stat-card',
        `stat-card--${variant}`,
        `stat-card--${size}`,
        className
    ].filter(Boolean).join(' ')

    const trendClasses = [
        'stat-card__trend',
        trend === 'up' && 'stat-card__trend--up',
        trend === 'down' && 'stat-card__trend--down'
    ].filter(Boolean).join(' ')

    return (
        <div className={classes} {...props}>
            <div className="stat-card__header">
                {Icon && (
                    <div className="stat-card__icon">
                        <Icon size={20} />
                    </div>
                )}
                <span className="stat-card__title">{title}</span>
                {trendValue && (
                    <span className={trendClasses}>
                        {trend === 'up' ? '+' : trend === 'down' ? '-' : ''}{trendValue}
                    </span>
                )}
            </div>

            <div className="stat-card__content">
                <span className="stat-card__value">{value}</span>
                {unit && <span className="stat-card__unit">{unit}</span>}
            </div>

            {children && (
                <div className="stat-card__extra">
                    {children}
                </div>
            )}
        </div>
    )
}

export default StatCard
