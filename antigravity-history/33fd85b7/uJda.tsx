import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function DashboardScreen() {
    const stats = [
        { label: 'Vecinos activos', value: '127', emoji: '👥', bg: '#EFF6FF' },
        { label: 'Tickets abiertos', value: '5', emoji: '🎫', bg: '#FFFBEB' },
        { label: 'Comunicados', value: '12', emoji: '📢', bg: '#F0FDF4' },
        { label: 'Eventos este mes', value: '3', emoji: '📅', bg: '#FDF2F8' },
    ];

    return (
        <SafeAreaView style={s.safe}>
            <ScrollView contentContainerStyle={s.scroll}>
                <Text style={s.title}>📊 Panel Directiva</Text>
                <View style={s.grid}>
                    {stats.map((stat, i) => (
                        <View key={i} style={[s.card, { backgroundColor: stat.bg }]}>
                            <Text style={s.emoji}>{stat.emoji}</Text>
                            <Text style={s.value}>{stat.value}</Text>
                            <Text style={s.label}>{stat.label}</Text>
                        </View>
                    ))}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#0F172A' },
    scroll: { padding: 20 },
    title: { fontSize: 24, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 20 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    card: { width: '48%', borderRadius: 16, padding: 16, alignItems: 'center', marginBottom: 12 },
    emoji: { fontSize: 32, marginBottom: 8 },
    value: { fontSize: 28, fontWeight: 'bold', color: '#0F172A' },
    label: { fontSize: 12, color: '#64748B', marginTop: 4, textAlign: 'center' },
});
