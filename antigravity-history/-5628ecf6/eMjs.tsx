import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '../../lib/store';
import { pushService } from '../../services/pushService';

export default function ManageAnnouncementsScreen() {
    const { announcements, addAnnouncement, removeAnnouncement, updateAnnouncement } = useAppStore();
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [priority, setPriority] = useState<'normal' | 'important'>('normal');
    const [sendPush, setSendPush] = useState(false);

    const startEdit = (a: any) => {
        setEditId(a.id); setTitle(a.title); setBody(a.body); setPriority(a.priority); setSendPush(false); setShowForm(true);
    };

    const handleSave = async () => {
        if (!title.trim() || !body.trim()) { Alert.alert('Error', 'Completa título y contenido.'); return; }
        if (editId) {
            updateAnnouncement(editId, { title, body, priority });
            Alert.alert('✅ Aviso actualizado');
        } else {
            addAnnouncement({ title, body, priority });
            if (sendPush) {
                await pushService.broadcastPushNotification(`📣 ${title}`, body, { type: 'announcement' });
            }
            Alert.alert('✅ Aviso publicado', sendPush ? 'Se ha enviado una notificación Push a los usuarios.' : '');
        }
        setTitle(''); setBody(''); setPriority('normal'); setSendPush(false); setShowForm(false); setEditId(null);
    };

    const handleDelete = (id: string, name: string) => {
        Alert.alert('¿Eliminar aviso?', `"${name}" será eliminado permanentemente.`, [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Eliminar', style: 'destructive', onPress: () => removeAnnouncement(id) },
        ]);
    };

    const cancelForm = () => { setShowForm(false); setEditId(null); setTitle(''); setBody(''); setPriority('normal'); };

    return (
        <SafeAreaView style={s.safe}>
            <ScrollView contentContainerStyle={s.scroll}>
                <Text style={s.title}>📢 Gestionar Avisos</Text>
                <TouchableOpacity style={s.newBtn} onPress={() => showForm ? cancelForm() : setShowForm(true)}>
                    <Text style={s.newBtnText}>{showForm ? '✕ Cancelar' : '+ Nuevo Aviso'}</Text>
                </TouchableOpacity>
                {showForm && (
                    <View style={s.form}>
                        <Text style={s.formTitle}>{editId ? '✏️ Editar Aviso' : '📝 Nuevo Aviso'}</Text>
                        <Text style={s.label}>Título</Text>
                        <TextInput style={s.input} placeholder="Título del aviso" placeholderTextColor="#94A3B8" value={title} onChangeText={setTitle} />
                        <Text style={s.label}>Contenido</Text>
                        <TextInput style={[s.input, s.multiline]} placeholder="Escribe el contenido..." placeholderTextColor="#94A3B8" value={body} onChangeText={setBody} multiline numberOfLines={4} textAlignVertical="top" />
                        <Text style={s.label}>Prioridad</Text>
                        <View style={s.prioRow}>
                            <TouchableOpacity style={[s.prioChip, priority === 'normal' && s.prioActive]} onPress={() => setPriority('normal')}>
                                <Text style={[s.prioText, priority === 'normal' && s.prioTextActive]}>🟢 Normal</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[s.prioChip, priority === 'important' && s.prioImportant]} onPress={() => setPriority('important')}>
                                <Text style={[s.prioText, priority === 'important' && s.prioTextActive]}>🔴 Importante</Text>
                            </TouchableOpacity>
                        </View>

                        {!editId && (
                            <View style={s.pushToggleRow}>
                                <Text style={s.pushToggleLabel}>🔔 ¿Enviar Notificación Push a los vecinos?</Text>
                                <Switch value={sendPush} onValueChange={setSendPush} trackColor={{ false: '#CBD5E1', true: '#22C55E' }} thumbColor="#FFFFFF" />
                            </View>
                        )}

                        <TouchableOpacity style={s.submitBtn} onPress={handleSave}>
                            <Text style={s.submitText}>{editId ? '💾 Guardar Cambios' : '📤 Publicar Aviso'}</Text>
                        </TouchableOpacity>
                    </View>
                )}
                <Text style={s.section}>Avisos activos ({announcements.length})</Text>
                {announcements.map(a => (
                    <View key={a.id} style={s.card}>
                        <Text style={s.cardTitle}>{a.title}</Text>
                        <Text style={s.cardBody} numberOfLines={2}>{a.body}</Text>
                        <View style={s.cardFooter}>
                            <View style={[s.pBadge, { backgroundColor: a.priority === 'important' ? '#FEF2F2' : '#F0FDF4' }]}>
                                <Text style={{ color: a.priority === 'important' ? '#EF4444' : '#22C55E', fontSize: 11, fontWeight: '600' }}>
                                    {a.priority === 'important' ? '🔴 Importante' : '🟢 Normal'}
                                </Text>
                            </View>
                            <View style={s.cardActions}>
                                <TouchableOpacity onPress={() => startEdit(a)} style={s.editBtn}><Text style={s.editText}>✏️</Text></TouchableOpacity>
                                <TouchableOpacity onPress={() => handleDelete(a.id, a.title)} style={s.deleteBtn}><Text style={s.deleteText}>🗑️</Text></TouchableOpacity>
                            </View>
                        </View>
                    </View>
                ))}
            </ScrollView>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: 'transparent' }, scroll: { padding: 20 },
    title: { fontSize: 24, fontWeight: 'bold', color: '#1E3A5F', marginBottom: 16 },
    newBtn: { backgroundColor: '#2563EB', borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 16 },
    newBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 },
    form: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 20, elevation: 2 },
    formTitle: { fontSize: 18, fontWeight: 'bold', color: '#1E3A5F', marginBottom: 8 },
    label: { fontSize: 13, fontWeight: '600', color: '#64748B', marginBottom: 6, marginTop: 10 },
    input: { backgroundColor: 'transparent', borderRadius: 10, padding: 12, fontSize: 15, color: '#0F172A', borderWidth: 1, borderColor: '#E2E8F0' },
    multiline: { minHeight: 80 },
    prioRow: { flexDirection: 'row', gap: 8 },
    prioChip: { flex: 1, backgroundColor: 'transparent', borderRadius: 8, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
    prioActive: { backgroundColor: '#F0FDF4', borderColor: '#22C55E' },
    prioImportant: { backgroundColor: '#FEF2F2', borderColor: '#EF4444' },
    prioText: { fontSize: 13, color: '#64748B' }, prioTextActive: { fontWeight: '700', color: '#0F172A' },
    submitBtn: { backgroundColor: '#22C55E', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 16 },
    submitText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 },
    section: { fontSize: 16, fontWeight: 'bold', color: '#64748B', marginBottom: 10 },
    card: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginBottom: 10, elevation: 1 },
    cardTitle: { fontSize: 15, fontWeight: 'bold', color: '#0F172A' },
    cardBody: { fontSize: 13, color: '#64748B', marginTop: 4 },
    cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
    pBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
    cardActions: { flexDirection: 'row', gap: 8 },
    editBtn: { padding: 6 }, editText: { fontSize: 18 },
    deleteBtn: { padding: 6 }, deleteText: { fontSize: 18 },
});
