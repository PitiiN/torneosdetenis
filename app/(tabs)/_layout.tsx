import React, { useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { BlurView } from 'expo-blur';
import { Platform, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/services/supabase';
import { adminModeService } from '@/services/adminMode';

const GLOBAL_ADMIN_EMAIL = 'javier.aravena25@gmail.com';

export default function TabsLayout() {
    const insets = useSafeAreaInsets();
    const { colors } = useTheme();
    const [role, setRole] = useState<string | null>(null);
    const [isGlobalAdmin, setIsGlobalAdmin] = useState(false);
    const [viewMode, setViewMode] = useState(adminModeService.getMode());

    useEffect(() => {
        const fetchProfile = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                const isGlobal = session.user.email === GLOBAL_ADMIN_EMAIL;
                setIsGlobalAdmin(isGlobal);
                
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', session.user.id)
                    .single();
                
                if (profile) setRole(profile.role);
            }
        };
        fetchProfile();

        const unsubscribe = adminModeService.subscribe((m) => {
            setViewMode(m);
        });
        return unsubscribe;
    }, []);

    const isAdmin = (role === 'admin' || isGlobalAdmin) && viewMode === 'admin';
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
                backgroundColor: colors.surface // Dynamic background
            }
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
            <Ionicons name={focused ? "home" : "home-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="tournaments"
        options={{
          title: 'Torneos',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "trophy" : "trophy-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="players"
        options={{
          title: 'Ranking',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "people" : "people-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="finance"
        options={{
          title: 'Finanzas',
          href: isAdmin ? '/finance' : null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "card" : "card-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="payments"
        options={{
          title: 'Pagos',
          href: !isAdmin ? '/payments' : null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "card" : "card-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Config',
          href: isAdmin ? '/settings' : null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "settings" : "settings-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "person" : "person-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="tournaments/[id]"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
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
