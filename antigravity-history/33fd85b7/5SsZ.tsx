import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useAuth } from '../../context/AuthContext';

export default function DashboardScreen() {
    const { user, role } = useAuth();

    const stats = [
        { label: 'Socios Activos', value: '142' },
        { label: 'Tickets Pendientes', value: '5' },
        { label: 'Cuotas Mes', value: '78%' },
        { label: 'Alertas Vecinales', value: '0' },
    ];

    return (
        <ScrollView className="flex-1 bg-surface-50 p-4">
            <View className="mb-6 bg-primary-800 p-6 rounded-3xl shadow-md border-t-4 border-yellow-400">
                <Text className="text-yellow-400 font-bold mb-1 tracking-wider text-xs uppercase">Panel Directiva: {role}</Text>
                <Text className="text-white text-3xl font-bold">{user?.user_metadata?.full_name}</Text>
            </View>

            <Text className="text-xl font-bold text-slate-800 mb-4 px-2">Resumen JJVV</Text>

            <View className="flex-row flex-wrap justify-between mb-8">
                {stats.map((stat, index) => (
                    <View key={index} className="w-[48%] bg-white p-5 rounded-2xl mb-4 shadow-sm border border-slate-100">
                        <Text className="text-3xl font-bold text-primary-600 mb-1">{stat.value}</Text>
                        <Text className="text-slate-500 font-medium">{stat.label}</Text>
                    </View>
                ))}
            </View>

            <View className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 mb-8">
                <Text className="text-lg font-bold text-slate-800 mb-3">Acciones Rápidas Directiva</Text>

                <TouchableOpacity className="py-3 border-b border-slate-100 flex-row justify-between items-center">
                    <Text className="text-primary-700 font-medium text-base">Crear Comunicado</Text>
                    <Text className="text-primary-300">›</Text>
                </TouchableOpacity>

                <TouchableOpacity className="py-3 border-b border-slate-100 flex-row justify-between items-center">
                    <Text className="text-primary-700 font-medium text-base">Aprobar Gastos (Presidente)</Text>
                    <Text className="text-primary-300">›</Text>
                </TouchableOpacity>

                <TouchableOpacity className="py-3 flex-row justify-between items-center">
                    <Text className="text-primary-700 font-medium text-base">Registrar Pago (Tesorero)</Text>
                    <Text className="text-primary-300">›</Text>
                </TouchableOpacity>
            </View>

        </ScrollView>
    );
}
