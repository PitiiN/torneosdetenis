import './Card.css'

/**
 * Componente Card reutilizable
 * Variantes: default, dark, gradient
 */
function Card({
    children,
    variant = 'default',
    padding = 'md',
    className = '',
    onClick,
    hoverable = false,
    ...props
}) {
    const classes = [
        'card',
        `card--${variant}`,
        `card--padding-${padding}`,
        hoverable && 'card--hoverable',
        onClick && 'card--clickable',
        className
    ].filter(Boolean).join(' ')

    return (
        <div
            className={classes}
            onClick={onClick}
            role={onClick ? 'button' : undefined}
            tabIndex={onClick ? 0 : undefined}
            {...props}
        >
            {children}
        </div>
    )
}

/**
 * Header de la Card
 */
Card.Header = function CardHeader({ children, className = '', ...props }) {
    return (
        <div className={`card__header ${className}`} {...props}>
            {children}
        </div>
    )
}

/**
 * Body de la Card
 */
Card.Body = function CardBody({ children, className = '', ...props }) {
    return (
        <div className={`card__body ${className}`} {...props}>
            {children}
        </div>
    )
}

/**
 * Footer de la Card
 */
Card.Footer = function CardFooter({ children, className = '', ...props }) {
    return (
        <div className={`card__footer ${className}`} {...props}>
            {children}
        </div>
    )
}

export default Card
