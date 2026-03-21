import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as Speech from 'expo-speech';
import { useAppStore } from '../../lib/store';
import { useAuth } from '../../context/AuthContext';
import { useAccessibility } from '../../context/AccessibilityContext';

export default function AnnouncementsScreen() {
    const [speaking, setSpeaking] = useState<string | null>(null);
    const [replyingTo, setReplyingTo] = useState<string | null>(null);
    const [replyMessage, setReplyMessage] = useState('');
    const announcements = useAppStore(s => s.announcements);
    const markAvisosSeen = useAppStore(s => s.markAvisosSeen);
    const addAnnouncementReply = useAppStore(s => s.addAnnouncementReply);
    const { ttsEnabled } = useAccessibility();
    const { user } = useAuth();

    // Mark avisos as seen and stop audio on blur (Fix #1 + #2)
    useFocusEffect(
        useCallback(() => {
            markAvisosSeen();
            return () => {
                Speech.stop();
                setSpeaking(null);
            };
        }, [])
    );

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

    const handleSendReply = (id: string) => {
        if (!replyMessage.trim()) return;
        const userName = user?.user_metadata?.full_name || 'Vecino';
        addAnnouncementReply(id, replyMessage, userName);
        setReplyMessage('');
        setReplyingTo(null);
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

                        {(a.replies || []).length > 0 && (
                            <View style={s.repliesContainer}>
                                <Text style={s.repliesHeader}>Respuestas ({(a.replies || []).length})</Text>
                                {(a.replies || []).map(r => (
                                    <View key={r.id} style={s.replyBubble}>
                                        <View style={s.replyHeader}>
                                            <Text style={s.replyName}>{r.userName}</Text>
                                            <Text style={s.replyDate}>{r.date}</Text>
                                        </View>
                                        <Text style={s.replyMessage}>{r.message}</Text>
                                    </View>
                                ))}
                            </View>
                        )}

                        {replyingTo === a.id ? (
                            <View style={s.replyInputContainer}>
                                <TextInput
                                    style={s.replyInput}
                                    placeholder="Escribe tu respuesta..."
                                    value={replyMessage}
                                    onChangeText={setReplyMessage}
                                    multiline
                                />
                                <View style={s.replyActions}>
                                    <TouchableOpacity style={s.cancelBtn} onPress={() => { setReplyingTo(null); setReplyMessage(''); }}>
                                        <Text style={s.cancelText}>Cancelar</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={s.sendBtn} onPress={() => handleSendReply(a.id)}>
                                        <Text style={s.sendText}>Enviar</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : (
                            <TouchableOpacity style={s.startReplyBtn} onPress={() => setReplyingTo(a.id)}>
                                <Text style={s.startReplyText}>💬 Responder</Text>
                            </TouchableOpacity>
                        )}

                        {ttsEnabled && (
                            <TouchableOpacity style={[s.ttsBtn, speaking === a.id && s.ttsBtnActive]} onPress={() => speak(a.id, `${a.title}. ${a.body}`)}>
                                <Text style={[s.ttsText, speaking === a.id && s.ttsTextActive]}>
                                    {speaking === a.id ? '⏹ Detener audio' : '🔊 Escuchar este aviso'}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                ))}
            </ScrollView>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: 'transparent' },
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
    repliesContainer: { marginTop: 12, borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 12 },
    repliesHeader: { fontSize: 13, fontWeight: 'bold', color: '#64748B', marginBottom: 8 },
    replyBubble: { backgroundColor: '#F8FAFC', padding: 10, borderRadius: 12, marginBottom: 8 },
    replyHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    replyName: { fontSize: 12, fontWeight: '600', color: '#334155' },
    replyDate: { fontSize: 11, color: '#94A3B8' },
    replyMessage: { fontSize: 13, color: '#475569' },
    replyInputContainer: { marginTop: 12, backgroundColor: '#F8FAFC', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' },
    replyInput: { backgroundColor: '#FFFFFF', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#CBD5E1', fontSize: 14, minHeight: 60, textAlignVertical: 'top', marginBottom: 8 },
    replyActions: { flexDirection: 'row', justifyContent: 'flex-end' },
    cancelBtn: { paddingVertical: 8, paddingHorizontal: 12, marginRight: 8 },
    cancelText: { color: '#64748B', fontSize: 14, fontWeight: '600' },
    sendBtn: { backgroundColor: '#2563EB', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
    sendText: { color: '#FFFFFF', fontSize: 14, fontWeight: 'bold' },
    startReplyBtn: { backgroundColor: '#F1F5F9', paddingVertical: 10, borderRadius: 8, alignItems: 'center', marginTop: 12, marginBottom: 8 },
    startReplyText: { color: '#475569', fontSize: 14, fontWeight: '600' },
});
