import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAppStore } from '../../lib/store';

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const YEARS = [2024, 2025, 2026, 2027, 2028];

export default function AdminSolicitudesScreen() {
    const navigation = useNavigation<any>();
    const solicitudes = useAppStore(s => s.solicitudes);
    const now = new Date();
    const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
    const [selectedYear, setSelectedYear] = useState(now.getFullYear());

    const getStatusColor = (s: string) => {
        switch (s) { case 'Abierta': return '#EF4444'; case 'En proceso': return '#F59E0B'; case 'Resuelta': return '#22C55E'; default: return '#94A3B8'; }
    };

    // Filter solicitudes by selected month/year
    const filtered = solicitudes.filter(sol => {
        const parts = sol.date.split(' ');
        if (parts.length >= 3) {
            const monthStr = parts[1]?.toLowerCase();
            const yearStr = parseInt(parts[2]);
            const mIdx = MONTHS.findIndex(m => m.toLowerCase() === monthStr?.substring(0, 3));
            return mIdx === selectedMonth && yearStr === selectedYear;
        }
        return true;
    });

    const open = filtered.filter(s => s.status === 'Abierta').length;
    const inProgress = filtered.filter(s => s.status === 'En proceso').length;
    const resolved = filtered.filter(s => s.status === 'Resuelta').length;

    return (
        <SafeAreaView style={s.safe}>
            <ScrollView contentContainerStyle={s.scroll}>
                <Text style={s.title}>📝 Solicitudes Recibidas</Text>

                {/* Separate Year selector */}
                <View style={s.filterSection}>
                    <Text style={s.filterLabel}>Año</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {YEARS.map(y => (
                            <TouchableOpacity key={y} style={[s.pill, selectedYear === y && s.pillActive]} onPress={() => setSelectedYear(y)}>
                                <Text style={[s.pillText, selectedYear === y && s.pillTextActive]}>{y}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* Separate Month selector */}
                <View style={s.filterSection}>
                    <Text style={s.filterLabel}>Mes</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {MONTHS.map((m, i) => (
                            <TouchableOpacity key={i} style={[s.pill, selectedMonth === i && s.pillActive]} onPress={() => setSelectedMonth(i)}>
                                <Text style={[s.pillText, selectedMonth === i && s.pillTextActive]}>{m}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                <View style={s.stats}>
                    <View style={[s.stat, { backgroundColor: '#FEF2F2' }]}><Text style={s.statNum}>{open}</Text><Text style={s.statLabel}>Abiertas</Text></View>
                    <View style={[s.stat, { backgroundColor: '#FFFBEB' }]}><Text style={s.statNum}>{inProgress}</Text><Text style={s.statLabel}>En proceso</Text></View>
                    <View style={[s.stat, { backgroundColor: '#F0FDF4' }]}><Text style={s.statNum}>{resolved}</Text><Text style={s.statLabel}>Resueltas</Text></View>
                </View>

                {filtered.length === 0 ? (
                    <View style={s.empty}><Text style={s.emptyEmoji}>📭</Text><Text style={s.emptyText}>No hay solicitudes en {MONTHS[selectedMonth]} {selectedYear}</Text></View>
                ) : filtered.map(sol => (
                    <TouchableOpacity key={sol.id} style={s.card} activeOpacity={0.7} onPress={() => navigation.navigate('AdminSolicitudDetail', { id: sol.id, isAdmin: true })}>
                        <View style={s.cardHeader}>
                            <Text style={s.cardTitle} numberOfLines={2}>{sol.title}</Text>
                            <View style={[s.badge, { backgroundColor: getStatusColor(sol.status) }]}><Text style={s.badgeText}>{sol.status}</Text></View>
                        </View>
                        {sol.category ? <Text style={s.category}>📋 {sol.category}</Text> : null}
                        <Text style={s.desc} numberOfLines={2}>{sol.description}</Text>
                        <View style={s.cardMeta}>
                            <Text style={s.user}>👤 {sol.user}</Text>
                            <Text style={s.date}>📅 {sol.date}</Text>
                            {sol.hasImage && <Text style={s.img}>📷</Text>}
                            {sol.replies.length > 0 && <Text style={s.replies}>💬 {sol.replies.length}</Text>}
                            {!sol.seenByAdmin && <View style={s.newDot} />}
                        </View>
                    </TouchableOpacity>
                ))}

                <TouchableOpacity style={s.showAllBtn} onPress={() => { setSelectedMonth(now.getMonth()); setSelectedYear(now.getFullYear()); }}>
                    <Text style={s.showAllText}>🔄 Volver al mes actual</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#F8FAFC' }, scroll: { padding: 20 },
    title: { fontSize: 24, fontWeight: 'bold', color: '#1E3A5F', marginBottom: 12 },
    filterSection: { marginBottom: 8 },
    filterLabel: { fontSize: 12, color: '#64748B', fontWeight: '600', marginBottom: 4, textTransform: 'uppercase' },
    pill: { backgroundColor: '#E2E8F0', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 6, marginRight: 6 },
    pillActive: { backgroundColor: '#2563EB' },
    pillText: { fontSize: 13, color: '#64748B', fontWeight: '500' },
    pillTextActive: { color: '#FFFFFF' },
    stats: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, marginTop: 8 },
    stat: { flex: 1, borderRadius: 12, padding: 12, alignItems: 'center', marginHorizontal: 3, elevation: 1 },
    statNum: { fontSize: 22, fontWeight: 'bold', color: '#0F172A' }, statLabel: { fontSize: 11, color: '#64748B', marginTop: 2 },
    card: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginBottom: 10, elevation: 1 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    cardTitle: { fontSize: 14, fontWeight: '600', color: '#0F172A', flex: 1, marginRight: 8 },
    badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }, badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: 'bold' },
    category: { fontSize: 12, color: '#7C3AED', fontWeight: '500', marginBottom: 4 },
    desc: { fontSize: 13, color: '#64748B', marginBottom: 6 },
    cardMeta: { flexDirection: 'row', alignItems: 'center' },
    user: { fontSize: 12, color: '#94A3B8', marginRight: 12 }, date: { fontSize: 12, color: '#94A3B8', marginRight: 8 },
    img: { fontSize: 14, marginRight: 8 }, replies: { fontSize: 12, color: '#2563EB', marginRight: 8 },
    newDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' },
    empty: { alignItems: 'center', paddingVertical: 40 }, emptyEmoji: { fontSize: 48, marginBottom: 12 }, emptyText: { fontSize: 16, color: '#94A3B8', textAlign: 'center' },
    showAllBtn: { alignItems: 'center', padding: 12, marginTop: 8 },
    showAllText: { color: '#2563EB', fontWeight: '600', fontSize: 14 },
});
