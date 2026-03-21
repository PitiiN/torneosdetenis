import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';

export default function AdminDocumentsScreen() {
    const [showUpload, setShowUpload] = useState(false);
    const [title, setTitle] = useState('');
    const [docType, setDocType] = useState('Acta');
    const [fileName, setFileName] = useState('');

    const documents = [
        { id: '1', title: 'Acta Reunión Febrero 2026', type: 'Acta', date: '15 Feb 2026', emoji: '📋' },
        { id: '2', title: 'Reglamento Interno JJVV', type: 'Reglamento', date: '01 Ene 2026', emoji: '📖' },
        { id: '3', title: 'Balance Financiero 2025', type: 'Finanzas', date: '31 Dic 2025', emoji: '💰' },
    ];

    const types = ['Acta', 'Reglamento', 'Finanzas', 'Legal', 'Seguridad', 'Otro'];

    const pickDocument = async () => {
        const result = await DocumentPicker.getDocumentAsync({ type: '*/*' });
        if (!result.canceled && result.assets[0]) {
            setFileName(result.assets[0].name);
        }
    };

    const handleUpload = () => {
        if (!title || !fileName) {
            Alert.alert('Error', 'Completa el título y selecciona un archivo.');
            return;
        }
        Alert.alert('✅ Documento subido', `"${title}" se ha publicado correctamente.`);
        setShowUpload(false);
        setTitle('');
        setFileName('');
    };

    return (
        <SafeAreaView style={s.safe}>
            <ScrollView contentContainerStyle={s.scroll}>
                <Text style={s.title}>📁 Gestionar Documentos</Text>

                <TouchableOpacity style={s.uploadBtn} onPress={() => setShowUpload(!showUpload)}>
                    <Text style={s.uploadBtnText}>{showUpload ? '✕ Cancelar' : '📤 Subir Documento'}</Text>
                </TouchableOpacity>

                {showUpload && (
                    <View style={s.form}>
                        <Text style={s.label}>Título del documento</Text>
                        <TextInput style={s.input} placeholder="Ej: Acta Reunión Marzo" placeholderTextColor="#64748B" value={title} onChangeText={setTitle} />

                        <Text style={s.label}>Tipo</Text>
                        <View style={s.typeRow}>
                            {types.map(t => (
                                <TouchableOpacity key={t} style={[s.typeChip, docType === t && s.typeChipActive]} onPress={() => setDocType(t)}>
                                    <Text style={[s.typeChipText, docType === t && s.typeChipTextActive]}>{t}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={s.label}>Archivo</Text>
                        <TouchableOpacity style={s.fileBtn} onPress={pickDocument}>
                            <Text style={s.fileBtnText}>{fileName || '📎 Seleccionar archivo...'}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={s.submitBtn} onPress={handleUpload}>
                            <Text style={s.submitBtnText}>Publicar Documento</Text>
                        </TouchableOpacity>
                    </View>
                )}

                <Text style={s.section}>Documentos publicados</Text>
                {documents.map(doc => (
                    <View key={doc.id} style={s.card}>
                        <Text style={s.emoji}>{doc.emoji}</Text>
                        <View style={s.info}>
                            <Text style={s.docTitle}>{doc.title}</Text>
                            <Text style={s.meta}>{doc.type} • {doc.date}</Text>
                        </View>
                        <TouchableOpacity><Text style={s.delete}>🗑️</Text></TouchableOpacity>
                    </View>
                ))}
            </ScrollView>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#0F172A' },
    scroll: { padding: 20 },
    title: { fontSize: 24, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 16 },
    uploadBtn: { backgroundColor: '#2563EB', borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 16 },
    uploadBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 },
    form: { backgroundColor: '#1E293B', borderRadius: 14, padding: 16, marginBottom: 20 },
    label: { fontSize: 13, fontWeight: '600', color: '#94A3B8', marginBottom: 6, marginTop: 10 },
    input: { backgroundColor: '#334155', borderRadius: 10, padding: 12, fontSize: 15, color: '#F1F5F9' },
    typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    typeChip: { backgroundColor: '#334155', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
    typeChipActive: { backgroundColor: '#2563EB' },
    typeChipText: { color: '#94A3B8', fontSize: 13 },
    typeChipTextActive: { color: '#FFFFFF', fontWeight: '600' },
    fileBtn: { backgroundColor: '#334155', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#475569', borderStyle: 'dashed' },
    fileBtnText: { color: '#94A3B8', fontSize: 14 },
    submitBtn: { backgroundColor: '#22C55E', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 16 },
    submitBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 },
    section: { fontSize: 16, fontWeight: 'bold', color: '#94A3B8', marginBottom: 10, marginTop: 8 },
    card: { backgroundColor: '#1E293B', borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center' },
    emoji: { fontSize: 24, marginRight: 12 },
    info: { flex: 1 },
    docTitle: { fontSize: 14, fontWeight: '600', color: '#F1F5F9' },
    meta: { fontSize: 12, color: '#64748B', marginTop: 2 },
    delete: { fontSize: 18 },
});
