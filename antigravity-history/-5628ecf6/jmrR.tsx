import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '../../lib/store';

export default function ManageAnnouncementsScreen() {
    const { announcements, addAnnouncement } = useAppStore();
    const [showForm, setShowForm] = useState(false);
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [priority, setPriority] = useState<'normal' | 'important'>('normal');

    const handleCreate = () => {
        if (!title.trim() || !body.trim()) { Alert.alert('Error', 'Completa título y contenido.'); return; }
        addAnnouncement({ title, body, priority });
        Alert.alert('✅ Aviso publicado', 'El aviso es visible para todos los vecinos.');
        setTitle(''); setBody(''); setPriority('normal'); setShowForm(false);
    };

    return (
        <SafeAreaView style={s.safe}>
            <ScrollView contentContainerStyle={s.scroll}>
                <Text style={s.title}>📢 Gestionar Avisos</Text>

                <TouchableOpacity style={s.newBtn} onPress={() => setShowForm(!showForm)}>
                    <Text style={s.newBtnText}>{showForm ? '✕ Cancelar' : '+ Nuevo Aviso'}</Text>
                </TouchableOpacity>

                {showForm && (
                    <View style={s.form}>
                        <Text style={s.label}>Título</Text>
                        <TextInput style={s.input} placeholder="Título del aviso" placeholderTextColor="#64748B" value={title} onChangeText={setTitle} />
                        <Text style={s.label}>Contenido</Text>
                        <TextInput style={[s.input, s.multiline]} placeholder="Escribe el contenido..." placeholderTextColor="#64748B" value={body} onChangeText={setBody} multiline numberOfLines={4} textAlignVertical="top" />
                        <Text style={s.label}>Prioridad</Text>
                        <View style={s.prioRow}>
                            <TouchableOpacity style={[s.prioChip, priority === 'normal' && s.prioActive]} onPress={() => setPriority('normal')}>
                                <Text style={[s.prioText, priority === 'normal' && s.prioTextActive]}>🟢 Normal</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[s.prioChip, priority === 'important' && s.prioImportant]} onPress={() => setPriority('important')}>
                                <Text style={[s.prioText, priority === 'important' && s.prioTextActive]}>🔴 Importante</Text>
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity style={s.submitBtn} onPress={handleCreate}>
                            <Text style={s.submitText}>📤 Publicar Aviso</Text>
                        </TouchableOpacity>
                    </View>
                )}

                <Text style={s.section}>Avisos activos ({announcements.length})</Text>
                {announcements.map(a => (
                    <View key={a.id} style={s.card}>
                        <Text style={s.cardTitle}>{a.title}</Text>
                        <Text style={s.cardBody} numberOfLines={2}>{a.body}</Text>
                        <View style={s.cardMeta}>
                            <View style={[s.pBadge, { backgroundColor: a.priority === 'important' ? '#FEF2F2' : '#F0FDF4' }]}>
                                <Text style={{ color: a.priority === 'important' ? '#EF4444' : '#22C55E', fontSize: 11, fontWeight: '600' }}>
                                    {a.priority === 'important' ? '🔴 Importante' : '🟢 Normal'}
                                </Text>
                            </View>
                            <Text style={s.cardDate}>{a.date}</Text>
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
    newBtn: { backgroundColor: '#2563EB', borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 16 },
    newBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 },
    form: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 20, elevation: 2 },
    label: { fontSize: 13, fontWeight: '600', color: '#64748B', marginBottom: 6, marginTop: 10 },
    input: { backgroundColor: '#F8FAFC', borderRadius: 10, padding: 12, fontSize: 15, color: '#0F172A', borderWidth: 1, borderColor: '#E2E8F0' },
    multiline: { minHeight: 80 },
    prioRow: { flexDirection: 'row', gap: 8 },
    prioChip: { flex: 1, backgroundColor: '#F8FAFC', borderRadius: 8, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
    prioActive: { backgroundColor: '#F0FDF4', borderColor: '#22C55E' },
    prioImportant: { backgroundColor: '#FEF2F2', borderColor: '#EF4444' },
    prioText: { fontSize: 13, color: '#64748B' },
    prioTextActive: { fontWeight: '700', color: '#0F172A' },
    submitBtn: { backgroundColor: '#22C55E', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 16 },
    submitText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 },
    section: { fontSize: 16, fontWeight: 'bold', color: '#64748B', marginBottom: 10 },
    card: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginBottom: 10, elevation: 1 },
    cardTitle: { fontSize: 15, fontWeight: 'bold', color: '#0F172A' },
    cardBody: { fontSize: 13, color: '#64748B', marginTop: 4 },
    cardMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
    pBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
    cardDate: { fontSize: 11, color: '#94A3B8' },
});
