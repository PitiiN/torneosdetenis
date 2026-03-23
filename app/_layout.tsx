import { useEffect, useState } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { clearSessionArtifacts, supabase, supabaseConfigError } from '@/services/supabase';
import { Session } from '@supabase/supabase-js';
import { Image, Text, View } from 'react-native';
import { ThemeProvider, darkTheme } from '@/theme';
import { TennisSpinner } from '@/components/TennisSpinner';

const MIN_BOOTSTRAP_LOADING_MS = 3000;

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    let isMounted = true;

    const bootstrapSession = async () => {
      if (supabaseConfigError) {
        if (!isMounted) return;
        setBootstrapError(supabaseConfigError);
        setInitialized(true);
        return;
      }

      const [{ data: { session } }] = await Promise.all([
        supabase.auth.getSession(),
        new Promise((resolve) => setTimeout(resolve, MIN_BOOTSTRAP_LOADING_MS)),
      ]);

      if (!isMounted) return;
      setSession(session);
      setInitialized(true);
    };

    bootstrapSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) {
        clearSessionArtifacts();
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!initialized) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      // Redirect to login if not authenticated and not in auth group
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      // Redirect to tabs if authenticated and in auth group
      router.replace('/(tabs)');
    }
  }, [session, initialized, segments]);

  if (!initialized) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
        <Image
          source={require('../assets/LogoSweetSpot.png')}
          style={{ width: 440, height: 176, marginBottom: 24 }}
          resizeMode="contain"
        />
        <TennisSpinner size={34} color={darkTheme.primary[500]} />
      </View>
    );
  }

  if (bootstrapError) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, backgroundColor: '#FFFFFF' }}>
        <Image
          source={require('../assets/LogoSweetSpot.png')}
          style={{ width: 320, height: 128, marginBottom: 20 }}
          resizeMode="contain"
        />
        <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 10, textAlign: 'center' }}>
          Configuracion incompleta
        </Text>
        <Text style={{ fontSize: 14, color: '#374151', textAlign: 'center' }}>
          {bootstrapError}
        </Text>
      </View>
    );
  }

  return (
    <ThemeProvider>
      <Slot />
    </ThemeProvider>
  );
}
