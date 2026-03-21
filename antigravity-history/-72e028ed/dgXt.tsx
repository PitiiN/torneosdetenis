import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AnnouncementsScreen() {
    const sampleAnnouncements = [
        { id: '1', title: 'Reunión mensual de vecinos', body: 'Los invitamos a la reunión mensual este sábado a las 10:00 hrs en la sede vecinal.', priority: 'high', date: '28 Feb 2026' },
        { id: '2', title: 'Corte de agua programado', body: 'Se informa corte de agua el día lunes de 09:00 a 14:00 hrs por trabajos de mantenimiento.', priority: 'medium', date: '27 Feb 2026' },
        { id: '3', title: 'Nuevo horario de recolección', body: 'A partir de marzo, la recolección de basura será los días lunes, miércoles y viernes.', priority: 'low', date: '25 Feb 2026' },
    ];

    const getPriorityColor = (p: string) => p === 'high' ? '#EF4444' : p === 'medium' ? '#F59E0B' : '#22C55E';

    return (
        <SafeAreaView style={s.safe}>
            <ScrollView contentContainerStyle={s.scroll}>
                <Text style={s.title}>📢 Comunicados</Text>
                {sampleAnnouncements.map(a => (
                    <View key={a.id} style={[s.card, { borderLeftColor: getPriorityColor(a.priority) }]}>
                        <View style={s.row}>
                            <Text style={s.cardTitle}>{a.title}</Text>
                            <Text style={s.date}>{a.date}</Text>
                        </View>
                        <Text style={s.body}>{a.body}</Text>
                        <TouchableOpacity style={s.ttsBtn}>
                            <Text style={s.ttsText}>🔊 Escuchar este aviso</Text>
                        </TouchableOpacity>
                    </View>
                ))}
            </ScrollView>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#F8FAFC' },
    scroll: { padding: 20 },
    title: { fontSize: 24, fontWeight: 'bold', color: '#1E3A5F', marginBottom: 16 },
    card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12, borderLeftWidth: 4, elevation: 2 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#0F172A', flex: 1 },
    date: { fontSize: 12, color: '#94A3B8' },
    body: { fontSize: 14, color: '#475569', lineHeight: 20, marginBottom: 12 },
    ttsBtn: { backgroundColor: '#EFF6FF', borderRadius: 8, padding: 10, alignItems: 'center' },
    ttsText: { color: '#2563EB', fontWeight: '600', fontSize: 14 },
});
