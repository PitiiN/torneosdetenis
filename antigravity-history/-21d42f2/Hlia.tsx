import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AdminSolicitudesScreen() {
    const solicitudes = [
        { id: '1', title: 'Luminaria rota calle Los Aromos', user: 'María González', date: '28 Feb', status: 'Abierta', hasImage: true },
        { id: '2', title: 'Bache frente a la sede vecinal', user: 'Carlos Pérez', date: '27 Feb', status: 'En proceso', hasImage: true },
        { id: '3', title: 'Ruidos molestos sector norte', user: 'Ana López', date: '25 Feb', status: 'Resuelta', hasImage: false },
        { id: '4', title: 'Poda de árboles pasaje 5', user: 'Pedro Soto', date: '24 Feb', status: 'Abierta', hasImage: false },
        { id: '5', title: 'Filtración de agua vereda', user: 'Javier Aravena', date: '23 Feb', status: 'Rechazada', hasImage: true },
    ];

    const getStatusColor = (s: string) => {
        switch (s) {
            case 'Abierta': return '#EF4444';
            case 'En proceso': return '#F59E0B';
            case 'Resuelta': return '#22C55E';
            case 'Rechazada': return '#94A3B8';
            default: return '#94A3B8';
        }
    };

    return (
        <SafeAreaView style={s.safe}>
            <ScrollView contentContainerStyle={s.scroll}>
                <Text style={s.title}>📝 Solicitudes Recibidas</Text>
                <View style={s.stats}>
                    <View style={[s.stat, { backgroundColor: '#FEF2F2' }]}>
                        <Text style={s.statNum}>2</Text><Text style={s.statLabel}>Abiertas</Text>
                    </View>
                    <View style={[s.stat, { backgroundColor: '#FFFBEB' }]}>
                        <Text style={s.statNum}>1</Text><Text style={s.statLabel}>En proceso</Text>
                    </View>
                    <View style={[s.stat, { backgroundColor: '#F0FDF4' }]}>
                        <Text style={s.statNum}>1</Text><Text style={s.statLabel}>Resueltas</Text>
                    </View>
                </View>

                {solicitudes.map(sol => (
                    <TouchableOpacity key={sol.id} style={s.card} activeOpacity={0.7}>
                        <View style={s.cardHeader}>
                            <Text style={s.cardTitle}>{sol.title}</Text>
                            <View style={[s.badge, { backgroundColor: getStatusColor(sol.status) }]}>
                                <Text style={s.badgeText}>{sol.status}</Text>
                            </View>
                        </View>
                        <View style={s.cardMeta}>
                            <Text style={s.user}>👤 {sol.user}</Text>
                            <Text style={s.date}>📅 {sol.date}</Text>
                            {sol.hasImage && <Text style={s.img}>📷</Text>}
                        </View>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#0F172A' },
    scroll: { padding: 20 },
    title: { fontSize: 24, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 16 },
    stats: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
    stat: { flex: 1, borderRadius: 12, padding: 12, alignItems: 'center', marginHorizontal: 3 },
    statNum: { fontSize: 22, fontWeight: 'bold', color: '#0F172A' },
    statLabel: { fontSize: 11, color: '#64748B', marginTop: 2 },
    card: { backgroundColor: '#1E293B', borderRadius: 12, padding: 14, marginBottom: 10 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    cardTitle: { fontSize: 14, fontWeight: '600', color: '#F1F5F9', flex: 1, marginRight: 8 },
    badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
    badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: 'bold' },
    cardMeta: { flexDirection: 'row', alignItems: 'center' },
    user: { fontSize: 12, color: '#94A3B8', marginRight: 12 },
    date: { fontSize: 12, color: '#94A3B8', marginRight: 8 },
    img: { fontSize: 14 },
});
