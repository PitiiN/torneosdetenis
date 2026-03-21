import React from 'react';
import { Tabs } from 'expo-router';
import { LayoutDashboard, Search, CalendarDays, User, ShieldCheck } from 'lucide-react-native';
import { useAuth } from '../../src/contexts/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
    const { role } = useAuth();
    const insets = useSafeAreaInsets();

    return (
        <Tabs screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: '#10b981',
            tabBarInactiveTintColor: '#9ca3af',
            tabBarStyle: {
                borderTopWidth: 1,
                borderTopColor: '#f3f4f6',
                height: 60 + insets.bottom,
                paddingBottom: insets.bottom > 0 ? insets.bottom : 10,
            }
        }}>
            <Tabs.Screen
                name="dashboard"
                options={{
                    title: 'Inicio',
                    tabBarIcon: ({ color, size }) => <LayoutDashboard color={color} size={size} />,
                }}
            />
            <Tabs.Screen
                name="search"
                options={{
                    title: 'Reservar',
                    tabBarIcon: ({ color, size }) => <Search color={color} size={size} />,
                }}
            />
            {role === 'ADMIN' && (
                <Tabs.Screen
                    name="admin"
                    options={{
                        title: 'Admin',
                        tabBarIcon: ({ color, size }) => <ShieldCheck color={color} size={size} />,
                    }}
                />
            )}
            <Tabs.Screen
                name="bookings"
                options={{
                    title: 'Mis Reservas',
                    tabBarIcon: ({ color, size }) => <CalendarDays color={color} size={size} />,
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: 'Perfil',
                    tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
                }}
            />
        </Tabs>
    );
}
