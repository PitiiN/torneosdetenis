import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock, User, Clock } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import './Register.css'

/**
 * Página de registro
 */
function Register() {
    const navigate = useNavigate()
    const { register, isLoading, error, clearError } = useAuthStore()

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: ''
    })

    const [passwordError, setPasswordError] = useState('')

    const handleChange = (e) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
        if (error) clearError()
        if (passwordError) setPasswordError('')
    }

    const handleSubmit = async (e) => {
        e.preventDefault()

        // Validar contraseñas
        if (formData.password !== formData.confirmPassword) {
            setPasswordError('Las contraseñas no coinciden')
            return
        }

        if (formData.password.length < 8) {
            setPasswordError('La contraseña debe tener al menos 8 caracteres')
            return
        }

        const result = await register(formData.email, formData.password, formData.name)

        if (result.success) {
            navigate('/dashboard')
        }
    }

    return (
        <div className="register-page">
            <div className="register-page__left">
                <div className="register-page__brand">
                    <Clock className="register-page__brand-icon" size={48} />
                    <h1 className="register-page__brand-name">Control Horario</h1>
                    <p className="register-page__brand-tagline">
                        Comienza a gestionar tu tiempo de manera eficiente
                    </p>
                </div>

                <div className="register-page__benefits">
                    <div className="register-page__benefit">
                        <span className="register-page__benefit-check">✓</span>
                        <span>Registro de entrada y salida</span>
                    </div>
                    <div className="register-page__benefit">
                        <span className="register-page__benefit-check">✓</span>
                        <span>Gestión de pausas y descansos</span>
                    </div>
                    <div className="register-page__benefit">
                        <span className="register-page__benefit-check">✓</span>
                        <span>Estadísticas detalladas</span>
                    </div>
                    <div className="register-page__benefit">
                        <span className="register-page__benefit-check">✓</span>
                        <span>Reportes exportables</span>
                    </div>
                    <div className="register-page__benefit">
                        <span className="register-page__benefit-check">✓</span>
                        <span>Historial completo</span>
                    </div>
                </div>
            </div>

            <div className="register-page__right">
                <div className="register-page__form-container">
                    <div className="register-page__form-header">
                        <h2>Crear cuenta</h2>
                        <p>Completa tus datos para registrarte</p>
                    </div>

                    <form className="register-page__form" onSubmit={handleSubmit}>
                        <Input
                            label="Nombre completo"
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            placeholder="Tu nombre"
                            icon={User}
                            required
                        />

                        <Input
                            label="Correo electrónico"
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            placeholder="tu@email.com"
                            icon={Mail}
                            required
                        />

                        <Input
                            label="Contraseña"
                            type="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            placeholder="Mínimo 8 caracteres"
                            icon={Lock}
                            required
                        />

                        <Input
                            label="Confirmar contraseña"
                            type="password"
                            name="confirmPassword"
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            placeholder="Repite tu contraseña"
                            icon={Lock}
                            error={passwordError || error}
                            required
                        />

                        <div className="register-page__terms">
                            <label>
                                <input type="checkbox" required />
                                <span>
                                    Acepto los <a href="#">términos y condiciones</a> y la{' '}
                                    <a href="#">política de privacidad</a>
                                </span>
                            </label>
                        </div>

                        <Button
                            type="submit"
                            fullWidth
                            loading={isLoading}
                            size="lg"
                        >
                            Crear Cuenta
                        </Button>
                    </form>

                    <p className="register-page__login">
                        ¿Ya tienes cuenta?{' '}
                        <Link to="/login">Inicia sesión</Link>
                    </p>
                </div>
            </div>
        </div>
    )
}

export default Register
