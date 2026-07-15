import '@/utils/alertPatch';
import { useEffect, useRef, useState } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { clearSessionArtifacts, supabase, supabaseConfigError } from '@/services/supabase';
import { Session } from '@supabase/supabase-js';
import { Image, Text, View } from 'react-native';
import { ThemeProvider, darkTheme } from '@/theme';
import { TennisSpinner } from '@/components/TennisSpinner';
import { notificationService } from '@/services/notificationService';
import { GlobalAlert } from '@/components/GlobalAlert';

const MIN_BOOTSTRAP_LOADING_MS = 3000;

const getNotificationRoute = (data?: Record<string, any>) => {
  const type = String(data?.type || '').trim();
  const tournamentId = String(data?.tournamentId || '').trim();
  const organizationId = String(data?.organizationId || '').trim();
  const level = String(data?.level || data?.category || '').trim();
  const modality = String(data?.modality || '').trim();

  if (type === 'achievement_unlocked' || data?.target === 'profile') {
    return '/(tabs)/profile';
  }

  if (type === 'registration_request' || data?.target === 'admin_finance') {
    if (tournamentId) {
      return { pathname: '/(admin)/finance/[id]', params: { id: tournamentId } } as const;
    }
    return '/(tabs)/finance';
  }

  if (
    type === 'registration_approved' ||
    type === 'registration_rejected' ||
    type === 'new_tournament_published' ||
    type === 'match_reminder_24h' ||
    type === 'match_schedule_updated' ||
    type === 'next_match_defined' ||
    type === 'tournament_finished'
  ) {
    if (tournamentId) {
      return { pathname: '/(tabs)/tournaments/[id]', params: { id: tournamentId } } as const;
    }
  }

  if (
    type === 'ranking_position_updated' ||
    type === 'ranking_category_updated' ||
    type === 'ranking_new_number_one'
  ) {
    return {
      pathname: '/(tabs)/players',
      params: {
        ...(organizationId ? { organizationId } : {}),
        ...(level ? { level } : {}),
        ...(modality ? { modality } : {}),
      },
    } as const;
  }

  return null;
};

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [pendingNotificationDestination, setPendingNotificationDestination] = useState<any | null>(null);
  const [initialRoute, setInitialRoute] = useState<string>('/(tabs)');
  const [bootRedirectDone, setBootRedirectDone] = useState(false);
  const router = useRouter();
  const segments = useSegments() as string[];
  const lastHandledNotificationIdRef = useRef<string | null>(null);

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

      let targetRoute = '/(tabs)';
      if (session?.user?.id) {
        try {
          const currentUserId = session.user.id;
          const { data: profile } = await supabase
            .from('profiles')
            .select('admin_org_ids')
            .eq('id', currentUserId)
            .maybeSingle();

          const isAdmin = profile && Array.isArray(profile.admin_org_ids) && profile.admin_org_ids.length > 0;
          if (!isAdmin) {
            const { count: pendingMatchesCount } = await supabase
              .from('matches')
              .select('id', { head: true, count: 'exact' })
              .or(`player_a_id.eq.${currentUserId},player_a2_id.eq.${currentUserId},player_b_id.eq.${currentUserId},player_b2_id.eq.${currentUserId}`)
              .neq('status', 'finished');

            if (pendingMatchesCount && pendingMatchesCount > 0) {
              targetRoute = '/(tabs)/calendar';
              (global as any).hasAutoRedirectedToCalendar = true;
            } else {
              const { data: regRows } = await supabase
                .from('registrations')
                .select('tournament_id')
                .eq('player_id', currentUserId)
                .eq('status', 'confirmed');

              if (regRows && regRows.length > 0) {
                const tournamentIds = [...new Set(regRows.map((r: any) => r.tournament_id).filter(Boolean))];
                if (tournamentIds.length > 0) {
                  const { data: tournamentsRows } = await supabase
                    .from('tournaments')
                    .select('id, status, end_date')
                    .in('id', tournamentIds);

                  if (tournamentsRows && tournamentsRows.length > 0) {
                    const now = new Date();
                    const hasActiveTournament = tournamentsRows.some((tour: any) => {
                      const statusLower = String(tour.status || '').toLowerCase();
                      if (['finished', 'completed', 'finalized', 'cancelled', 'draft', 'pending'].includes(statusLower)) {
                        return false;
                      }
                      if (tour.end_date) {
                        const endDateObj = new Date(`${tour.end_date}T23:59:59`);
                        if (now >= endDateObj) return false;
                      }
                      return true;
                    });

                    if (hasActiveTournament) {
                      targetRoute = '/(tabs)/calendar';
                      (global as any).hasAutoRedirectedToCalendar = true;
                    }
                  }
                }
              }
            }
          }
        } catch (e) {
          console.error('Error determining initial route:', e);
        }
      }

      setInitialRoute(targetRoute);
      setInitialized(true);
    };

    bootstrapSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) {
        clearSessionArtifacts();
        setBootRedirectDone(false);
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
    const inResetPassword = segments[1] === 'reset-password';
    const isAtLandingTab = segments.length === 0 || (segments[0] === '(tabs)' && (segments.length === 1 || segments[1] === 'index' || segments[1] === ''));

    if (!session && !inAuthGroup) {
      // Redirect to login if not authenticated and not in auth group
      router.replace('/(auth)/login');
    } else if (session && !bootRedirectDone && (inAuthGroup || isAtLandingTab) && !inResetPassword) {
      // Redirect to tabs or calendar immediately if authenticated and in auth or landing tab
      setBootRedirectDone(true);
      router.replace(initialRoute as any);
    }
  }, [session, initialized, segments, initialRoute, bootRedirectDone]);

  useEffect(() => {
    if (!initialized || !pendingNotificationDestination) return;
    if (!session) return;

    router.push(pendingNotificationDestination as any);
    setPendingNotificationDestination(null);
  }, [initialized, pendingNotificationDestination, router, session]);

  useEffect(() => {
    let isMounted = true;

    const syncPushTokenIfEnabled = async () => {
      const userId = session?.user?.id;
      if (!userId) return;

      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('notifications_enabled')
          .eq('id', userId)
          .maybeSingle();

        if (!isMounted) return;
        const notificationsEnabled = profile?.notifications_enabled !== false;
        if (notificationsEnabled) {
          await notificationService.registerForPushNotifications(userId);
        }
      } catch {
        // Silent fallback: notification sync should never block app boot.
      }
    };

    syncPushTokenIfEnabled();

    return () => {
      isMounted = false;
    };
  }, [session?.user?.id]);

  useEffect(() => {
    let isMounted = true;

    const handleNotificationNavigation = (notificationId: string | null, data?: Record<string, any>) => {
      if (notificationId && lastHandledNotificationIdRef.current === notificationId) return;
      const destination = getNotificationRoute(data);
      if (!destination) return;
      lastHandledNotificationIdRef.current = notificationId;

      if (!initialized || !session) {
        setPendingNotificationDestination(destination);
        return;
      }

      router.push(destination as any);
    };

    const syncLastNotificationResponse = async () => {
      const response = await notificationService.getLastNotificationResponse();
      if (!isMounted || !response) return;
      const notificationId = String(response.notification.request.identifier || '').trim() || null;
      const data = response.notification.request.content.data as Record<string, any> | undefined;
      handleNotificationNavigation(notificationId, data);
    };

    syncLastNotificationResponse();

    const unsubscribe = notificationService.addNotificationListeners(
      () => {},
      (response) => {
        const notificationId = String(response.notification.request.identifier || '').trim() || null;
        const data = response.notification.request.content.data as Record<string, any> | undefined;
        handleNotificationNavigation(notificationId, data);
      }
    );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [initialized, router, session]);

  if (!initialized) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
        <Image
          source={require('../assets/Logos/LogoAplicacion.png')}
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
          source={require('../assets/Logos/LogoAplicacion.png')}
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
      <GlobalAlert />
    </ThemeProvider>
  );
}
