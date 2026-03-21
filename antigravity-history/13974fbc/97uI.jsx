import { Search, Bell } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import './Header.css'

/**
 * Header principal
 * Muestra perfil de usuario, búsqueda y notificaciones
 */
function Header({ title, subtitle }) {
    const { user } = useAuthStore()

    // Obtener iniciales del usuario
    const getInitials = (name) => {
        if (!name) return 'U'
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    }

    const today = new Date()
    const formattedDate = today.toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    })

    return (
        <header className="header">
            <div className="header__left">
                {/* Perfil de usuario */}
                <div className="header__user">
                    <div className="header__avatar">
                        {user?.avatar ? (
                            <img src={user.avatar} alt={user.name} />
                        ) : (
                            <span>{getInitials(user?.name)}</span>
                        )}
                    </div>
                    <div className="header__user-info">
                        <span className="header__user-name">{user?.name || 'Usuario'}</span>
                        <span className="header__user-email">{user?.email}</span>
                    </div>
                </div>
            </div>

            <div className="header__center">
                <h1 className="header__title">{title || 'Dashboard'}</h1>
                {subtitle && <p className="header__subtitle">{subtitle}</p>}
            </div>

            <div className="header__right">
                <span className="header__date">{formattedDate}</span>

                {/* Búsqueda */}
                <div className="header__search">
                    <Search size={18} />
                    <input
                        type="text"
                        placeholder="Buscar..."
                        className="header__search-input"
                    />
                </div>

                {/* Notificaciones */}
                <button className="header__notification">
                    <Bell size={20} />
                    <span className="header__notification-badge">2</span>
                </button>
            </div>
        </header>
    )
}

export default Header
