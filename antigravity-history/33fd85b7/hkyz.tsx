import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAppStore, formatCLP } from '../../lib/store';

export default function DashboardScreen() {
    const navigation = useNavigation<any>();
    const { announcements, solicitudes, documents, members, finances } = useAppStore();

    const openSolicitudes = solicitudes.filter(s => s.status === 'Abierta').length;
    const totalIncome = finances.filter(f => f.type === 'income').reduce((a, b) => a + b.amount, 0);
    const totalExpense = finances.filter(f => f.type === 'expense').reduce((a, b) => a + b.amount, 0);

    const stats = [
        { label: 'Socios', value: members.length.toString(), icon: '👥', color: '#EFF6FF', tab: 'Admin' },
        { label: 'Avisos', value: announcements.length.toString(), icon: '📢', color: '#F0FDF4', tab: 'Avisos' },
        { label: 'Solicitudes\nabiertas', value: openSolicitudes.toString(), icon: '📝', color: '#FEF2F2', tab: 'Solicitudes' },
        { label: 'Documentos', value: documents.length.toString(), icon: '📁', color: '#FFFBEB', tab: 'Docs' },
    ];

    return (
        <SafeAreaView style={s.safe}>
            <ScrollView contentContainerStyle={s.scroll}>
                <View style={s.header}>
                    <Text style={s.headerEmoji}>👑</Text>
                    <Text style={s.headerTitle}>Panel de Administración</Text>
                    <Text style={s.headerSub}>Junta de Vecinos UV 22 • San Miguel</Text>
                </View>

                <View style={s.grid}>
                    {stats.map((stat, i) => (
                        <TouchableOpacity key={i} style={[s.card, { backgroundColor: stat.color }]} onPress={() => navigation.navigate(stat.tab)} activeOpacity={0.7}>
                            <Text style={s.cardIcon}>{stat.icon}</Text>
                            <Text style={s.cardValue}>{stat.value}</Text>
                            <Text style={s.cardLabel}>{stat.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <View style={s.financeCard}>
                    <Text style={s.sectionTitle}>💰 Resumen Financiero</Text>
                    <View style={s.finRow}>
                        <View style={s.finItem}>
                            <Text style={s.finLabel}>Ingresos</Text>
                            <Text style={[s.finValue, { color: '#22C55E' }]}>+{formatCLP(totalIncome)}</Text>
                        </View>
                        <View style={s.finDivider} />
                        <View style={s.finItem}>
                            <Text style={s.finLabel}>Egresos</Text>
                            <Text style={[s.finValue, { color: '#EF4444' }]}>-{formatCLP(totalExpense)}</Text>
                        </View>
                        <View style={s.finDivider} />
                        <View style={s.finItem}>
                            <Text style={s.finLabel}>Balance</Text>
                            <Text style={[s.finValue, { color: '#2563EB' }]}>{formatCLP(totalIncome - totalExpense)}</Text>
                        </View>
                    </View>
                </View>

                <Text style={s.sectionTitle}>⚡ Acciones rápidas</Text>
                <TouchableOpacity style={s.actionRow} onPress={() => navigation.navigate('Avisos')}>
                    <Text style={s.actionIcon}>📢</Text><Text style={s.actionText}>Crear nuevo aviso</Text><Text style={s.actionArrow}>›</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.actionRow} onPress={() => navigation.navigate('Solicitudes')}>
                    <Text style={s.actionIcon}>📝</Text><Text style={s.actionText}>Ver solicitudes pendientes</Text><Text style={s.actionArrow}>›</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.actionRow} onPress={() => navigation.navigate('Docs')}>
                    <Text style={s.actionIcon}>📁</Text><Text style={s.actionText}>Subir documento</Text><Text style={s.actionArrow}>›</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.actionRow} onPress={() => navigation.navigate('Más', { screen: 'MapaAdmin' })}>
                    <Text style={s.actionIcon}>🗺️</Text><Text style={s.actionText}>Mapa del Barrio</Text><Text style={s.actionArrow}>›</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#F8FAFC' },
    scroll: { padding: 20 },
    header: { backgroundColor: '#1E3A5F', borderRadius: 20, padding: 24, marginBottom: 20 },
    headerEmoji: { fontSize: 36 },
    headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#FFFFFF', marginTop: 8 },
    headerSub: { fontSize: 13, color: '#94A3B8', marginTop: 4 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 20 },
    card: { width: '48%', borderRadius: 16, padding: 16, alignItems: 'center', marginBottom: 12, elevation: 2 },
    cardIcon: { fontSize: 28, marginBottom: 4 },
    cardValue: { fontSize: 28, fontWeight: 'bold', color: '#0F172A' },
    cardLabel: { fontSize: 12, color: '#64748B', textAlign: 'center', marginTop: 2 },
    financeCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 20, elevation: 2 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1E3A5F', marginBottom: 12 },
    finRow: { flexDirection: 'row', alignItems: 'center' },
    finItem: { flex: 1, alignItems: 'center' },
    finLabel: { fontSize: 12, color: '#94A3B8', marginBottom: 4 },
    finValue: { fontSize: 16, fontWeight: 'bold' },
    finDivider: { width: 1, height: 30, backgroundColor: '#E2E8F0' },
    actionRow: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', elevation: 1 },
    actionIcon: { fontSize: 20, marginRight: 12 },
    actionText: { flex: 1, fontSize: 15, fontWeight: '500', color: '#334155' },
    actionArrow: { fontSize: 22, color: '#CBD5E1' },
});
