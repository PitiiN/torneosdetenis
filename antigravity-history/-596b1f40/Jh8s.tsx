import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '../../lib/store';
import { useAuth } from '../../context/AuthContext';

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

function formatDate(iso: string) {
    const d = new Date(iso);
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    return `${days[d.getDay()]} ${d.getDate()} de ${MONTHS[d.getMonth()]}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function EventsScreen() {
    const { user, viewMode } = useAuth();
    const allEvents = useAppStore(s => s.events);
    const addEvent = useAppStore(s => s.addEvent);
    const updateEvent = useAppStore(s => s.updateEvent);
    const removeEvent = useAppStore(s => s.removeEvent);

    const now = new Date();
    const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
    const [selectedYear] = useState(now.getFullYear());

    // Add/Edit Event State
    const [showForm, setShowForm] = useState(false);
    const [editingEventId, setEditingEventId] = useState<string | null>(null);
    const [title, setTitle] = useState('');
    const [location, setLocation] = useState('');
    const [emoji, setEmoji] = useState('📅');
    const [dateText, setDateText] = useState('2026-03-01T12:00'); // simple string for MVP

    const filteredEvents = allEvents.filter(e => e.month === selectedMonth);

    const prevMonth = () => setSelectedMonth(m => m === 0 ? 11 : m - 1);
    const nextMonth = () => setSelectedMonth(m => m === 11 ? 0 : m + 1);

    const handleSave = () => {
        if (!title || !location || !dateText) return;
        const d = new Date(dateText);
        const eventData = {
            title,
            location,
            emoji,
            date: dateText,
            month: isNaN(d.getMonth()) ? selectedMonth : d.getMonth()
        };

        if (editingEventId) {
            updateEvent(editingEventId, eventData);
        } else {
            addEvent(eventData);
        }

        setShowForm(false);
        setEditingEventId(null);
        setTitle('');
        setLocation('');
    };

    const handleEdit = (event: any) => {
        setEditingEventId(event.id);
        setTitle(event.title);
        setLocation(event.location);
        setEmoji(event.emoji);
        setDateText(event.date);
        setShowForm(true);
    };

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

                {viewMode === 'admin' && (
                    <TouchableOpacity style={s.newBtn} onPress={() => {
                        if (showForm) {
                            setShowForm(false);
                            setEditingEventId(null);
                            setTitle('');
                            setLocation('');
                        } else {
                            setShowForm(true);
                            setEditingEventId(null);
                            setTitle('');
                            setLocation('');
                            setDateText(now.toISOString().substring(0, 16));
                        }
                    }}>
                        <Text style={s.newBtnText}>{showForm ? 'Cancelar' : '+ Agregar Evento'}</Text>
                    </TouchableOpacity>
                )}

                {showForm && (
                    <View style={s.form}>
                        <TextInput style={s.input} placeholder="Título" value={title} onChangeText={setTitle} />
                        <TextInput style={s.input} placeholder="Lugar" value={location} onChangeText={setLocation} />
                        <TextInput style={s.input} placeholder="Fecha ISO (ej: 2026-03-01T12:00)" value={dateText} onChangeText={setDateText} />
                        <TextInput style={s.input} placeholder="Emoji" value={emoji} onChangeText={setEmoji} />
                        <TouchableOpacity style={s.submitBtn} onPress={handleSave}>
                            <Text style={s.submitBtnText}>{editingEventId ? 'Actualizar Evento' : 'Guardar Evento'}</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {filteredEvents.length === 0 ? (
                    <View style={s.empty}>
                        <Text style={s.emptyEmoji}>📭</Text>
                        <Text style={s.emptyText}>No hay eventos para {MONTHS[selectedMonth]}</Text>
                    </View>
                ) : (
                    filteredEvents.map(e => (
                        <TouchableOpacity
                            key={e.id}
                            style={s.card}
                            activeOpacity={viewMode === 'admin' ? 0.7 : 1}
                            onPress={() => viewMode === 'admin' && handleEdit(e)}
                        >
                            <Text style={s.emoji}>{e.emoji}</Text>
                            <View style={s.info}>
                                <Text style={s.cardTitle}>{e.title}</Text>
                                <Text style={s.date}>{formatDate(e.date)}</Text>
                                <Text style={s.location}>📍 {e.location}</Text>
                            </View>
                            {viewMode === 'admin' && (
                                <TouchableOpacity onPress={() => removeEvent(e.id)} style={{ padding: 10 }}>
                                    <Text style={{ color: '#EF4444', fontWeight: 'bold' }}>✕</Text>
                                </TouchableOpacity>
                            )}
                        </TouchableOpacity>
                    ))
                )}
            </ScrollView>
        </SafeAreaView >
    );
}

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: 'transparent' },
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
    newBtn: { backgroundColor: '#2563EB', borderRadius: 12, padding: 12, alignItems: 'center', marginBottom: 12 },
    newBtnText: { color: '#FFFFFF', fontWeight: 'bold' },
    form: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 16, elevation: 1 },
    input: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, padding: 10, marginBottom: 8 },
    submitBtn: { backgroundColor: '#22C55E', borderRadius: 8, padding: 12, alignItems: 'center' },
    submitBtnText: { color: '#FFFFFF', fontWeight: 'bold' }
});
