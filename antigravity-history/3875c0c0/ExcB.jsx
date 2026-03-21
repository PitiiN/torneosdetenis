import { useEffect } from 'react'
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
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin" style={{
                    width: '40px',
                    height: '40px',
                    border: '3px solid var(--color-surface-light)',
                    borderTopColor: 'var(--color-primary)',
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
        return null
    }

    if (user) {
        return <Navigate to="/dashboard" replace />
    }

    return children
}

function App() {
    const { checkSession } = useAuthStore()

    useEffect(() => {
        checkSession()
    }, [])

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
