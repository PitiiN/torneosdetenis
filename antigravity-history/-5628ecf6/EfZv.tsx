import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ManageAnnouncementsScreen() {
    return (
        <SafeAreaView style={s.safe}>
            <ScrollView contentContainerStyle={s.scroll}>
                <Text style={s.title}>📢 Gestionar Comunicados</Text>
                <TouchableOpacity style={s.addBtn}>
                    <Text style={s.addBtnText}>+ Nuevo Comunicado</Text>
                </TouchableOpacity>
                <View style={s.card}>
                    <Text style={s.cardTitle}>Reunión mensual de vecinos</Text>
                    <Text style={s.cardDate}>28 Feb 2026 • Urgente</Text>
                </View>
                <View style={s.card}>
                    <Text style={s.cardTitle}>Corte de agua programado</Text>
                    <Text style={s.cardDate}>27 Feb 2026 • Normal</Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#0F172A' },
    scroll: { padding: 20 },
    title: { fontSize: 24, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 16 },
    addBtn: { backgroundColor: '#2563EB', borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 16 },
    addBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 },
    card: { backgroundColor: '#1E293B', borderRadius: 12, padding: 16, marginBottom: 8 },
    cardTitle: { fontSize: 16, fontWeight: '600', color: '#F1F5F9' },
    cardDate: { fontSize: 12, color: '#94A3B8', marginTop: 4 },
});
