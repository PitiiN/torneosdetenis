import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ManageMembersScreen() {
    const members = [
        { id: '1', name: 'Juan Pérez', role: 'Presidente', active: true },
        { id: '2', name: 'María González', role: 'Secretaria', active: true },
        { id: '3', name: 'Carlos López', role: 'Tesorero', active: true },
        { id: '4', name: 'Ana Muñoz', role: 'Socio', active: true },
        { id: '5', name: 'Pedro Soto', role: 'Residente', active: false },
    ];
    const getRoleColor = (r: string) => r === 'Presidente' ? '#7C3AED' : r === 'Secretaria' || r === 'Tesorero' ? '#2563EB' : '#22C55E';

    return (
        <SafeAreaView style={s.safe}>
            <Text style={s.title}>👥 Socios</Text>
            <FlatList
                data={members}
                keyExtractor={i => i.id}
                contentContainerStyle={s.list}
                renderItem={({ item }) => (
                    <View style={s.card}>
                        <View style={s.avatar}><Text style={s.avatarText}>{item.name[0]}</Text></View>
                        <View style={s.info}>
                            <Text style={s.name}>{item.name}</Text>
                            <View style={[s.badge, { backgroundColor: getRoleColor(item.role) }]}>
                                <Text style={s.badgeText}>{item.role}</Text>
                            </View>
                        </View>
                        {!item.active && <Text style={s.inactive}>Inactivo</Text>}
                    </View>
                )}
            />
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#0F172A' },
    title: { fontSize: 24, fontWeight: 'bold', color: '#FFFFFF', padding: 20, paddingBottom: 8 },
    list: { padding: 20, paddingTop: 8 },
    card: { backgroundColor: '#1E293B', borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center' },
    avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#334155', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    avatarText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 },
    info: { flex: 1 },
    name: { fontSize: 15, fontWeight: '600', color: '#F1F5F9' },
    badge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start', marginTop: 4 },
    badgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: 'bold' },
    inactive: { color: '#EF4444', fontSize: 11, fontWeight: '600' },
});
