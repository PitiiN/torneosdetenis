import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import HomeScreen from '../screens/user/HomeScreen';
import AnnouncementsScreen from '../screens/user/AnnouncementsScreen';
import EmergencyScreen from '../screens/user/EmergencyScreen';
import EventsScreen from '../screens/user/EventsScreen';
import MoreScreen from '../screens/user/MoreScreen';

const Tab = createBottomTabNavigator();

export default function UserTabs() {
    return (
        <Tab.Navigator
            screenOptions={{
                headerShown: false,
                tabBarStyle: { backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E2E8F0', height: 80, paddingBottom: 24, paddingTop: 8 },
                tabBarActiveTintColor: '#2563EB',
                tabBarInactiveTintColor: '#94A3B8',
                tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
            }}
        >
            <Tab.Screen name="Inicio" component={HomeScreen} options={{ tabBarIcon: ({ color }) => <Text style={{ fontSize: 22 }}>🏠</Text> }} />
            <Tab.Screen name="Avisos" component={AnnouncementsScreen} options={{ tabBarIcon: ({ color }) => <Text style={{ fontSize: 22 }}>📢</Text> }} />
            <Tab.Screen name="S.O.S" component={EmergencyScreen} options={{ tabBarIcon: ({ color }) => <Text style={{ fontSize: 22 }}>🆘</Text> }} />
            <Tab.Screen name="Agenda" component={EventsScreen} options={{ tabBarIcon: ({ color }) => <Text style={{ fontSize: 22 }}>📅</Text> }} />
            <Tab.Screen name="Más" component={MoreScreen} options={{ tabBarIcon: ({ color }) => <Text style={{ fontSize: 22 }}>⚙️</Text> }} />
        </Tab.Navigator>
    );
}
