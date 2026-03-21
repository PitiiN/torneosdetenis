import React, { createContext, useState, useEffect, useContext } from 'react';
import { supabase } from '../lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import { useRouter, useSegments } from 'expo-router';

type AuthContextType = {
    session: Session | null;
    user: User | null;
    role: 'USER' | 'ADMIN' | null;
    isLoading: boolean;
};

const AuthContext = createContext<AuthContextType>({
    session: null,
    user: null,
    role: null,
    isLoading: true,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [role, setRole] = useState<'USER' | 'ADMIN' | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const segments = useSegments();
    const router = useRouter();

    const fetchRole = async (userId: string) => {
        const { data, error } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', userId)
            .maybeSingle();

        if (data && !error) {
            setRole(data.role as 'USER' | 'ADMIN');
        } else {
            setRole('USER'); // Default to user if no role found
        }
    };

    useEffect(() => {
        // 1. Obtener la sesión actual al cargar
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchRole(session.user.id);
            } else {
                setRole(null);
                setIsLoading(false);
            }
        });

        // 2. Escuchar cambios en la autenticación (login, logout)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchRole(session.user.id);
            } else {
                setRole(null);
                setIsLoading(false);
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    // Effect to handle loading state when role is fetched
    useEffect(() => {
        if (session && role) {
            setIsLoading(false);
        } else if (!session) {
            setIsLoading(false);
        }
    }, [session, role]);

    // 3. Manejar la navegación de Expo Router según el estado de la sesión
    useEffect(() => {
        if (isLoading) return;

        const inAuthGroup = segments[0] === '(auth)';

        if (!session && !inAuthGroup) {
            // Redirigir a login si no hay sesión y tratan de entrar a rutas protegidas
            router.replace('/(auth)/login');
        } else if (session && inAuthGroup) {
            // Redirigir a la app principal si hay sesión y tratan de ir al login
            router.replace('/(tabs)/dashboard');
        }
    }, [session, isLoading, segments]);

    return (
        <AuthContext.Provider value={{ session, user, role, isLoading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
