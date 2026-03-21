import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function EventsScreen() {
    const events = [
        { id: '1', title: 'Bingo Vecinal', date: 'Sábado 1 de Marzo, 18:00', location: 'Sede Vecinal', emoji: '🎲' },
        { id: '2', title: 'Taller de Primeros Auxilios', date: 'Miércoles 5 de Marzo, 10:00', location: 'Plaza Central', emoji: '🏥' },
        { id: '3', title: 'Reunión Ordinaria', date: 'Viernes 7 de Marzo, 19:00', location: 'Sede Vecinal', emoji: '📋' },
    ];

    return (
        <SafeAreaView style={s.safe}>
            <ScrollView contentContainerStyle={s.scroll}>
                <Text style={s.title}>📅 Agenda</Text>
                {events.map(e => (
                    <View key={e.id} style={s.card}>
                        <Text style={s.emoji}>{e.emoji}</Text>
                        <View style={s.info}>
                            <Text style={s.cardTitle}>{e.title}</Text>
                            <Text style={s.date}>{e.date}</Text>
                            <Text style={s.location}>📍 {e.location}</Text>
                        </View>
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
    card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', elevation: 2 },
    emoji: { fontSize: 36, marginRight: 16 },
    info: { flex: 1 },
    cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#0F172A' },
    date: { fontSize: 13, color: '#2563EB', marginTop: 4 },
    location: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
});
