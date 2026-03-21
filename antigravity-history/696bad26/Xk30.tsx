import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '../../lib/store';
import { useAuth } from '../../context/AuthContext';

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export default function DuesScreen({ navigation }: any) {
    const { user } = useAuth();
    const memberDues = useAppStore(s => s.memberDues);
    const [selectedYear, setSelectedYear] = useState(2026);

    const myDues = memberDues.filter(d => d.memberName === (user?.user_metadata?.full_name || '') && d.year === selectedYear);
    const pending = myDues.filter(d => d.status === 'pending' || d.status === 'overdue');

    const getInfo = (status: string) => {
        switch (status) {
            case 'paid': return { label: 'Pagada', color: '#22C55E', bg: '#F0FDF4', icon: '✅' };
            case 'pending': return { label: 'Pendiente', color: '#F59E0B', bg: '#FFFBEB', icon: '⏳' };
            case 'overdue': return { label: 'Atrasada', color: '#EF4444', bg: '#FEF2F2', icon: '⚠️' };
            default: return { label: '', color: '#94A3B8', bg: '#F8FAFC', icon: '' };
        }
    };

    return (
        <SafeAreaView style={s.safe}>
            <ScrollView contentContainerStyle={s.scroll}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={s.back}><Text style={s.backText}>← Volver</Text></TouchableOpacity>
                <Text style={s.title}>💸 Mis Cuotas</Text>

                <View style={s.yearSelector}>
                    <TouchableOpacity onPress={() => setSelectedYear(y => y - 1)} style={s.arrowBtn}><Text style={s.arrowText}>◀</Text></TouchableOpacity>
                    <Text style={s.yearText}>📅 {selectedYear}</Text>
                    <TouchableOpacity onPress={() => setSelectedYear(y => y + 1)} style={s.arrowBtn}><Text style={s.arrowText}>▶</Text></TouchableOpacity>
                </View>

                {pending.length > 0 && (
                    <View style={s.alertCard}><Text style={s.alertText}>⚠️ Tienes {pending.length} cuota{pending.length > 1 ? 's' : ''} por pagar en {selectedYear}</Text></View>
                )}

                {myDues.length === 0 ? (
                    <View style={s.empty}><Text style={s.emptyText}>No hay cuotas registradas para {selectedYear}</Text></View>
                ) : myDues.sort((a, b) => a.month - b.month).map(d => {
                    const info = getInfo(d.status);
                    return (
                        <View key={d.id} style={[s.card, { borderLeftColor: info.color }]}>
                            <View style={s.row}>
                                <Text style={s.month}>{info.icon} {MONTHS[d.month - 1]} {d.year}</Text>
                                <Text style={[s.amount, { color: info.color }]}>${d.amount.toLocaleString('es-CL')}</Text>
                            </View>
                            <View style={[s.statusBadge, { backgroundColor: info.bg }]}><Text style={[s.statusText, { color: info.color }]}>{info.label}</Text></View>
                            {d.paidDate && <Text style={s.paidDate}>Pagada el {d.paidDate}</Text>}
                        </View>
                    );
                })}
            </ScrollView>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#F8FAFC' }, scroll: { padding: 20 },
    back: { marginBottom: 16 }, backText: { color: '#2563EB', fontSize: 16, fontWeight: '600' },
    title: { fontSize: 24, fontWeight: 'bold', color: '#1E3A5F', marginBottom: 16 },
    yearSelector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', borderRadius: 14, padding: 12, marginBottom: 16, elevation: 2 },
    arrowBtn: { padding: 8 }, arrowText: { fontSize: 18, color: '#2563EB', fontWeight: 'bold' },
    yearText: { fontSize: 18, fontWeight: 'bold', color: '#1E3A5F' },
    alertCard: { backgroundColor: '#FEF2F2', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#FECACA' },
    alertText: { color: '#991B1B', fontWeight: '600', fontSize: 14 },
    card: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginBottom: 8, borderLeftWidth: 4, elevation: 1 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    month: { fontSize: 15, fontWeight: '600', color: '#0F172A' },
    amount: { fontSize: 16, fontWeight: 'bold' },
    statusBadge: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginTop: 6 },
    statusText: { fontSize: 12, fontWeight: '600' },
    paidDate: { fontSize: 12, color: '#94A3B8', marginTop: 4 },
    empty: { alignItems: 'center', paddingVertical: 40 },
    emptyText: { fontSize: 16, color: '#94A3B8' },
});
