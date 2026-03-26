import React, { useCallback, useEffect, useState } from 'react';
import { Tabs, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getCurrentUserAccessContext } from '@/services/accessControl';

export default function TabsLayout() {
    const insets = useSafeAreaInsets();
    const { colors } = useTheme();
    const [isAdmin, setIsAdmin] = useState(false);

    const refreshAccessContext = useCallback(async () => {
        const access = await getCurrentUserAccessContext();
        if (!access) {
            setIsAdmin(false);
            return;
        }

        setIsAdmin(Boolean(access.isAdmin));
    }, []);

    useEffect(() => {
        refreshAccessContext();
    }, [refreshAccessContext]);

    useFocusEffect(
        useCallback(() => {
            refreshAccessContext();
        }, [refreshAccessContext])
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
    });
