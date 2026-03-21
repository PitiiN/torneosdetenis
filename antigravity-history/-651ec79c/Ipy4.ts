import { create } from 'zustand';
import { Session } from '@supabase/supabase-js';

export interface Profile {
    id: string;
    email: string;
    full_name: string;
    phone?: string;
    avatar_url?: string;
    role: 'admin' | 'coach' | 'student';
    rut?: string;
    birth_date?: string;
    address?: string;
    emergency_contact_name?: string;
    emergency_contact_phone?: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

interface AuthState {
    session: Session | null;
    profile: Profile | null;
    isLoading: boolean;
    setSession: (session: Session | null) => void;
    setProfile: (profile: Profile | null) => void;
    setLoading: (loading: boolean) => void;
    reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    session: null,
    profile: null,
    isLoading: true,
    setSession: (session) => set({ session }),
    setProfile: (profile) => set({ profile }),
    setLoading: (isLoading) => set({ isLoading }),
    reset: () => set({ session: null, profile: null, isLoading: false }),
}));
