import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAppStore } from '../../lib/store';

export default function AdminSolicitudesScreen() {
    const navigation = useNavigation<any>();
    const solicitudes = useAppStore(s => s.solicitudes);

    const getStatusColor = (s: string) => {
        switch (s) { case 'Abierta': return '#EF4444'; case 'En proceso': return '#F59E0B'; case 'Resuelta': return '#22C55E'; default: return '#94A3B8'; }
    };

    const open = solicitudes.filter(s => s.status === 'Abierta').length;
    const inProgress = solicitudes.filter(s => s.status === 'En proceso').length;
    const resolved = solicitudes.filter(s => s.status === 'Resuelta').length;

    return (
        <SafeAreaView style={s.safe}>
            <ScrollView contentContainerStyle={s.scroll}>
                <Text style={s.title}>📝 Solicitudes Recibidas</Text>
                <View style={s.stats}>
                    <View style={[s.stat, { backgroundColor: '#FEF2F2' }]}><Text style={s.statNum}>{open}</Text><Text style={s.statLabel}>Abiertas</Text></View>
                    <View style={[s.stat, { backgroundColor: '#FFFBEB' }]}><Text style={s.statNum}>{inProgress}</Text><Text style={s.statLabel}>En proceso</Text></View>
                    <View style={[s.stat, { backgroundColor: '#F0FDF4' }]}><Text style={s.statNum}>{resolved}</Text><Text style={s.statLabel}>Resueltas</Text></View>
                </View>
                {solicitudes.length === 0 ? (
                    <View style={s.empty}><Text style={s.emptyEmoji}>📭</Text><Text style={s.emptyText}>No hay solicitudes recibidas</Text></View>
                ) : solicitudes.map(sol => (
                    <TouchableOpacity key={sol.id} style={s.card} activeOpacity={0.7} onPress={() => navigation.navigate('AdminSolicitudDetail', { id: sol.id, isAdmin: true })}>
                        <View style={s.cardHeader}>
                            <Text style={s.cardTitle} numberOfLines={2}>{sol.title}</Text>
                            <View style={[s.badge, { backgroundColor: getStatusColor(sol.status) }]}><Text style={s.badgeText}>{sol.status}</Text></View>
                        </View>
                        <Text style={s.desc} numberOfLines={2}>{sol.description}</Text>
                        <View style={s.cardMeta}>
                            <Text style={s.user}>👤 {sol.user}</Text>
                            <Text style={s.date}>📅 {sol.date}</Text>
                            {sol.hasImage && <Text style={s.img}>📷</Text>}
                            {sol.replies.length > 0 && <Text style={s.replies}>💬 {sol.replies.length}</Text>}
                        </View>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#F8FAFC' }, scroll: { padding: 20 },
    title: { fontSize: 24, fontWeight: 'bold', color: '#1E3A5F', marginBottom: 16 },
    stats: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
    stat: { flex: 1, borderRadius: 12, padding: 12, alignItems: 'center', marginHorizontal: 3, elevation: 1 },
    statNum: { fontSize: 22, fontWeight: 'bold', color: '#0F172A' }, statLabel: { fontSize: 11, color: '#64748B', marginTop: 2 },
    card: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginBottom: 10, elevation: 1 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    cardTitle: { fontSize: 14, fontWeight: '600', color: '#0F172A', flex: 1, marginRight: 8 },
    badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }, badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: 'bold' },
    desc: { fontSize: 13, color: '#64748B', marginBottom: 6 },
    cardMeta: { flexDirection: 'row', alignItems: 'center' },
    user: { fontSize: 12, color: '#94A3B8', marginRight: 12 }, date: { fontSize: 12, color: '#94A3B8', marginRight: 8 },
    img: { fontSize: 14, marginRight: 8 }, replies: { fontSize: 12, color: '#2563EB' },
    empty: { alignItems: 'center', paddingVertical: 40 }, emptyEmoji: { fontSize: 48, marginBottom: 12 }, emptyText: { fontSize: 16, color: '#94A3B8' },
});
