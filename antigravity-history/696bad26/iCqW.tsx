import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function DuesScreen({ navigation }: any) {
    const dues = [
        { id: '1', month: 'Febrero 2026', amount: '$5.000', status: 'pending', current: true },
        { id: '2', month: 'Enero 2026', amount: '$5.000', status: 'paid', paidDate: '15 Ene 2026' },
        { id: '3', month: 'Diciembre 2025', amount: '$5.000', status: 'paid', paidDate: '12 Dic 2025' },
        { id: '4', month: 'Noviembre 2025', amount: '$5.000', status: 'paid', paidDate: '10 Nov 2025' },
        { id: '5', month: 'Octubre 2025', amount: '$5.000', status: 'overdue' },
        { id: '6', month: 'Marzo 2026', amount: '$5.000', status: 'upcoming' },
        { id: '7', month: 'Abril 2026', amount: '$5.000', status: 'upcoming' },
    ];

    const getStatusInfo = (status: string) => {
        switch (status) {
            case 'paid': return { label: 'Pagada', color: '#22C55E', bg: '#F0FDF4', icon: '✅' };
            case 'pending': return { label: 'Pendiente', color: '#F59E0B', bg: '#FFFBEB', icon: '⏳' };
            case 'overdue': return { label: 'Atrasada', color: '#EF4444', bg: '#FEF2F2', icon: '⚠️' };
            case 'upcoming': return { label: 'Próxima', color: '#94A3B8', bg: '#F8FAFC', icon: '📅' };
            default: return { label: '', color: '#94A3B8', bg: '#F8FAFC', icon: '' };
        }
    };

    const total = dues.filter(d => d.status === 'pending' || d.status === 'overdue').length;

    return (
        <SafeAreaView style={s.safe}>
            <ScrollView contentContainerStyle={s.scroll}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={s.back}>
                    <Text style={s.backText}>← Volver</Text>
                </TouchableOpacity>
                <Text style={s.title}>💸 Mis Cuotas</Text>

                {total > 0 && (
                    <View style={s.alertCard}>
                        <Text style={s.alertText}>⚠️ Tienes {total} cuota{total > 1 ? 's' : ''} por pagar</Text>
                    </View>
                )}

                <Text style={s.section}>Pendientes y atrasadas</Text>
                {dues.filter(d => d.status === 'pending' || d.status === 'overdue').map(d => {
                    const info = getStatusInfo(d.status);
                    return (
                        <View key={d.id} style={[s.card, { borderLeftColor: info.color }]}>
                            <View style={s.row}>
                                <Text style={s.month}>{info.icon} {d.month}</Text>
                                <Text style={[s.amount, { color: info.color }]}>{d.amount}</Text>
                            </View>
                            <View style={[s.statusBadge, { backgroundColor: info.bg }]}>
                                <Text style={[s.statusText, { color: info.color }]}>{info.label}</Text>
                            </View>
                        </View>
                    );
                })}

                <Text style={s.section}>Pagadas</Text>
                {dues.filter(d => d.status === 'paid').map(d => {
                    const info = getStatusInfo(d.status);
                    return (
                        <View key={d.id} style={[s.card, { borderLeftColor: info.color }]}>
                            <View style={s.row}>
                                <Text style={s.month}>{info.icon} {d.month}</Text>
                                <Text style={[s.amount, { color: info.color }]}>{d.amount}</Text>
                            </View>
                            <Text style={s.paidDate}>Pagada el {(d as any).paidDate}</Text>
                        </View>
                    );
                })}

                <Text style={s.section}>Próximas</Text>
                {dues.filter(d => d.status === 'upcoming').map(d => {
                    const info = getStatusInfo(d.status);
                    return (
                        <View key={d.id} style={[s.card, { borderLeftColor: info.color, opacity: 0.6 }]}>
                            <View style={s.row}>
                                <Text style={s.month}>{info.icon} {d.month}</Text>
                                <Text style={s.amount}>{d.amount}</Text>
                            </View>
                        </View>
                    );
                })}
            </ScrollView>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#F8FAFC' },
    scroll: { padding: 20 },
    back: { marginBottom: 16 },
    backText: { color: '#2563EB', fontSize: 16, fontWeight: '600' },
    title: { fontSize: 24, fontWeight: 'bold', color: '#1E3A5F', marginBottom: 16 },
    alertCard: { backgroundColor: '#FEF2F2', borderRadius: 12, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: '#FECACA' },
    alertText: { color: '#991B1B', fontWeight: '600', fontSize: 14 },
    section: { fontSize: 16, fontWeight: 'bold', color: '#475569', marginBottom: 10, marginTop: 16 },
    card: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginBottom: 8, borderLeftWidth: 4, elevation: 1 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    month: { fontSize: 15, fontWeight: '600', color: '#0F172A' },
    amount: { fontSize: 16, fontWeight: 'bold', color: '#334155' },
    statusBadge: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginTop: 6 },
    statusText: { fontSize: 12, fontWeight: '600' },
    paidDate: { fontSize: 12, color: '#94A3B8', marginTop: 4 },
});
