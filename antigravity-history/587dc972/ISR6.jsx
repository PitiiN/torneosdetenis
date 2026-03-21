import { Outlet } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuthStore } from '../../store/authStore'
import { useTimeStore } from '../../store/timeStore'
import Sidebar from './Sidebar'
import './MainLayout.css'

/**
 * Layout principal de la aplicación
 * Combina Sidebar + contenido principal
 */
function MainLayout() {
    const { checkSession } = useAuthStore()
    const { initialize } = useTimeStore()

    useEffect(() => {
        // Verificar sesión y cargar datos al montar
        checkSession()
        initialize()
    }, [checkSession, initialize])

    return (
        <div className="main-layout">
            <Sidebar />
            <main className="main-layout__content">
                <Outlet />
            </main>
        </div>
    )
}

export default MainLayout
