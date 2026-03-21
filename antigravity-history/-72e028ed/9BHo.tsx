import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Speech from 'expo-speech';
import { useAppStore } from '../../lib/store';

export default function AnnouncementsScreen() {
    const [speaking, setSpeaking] = useState<string | null>(null);
    const announcements = useAppStore(s => s.announcements);
    const markAvisosSeen = useAppStore(s => s.markAvisosSeen);

    // Mark avisos as seen when this screen mounts
    useEffect(() => {
        markAvisosSeen();
    }, []);

    // Stop audio on unmount (Item 5)
    useEffect(() => {
        return () => {
            Speech.stop();
        };
    }, []);

    const getPriorityColor = (p: string) => p === 'important' ? '#EF4444' : '#22C55E';

    const speak = (id: string, text: string) => {
        if (speaking === id) {
            Speech.stop();
            setSpeaking(null);
        } else {
            Speech.stop();
            setSpeaking(id);
            Speech.speak(text, {
                language: 'es-CL',
                rate: 0.9,
                onDone: () => setSpeaking(null),
                onError: () => { setSpeaking(null); Alert.alert('Error', 'No se pudo reproducir el audio.'); },
            });
        }
    };

    return (
        <SafeAreaView style={s.safe}>
            <ScrollView contentContainerStyle={s.scroll}>
                <Text style={s.title}>📢 Avisos</Text>
                {announcements.length === 0 ? (
                    <View style={s.empty}><Text style={s.emptyText}>No hay avisos por el momento</Text></View>
                ) : announcements.map(a => (
                    <View key={a.id} style={[s.card, { borderLeftColor: getPriorityColor(a.priority) }]}>
                        <View style={s.row}>
                            <Text style={s.cardTitle}>{a.title}</Text>
                            <Text style={s.date}>{a.date}</Text>
                        </View>
                        <Text style={s.body}>{a.body}</Text>
                        <TouchableOpacity style={[s.ttsBtn, speaking === a.id && s.ttsBtnActive]} onPress={() => speak(a.id, `${a.title}. ${a.body}`)}>
                            <Text style={[s.ttsText, speaking === a.id && s.ttsTextActive]}>
                                {speaking === a.id ? '⏹ Detener audio' : '🔊 Escuchar este aviso'}
                            </Text>
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
    ttsBtnActive: { backgroundColor: '#DC2626' },
    ttsText: { color: '#2563EB', fontWeight: '600', fontSize: 14 },
    ttsTextActive: { color: '#FFFFFF' },
    empty: { alignItems: 'center', paddingVertical: 40 },
    emptyText: { fontSize: 16, color: '#94A3B8' },
});
