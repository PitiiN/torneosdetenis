import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';

export default function MoreScreen() {
    const { signOut, user } = useAuth();
    const items = [
        { title: 'Mis Tickets', icon: '🎫' },
        { title: 'Mis Cuotas', icon: '💸' },
        { title: 'Documentos', icon: '📁' },
        { title: 'Mapa del Barrio', icon: '🗺️' },
        { title: 'Mi Perfil', icon: '👤' },
        { title: 'Preferencias de Accesibilidad', icon: '♿' },
    ];

    return (
        <SafeAreaView style={s.safe}>
            <ScrollView contentContainerStyle={s.scroll}>
                <View style={s.header}>
                    <Text style={s.name}>{user?.user_metadata?.full_name || 'Vecino'}</Text>
                    <Text style={s.email}>{user?.email}</Text>
                </View>

                {items.map((item, i) => (
                    <TouchableOpacity key={i} style={s.row}>
                        <Text style={s.rowIcon}>{item.icon}</Text>
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
    safe: { flex: 1, backgroundColor: '#F8FAFC' },
    scroll: { padding: 20 },
    header: { backgroundColor: '#1E3A5F', borderRadius: 16, padding: 20, marginBottom: 20 },
    name: { fontSize: 20, fontWeight: 'bold', color: '#FFFFFF' },
    email: { fontSize: 14, color: '#94A3B8', marginTop: 4 },
    row: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 8, flexDirection: 'row', alignItems: 'center', elevation: 1 },
    rowIcon: { fontSize: 22, marginRight: 12 },
    rowTitle: { flex: 1, fontSize: 16, fontWeight: '500', color: '#334155' },
    arrow: { fontSize: 22, color: '#CBD5E1' },
    logout: { backgroundColor: '#FEF2F2', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 20, borderWidth: 1, borderColor: '#FECACA' },
    logoutText: { color: '#EF4444', fontWeight: 'bold', fontSize: 16 },
});
