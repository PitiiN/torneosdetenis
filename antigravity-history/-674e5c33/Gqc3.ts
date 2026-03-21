import { supabase } from './supabase';

export const authService = {
    signIn: (email: string, password: string) =>
        supabase.auth.signInWithPassword({ email, password }),

    signUp: (email: string, password: string, fullName: string) =>
        supabase.auth.signUp({
            email,
            password,
            options: { data: { full_name: fullName } },
        }),

    signOut: () => supabase.auth.signOut(),

    resetPassword: (email: string) =>
        supabase.auth.resetPasswordForEmail(email),

    getSession: () => supabase.auth.getSession(),
};
