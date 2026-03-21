import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import HomeScreen from '../screens/user/HomeScreen';
import AnnouncementsScreen from '../screens/user/AnnouncementsScreen';
import EmergencyScreen from '../screens/user/EmergencyScreen';
import EventsScreen from '../screens/user/EventsScreen';
import MoreScreen from '../screens/user/MoreScreen';

const Tab = createBottomTabNavigator();

export default function UserTabs() {
    const insets = useSafeAreaInsets();

    return (
        <Tab.Navigator
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: '#FFFFFF',
                    borderTopWidth: 1,
                    borderTopColor: '#E2E8F0',
                    height: 56 + insets.bottom,
                    paddingBottom: insets.bottom,
                    paddingTop: 6,
                },
                tabBarActiveTintColor: '#2563EB',
                tabBarInactiveTintColor: '#94A3B8',
                tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
            }}
        >
            <Tab.Screen name="Inicio" component={HomeScreen} options={{ tabBarIcon: () => <Text style={{ fontSize: 22 }}>🏠</Text> }} />
            <Tab.Screen name="Avisos" component={AnnouncementsScreen} options={{ tabBarIcon: () => <Text style={{ fontSize: 22 }}>📢</Text> }} />
            <Tab.Screen name="S.O.S" component={EmergencyScreen} options={{ tabBarIcon: () => <Text style={{ fontSize: 22 }}>🆘</Text> }} />
            <Tab.Screen name="Agenda" component={EventsScreen} options={{ tabBarIcon: () => <Text style={{ fontSize: 22 }}>📅</Text> }} />
            <Tab.Screen name="Más" component={MoreScreen} options={{ tabBarIcon: () => <Text style={{ fontSize: 22 }}>⚙️</Text> }} />
        </Tab.Navigator>
    );
}
