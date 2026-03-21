import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DashboardScreen from '../screens/admin/DashboardScreen';
import ManageAnnouncementsScreen from '../screens/admin/ManageAnnouncementsScreen';
import AdminSolicitudesScreen from '../screens/admin/AdminSolicitudesScreen';
import AdminDocumentsScreen from '../screens/admin/AdminDocumentsScreen';
import AdminMoreStack from './AdminMoreStack';

const Tab = createBottomTabNavigator();

export default function AdminTabs() {
    const insets = useSafeAreaInsets();

    return (
        <Tab.Navigator
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: '#1E293B',
                    borderTopWidth: 0,
                    height: 56 + insets.bottom,
                    paddingBottom: insets.bottom,
                    paddingTop: 6,
                },
                tabBarActiveTintColor: '#38BDF8',
                tabBarInactiveTintColor: '#64748B',
                tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
            }}
        >
            <Tab.Screen name="Panel" component={DashboardScreen} options={{ tabBarIcon: () => <Text style={{ fontSize: 22 }}>📊</Text> }} />
            <Tab.Screen name="Avisos" component={ManageAnnouncementsScreen} options={{ tabBarIcon: () => <Text style={{ fontSize: 22 }}>📢</Text> }} />
            <Tab.Screen name="Solicitudes" component={AdminSolicitudesScreen} options={{ tabBarIcon: () => <Text style={{ fontSize: 22 }}>📝</Text> }} />
            <Tab.Screen name="Docs" component={AdminDocumentsScreen} options={{ tabBarIcon: () => <Text style={{ fontSize: 22 }}>📁</Text> }} />
            <Tab.Screen name="Admin" component={AdminMoreStack} options={{ tabBarIcon: () => <Text style={{ fontSize: 22 }}>⚙️</Text> }} />
        </Tab.Navigator>
    );
}
