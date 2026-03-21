import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';

export default function SolicitudesScreen({ navigation }: any) {
    const [description, setDescription] = useState('');
    const [image, setImage] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permisos', 'Se necesitan permisos para acceder a la galería.');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            quality: 0.7,
        });
        if (!result.canceled && result.assets[0]) {
            setImage(result.assets[0].uri);
        }
    };

    const takePhoto = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permisos', 'Se necesitan permisos para usar la cámara.');
            return;
        }
        const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            quality: 0.7,
        });
        if (!result.canceled && result.assets[0]) {
            setImage(result.assets[0].uri);
        }
    };

    const handleSubmit = () => {
        if (!description.trim()) {
            Alert.alert('Error', 'Escribe una descripción de tu solicitud.');
            return;
        }
        setLoading(true);
        setTimeout(() => {
            setLoading(false);
            Alert.alert('✅ Solicitud enviada', 'Tu solicitud ha sido registrada. Te notificaremos cuando haya una respuesta.', [
                { text: 'OK', onPress: () => { setDescription(''); setImage(null); navigation.goBack(); } }
            ]);
        }, 1000);
    };

    return (
        <SafeAreaView style={s.safe}>
            <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
                <TouchableOpacity onPress={() => navigation.goBack()} style={s.back}>
                    <Text style={s.backText}>← Volver</Text>
                </TouchableOpacity>

                <Text style={s.title}>📝 Nueva Solicitud</Text>
                <Text style={s.subtitle}>Cuéntanos qué necesitas o qué problema detectaste</Text>

                <Text style={s.label}>Descripción</Text>
                <TextInput
                    style={s.textArea}
                    placeholder="Describe tu solicitud, problema o sugerencia..."
                    placeholderTextColor="#94A3B8"
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    numberOfLines={5}
                    textAlignVertical="top"
                />

                <Text style={s.label}>Adjuntar imagen (opcional)</Text>
                <View style={s.imageRow}>
                    <TouchableOpacity style={s.imageBtn} onPress={pickImage}>
                        <Text style={s.imageBtnEmoji}>🖼️</Text>
                        <Text style={s.imageBtnText}>Galería</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.imageBtn} onPress={takePhoto}>
                        <Text style={s.imageBtnEmoji}>📷</Text>
                        <Text style={s.imageBtnText}>Cámara</Text>
                    </TouchableOpacity>
                </View>

                {image && (
                    <View style={s.preview}>
                        <Image source={{ uri: image }} style={s.previewImg} />
                        <TouchableOpacity onPress={() => setImage(null)} style={s.removeImg}>
                            <Text style={s.removeText}>✕</Text>
                        </TouchableOpacity>
                    </View>
                )}

                <TouchableOpacity
                    style={[s.submitBtn, loading && s.submitDisabled]}
                    onPress={handleSubmit}
                    disabled={loading}
                >
                    <Text style={s.submitText}>{loading ? 'Enviando...' : '📤 Enviar Solicitud'}</Text>
                </TouchableOpacity>
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
    label: { fontSize: 14, fontWeight: '600', color: '#334155', marginBottom: 8, marginTop: 16 },
    textArea: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, fontSize: 16, color: '#0F172A', borderWidth: 1, borderColor: '#E2E8F0', minHeight: 120, elevation: 1 },
    imageRow: { flexDirection: 'row', gap: 12 },
    imageBtn: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0', borderStyle: 'dashed', elevation: 1 },
    imageBtnEmoji: { fontSize: 28, marginBottom: 4 },
    imageBtnText: { fontSize: 13, color: '#64748B', fontWeight: '500' },
    preview: { marginTop: 12, borderRadius: 12, overflow: 'hidden', position: 'relative' },
    previewImg: { width: '100%', height: 200, borderRadius: 12 },
    removeImg: { position: 'absolute', top: 8, right: 8, backgroundColor: '#EF4444', width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    removeText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 },
    submitBtn: { backgroundColor: '#2563EB', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24, marginBottom: 40 },
    submitDisabled: { opacity: 0.6 },
    submitText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
});
