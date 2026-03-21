import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../../context/AuthContext';
import { useAppStore } from '../../lib/store';

export default function AdminSettingsScreen({ navigation }: any) {
    const { signOut, setViewMode } = useAuth();
    const orgSettings = useAppStore(s => s.orgSettings);
    const updateOrgSettings = useAppStore(s => s.updateOrgSettings);

    const [name, setName] = useState(orgSettings.name);
    const [address, setAddress] = useState(orgSettings.address);
    const [phone, setPhone] = useState(orgSettings.phone);
    const [social, setSocial] = useState(orgSettings.social);
    const [editing, setEditing] = useState(false);

    const handleSave = () => {
        updateOrgSettings({ name, address, phone, social });
        setEditing(false);
        Alert.alert('✅ Guardado', 'La configuración se ha actualizado correctamente.');
    };

    const sendTestNotification = async () => {
        try {
            // Check and request permissions explicitly
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;

            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }

            if (finalStatus !== 'granted') {
                Alert.alert('Permiso Denegado', 'Debes habilitar las notificaciones para esta aplicación en los ajustes de tu teléfono para poder probarlas.');
                return;
            }

            await Notifications.scheduleNotificationAsync({
                content: {
                    title: '✅ ¡Prueba Local Exitosa!',
                    body: 'El sistema de notificaciones en tu teléfono está listo. Esta es una notificación de prueba.',
                    data: { test: true },
                    sound: true,
                },
                trigger: null, // Dispara inmediatamente
            });
            Alert.alert('Notificación programada 🚀', 'Se enviará una notificación en 2 segundos. Cierra o minimiza la aplicación rápidamente (si estás en iOS) para verla aparecer, o espera a que salte arriba en Android.');
        } catch (e: any) {
            Alert.alert('Error', 'Falló el envío de la notificación de prueba.\n' + e.message);
        }
    };

    return (
        <SafeAreaView style={s.safe}>
            <ScrollView contentContainerStyle={s.scroll}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={s.back}>
                    <Text style={s.backText}>← Volver</Text>
                </TouchableOpacity>
                <Text style={s.title}>⚙️ Configuración JJVV</Text>
                <Text style={s.subtitle}>Administra la información de tu organización</Text>

                <View style={s.card}>
                    <Text style={s.label}>Nombre de la organización</Text>
                    <TextInput style={s.input} value={name} onChangeText={setName} editable={editing} placeholder="Nombre JJVV" />
                </View>

                <View style={s.card}>
                    <Text style={s.label}>Dirección</Text>
                    <TextInput style={s.input} value={address} onChangeText={setAddress} editable={editing} placeholder="Dirección de la sede" />
                </View>

                <View style={s.card}>
                    <Text style={s.label}>Teléfono de contacto</Text>
                    <TextInput style={s.input} value={phone} onChangeText={setPhone} editable={editing} placeholder="Ej: +56 9 1234 5678" keyboardType="phone-pad" />
                </View>

                <View style={s.card}>
                    <Text style={s.label}>Redes sociales / Web</Text>
                    <TextInput style={s.input} value={social} onChangeText={setSocial} editable={editing} placeholder="Instagram, Facebook, etc." />
                </View>

                {editing ? (
                    <View style={s.btnRow}>
                        <TouchableOpacity style={s.saveBtn} onPress={handleSave}>
                            <Text style={s.saveBtnText}>💾 Guardar cambios</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={s.cancelBtn} onPress={() => { setEditing(false); setName(orgSettings.name); setAddress(orgSettings.address); setPhone(orgSettings.phone); setSocial(orgSettings.social); }}>
                            <Text style={s.cancelBtnText}>Cancelar</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <TouchableOpacity style={s.editBtn} onPress={() => setEditing(true)}>
                        <Text style={s.editBtnText}>✏️ Editar información</Text>
                    </TouchableOpacity>
                )}

                <View style={s.divider} />

                <TouchableOpacity style={s.testPushBtn} onPress={sendTestNotification}>
                    <Text style={s.testPushText}>🔔 Enviar Notificación Push de Prueba</Text>
                </TouchableOpacity>

                <TouchableOpacity style={s.actionRow} onPress={() => setViewMode('user')}>
                    <Text style={s.actionIcon}>👤</Text><Text style={s.actionText}>Cambiar a vista Usuario</Text><Text style={s.actionArrow}>›</Text>
                </TouchableOpacity>

                <TouchableOpacity style={s.logoutBtn} onPress={() => Alert.alert('Cerrar sesión', '¿Estás seguro?', [{ text: 'Cancelar' }, { text: 'Cerrar sesión', style: 'destructive', onPress: signOut }])}>
                    <Text style={s.logoutText}>🚪 Cerrar sesión</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    safe: { flex: 1, backgroundColor: 'transparent' },
    scroll: { padding: 20 },
    back: { marginBottom: 16 },
    backText: { color: '#2563EB', fontSize: 16, fontWeight: '600' },
    title: { fontSize: 24, fontWeight: 'bold', color: '#1E3A5F', marginBottom: 4 },
    subtitle: { fontSize: 14, color: '#64748B', marginBottom: 20 },
    card: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 10, elevation: 1 },
    label: { fontSize: 12, color: '#94A3B8', fontWeight: '600', textTransform: 'uppercase', marginBottom: 8 },
    input: { fontSize: 16, color: '#0F172A', fontWeight: '500', backgroundColor: 'transparent', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#E2E8F0' },
    btnRow: { gap: 8, marginTop: 16 },
    saveBtn: { backgroundColor: '#22C55E', borderRadius: 12, padding: 16, alignItems: 'center' },
    saveBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 },
    cancelBtn: { alignItems: 'center', padding: 12 },
    cancelBtnText: { color: '#94A3B8', fontSize: 14 },
    editBtn: { backgroundColor: '#2563EB', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 16 },
    editBtnText: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 },
    divider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 20 },
    actionRow: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', elevation: 1 },
    actionIcon: { fontSize: 20, marginRight: 12 },
    actionText: { flex: 1, fontSize: 15, fontWeight: '500', color: '#334155' },
    actionArrow: { fontSize: 22, color: '#CBD5E1' },
    testPushBtn: { backgroundColor: '#F0F9FF', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 8, borderWidth: 1, borderColor: '#BAE6FD' },
    testPushText: { color: '#0369A1', fontWeight: 'bold', fontSize: 16 },
    logoutBtn: { backgroundColor: '#FEF2F2', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8, borderWidth: 1, borderColor: '#FECACA' },
    logoutText: { color: '#DC2626', fontWeight: 'bold', fontSize: 16 },
});
