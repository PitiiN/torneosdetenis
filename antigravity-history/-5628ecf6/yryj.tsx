import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '../../lib/store';
import { pushService } from '../../services/pushService';

export default function ManageAnnouncementsScreen() {
    const { announcements, addAnnouncement, removeAnnouncement, updateAnnouncement, polls, addPoll, removePoll } = useAppStore();
    const [showForm, setShowForm] = useState(false);
    const [formType, setFormType] = useState<'aviso' | 'encuesta'>('aviso');
    const [editId, setEditId] = useState<string | null>(null);
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [location, setLocation] = useState('');
    const [schedule, setSchedule] = useState('');
    const [priority, setPriority] = useState<'normal' | 'important'>('normal');

    // Poll fields
    const [pollQuestion, setPollQuestion] = useState('');
    const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
    const [pollDeadline, setPollDeadline] = useState('');

    const [sendPush, setSendPush] = useState(false);

    const startEdit = (a: any) => {
        setEditId(a.id); setTitle(a.title); setBody(a.body); setPriority(a.priority);
        setLocation(a.location || ''); setSchedule(a.schedule || '');
        setSendPush(false); setShowForm(true);
    };

    const handleSave = async () => {
        if (formType === 'aviso') {
            if (!title.trim() || !body.trim()) { Alert.alert('Error', 'Completa título y contenido.'); return; }
            if (editId) {
                updateAnnouncement(editId, { title, body, priority, location, schedule });
                Alert.alert('✅ Aviso actualizado');
            } else {
                addAnnouncement({ title, body, priority, location, schedule });
                if (sendPush) await pushService.broadcastPushNotification(`📣 ${title}`, body, { type: 'announcement' });
                Alert.alert('✅ Aviso publicado', sendPush ? 'Se ha enviado Notificación Push.' : '');
            }
        } else {
            // Save Poll
            const validOptions = pollOptions.filter(o => o.trim() !== '');
            if (!pollQuestion.trim() || validOptions.length < 2 || !pollDeadline.trim()) {
                Alert.alert('Error', 'Completa la pregunta, fecha límite y al menos 2 opciones.'); return;
            }
            addPoll({
                question: pollQuestion,
                deadline: pollDeadline,
                options: validOptions.map(text => ({ id: Math.random().toString(), text, votes: 0 })),
                pushEnabled: sendPush
            });
            if (sendPush) await pushService.broadcastPushNotification(`📊 Nueva Encuesta`, pollQuestion, { type: 'poll' });
            Alert.alert('✅ Encuesta publicada', sendPush ? 'Se ha enviado Notificación Push.' : '');
        }

        setTitle(''); setBody(''); setLocation(''); setSchedule(''); setPriority('normal');
        setPollQuestion(''); setPollOptions(['', '']); setPollDeadline('');
        setSendPush(false); setShowForm(false); setEditId(null);
    };

    const handleDelete = (id: string, name: string, isPoll = false) => {
        Alert.alert('¿Eliminar?', `"${name}" será eliminado permanentemente.`, [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Eliminar', style: 'destructive', onPress: () => isPoll ? removePoll(id) : removeAnnouncement(id) },
        ]);
    };

    const cancelForm = () => {
        setShowForm(false); setEditId(null); setTitle(''); setBody(''); setLocation(''); setSchedule(''); setPriority('normal');
        setPollQuestion(''); setPollOptions(['', '']); setPollDeadline('');
    };

    return (
        <SafeAreaView style={s.safe}>
            <ScrollView contentContainerStyle={s.scroll}>
                <Text style={s.title}>📢 Gestionar Avisos</Text>
                <TouchableOpacity style={s.newBtn} onPress={() => showForm ? cancelForm() : setShowForm(true)}>
                    <Text style={s.newBtnText}>{showForm ? '✕ Cancelar' : '+ Nuevo Aviso'}</Text>
                </TouchableOpacity>
                {showForm && (
                    <View style={s.form}>
                        <View style={s.typeSelector}>
                            <TouchableOpacity style={[s.typeBtn, formType === 'aviso' && s.typeActive]} onPress={() => setFormType('aviso')}>
                                <Text style={[s.typeText, formType === 'aviso' && s.typeTextActive]}>📢 Aviso</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[s.typeBtn, formType === 'encuesta' && s.typeActive]} onPress={() => setFormType('encuesta')}>
                                <Text style={[s.typeText, formType === 'encuesta' && s.typeTextActive]}>📊 Encuesta</Text>
                            </TouchableOpacity>
                        </View>

                        <Text style={s.formTitle}>{editId ? '✏️ Editar Publicación' : `📝 nuev${formType === 'aviso' ? 'o Aviso' : 'a Encuesta'}`}</Text>

                        {formType === 'aviso' ? (
                            <>
                                <Text style={s.label}>Título</Text>
                                <TextInput style={s.input} placeholder="Título del aviso" placeholderTextColor="#94A3B8" value={title} onChangeText={setTitle} />

                                <Text style={s.label}>Fecha y Horario</Text>
                                <TextInput style={s.input} placeholder="Ej: Sábado a las 10:00 hrs" placeholderTextColor="#94A3B8" value={schedule} onChangeText={setSchedule} />

                                <Text style={s.label}>Lugar</Text>
                                <TextInput style={s.input} placeholder="Ej: Sede Vecinal" placeholderTextColor="#94A3B8" value={location} onChangeText={setLocation} />

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
                            </>
                        ) : (
                            <>
                                <Text style={s.label}>Pregunta</Text>
                                <TextInput style={s.input} placeholder="¿Qué día prefieres para la reunión?" placeholderTextColor="#94A3B8" value={pollQuestion} onChangeText={setPollQuestion} />
                                <Text style={s.label}>Fecha Límite (Deadline)</Text>
                                <TextInput style={s.input} placeholder="Ej: 2026-03-10" placeholderTextColor="#94A3B8" value={pollDeadline} onChangeText={setPollDeadline} />
                                <Text style={s.label}>Opciones</Text>
                                {pollOptions.map((opt, i) => (
                                    <TextInput key={i} style={[s.input, { marginBottom: 8 }]} placeholder={`Opción ${i + 1}`} placeholderTextColor="#94A3B8" value={opt} onChangeText={(text) => {
                                        const newOpts = [...pollOptions]; newOpts[i] = text; setPollOptions(newOpts);
                                    }} />
                                ))}
                                <TouchableOpacity onPress={() => setPollOptions([...pollOptions, ''])}>
                                    <Text style={{ color: '#2563EB', fontWeight: 'bold', marginTop: 4 }}>+ Añadir opción</Text>
                                </TouchableOpacity>
                            </>
                        )}

                        {!editId && (
                            <View style={s.pushToggleRow}>
                                <Text style={s.pushToggleLabel}>🔔 ¿Enviar Notificación Push a los vecinos?</Text>
                                <Switch value={sendPush} onValueChange={setSendPush} trackColor={{ false: '#CBD5E1', true: '#22C55E' }} thumbColor="#FFFFFF" />
                            </View>
                        )}

                        <TouchableOpacity style={s.submitBtn} onPress={handleSave}>
                            <Text style={s.submitText}>{editId ? '💾 Guardar Cambios' : '📤 Publicar'}</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {polls.length > 0 && (
                    <>
                        <Text style={s.section}>Encuestas Activas ({polls.length})</Text>
                        {polls.map(p => (
                            <View key={p.id} style={s.card}>
                                <Text style={s.cardTitle}>📊 {p.question}</Text>
                                <Text style={s.cardMeta}>Cierra: {p.deadline}</Text>
                                <View style={s.cardFooter}>
                                    <View style={[s.pBadge, { backgroundColor: '#EFF6FF' }]}>
                                        <Text style={{ color: '#2563EB', fontSize: 11, fontWeight: '600' }}>{p.votedBy.length} votos</Text>
                                    </View>
                                    <View style={s.cardActions}>
                                        <TouchableOpacity onPress={() => handleDelete(p.id, p.question, true)} style={s.deleteBtn}><Text style={s.deleteText}>🗑️</Text></TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        ))}
                    </>
                )}

                <Text style={s.section}>Avisos activos ({announcements.length})</Text>
                {announcements.map(a => (
                    <View key={a.id} style={s.card}>
                        <Text style={s.cardTitle}>{a.title}</Text>
                        {(a.schedule || a.location) && (
                            <Text style={s.cardMeta}>
                                {a.schedule && `🗓 ${a.schedule}`} {a.schedule && a.location && ' • '} {a.location && `📍 ${a.location}`}
                            </Text>
                        )}
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
    typeSelector: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 10, padding: 4, marginBottom: 16 },
    typeBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
    typeActive: { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
    typeText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
    typeTextActive: { color: '#0F172A' },
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
    pushToggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 8, padding: 12, backgroundColor: '#F8FAFC', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0' },
    pushToggleLabel: { fontSize: 14, fontWeight: '600', color: '#1E3A5F', flex: 1 },
    section: { fontSize: 16, fontWeight: 'bold', color: '#64748B', marginBottom: 10 },
    card: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginBottom: 10, elevation: 1 },
    cardTitle: { fontSize: 15, fontWeight: 'bold', color: '#0F172A' },
    cardMeta: { fontSize: 12, color: '#3B82F6', marginTop: 4, fontWeight: '500' },
    cardBody: { fontSize: 13, color: '#64748B', marginTop: 4 },
    cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
    pBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
    cardActions: { flexDirection: 'row', gap: 8 },
    editBtn: { padding: 6 }, editText: { fontSize: 18 },
    deleteBtn: { padding: 6 }, deleteText: { fontSize: 18 },
});
