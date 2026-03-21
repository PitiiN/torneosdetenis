import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useAuth } from '../../context/AuthContext';

export default function AdminMoreScreen() {
    const { signOut } = useAuth();

    const menuItems = [
        { title: 'Gestión de Cuotas', icon: '💸' },
        { title: 'Aprobaciones Financieras', icon: '📝' },
        { title: 'Biblioteca de Documentos', icon: '📁' },
        { title: 'Puntos de Interés (Mapa)', icon: '🗺️' },
        { title: 'Auditoría (Logs)', icon: '🕵️' },
        { title: 'Configuración JJVV', icon: '⚙️' },
    ];

    return (
        <ScrollView className="flex-1 bg-surface-50 p-4">
            <Text className="text-slate-500 font-medium mb-4 px-2">HERRAMIENTAS ADMINISTRATIVAS</Text>
            <View className="gap-3 mb-8">
                {menuItems.map((item, index) => (
                    <TouchableOpacity
                        key={index}
                        className="bg-white p-5 rounded-xl border border-slate-100 flex-row items-center shadow-sm"
                    >
                        <Text className="text-2xl w-10 text-center mr-2">{item.icon}</Text>
                        <Text className="text-lg font-semibold text-slate-700 flex-1">{item.title}</Text>
                        <Text className="text-slate-300 text-xl">›</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <Text className="text-slate-500 font-medium mb-4 px-2">MI CUENTA</Text>
            <TouchableOpacity
                className="bg-red-50 border border-red-200 p-5 rounded-xl items-center flex-row justify-center mb-10 shadow-sm"
                onPress={signOut}
            >
                <Text className="text-xl mr-2">🚪</Text>
                <Text className="text-red-600 font-bold text-lg">Cerrar Sesión Segura</Text>
            </TouchableOpacity>
        </ScrollView>
    );
}
