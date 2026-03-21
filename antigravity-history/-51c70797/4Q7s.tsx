import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import DashboardScreen from '../screens/admin/DashboardScreen';
import ManageAnnouncementsScreen from '../screens/admin/ManageAnnouncementsScreen';
import ManageTicketsScreen from '../screens/admin/ManageTicketsScreen';
import ManageMembersScreen from '../screens/admin/ManageMembersScreen';
import AdminMoreScreen from '../screens/admin/AdminMoreScreen';

const Tab = createBottomTabNavigator();

export default function AdminTabs() {
    return (
        <Tab.Navigator
            screenOptions={{
                headerShown: false,
                tabBarStyle: { backgroundColor: '#1E293B', borderTopWidth: 0, height: 80, paddingBottom: 24, paddingTop: 8 },
                tabBarActiveTintColor: '#38BDF8',
                tabBarInactiveTintColor: '#64748B',
                tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
            }}
        >
            <Tab.Screen name="Panel" component={DashboardScreen} options={{ tabBarIcon: () => <Text style={{ fontSize: 22 }}>📊</Text> }} />
            <Tab.Screen name="Avisos" component={ManageAnnouncementsScreen} options={{ tabBarIcon: () => <Text style={{ fontSize: 22 }}>📢</Text> }} />
            <Tab.Screen name="Tickets" component={ManageTicketsScreen} options={{ tabBarIcon: () => <Text style={{ fontSize: 22 }}>🎫</Text> }} />
            <Tab.Screen name="Socios" component={ManageMembersScreen} options={{ tabBarIcon: () => <Text style={{ fontSize: 22 }}>👥</Text> }} />
            <Tab.Screen name="Admin" component={AdminMoreScreen} options={{ tabBarIcon: () => <Text style={{ fontSize: 22 }}>⚙️</Text> }} />
        </Tab.Navigator>
    );
}
