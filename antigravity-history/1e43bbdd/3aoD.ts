import { useAuthStore, Profile } from '@/store/auth.store';

export const useAuth = () => {
    const { session, profile, isLoading } = useAuthStore();

    return {
        user: session?.user ?? null,
        session,
        profile,
        isLoading,
        isAdmin: profile?.role === 'admin',
        isCoach: profile?.role === 'coach',
        isStudent: profile?.role === 'student',
        isAuthenticated: !!session,
    };
};
