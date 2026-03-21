import React from 'react';
import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme].tint,
        headerShown: useClientOnlyValue(false, true),
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E8F4FD',
          height: 70,
          paddingBottom: 16,
          paddingTop: 6,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Hub',
          headerTitle: 'F2 Sports Management',
          headerStyle: { backgroundColor: '#00A3E0' },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontWeight: '800' },
          tabBarIcon: () => (
            <Text style={{ fontSize: 22 }}>⚽</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="two"
        options={{
          title: 'Notificaciones',
          headerTitle: 'Notificaciones',
          headerStyle: { backgroundColor: '#00A3E0' },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontWeight: '800' },
          tabBarIcon: () => (
            <Text style={{ fontSize: 22 }}>🔔</Text>
          ),
        }}
      />
    </Tabs>
  );
}
