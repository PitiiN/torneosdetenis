import { useEffect, useState } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/store/auth.store';
import { colors } from '@/theme';
import { CustomAlert } from '@/components/CustomAlert';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 5 * 60 * 1000,
            retry: 2,
        },
    },
});

function AuthGate() {
    const router = useRouter();
    const segments = useSegments();
    const { session, isLoading, setSession, setProfile } = useAuthStore();
    const [initializing, setInitializing] = useState(true);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            if (session) {
                supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', session.user.id)
                    .single()
                    .then(({ data }) => {
                        if (data) setProfile(data);
                        setInitializing(false);
                    });
            } else {
                setInitializing(false);
            }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (_event, session) => {
                setSession(session);
                if (session) {
                    const { data } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', session.user.id)
                        .single();
                    if (data) setProfile(data);
                } else {
                    setProfile(null);
                }
            }
        );

        return () => subscription.unsubscribe();
    }, []);

    useEffect(() => {
        if (initializing) return;

        const inAuthGroup = segments[0] === '(auth)';
        const isRoot = segments.length === 0;

        if (!session && !inAuthGroup && !isRoot) {
            router.replace('/(auth)/login');
        } else if (session && inAuthGroup) {
            router.replace('/selection');
        }
    }, [session, segments, initializing]);

    if (initializing) {
        return (
            <View style={styles.loading}>
                <ActivityIndicator size="large" color={colors.primary[500]} />
            </View>
        );
    }

    return <Slot />;
}

export default function RootLayout() {
    return (
        <QueryClientProvider client={queryClient}>
            <StatusBar style="light" />
            <AuthGate />
            <CustomAlert />
        </QueryClientProvider>
    );
}

const styles = StyleSheet.create({
    loading: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.background,
    },
});
