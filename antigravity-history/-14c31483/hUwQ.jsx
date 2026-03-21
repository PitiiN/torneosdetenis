import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock, Clock } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import './Login.css'

/**
 * Página de inicio de sesión
 */
function Login() {
    const navigate = useNavigate()
    const { login, isLoading, error, clearError, checkSession } = useAuthStore()

    const [formData, setFormData] = useState({
        email: '',
        password: ''
    })

    useEffect(() => {
        checkSession()
    }, [checkSession])

    const handleChange = (e) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
        if (error) clearError()
    }

    const handleSubmit = async (e) => {
        e.preventDefault()

        const result = await login(formData.email, formData.password)

        if (result.success) {
            navigate('/dashboard')
        }
    }

    return (
        <div className="login-page">
            <div className="login-page__left">
                <div className="login-page__brand">
                    <Clock className="login-page__brand-icon" size={48} />
                    <h1 className="login-page__brand-name">Control Horario</h1>
                    <p className="login-page__brand-tagline">
                        Gestiona tu tiempo de trabajo de forma inteligente
                    </p>
                </div>

                <div className="login-page__features">
                    <div className="login-page__feature">
                        <span className="login-page__feature-icon">⏱️</span>
                        <div>
                            <h3>Registro rápido</h3>
                            <p>Marca entrada y salida con un solo clic</p>
                        </div>
                    </div>
                    <div className="login-page__feature">
                        <span className="login-page__feature-icon">📊</span>
                        <div>
                            <h3>Estadísticas claras</h3>
                            <p>Visualiza tus horas trabajadas</p>
                        </div>
                    </div>
                    <div className="login-page__feature">
                        <span className="login-page__feature-icon">📈</span>
                        <div>
                            <h3>Reportes detallados</h3>
                            <p>Exporta tus datos cuando quieras</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="login-page__right">
                <div className="login-page__form-container">
                    <div className="login-page__form-header">
                        <h2>Bienvenido de vuelta</h2>
                        <p>Ingresa tus credenciales para continuar</p>
                    </div>

                    <form className="login-page__form" onSubmit={handleSubmit}>
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
                            placeholder="••••••••"
                            icon={Lock}
                            error={error}
                            required
                        />

                        <div className="login-page__options">
                            <label className="login-page__remember">
                                <input type="checkbox" />
                                <span>Recordarme</span>
                            </label>
                            <Link to="/forgot-password" className="login-page__forgot">
                                ¿Olvidaste tu contraseña?
                            </Link>
                        </div>

                        <Button
                            type="submit"
                            fullWidth
                            loading={isLoading}
                            size="lg"
                        >
                            Iniciar Sesión
                        </Button>
                    </form>

                    <p className="login-page__register">
                        ¿No tienes cuenta?{' '}
                        <Link to="/register">Regístrate aquí</Link>
                    </p>

                    <div className="login-page__demo">
                        <p>Para probar, usa cualquier email y contraseña (mín. 8 caracteres)</p>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Login
