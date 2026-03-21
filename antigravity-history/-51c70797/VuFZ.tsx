import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { COLORS } from '../lib/constants';

// Temporary dummy screens
import DashboardScreen from '../screens/admin/DashboardScreen';
import ManageAnnouncementsScreen from '../screens/admin/ManageAnnouncementsScreen';
import ManageTicketsScreen from '../screens/admin/ManageTicketsScreen';
import ManageMembersScreen from '../screens/admin/ManageMembersScreen';
import AdminMoreScreen from '../screens/admin/AdminMoreScreen';

export type AdminTabsParamList = {
    Dashboard: undefined;
    ComunicadosAdmin: undefined;
    TicketsAdmin: undefined;
    SociosAdmin: undefined;
    AdminMas: undefined;
};

const Tab = createBottomTabNavigator<AdminTabsParamList>();

export default function AdminTabs() {
    return (
        <Tab.Navigator
            screenOptions={{
                tabBarActiveTintColor: COLORS.primary, // Darker blue for admin to differentiate visually subtly
                tabBarInactiveTintColor: COLORS.textSecondary,
                headerStyle: {
                    backgroundColor: COLORS.primary,
                },
                headerTintColor: '#fff',
                tabBarStyle: {
                    paddingBottom: 5,
                    paddingTop: 5,
                    height: 60,
                    borderTopWidth: 2,
                    borderTopColor: COLORS.primary, // Visual cue for admin mode
                }
            }}
        >
            <Tab.Screen
                name="Dashboard"
                component={DashboardScreen}
                options={{ title: 'Panel' }}
            />
            <Tab.Screen
                name="ComunicadosAdmin"
                component={ManageAnnouncementsScreen}
                options={{ title: 'Avisos G.', tabBarLabel: 'Avisos' }}
            />
            <Tab.Screen
                name="TicketsAdmin"
                component={ManageTicketsScreen}
                options={{ title: 'Solicitudes', tabBarLabel: 'Tickets' }}
            />
            <Tab.Screen
                name="SociosAdmin"
                component={ManageMembersScreen}
                options={{ title: 'Socios' }}
            />
            <Tab.Screen
                name="AdminMas"
                component={AdminMoreScreen}
                options={{ title: 'Administración', tabBarLabel: 'Más' }}
            />
        </Tab.Navigator>
    );
}
