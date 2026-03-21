import './Button.css'

/**
 * Componente Button reutilizable
 * Variantes: primary, secondary, danger, ghost
 * Tamaños: sm, md, lg
 */
function Button({
    children,
    variant = 'primary',
    size = 'md',
    fullWidth = false,
    disabled = false,
    loading = false,
    icon: Icon,
    iconPosition = 'left',
    onClick,
    type = 'button',
    className = '',
    ...props
}) {
    const classes = [
        'btn',
        `btn--${variant}`,
        `btn--${size}`,
        fullWidth && 'btn--full-width',
        disabled && 'btn--disabled',
        loading && 'btn--loading',
        Icon && 'btn--with-icon',
        className
    ].filter(Boolean).join(' ')

    return (
        <button
            type={type}
            className={classes}
            disabled={disabled || loading}
            onClick={onClick}
            {...props}
        >
            {loading && (
                <span className="btn__spinner" />
            )}
            {Icon && iconPosition === 'left' && !loading && (
                <Icon className="btn__icon btn__icon--left" size={size === 'sm' ? 16 : size === 'lg' ? 24 : 20} />
            )}
            <span className="btn__text">{children}</span>
            {Icon && iconPosition === 'right' && !loading && (
                <Icon className="btn__icon btn__icon--right" size={size === 'sm' ? 16 : size === 'lg' ? 24 : 20} />
            )}
        </button>
    )
}

export default Button
