import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';

export default function AdminMoreScreen() {
    const { signOut } = useAuth();
    const items = [
        { title: 'Gestión de Cuotas', icon: '💸' },
        { title: 'Aprobaciones Financieras', icon: '📝' },
        { title: 'Biblioteca de Documentos', icon: '📁' },
        { title: 'Puntos de Interés', icon: '🗺️' },
        { title: 'Configuración JJVV', icon: '⚙️' },
    ];

    return (
        <SafeAreaView style={s.safe}>
            <ScrollView contentContainerStyle={s.scroll}>
                <Text style={s.title}>🔧 Herramientas</Text>
                {items.map((item, i) => (
                    <TouchableOpacity key={i} style={s.row}>
                        <Text style={s.icon}>{item.icon}</Text>
                        <Text style={s.rowTitle}>{item.title}</Text>
                        <Text style={s.arrow}>›</Text>
                    </TouchableOpacity>
                ))}
                <TouchableOpacity style={s.logout} onPress={signOut}>
                    <Text style={s.logoutText}>🚪 Cerrar Sesión</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#0F172A' },
    scroll: { padding: 20 },
    title: { fontSize: 24, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 16 },
    row: { backgroundColor: '#1E293B', borderRadius: 12, padding: 16, marginBottom: 8, flexDirection: 'row', alignItems: 'center' },
    icon: { fontSize: 22, marginRight: 12 },
    rowTitle: { flex: 1, fontSize: 16, fontWeight: '500', color: '#E2E8F0' },
    arrow: { fontSize: 22, color: '#475569' },
    logout: { backgroundColor: '#7F1D1D', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24 },
    logoutText: { color: '#FCA5A5', fontWeight: 'bold', fontSize: 16 },
});
