import React from 'react';
import { Tabs } from 'expo-router';
import { LayoutDashboard, Search, CalendarDays, User } from 'lucide-react-native';

export default function TabLayout() {
    return (
        <Tabs screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: '#10b981',
            tabBarInactiveTintColor: '#9ca3af',
            tabBarStyle: {
                borderTopWidth: 1,
                borderTopColor: '#f3f4f6',
                height: 60,
                paddingBottom: 10,
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
