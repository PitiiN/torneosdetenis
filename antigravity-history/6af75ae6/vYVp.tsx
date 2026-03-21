import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Role } from '../lib/constants';

type AuthContextType = {
    session: Session | null;
    user: User | null;
    role: Role | null;
    organizationId: string | null;
    isLoading: boolean;
    signOut: () => Promise<void>;
    refreshSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
    session: null,
    user: null,
    role: null,
    organizationId: null,
    isLoading: true,
    signOut: async () => { },
    refreshSession: async () => { },
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [role, setRole] = useState<Role | null>(null);
    const [organizationId, setOrganizationId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const fetchMembershipData = async (userId: string) => {
        try {
            // Get the user's active membership
            const { data, error } = await supabase
                .from('memberships')
                .select('role, organization_id')
                .eq('user_id', userId)
                .eq('is_active', true)
                .maybeSingle();

            if (error) {
                console.warn('No membership found:', error.message);
                setRole(null);
                setOrganizationId(null);
            } else if (data) {
                setRole(data.role as Role);
                setOrganizationId(data.organization_id);
            }
        } catch (err) {
            console.error('Unexpected error fetching membership:', err);
        }
    };

    const refreshSession = async () => {
        setIsLoading(true);
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        setSession(currentSession);
        setUser(currentSession?.user || null);

        if (currentSession?.user) {
            await fetchMembershipData(currentSession.user.id);
        } else {
            setRole(null);
            setOrganizationId(null);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        refreshSession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
            setSession(newSession);
            setUser(newSession?.user || null);

            if (newSession?.user) {
                await fetchMembershipData(newSession.user.id);
            } else {
                setRole(null);
                setOrganizationId(null);
            }
            setIsLoading(false);
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const signOut = async () => {
        await supabase.auth.signOut();
    };

    return (
        <AuthContext.Provider value={{ session, user, role, organizationId, isLoading, signOut, refreshSession }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
