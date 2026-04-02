import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';
import { supabase } from '@/services/supabase';

type QuickActionKey = 'home' | 'tournaments' | 'ranking' | 'finance' | 'settings' | 'profile';

type QuickActionItem = {
  key: QuickActionKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconOutline: keyof typeof Ionicons.glyphMap;
};

const QUICK_ACTION_ITEMS: QuickActionItem[] = [
  { key: 'home', label: 'Inicio', icon: 'home', iconOutline: 'home-outline' },
  { key: 'tournaments', label: 'Torneos', icon: 'trophy', iconOutline: 'trophy-outline' },
  { key: 'ranking', label: 'Ranking', icon: 'people', iconOutline: 'people-outline' },
  { key: 'finance', label: 'Finanzas', icon: 'card', iconOutline: 'card-outline' },
  { key: 'settings', label: 'Config', icon: 'settings', iconOutline: 'settings-outline' },
  { key: 'profile', label: 'Perfil', icon: 'person', iconOutline: 'person-outline' },
];

const getRouteForAction = (key: QuickActionKey) => {
  if (key === 'home') return '/(tabs)';
  if (key === 'tournaments') return '/(tabs)/tournaments';
  if (key === 'ranking') return '/(tabs)/players';
  if (key === 'finance') return '/(tabs)/finance';
  if (key === 'settings') return '/(tabs)/settings';
  return '/(tabs)/profile';
};

export function AdminQuickActionsBar({
  active,
  organizationId,
}: {
  active: QuickActionKey;
  organizationId?: string | null;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const [pendingFinanceCount, setPendingFinanceCount] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const loadPendingFinanceCount = async () => {
      if (!organizationId) {
        if (isMounted) setPendingFinanceCount(0);
        return;
      }

      try {
        const { data: tournamentRows, error: tournamentError } = await supabase
          .from('tournaments')
          .select('id')
          .eq('organization_id', organizationId)
          .eq('is_tournament_master', false);

        if (tournamentError) throw tournamentError;

        const tournamentIds = (tournamentRows || [])
          .map((row: any) => String(row?.id || ''))
          .filter(Boolean);

        if (tournamentIds.length === 0) {
          if (isMounted) setPendingFinanceCount(0);
          return;
        }

        const { count, error: requestError } = await supabase
          .from('tournament_registration_requests')
          .select('id', { head: true, count: 'exact' })
          .eq('status', 'pending')
          .in('tournament_id', tournamentIds);

        if (requestError) throw requestError;
        if (isMounted) setPendingFinanceCount(Number(count || 0));
      } catch {
        if (isMounted) setPendingFinanceCount(0);
      }
    };

    loadPendingFinanceCount();
    const refreshInterval = setInterval(loadPendingFinanceCount, 45_000);

    return () => {
      isMounted = false;
      clearInterval(refreshInterval);
    };
  }, [organizationId]);

  const handlePress = (key: QuickActionKey) => {
    if (key === 'tournaments') {
      router.replace({
        pathname: '/(tabs)/tournaments',
        params: { orgId: organizationId || '' },
      } as any);
      return;
    }

    router.replace(getRouteForAction(key) as any);
  };

  return (
    <View
      style={[
        styles.container,
        {
          height: 65 + insets.bottom,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 10,
        },
      ]}
    >
      {QUICK_ACTION_ITEMS.map((item) => {
        const isActive = active === item.key;
        return (
          <TouchableOpacity
            key={item.key}
            style={styles.actionButton}
            onPress={() => handlePress(item.key)}
            activeOpacity={0.85}
          >
            <View style={styles.iconWrap}>
              <Ionicons
                name={isActive ? item.icon : item.iconOutline}
                size={22}
                color={isActive ? colors.primary[500] : colors.textTertiary}
              />
              {item.key === 'finance' && pendingFinanceCount > 0 && (
                <View style={styles.pendingBadge}>
                  <Text style={styles.pendingBadgeText}>
                    {pendingFinanceCount > 99 ? '99+' : pendingFinanceCount}
                  </Text>
                </View>
              )}
            </View>
            <Text style={[styles.actionLabel, { color: isActive ? colors.primary[500] : colors.textTertiary }]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-around',
      paddingTop: 4,
      paddingHorizontal: 4,
    },
    actionButton: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
    },
    iconWrap: {
      position: 'relative',
      width: 26,
      height: 26,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionLabel: {
      fontSize: 9,
      fontWeight: '700',
    },
    pendingBadge: {
      position: 'absolute',
      top: -5,
      right: -11,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      paddingHorizontal: 3,
      backgroundColor: '#EF4444',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: '#fff',
    },
    pendingBadgeText: {
      color: '#fff',
      fontSize: 9,
      fontWeight: '800',
      lineHeight: 11,
    },
  });
