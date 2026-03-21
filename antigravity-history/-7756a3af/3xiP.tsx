import { useEffect, useState, useCallback } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { ThemeProvider, DarkTheme } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/store/auth.store';
import { colors } from '@/theme';
import { CustomAlert } from '@/components/CustomAlert';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync().catch(() => { });

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 5 * 60 * 1000,
            retry: 2,
        },
    },
});

const NavigationTheme = {
    ...DarkTheme,
    colors: {
        ...DarkTheme.colors,
        background: colors.background,
        card: colors.surface,
        text: colors.text,
        border: colors.border,
        notification: colors.primary[500],
    },
};

function AuthGate() {
    const router = useRouter();
    const segments = useSegments();
    const { session, isLoading, setSession, setProfile, setLoading } = useAuthStore();
    const [initializing, setInitializing] = useState(true);

    useEffect(() => {
        const initAuth = async () => {
            try {
                const { data: { session }, error } = await supabase.auth.getSession();
                if (error) throw error;

                setSession(session);
                if (session) {
                    const { data, error: profileError } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', session.user.id)
                        .single();
                    if (profileError) throw profileError;
                    if (data) setProfile(data);
                }
            } catch (error) {
                console.error('Auth initialization error:', error);
            } finally {
                setInitializing(false);
                setLoading(false);
            }
        };

        // Safety timeout to prevent infinite spinner
        const timeout = setTimeout(() => {
            setInitializing(false);
            setLoading(false);
        }, 6000);

        initAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (_event, session) => {
                setSession(session);
                if (session) {
                    try {
                        const { data } = await supabase
                            .from('profiles')
                            .select('*')
                            .eq('id', session.user.id)
                            .single();
                        if (data) setProfile(data);
                    } catch (e) {
                        console.error('Error fetching profile on state change:', e);
                    }
                } else {
                    setProfile(null);
                }
            }
        );

        return () => {
            clearTimeout(timeout);
            subscription.unsubscribe();
        };
    }, []);

    useEffect(() => {
        if (initializing) return;

        const inAuthGroup = segments[0] === '(auth)';
        const isRoot = segments.length === 0 || (segments[0] as string) === '';

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

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
        </View>
    );
}

export default function RootLayout() {
    const [appIsReady, setAppIsReady] = useState(false);

    useEffect(() => {
        async function prepare() {
            try {
                // Load fonts and icons
                await Font.loadAsync({
                    ...Ionicons.font,
                });
            } catch (e) {
                console.warn(e);
            } finally {
                setAppIsReady(true);
            }
        }

        prepare();
    }, []);

    const onLayoutRootView = useCallback(async () => {
        if (appIsReady) {
            await SplashScreen.hideAsync();
        }
    }, [appIsReady]);

    if (!appIsReady) {
        return null;
    }

    return (
        <QueryClientProvider client={queryClient}>
            <ThemeProvider value={NavigationTheme}>
                <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
                    <StatusBar style="light" />
                    <AuthGate />
                    <CustomAlert />
                </View>
            </ThemeProvider>
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
