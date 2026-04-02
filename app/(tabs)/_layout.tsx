import React, { useCallback, useEffect, useState } from 'react';
import { Tabs, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getCurrentUserAccessContext } from '@/services/accessControl';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '@/services/supabase';

export default function TabsLayout() {
    const insets = useSafeAreaInsets();
    const { colors } = useTheme();
    const [isAdmin, setIsAdmin] = useState(false);
    const [adminOrganizationId, setAdminOrganizationId] = useState<string | null>(null);
    const [pendingFinanceCount, setPendingFinanceCount] = useState(0);

    const refreshAccessContext = useCallback(async () => {
        const access = await getCurrentUserAccessContext();
        if (!access) {
            setIsAdmin(false);
            setAdminOrganizationId(null);
            setPendingFinanceCount(0);
            return;
        }

        setIsAdmin(Boolean(access.isAdmin));
        let resolvedOrgId: string | null = null;
        if (access.isSuperAdmin) {
            resolvedOrgId = await SecureStore.getItemAsync('selected_org_id');
        }
        if (!resolvedOrgId) {
            resolvedOrgId = access.profile.org_id || (await SecureStore.getItemAsync('selected_org_id'));
        }
        setAdminOrganizationId(resolvedOrgId);
    }, []);

    const refreshPendingFinanceCount = useCallback(async () => {
        if (!isAdmin || !adminOrganizationId) {
            setPendingFinanceCount(0);
            return;
        }

        try {
            const { data: tournamentRows, error: tournamentError } = await supabase
                .from('tournaments')
                .select('id')
                .eq('organization_id', adminOrganizationId)
                .eq('is_tournament_master', false);

            if (tournamentError) throw tournamentError;

            const tournamentIds = (tournamentRows || [])
                .map((row: any) => String(row?.id || ''))
                .filter(Boolean);

            if (tournamentIds.length === 0) {
                setPendingFinanceCount(0);
                return;
            }

            const { count, error: pendingError } = await supabase
                .from('tournament_registration_requests')
                .select('id', { head: true, count: 'exact' })
                .eq('status', 'pending')
                .in('tournament_id', tournamentIds);

            if (pendingError) throw pendingError;
            setPendingFinanceCount(Number(count || 0));
        } catch {
            setPendingFinanceCount(0);
        }
    }, [adminOrganizationId, isAdmin]);

    useEffect(() => {
        refreshAccessContext();
    }, [refreshAccessContext]);

    useEffect(() => {
        refreshPendingFinanceCount();
        if (!isAdmin) return;

        const interval = setInterval(() => {
            refreshPendingFinanceCount();
        }, 45_000);

        return () => clearInterval(interval);
    }, [isAdmin, refreshPendingFinanceCount]);

    useFocusEffect(
        useCallback(() => {
            refreshAccessContext();
            refreshPendingFinanceCount();
        }, [refreshAccessContext, refreshPendingFinanceCount])
    );

    const styles = getStyles(colors);

    return (
        <Tabs
            backBehavior="history"
            screenOptions={{
                headerShown: false,
                tabBarStyle: [
                    styles.tabBar,
                    {
                        height: 65 + insets.bottom,
                        paddingBottom: insets.bottom > 0 ? insets.bottom : 10,
                        backgroundColor: colors.surface,
                    },
                ],
                tabBarActiveTintColor: colors.primary[500],
                tabBarInactiveTintColor: colors.textTertiary,
                tabBarLabelStyle: styles.tabBarLabel,
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Inicio',
                    tabBarIcon: ({ color, focused }) => (
                        <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="tournaments"
                options={{
                    title: 'Torneos',
                    tabBarIcon: ({ color, focused }) => (
                        <Ionicons name={focused ? 'trophy' : 'trophy-outline'} size={22} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="players"
                options={{
                    title: 'Ranking',
                    tabBarIcon: ({ color, focused }) => (
                        <Ionicons name={focused ? 'people' : 'people-outline'} size={22} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="finance"
                options={{
                    title: 'Finanzas',
                    href: isAdmin ? '/finance' : null,
                    tabBarBadge:
                        isAdmin && pendingFinanceCount > 0
                            ? pendingFinanceCount > 99
                                ? '99+'
                                : pendingFinanceCount
                            : undefined,
                    tabBarBadgeStyle: styles.tabBarBadge,
                    tabBarIcon: ({ color, focused }) => (
                        <Ionicons name={focused ? 'card' : 'card-outline'} size={22} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="payments"
                options={{
                    title: 'Pagos',
                    href: !isAdmin ? '/payments' : null,
                    tabBarIcon: ({ color, focused }) => (
                        <Ionicons name={focused ? 'card' : 'card-outline'} size={22} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="settings"
                options={{
                    title: 'Config',
                    href: isAdmin ? '/settings' : null,
                    tabBarIcon: ({ color, focused }) => (
                        <Ionicons name={focused ? 'settings' : 'settings-outline'} size={22} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: 'Perfil',
                    tabBarIcon: ({ color, focused }) => (
                        <Ionicons name={focused ? 'person' : 'person-outline'} size={22} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="tournaments/[id]"
                options={{
                    href: null,
                }}
            />
            <Tabs.Screen
                name="tournaments/master/[id]"
                options={{
                    href: null,
                }}
            />
        </Tabs>
    );
}

const getStyles = (colors: any) =>
    StyleSheet.create({
        tabBar: {
            borderTopWidth: 1,
            borderTopColor: colors.border,
            elevation: 8,
            backgroundColor: colors.surface,
            paddingTop: 4,
        },
        tabBarLabel: {
            fontSize: 9,
            fontWeight: '700',
            marginTop: -4,
            color: colors.textTertiary,
        },
        tabBarBadge: {
            backgroundColor: '#EF4444',
            color: '#fff',
            fontSize: 10,
            fontWeight: '800',
        },
    });
