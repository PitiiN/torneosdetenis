import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const ALL_EVENTS = [
    { id: '1', title: 'Bingo Vecinal', date: '2026-03-01T18:00', location: 'Sede Vecinal', emoji: '🎲', month: 2 },
    { id: '2', title: 'Taller de Primeros Auxilios', date: '2026-03-05T10:00', location: 'Plaza Central', emoji: '🏥', month: 2 },
    { id: '3', title: 'Reunión Ordinaria', date: '2026-03-07T19:00', location: 'Sede Vecinal', emoji: '📋', month: 2 },
    { id: '4', title: 'Feria Vecinal', date: '2026-04-12T10:00', location: 'Pasaje Los Olivos', emoji: '🛍️', month: 3 },
    { id: '5', title: 'Día del Niño', date: '2026-04-20T15:00', location: 'Cancha Multiuso', emoji: '🎈', month: 3 },
    { id: '6', title: 'Asamblea Extraordinaria', date: '2026-05-03T18:30', location: 'Sede Vecinal', emoji: '📢', month: 4 },
];

function formatDate(iso: string) {
    const d = new Date(iso);
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    return `${days[d.getDay()]} ${d.getDate()} de ${MONTHS[d.getMonth()]}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function EventsScreen() {
    const now = new Date();
    const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
    const [selectedYear] = useState(now.getFullYear());

    const filteredEvents = ALL_EVENTS.filter(e => e.month === selectedMonth);

    const prevMonth = () => setSelectedMonth(m => m === 0 ? 11 : m - 1);
    const nextMonth = () => setSelectedMonth(m => m === 11 ? 0 : m + 1);

    return (
        <SafeAreaView style={s.safe}>
            <ScrollView contentContainerStyle={s.scroll}>
                <Text style={s.title}>📅 Agenda</Text>

                <View style={s.monthSelector}>
                    <TouchableOpacity onPress={prevMonth} style={s.arrowBtn}>
                        <Text style={s.arrowText}>◀</Text>
                    </TouchableOpacity>
                    <Text style={s.monthText}>📅 {MONTHS[selectedMonth]} {selectedYear}</Text>
                    <TouchableOpacity onPress={nextMonth} style={s.arrowBtn}>
                        <Text style={s.arrowText}>▶</Text>
                    </TouchableOpacity>
                </View>

                {filteredEvents.length === 0 ? (
                    <View style={s.empty}>
                        <Text style={s.emptyEmoji}>📭</Text>
                        <Text style={s.emptyText}>No hay eventos para {MONTHS[selectedMonth]}</Text>
                    </View>
                ) : (
                    filteredEvents.map(e => (
                        <View key={e.id} style={s.card}>
                            <Text style={s.emoji}>{e.emoji}</Text>
                            <View style={s.info}>
                                <Text style={s.cardTitle}>{e.title}</Text>
                                <Text style={s.date}>{formatDate(e.date)}</Text>
                                <Text style={s.location}>📍 {e.location}</Text>
                            </View>
                        </View>
                    ))
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#F8FAFC' },
    scroll: { padding: 20 },
    title: { fontSize: 24, fontWeight: 'bold', color: '#1E3A5F', marginBottom: 16 },
    monthSelector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 12, marginBottom: 16, elevation: 2 },
    arrowBtn: { padding: 8 },
    arrowText: { fontSize: 18, color: '#2563EB', fontWeight: 'bold' },
    monthText: { fontSize: 18, fontWeight: 'bold', color: '#1E3A5F' },
    card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', elevation: 2 },
    emoji: { fontSize: 36, marginRight: 16 },
    info: { flex: 1 },
    cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#0F172A' },
    date: { fontSize: 13, color: '#2563EB', marginTop: 4 },
    location: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
    empty: { alignItems: 'center', paddingVertical: 40 },
    emptyEmoji: { fontSize: 48, marginBottom: 12 },
    emptyText: { fontSize: 16, color: '#94A3B8' },
});
