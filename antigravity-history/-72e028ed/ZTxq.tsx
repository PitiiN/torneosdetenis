import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, TextInput, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as Speech from 'expo-speech';
import * as ImagePicker from 'expo-image-picker';
import { useAppStore } from '../../lib/store';
import { useAuth } from '../../context/AuthContext';
import { useAccessibility } from '../../context/AccessibilityContext';

export default function AnnouncementsScreen() {
    const [tab, setTab] = useState<'avisos' | 'encuestas'>('avisos');
    const [speaking, setSpeaking] = useState<string | null>(null);
    const [replyingTo, setReplyingTo] = useState<string | null>(null);
    const [expandedThreads, setExpandedThreads] = useState<Record<string, boolean>>({});
    const [replyMessage, setReplyMessage] = useState('');
    const [selectedMedia, setSelectedMedia] = useState<{ uri: string, type: 'image' | 'video' | 'audio' } | null>(null);
    const announcements = useAppStore(s => s.announcements);
    const polls = useAppStore(s => s.polls);
    const markAvisosSeen = useAppStore(s => s.markAvisosSeen);
    const addAnnouncementReply = useAppStore(s => s.addAnnouncementReply);
    const votePoll = useAppStore(s => s.votePoll);
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
        if (!replyMessage.trim() && !selectedMedia) return;
        const userName = user?.user_metadata?.full_name || 'Vecino';
        addAnnouncementReply(id, replyMessage, userName, selectedMedia?.uri, selectedMedia?.type);
        setReplyMessage('');
        setSelectedMedia(null);
        setReplyingTo(null);
    };

    const toggleThread = (id: string) => {
        setExpandedThreads(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const handleAttachMedia = async (type: 'image' | 'video' | 'audio') => {
        if (type === 'audio') {
            Alert.alert('Simulación de Audio', 'Se ha adjuntado una nota de voz (Simulada).');
            setSelectedMedia({ uri: 'simulated_audio.m4a', type: 'audio' });
            return;
        }

        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permiso denegado', 'Se necesita acceso a la galería para subir archivos Multimedia.');
            return;
        }

        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: type === 'image' ? ImagePicker.MediaTypeOptions.Images : ImagePicker.MediaTypeOptions.Videos,
            allowsEditing: false,
            quality: 0.8,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            setSelectedMedia({ uri: result.assets[0].uri, type });
        }
    };

    return (
        <SafeAreaView style={s.safe}>
            <View style={s.tabs}>
                <TouchableOpacity style={[s.tab, tab === 'avisos' && s.tabActive]} onPress={() => setTab('avisos')}>
                    <Text style={[s.tabText, tab === 'avisos' && s.tabTextActive]}>📢 Avisos</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.tab, tab === 'encuestas' && s.tabActive]} onPress={() => setTab('encuestas')}>
                    <Text style={[s.tabText, tab === 'encuestas' && s.tabTextActive]}>📊 Encuestas</Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={s.scroll}>
                {tab === 'encuestas' && (
                    polls.length === 0 ? (
                        <View style={s.empty}><Text style={s.emptyText}>No hay encuestas activas</Text></View>
                    ) : polls.map(p => {
                        const isExpired = new Date() > new Date(p.deadline);
                        // Determine user's current vote. Fallback to backward-compatible votedBy array if userVotes is missing.
                        const userVotesMap = (p as any).userVotes || {};
                        const userVotedOptionId = userVotesMap[user?.id || ''];
                        const hasVoted = !!userVotedOptionId || p.votedBy.includes(user?.id || '');
                        const showResults = isExpired || hasVoted;
                        const totalVotes = p.options.reduce((sum, opt) => sum + opt.votes, 0);

                        return (
                            <View key={p.id} style={[s.card, { borderLeftColor: '#3B82F6' }]}>
                                <View style={s.row}>
                                    <Text style={s.pollTitle}>📊 {p.question}</Text>
                                </View>
                                {isExpired ? (
                                    <View style={s.expiredBanner}><Text style={s.expiredText}>⏱️ Esta encuesta ha finalizado.</Text></View>
                                ) : (
                                    <Text style={s.metaText}>Cierra: {p.deadline}</Text>
                                )}

                                <View style={s.pollOptions}>
                                    {p.options.map(opt => {
                                        const percentage = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
                                        const isMyVote = userVotedOptionId === opt.id;

                                        if (showResults && isExpired) {
                                            return (
                                                <View key={opt.id} style={[s.pollResultBox, isMyVote && s.pollResultBoxMyVote]}>
                                                    <View style={[s.pollResultFill, { width: `${percentage}%` }]} />
                                                    <View style={s.pollResultContent}>
                                                        <Text style={s.pollResultText}>{opt.text} {isMyVote ? '(Tu voto)' : ''}</Text>
                                                        <Text style={s.pollResultStat}>{percentage}% ({opt.votes})</Text>
                                                    </View>
                                                </View>
                                            );
                                        }

                                        return (
                                            <TouchableOpacity
                                                key={opt.id}
                                                style={[s.pollOptionBtn, isMyVote && s.pollOptionBtnSelected]}
                                                onPress={() => user?.id && votePoll(p.id, opt.id, user.id)}
                                            >
                                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%' }}>
                                                    <Text style={[s.pollOptionText, isMyVote && s.pollOptionTextSelected]}>{opt.text}</Text>
                                                    {showResults && <Text style={[s.pollOptionText, isMyVote && s.pollOptionTextSelected]}>{percentage}%</Text>}
                                                </View>
                                                {showResults && (
                                                    <View style={[s.pollResultFillBg, { width: `${percentage}%` }]} />
                                                )}
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                                <Text style={s.pollFooter}>{totalVotes} voto{totalVotes !== 1 ? 's' : ''} en total{(hasVoted && !isExpired) ? ' • Puedes cambiar tu voto' : ''}</Text>
                            </View>
                        );
                    })
                )}

                {tab === 'avisos' && (
                    announcements.length === 0 ? (
                        <View style={s.empty}><Text style={s.emptyText}>No hay avisos por el momento</Text></View>
                    ) : announcements.map(a => {
                        const replies = a.replies || [];
                        return (
                            <View key={a.id} style={[s.card, { borderLeftColor: getPriorityColor(a.priority) }]}>
                                <View style={s.row}>
                                    <Text style={s.cardTitle}>{a.title}</Text>
                                    <Text style={s.date}>{a.date}</Text>
                                </View>
                                {(a.schedule || a.location) && (
                                    <Text style={s.metaText}>
                                        {a.schedule && `🗓 ${a.schedule}`} {a.schedule && a.location && ' • '} {a.location && `📍 ${a.location}`}
                                    </Text>
                                )}
                                <Text style={s.body}>{a.body}</Text>

                                {replies.length > 0 && (
                                    <TouchableOpacity style={s.expandBtn} onPress={() => toggleThread(a.id)}>
                                        <Text style={s.expandBtnText}>
                                            {expandedThreads[a.id] ? 'Ocultar comentarios' : `💬 Ver ${replies.length} comentario${replies.length > 1 ? 's' : ''}`}
                                        </Text>
                                    </TouchableOpacity>
                                )}

                                {expandedThreads[a.id] && replies.length > 0 && (
                                    <View style={s.repliesContainer}>
                                        {replies.map((r: any) => (
                                            <View key={r.id} style={s.replyBubble}>
                                                <View style={s.replyHeader}>
                                                    <Text style={s.replyName}>{r.userName}</Text>
                                                    <Text style={s.replyDate}>{r.date}</Text>
                                                </View>
                                                <Text style={s.replyMessage}>{r.message}</Text>
                                                {r.mediaUrl && (
                                                    <View style={s.replyMediaContainer}>
                                                        {r.mediaType === 'image' && <Image source={{ uri: r.mediaUrl }} style={s.replyImage} resizeMode="cover" />}
                                                        {r.mediaType === 'video' && <View style={s.replyVideo}><Text style={{ color: '#FFF' }}>▶ Video Adjunto</Text></View>}
                                                        {r.mediaType === 'audio' && <View style={s.replyAudio}><Text style={{ color: '#2563EB' }}>🔊 Nota de Voz</Text></View>}
                                                    </View>
                                                )}
                                            </View>
                                        ))}
                                    </View>
                                )}

                                {(expandedThreads[a.id] || replies.length === 0) && replyingTo === a.id ? (
                                    <View style={s.replyInputContainer}>
                                        <View style={s.mediaBtns}>
                                            <TouchableOpacity onPress={() => handleAttachMedia('image')} style={s.mediaBtn}><Text>📷 Imagen</Text></TouchableOpacity>
                                            <TouchableOpacity onPress={() => handleAttachMedia('video')} style={s.mediaBtn}><Text>🎥 Video</Text></TouchableOpacity>
                                            <TouchableOpacity onPress={() => handleAttachMedia('audio')} style={s.mediaBtn}><Text>🎤 Voz</Text></TouchableOpacity>
                                        </View>
                                        <TextInput
                                            style={s.replyInput}
                                            placeholder="Escribe tu respuesta..."
                                            value={replyMessage}
                                            onChangeText={setReplyMessage}
                                            multiline
                                        />
                                        {selectedMedia && (
                                            <View style={s.selectedMediaPreview}>
                                                <Text style={s.selectedMediaText}>📎 Adjunto: {selectedMedia.type}</Text>
                                                <TouchableOpacity onPress={() => setSelectedMedia(null)}><Text style={{ color: '#EF4444' }}>✕</Text></TouchableOpacity>
                                            </View>
                                        )}
                                        <View style={s.replyActions}>
                                            <TouchableOpacity style={s.cancelBtn} onPress={() => { setReplyingTo(null); setReplyMessage(''); setSelectedMedia(null); }}>
                                                <Text style={s.cancelText}>Cancelar</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity style={s.sendBtn} onPress={() => handleSendReply(a.id)}>
                                                <Text style={s.sendText}>Enviar</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ) : (
                                    (expandedThreads[a.id] || replies.length === 0) && (
                                        <TouchableOpacity style={s.startReplyBtn} onPress={() => setReplyingTo(a.id)}>
                                            <Text style={s.startReplyText}>Escribir una respuesta...</Text>
                                        </TouchableOpacity>
                                    )
                                )}

                                {ttsEnabled && (
                                    <TouchableOpacity style={[s.ttsBtn, speaking === a.id && s.ttsBtnActive]} onPress={() => speak(a.id, `${a.title}. ${a.body}`)}>
                                        <Text style={[s.ttsText, speaking === a.id && s.ttsTextActive]}>
                                            {speaking === a.id ? '⏹ Detener audio' : '🔊 Escuchar este aviso'}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        )
                    })
                )}
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
    pollTitle: { fontSize: 18, fontWeight: 'bold', color: '#1E3A5F', flex: 1, marginBottom: 8 },
    metaText: { fontSize: 13, color: '#3B82F6', fontWeight: '500', marginBottom: 6 },
    expiredBanner: { backgroundColor: '#FEF3C7', padding: 8, borderRadius: 6, marginBottom: 12 },
    expiredText: { color: '#D97706', fontSize: 13, fontWeight: '600' },
    pollOptions: { marginTop: 8 },
    pollOptionBtn: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, padding: 12, marginBottom: 8, alignItems: 'center', position: 'relative', overflow: 'hidden' },
    pollOptionBtnSelected: { borderColor: '#3B82F6', backgroundColor: '#EFF6FF', borderWidth: 2 },
    pollOptionText: { fontSize: 15, color: '#334155', fontWeight: '500', zIndex: 2 },
    pollOptionTextSelected: { color: '#1D4ED8', fontWeight: 'bold' },
    pollResultFillBg: { position: 'absolute', top: 0, left: 0, bottom: 0, backgroundColor: '#BFDBFE', opacity: 0.3, zIndex: 1 },
    pollResultBox: { backgroundColor: '#F1F5F9', borderRadius: 8, marginBottom: 8, overflow: 'hidden', position: 'relative', minHeight: 44, justifyContent: 'center' },
    pollResultBoxMyVote: { borderWidth: 2, borderColor: '#3B82F6' },
    pollResultFill: { position: 'absolute', top: 0, left: 0, bottom: 0, backgroundColor: '#BFDBFE' },
    pollResultContent: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, position: 'absolute', width: '100%' },
    pollResultText: { fontSize: 15, color: '#1E3A5F', fontWeight: '600' },
    pollResultStat: { fontSize: 14, color: '#1E3A5F', fontWeight: '700' },
    pollFooter: { fontSize: 12, color: '#94A3B8', textAlign: 'right', marginTop: 4 },
    date: { fontSize: 12, color: '#94A3B8' },
    body: { fontSize: 14, color: '#475569', lineHeight: 20, marginBottom: 12 },
    ttsBtn: { backgroundColor: '#EFF6FF', borderRadius: 8, padding: 10, alignItems: 'center' },
    ttsBtnActive: { backgroundColor: '#DC2626' },
    ttsText: { color: '#2563EB', fontWeight: '600', fontSize: 14 },
    ttsTextActive: { color: '#FFFFFF' },
    empty: { alignItems: 'center', paddingVertical: 40 },
    emptyText: { fontSize: 16, color: '#94A3B8' },
    expandBtn: { paddingVertical: 8, marginBottom: 4 },
    expandBtnText: { color: '#2563EB', fontSize: 14, fontWeight: '600' },
    repliesContainer: { marginTop: 8, borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 12 },
    replyBubble: { backgroundColor: '#F8FAFC', padding: 10, borderRadius: 12, marginBottom: 8 },
    replyHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    replyName: { fontSize: 12, fontWeight: '600', color: '#334155' },
    replyDate: { fontSize: 11, color: '#94A3B8' },
    replyMessage: { fontSize: 13, color: '#475569' },
    replyInputContainer: { marginTop: 12, backgroundColor: '#F8FAFC', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' },
    mediaBtns: { flexDirection: 'row', marginBottom: 8 },
    mediaBtn: { backgroundColor: '#E2E8F0', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginRight: 8 },
    replyInput: { backgroundColor: '#FFFFFF', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#CBD5E1', fontSize: 14, minHeight: 60, textAlignVertical: 'top', marginBottom: 8 },
    replyActions: { flexDirection: 'row', justifyContent: 'flex-end' },
    cancelBtn: { paddingVertical: 8, paddingHorizontal: 12, marginRight: 8 },
    cancelText: { color: '#64748B', fontSize: 14, fontWeight: '600' },
    sendBtn: { backgroundColor: '#2563EB', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
    sendText: { color: '#FFFFFF', fontSize: 14, fontWeight: 'bold' },
    startReplyBtn: { backgroundColor: '#F1F5F9', paddingVertical: 10, borderRadius: 8, alignItems: 'center', marginTop: 12, marginBottom: 8 },
    startReplyText: { color: '#64748B', fontSize: 14, fontWeight: '500' },
    replyMediaContainer: { marginTop: 8, borderRadius: 8, overflow: 'hidden' },
    replyImage: { width: '100%', height: 150, borderRadius: 8 },
    replyVideo: { backgroundColor: '#000', padding: 20, alignItems: 'center', borderRadius: 8 },
    replyAudio: { backgroundColor: '#DBEAFE', padding: 10, alignItems: 'center', borderRadius: 8, borderWidth: 1, borderColor: '#93C5FD' },
    selectedMediaPreview: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F1F5F9', padding: 8, borderRadius: 6, marginBottom: 8 },
    selectedMediaText: { fontSize: 12, color: '#475569', fontWeight: '500' },
    tabs: { flexDirection: 'row', backgroundColor: '#FFFFFF', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 5, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
    tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
    tabActive: { borderBottomColor: '#2563EB' },
    tabText: { fontSize: 16, fontWeight: '600', color: '#64748B' },
    tabTextActive: { color: '#2563EB' },
});
