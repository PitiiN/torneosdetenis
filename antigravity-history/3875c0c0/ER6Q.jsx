import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import MainLayout from './components/layout/MainLayout'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import History from './pages/History'
import Reports from './pages/Reports'

/**
 * Componente de ruta protegida
 * Redirige a login si el usuario no está autenticado
 */
function ProtectedRoute({ children }) {
    const { user, isLoading } = useAuthStore()

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin" style={{
                    width: '40px',
                    height: '40px',
                    border: '3px solid #e2e8f0',
                    borderTopColor: '#3b82f6',
                    borderRadius: '50%'
                }} />
            </div>
        )
    }

    if (!user) {
        return <Navigate to="/login" replace />
    }

    return children
}

/**
 * Componente de ruta pública
 * Redirige a dashboard si el usuario ya está autenticado
 */
function PublicRoute({ children }) {
    const { user, isLoading } = useAuthStore()

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin" style={{
                    width: '40px',
                    height: '40px',
                    border: '3px solid #e2e8f0',
                    borderTopColor: '#3b82f6',
                    borderRadius: '50%'
                }} />
            </div>
        )
    }

    if (user) {
        return <Navigate to="/dashboard" replace />
    }

    return children
}

function App() {
    const { checkSession, error } = useAuthStore()
    const [initError, setInitError] = useState(null)

    useEffect(() => {
        const init = async () => {
            try {
                await checkSession()
            } catch (e) {
                console.error("Error during session check:", e)
                setInitError(e.message)
            }
        }
        init()
    }, [])

    if (initError) {
        return (
            <div style={{ padding: 20, color: 'red' }}>
                <h1>Error Critical</h1>
                <p>{initError}</p>
                <p>Por favor revisa la consola del navegador.</p>
            </div>
        )
    }

    return (
        <Routes>
            {/* Rutas Públicas */}
            <Route path="/login" element={
                <PublicRoute>
                    <Login />
                </PublicRoute>
            } />
            <Route path="/register" element={
                <PublicRoute>
                    <Register />
                </PublicRoute>
            } />

            {/* Rutas Protegidas */}
            <Route path="/" element={
                <ProtectedRoute>
                    <MainLayout />
                </ProtectedRoute>
            }>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="history" element={<History />} />
                <Route path="reports" element={<Reports />} />
            </Route>

            {/* Ruta por defecto */}
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    )
}

export default App
