import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { UserTabsParamList } from '../../navigation/UserTabs';

type NavigationProp = BottomTabNavigationProp<UserTabsParamList, 'Home'>;

export default function HomeScreen() {
    const { user } = useAuth();
    const navigation = useNavigation<NavigationProp>();

    const quickActions = [
        { title: 'Avisos', icon: '📢', route: 'Comunicados' as const },
        { title: 'S.O.S', icon: '🆘', route: 'Emergencias' as const },
        { title: 'Agenda', icon: '📅', route: 'Agenda' as const },
        { title: 'Más', icon: '•••', route: 'Mas' as const },
    ];

    return (
        <ScrollView className="flex-1 bg-surface-50 p-4">
            <View className="mb-6 bg-primary-800 p-6 rounded-3xl shadow-md">
                <Text className="text-white text-xl opacity-90">Hola,</Text>
                <Text className="text-white text-3xl font-bold">{user?.user_metadata?.full_name || 'Vecino'} 👋</Text>
            </View>

            <Text className="text-2xl font-bold text-slate-800 mb-4 px-2">Accesos Rápidos</Text>

            <View className="flex-row flex-wrap justify-between">
                {quickActions.map((action, index) => (
                    <TouchableOpacity
                        key={index}
                        className="w-[48%] bg-white p-6 rounded-2xl items-center mb-4 shadow-sm border border-slate-100 active:bg-slate-50"
                        onPress={() => navigation.navigate(action.route)}
                        accessibilityRole="button"
                        accessibilityLabel={`Ir a ${action.title}`}
                    >
                        <Text className="text-4xl mb-3">{action.icon}</Text>
                        <Text className="text-lg font-bold text-primary-900">{action.title}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <View className="mt-4 bg-accent-50 p-5 rounded-2xl border border-accent-100 mb-8">
                <Text className="text-xl font-bold text-accent-600 mb-2">📢 Último Aviso Importante</Text>
                <Text className="text-lg text-slate-700">Reunión de asamblea este viernes a las 19:00 hrs en la sede.</Text>
                <TouchableOpacity
                    className="mt-3 bg-accent-500 py-2 px-4 rounded-xl self-start"
                    onPress={() => navigation.navigate('Comunicados')}
                >
                    <Text className="text-white font-bold">Ver todos</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
}
