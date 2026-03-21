import { create } from 'zustand'

/**
 * Store de autenticación
 * Maneja el estado del usuario actual y operaciones de auth
 */

// Datos mock de usuario para desarrollo
const MOCK_USERS = [
    {
        id: '1',
        email: 'lucas.bennett@gmail.com',
        name: 'Lucas Bennett',
        avatar: null,
        role: 'employee',
        department: 'Desarrollo',
        createdAt: new Date('2024-01-15')
    }
]

export const useAuthStore = create((set, get) => ({
    // Estado
    user: null,
    isLoading: false,
    error: null,

    // Acciones

    /**
     * Iniciar sesión con email y contraseña
     * @param {string} email
     * @param {string} password
     */
    login: async (email, password) => {
        set({ isLoading: true, error: null })

        // Simular delay de red
        await new Promise(resolve => setTimeout(resolve, 800))

        // Validación mock - en producción esto iría a Supabase
        if (password.length < 8) {
            set({ isLoading: false, error: 'La contraseña debe tener al menos 8 caracteres' })
            return { success: false }
        }

        // Buscar usuario mock o crear uno nuevo
        const user = MOCK_USERS.find(u => u.email === email) || {
            id: crypto.randomUUID(),
            email,
            name: email.split('@')[0],
            avatar: null,
            role: 'employee',
            department: 'General',
            createdAt: new Date()
        }

        // Guardar en localStorage para persistencia
        localStorage.setItem('control_horario_user', JSON.stringify(user))

        set({ user, isLoading: false, error: null })
        return { success: true }
    },

    /**
     * Registrar nuevo usuario
     * @param {string} email
     * @param {string} password
     * @param {string} name
     */
    register: async (email, password, name) => {
        set({ isLoading: true, error: null })

        await new Promise(resolve => setTimeout(resolve, 800))

        if (password.length < 8) {
            set({ isLoading: false, error: 'La contraseña debe tener al menos 8 caracteres' })
            return { success: false }
        }

        const user = {
            id: crypto.randomUUID(),
            email,
            name,
            avatar: null,
            role: 'employee',
            department: 'General',
            createdAt: new Date()
        }

        localStorage.setItem('control_horario_user', JSON.stringify(user))

        set({ user, isLoading: false, error: null })
        return { success: true }
    },

    /**
     * Cerrar sesión
     */
    logout: async () => {
        localStorage.removeItem('control_horario_user')
        localStorage.removeItem('control_horario_entries')
        set({ user: null, error: null })
    },

    /**
     * Verificar sesión existente al cargar la app
     */
    checkSession: async () => {
        set({ isLoading: true })

        const storedUser = localStorage.getItem('control_horario_user')

        if (storedUser) {
            try {
                const user = JSON.parse(storedUser)
                set({ user, isLoading: false })
            } catch {
                localStorage.removeItem('control_horario_user')
                set({ user: null, isLoading: false })
            }
        } else {
            set({ user: null, isLoading: false })
        }
    },

    /**
     * Limpiar errores
     */
    clearError: () => set({ error: null })
}))
