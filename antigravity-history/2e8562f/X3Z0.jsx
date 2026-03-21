import { NavLink, useNavigate } from 'react-router-dom'
import {
    LayoutDashboard,
    History,
    FileBarChart,
    Settings,
    LogOut,
    Clock,
    Rocket
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import Button from '../ui/Button'
import './Sidebar.css'

/**
 * Sidebar de navegación
 * Diseño oscuro basado en diseño.png
 */
function Sidebar() {
    const navigate = useNavigate()
    const { logout } = useAuthStore()

    const handleLogout = async () => {
        await logout()
        navigate('/login')
    }

    const navItems = [
        {
            path: '/dashboard',
            icon: LayoutDashboard,
            label: 'Dashboard',
            badge: null
        },
        {
            path: '/history',
            icon: History,
            label: 'Historial',
            badge: null
        },
        {
            path: '/reports',
            icon: FileBarChart,
            label: 'Reportes',
            badge: null
        },
    ]

    return (
        <aside className="sidebar">
            {/* Logo */}
            <div className="sidebar__logo">
                <Clock className="sidebar__logo-icon" size={28} />
                <span className="sidebar__logo-text">Control Horario</span>
            </div>

            {/* Navegación */}
            <nav className="sidebar__nav">
                {navItems.map(item => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) =>
                            `sidebar__nav-item ${isActive ? 'sidebar__nav-item--active' : ''}`
                        }
                    >
                        <item.icon size={20} />
                        <span className="sidebar__nav-label">{item.label}</span>
                        {item.badge && (
                            <span className="sidebar__nav-badge">{item.badge}</span>
                        )}
                    </NavLink>
                ))}
            </nav>

            {/* Card de upgrade (decorativo) */}
            <div className="sidebar__promo">
                <div className="sidebar__promo-icon">
                    <Rocket size={32} />
                </div>
                <h4 className="sidebar__promo-title">Control Horario Pro</h4>
                <p className="sidebar__promo-text">
                    Accede a reportes avanzados y exportación de datos
                </p>
                <Button variant="primary" size="sm" fullWidth>
                    Actualizar
                </Button>
            </div>

            {/* Logout */}
            <div className="sidebar__footer">
                <button className="sidebar__logout" onClick={handleLogout}>
                    <LogOut size={20} />
                    <span>Cerrar Sesión</span>
                </button>
            </div>
        </aside>
    )
}

export default Sidebar
