import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function DocumentsScreen({ navigation }: any) {
    const documents = [
        { id: '1', title: 'Acta Reunión Febrero 2026', type: 'Acta', date: '15 Feb 2026', emoji: '📋' },
        { id: '2', title: 'Reglamento Interno JJVV', type: 'Reglamento', date: '01 Ene 2026', emoji: '📖' },
        { id: '3', title: 'Balance Financiero 2025', type: 'Finanzas', date: '31 Dic 2025', emoji: '💰' },
        { id: '4', title: 'Plan de Seguridad Barrial', type: 'Seguridad', date: '20 Nov 2025', emoji: '🔒' },
        { id: '5', title: 'Certificado de Vigencia', type: 'Legal', date: '10 Oct 2025', emoji: '📜' },
    ];

    return (
        <SafeAreaView style={s.safe}>
            <ScrollView contentContainerStyle={s.scroll}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={s.back}>
                    <Text style={s.backText}>← Volver</Text>
                </TouchableOpacity>
                <Text style={s.title}>📁 Documentos</Text>
                <Text style={s.subtitle}>Archivos compartidos por la directiva</Text>

                {documents.map(doc => (
                    <TouchableOpacity key={doc.id} style={s.card} activeOpacity={0.7}>
                        <Text style={s.emoji}>{doc.emoji}</Text>
                        <View style={s.info}>
                            <Text style={s.docTitle}>{doc.title}</Text>
                            <View style={s.meta}>
                                <View style={s.badge}><Text style={s.badgeText}>{doc.type}</Text></View>
                                <Text style={s.date}>{doc.date}</Text>
                            </View>
                        </View>
                        <Text style={s.download}>📥</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#F8FAFC' },
    scroll: { padding: 20 },
    back: { marginBottom: 16 },
    backText: { color: '#2563EB', fontSize: 16, fontWeight: '600' },
    title: { fontSize: 24, fontWeight: 'bold', color: '#1E3A5F', marginBottom: 4 },
    subtitle: { fontSize: 14, color: '#64748B', marginBottom: 20 },
    card: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', elevation: 2 },
    emoji: { fontSize: 28, marginRight: 12 },
    info: { flex: 1 },
    docTitle: { fontSize: 15, fontWeight: '600', color: '#0F172A' },
    meta: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    badge: { backgroundColor: '#EFF6FF', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginRight: 8 },
    badgeText: { fontSize: 11, color: '#2563EB', fontWeight: '600' },
    date: { fontSize: 11, color: '#94A3B8' },
    download: { fontSize: 22 },
});
