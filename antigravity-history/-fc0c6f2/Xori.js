import { create } from 'zustand'
import { supabase } from '../lib/supabaseClient'

/**
 * Store de autenticación
 * Maneja el estado del usuario actual y operaciones de auth
 */

export const useAuthStore = create((set, get) => ({
    // Estado
    user: null,
    isLoading: true, // Empezar cargando para verificar sesión
    error: null,

    // Acciones

    /**
     * Iniciar sesión con email y contraseña
     * @param {string} email
     * @param {string} password
     */
    login: async (email, password) => {
        set({ isLoading: true, error: null })

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            })

            if (error) throw error

            // El usuario se actualizará mediante onAuthStateChange
            return { success: true }
        } catch (error) {
            set({ isLoading: false, error: error.message })
            return { success: false, error: error.message }
        }
    },

    /**
     * Registrar nuevo usuario
     * @param {string} email
     * @param {string} password
     * @param {string} name
     */
    register: async (email, password, name) => {
        set({ isLoading: true, error: null })

        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        name,
                        full_name: name, // Supabase standard
                    }
                }
            })

            if (error) throw error

            return { success: true }
        } catch (error) {
            set({ isLoading: false, error: error.message })
            return { success: false, error: error.message }
        }
    },

    /**
     * Cerrar sesión
     */
    logout: async () => {
        set({ isLoading: true })
        try {
            const { error } = await supabase.auth.signOut()
            if (error) throw error
            // El estado se limpiará en onAuthStateChange
        } catch (error) {
            set({ error: error.message, isLoading: false })
        }
    },

    /**
     * Verificar sesión existente al cargar la app
     * Configura el listener de cambios de estado
     */
    checkSession: async () => {
        set({ isLoading: true })

        // Obtener sesión actual
        const { data: { session } } = await supabase.auth.getSession()

        if (session?.user) {
            // Obtener perfil adicional si es necesario
            const { data: profile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .single()

            const user = {
                ...session.user,
                // Combinar metadatos de auth y perfil público
                name: profile?.full_name || session.user.user_metadata?.name || session.user.email.split('@')[0],
                role: profile?.role || 'employee',
                department: profile?.department || 'General',
                avatar: profile?.avatar_url
            }
            set({ user, isLoading: false })
        } else {
            set({ user: null, isLoading: false })
        }

        // Suscribirse a cambios
        supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                if (session?.user) {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', session.user.id)
                        .single()

                    const user = {
                        ...session.user,
                        name: profile?.full_name || session.user.user_metadata?.name || session.user.email.split('@')[0],
                        role: profile?.role || 'employee',
                        department: profile?.department || 'General',
                        avatar: profile?.avatar_url
                    }
                    set({ user, isLoading: false, error: null })
                }
            } else if (event === 'SIGNED_OUT') {
                set({ user: null, isLoading: false, error: null })
                // Limpiar otros stores si es necesario
                localStorage.removeItem('control_horario_user') // Limpieza legado
            }
        })
    },

    /**
     * Limpiar errores
     */
    clearError: () => set({ error: null })
}))
