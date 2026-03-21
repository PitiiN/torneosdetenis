import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { COLORS } from '../lib/constants';

// Temporary dummy screens until we build them
import HomeScreen from '../screens/user/HomeScreen';
import AnnouncementsScreen from '../screens/user/AnnouncementsScreen';
import EmergencyScreen from '../screens/user/EmergencyScreen';
import EventsScreen from '../screens/user/EventsScreen';
import MoreScreen from '../screens/user/MoreScreen';

export type UserTabsParamList = {
    Home: undefined;
    Comunicados: undefined;
    Emergencias: undefined;
    Agenda: undefined;
    Mas: undefined;
};

const Tab = createBottomTabNavigator<UserTabsParamList>();

// We will use standard icons or text initially, Expo comes with Ionicons usually (via @expo/vector-icons)
// but for blank template we might need to add it or just use basic styling first.

export default function UserTabs() {
    return (
        <Tab.Navigator
            screenOptions={{
                tabBarActiveTintColor: COLORS.secondary,
                tabBarInactiveTintColor: COLORS.textSecondary,
                headerStyle: {
                    backgroundColor: COLORS.primary,
                },
                headerTintColor: '#fff',
                headerTitleStyle: {
                    fontWeight: 'bold',
                },
                tabBarStyle: {
                    paddingBottom: 5,
                    paddingTop: 5,
                    height: 60,
                }
            }}
        >
            <Tab.Screen
                name="Home"
                component={HomeScreen}
                options={{ title: 'Inicio' }}
            />
            <Tab.Screen
                name="Comunicados"
                component={AnnouncementsScreen}
                options={{ title: 'Avisos' }}
            />
            <Tab.Screen
                name="Emergencias"
                component={EmergencyScreen}
                options={{ title: 'S.O.S', tabBarLabel: 'Emergencia' }}
            />
            <Tab.Screen
                name="Agenda"
                component={EventsScreen}
                options={{ title: 'Agenda' }}
            />
            <Tab.Screen
                name="Mas"
                component={MoreScreen}
                options={{ title: 'Más Opciones', tabBarLabel: 'Más' }}
            />
        </Tab.Navigator>
    );
}
