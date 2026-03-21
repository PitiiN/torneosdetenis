import './Input.css'
import { forwardRef } from 'react'

/**
 * Componente Input reutilizable
 * Soporta texto, email, password, etc.
 */
const Input = forwardRef(function Input({
    label,
    type = 'text',
    error,
    helperText,
    icon: Icon,
    iconPosition = 'left',
    fullWidth = true,
    className = '',
    id,
    ...props
}, ref) {
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`

    const wrapperClasses = [
        'input-wrapper',
        fullWidth && 'input-wrapper--full-width',
        error && 'input-wrapper--error',
        Icon && 'input-wrapper--with-icon',
        Icon && `input-wrapper--icon-${iconPosition}`,
        className
    ].filter(Boolean).join(' ')

    return (
        <div className={wrapperClasses}>
            {label && (
                <label htmlFor={inputId} className="input__label">
                    {label}
                </label>
            )}
            <div className="input__container">
                {Icon && iconPosition === 'left' && (
                    <Icon className="input__icon input__icon--left" size={20} />
                )}
                <input
                    ref={ref}
                    id={inputId}
                    type={type}
                    className="input__field"
                    {...props}
                />
                {Icon && iconPosition === 'right' && (
                    <Icon className="input__icon input__icon--right" size={20} />
                )}
            </div>
            {(error || helperText) && (
                <span className={`input__helper ${error ? 'input__helper--error' : ''}`}>
                    {error || helperText}
                </span>
            )}
        </div>
    )
})

export default Input
