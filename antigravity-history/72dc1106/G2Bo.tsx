import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, CommonActions, useFocusEffect } from '@react-navigation/native';
import * as Speech from 'expo-speech';
import { useAuth } from '../../context/AuthContext';
import { useAppStore } from '../../lib/store';
import { useAccessibility } from '../../context/AccessibilityContext';

export default function HomeScreen() {
    const { user } = useAuth();
    const navigation = useNavigation<any>();
    const announcements = useAppStore(s => s.announcements);
    const solicitudes = useAppStore(s => s.solicitudes);
    const documents = useAppStore(s => s.documents);
    const seenAvisosCount = useAppStore(s => s.seenAvisosCount);
    const seenDocsCount = useAppStore(s => s.seenDocsCount);
    const markAvisosSeen = useAppStore(s => s.markAvisosSeen);
    const { ttsEnabled } = useAccessibility();
    const displayName = user?.user_metadata?.full_name || 'Vecino';
    const importantAvisos = announcements.filter(a => a.priority === 'important').slice(0, 3);
    const mySolicitudes = solicitudes.filter(s => s.userEmail === user?.email || s.user === user?.user_metadata?.full_name);
    const unreadSolicitudes = mySolicitudes.filter(s => !s.seenByUser).length;
    const [speaking, setSpeaking] = useState<string | null>(null);

    // Badge: simple counter — new avisos = total - seen count
    const unreadAvisos = Math.max(0, announcements.length - seenAvisosCount);
    const unreadDocs = Math.max(0, documents.length - seenDocsCount);

    // Stop speech when leaving this screen (Fix #2)
    useFocusEffect(
        useCallback(() => {
            return () => {
                Speech.stop();
                setSpeaking(null);
            };
        }, [])
    );

    const goToTab = (tabName: string) => {
        if (tabName === 'Avisos') markAvisosSeen();
        navigation.dispatch(
            CommonActions.navigate({ name: tabName, params: {} })
        );
    };

    const speakAviso = (id: string, text: string) => {
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

    const quickActions = [
        { title: 'Avisos', emoji: '📢', bg: '#EFF6FF', badge: unreadAvisos, onPress: () => goToTab('Avisos') },
        { title: 'Emergencia', emoji: '🆘', bg: '#FEF2F2', badge: 0, onPress: () => goToTab('S.O.S') },
        { title: 'Agenda', emoji: '📅', bg: '#F5F3FF', badge: 0, onPress: () => goToTab('Agenda') },
        { title: 'Documentos', emoji: '📁', bg: '#F0FDF4', badge: unreadDocs, onPress: () => navigation.navigate('Más', { screen: 'Documents' }) },
        { title: 'Solicitudes', emoji: '📝', bg: '#FFFBEB', badge: unreadSolicitudes, onPress: () => navigation.navigate('Más', { screen: 'Solicitudes' }) },
        { title: 'Favores', emoji: '🤝', bg: '#FFF7ED', badge: 0, onPress: () => Alert.alert('Próximamente', 'Estamos trabajando en esta funcionalidad.') },
    ];

    return (
        <SafeAreaView style={s.safe}>
            <ScrollView contentContainerStyle={s.scroll}>
                <View style={s.greeting}>
                    <Text style={s.greetEmoji}>👋</Text>
                    <Text style={s.greetTitle}>¡Hola, {displayName}!</Text>
                    <Text style={s.greetSub}>Bienvenido a tu Junta de Vecinos</Text>
                </View>

                <Text style={s.section}>Accesos rápidos</Text>
                <View style={s.grid}>
                    {quickActions.map((action, i) => (
                        <TouchableOpacity key={i} style={[s.card, { backgroundColor: action.bg }]} activeOpacity={0.7} onPress={action.onPress}>
                            <View style={s.cardInner}>
                                <Text style={s.cardEmoji}>{action.emoji}</Text>
                                {action.badge > 0 && (
                                    <View style={s.badge}><Text style={s.badgeText}>{action.badge > 9 ? '9+' : action.badge}</Text></View>
                                )}
                            </View>
                            <Text style={s.cardTitle}>{action.title}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {importantAvisos.length > 0 ? (
                    <>
                        <Text style={s.section}>🔴 Avisos Importantes</Text>
                        {importantAvisos.map(a => (
                            <TouchableOpacity key={a.id} style={s.infoCard} onPress={() => goToTab('Avisos')} activeOpacity={0.7}>
                                <Text style={s.infoTitle}>{a.title}</Text>
                                <Text style={s.infoText} numberOfLines={2}>{a.body}</Text>
                                <View style={s.infoRow}>
                                    <Text style={s.infoDate}>{a.date}</Text>
                                    {ttsEnabled && (
                                        <TouchableOpacity
                                            style={[s.ttsBtn, speaking === a.id && s.ttsBtnActive]}
                                            onPress={(e) => { e.stopPropagation && e.stopPropagation(); speakAviso(a.id, `${a.title}. ${a.body}`); }}
                                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                        >
                                            <Text style={[s.ttsText, speaking === a.id && s.ttsTextActive]}>
                                                {speaking === a.id ? '⏹' : '🔊'}
                                            </Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </TouchableOpacity>
                        ))}
                    </>
                ) : (
                    <View style={s.noInfo}>
                        <Text style={s.noInfoText}>✅ No hay avisos importantes por el momento</Text>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: 'transparent' }, scroll: { padding: 20 },
    greeting: { backgroundColor: '#1E3A5F', borderRadius: 20, padding: 24, marginBottom: 24 },
    greetEmoji: { fontSize: 36 }, greetTitle: { fontSize: 24, fontWeight: 'bold', color: '#FFFFFF', marginTop: 8 }, greetSub: { fontSize: 14, color: '#94A3B8', marginTop: 4 },
    section: { fontSize: 18, fontWeight: 'bold', color: '#334155', marginBottom: 12 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 24 },
    card: { width: '48%', borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 12, elevation: 2 },
    cardInner: { position: 'relative', marginBottom: 8 },
    cardEmoji: { fontSize: 32 }, cardTitle: { fontSize: 14, fontWeight: '600', color: '#334155' },
    badge: { position: 'absolute', top: -6, right: -14, backgroundColor: '#EF4444', borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
    badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: 'bold' },
    infoCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderLeftWidth: 4, borderLeftColor: '#EF4444', elevation: 2, marginBottom: 10 },
    infoTitle: { fontSize: 15, fontWeight: 'bold', color: '#1E3A5F', marginBottom: 4 },
    infoText: { fontSize: 13, color: '#64748B', lineHeight: 18 },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
    infoDate: { fontSize: 11, color: '#94A3B8' },
    ttsBtn: { backgroundColor: '#EFF6FF', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, },
    ttsBtnActive: { backgroundColor: '#DC2626' },
    ttsText: { fontSize: 18 },
    ttsTextActive: { color: '#FFFFFF' },
    noInfo: { backgroundColor: '#F0FDF4', borderRadius: 12, padding: 16, alignItems: 'center' },
    noInfoText: { color: '#22C55E', fontWeight: '600', fontSize: 14 },
});
