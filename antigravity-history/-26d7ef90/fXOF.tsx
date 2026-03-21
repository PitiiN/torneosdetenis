import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

export default function ProfileScreen({ navigation }: any) {
    const { user } = useAuth();
    const fullName = user?.user_metadata?.full_name || 'Vecino';
    const email = user?.email || '';
    const createdAt = user?.created_at ? new Date(user.created_at).toLocaleDateString('es-CL') : '';

    const handleResetPassword = async () => {
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) {
            Alert.alert('Error', error.message);
        } else {
            Alert.alert('Correo enviado', 'Revisa tu bandeja para restablecer tu contraseña.');
        }
    };

    return (
        <SafeAreaView style={s.safe}>
            <ScrollView contentContainerStyle={s.scroll}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={s.back}>
                    <Text style={s.backText}>← Volver</Text>
                </TouchableOpacity>

                <View style={s.avatarContainer}>
                    <View style={s.avatar}>
                        <Text style={s.avatarText}>{fullName[0]?.toUpperCase()}</Text>
                    </View>
                    <Text style={s.name}>{fullName}</Text>
                </View>

                <View style={s.card}>
                    <Text style={s.label}>Correo electrónico</Text>
                    <Text style={s.value}>{email}</Text>
                </View>

                <View style={s.card}>
                    <Text style={s.label}>Nombre completo</Text>
                    <Text style={s.value}>{fullName}</Text>
                </View>

                <View style={s.card}>
                    <Text style={s.label}>Miembro desde</Text>
                    <Text style={s.value}>{createdAt}</Text>
                </View>

                <View style={s.card}>
                    <Text style={s.label}>Unidad Vecinal</Text>
                    <Text style={s.value}>UV 22 • San Miguel</Text>
                </View>

                <TouchableOpacity style={s.resetBtn} onPress={handleResetPassword}>
                    <Text style={s.resetText}>🔑 Cambiar Contraseña</Text>
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
    avatarContainer: { alignItems: 'center', marginBottom: 24 },
    avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#1E3A5F', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
    avatarText: { color: '#FFFFFF', fontSize: 32, fontWeight: 'bold' },
    name: { fontSize: 22, fontWeight: 'bold', color: '#0F172A' },
    card: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 10, elevation: 1 },
    label: { fontSize: 12, color: '#94A3B8', fontWeight: '600', textTransform: 'uppercase', marginBottom: 4 },
    value: { fontSize: 16, color: '#0F172A', fontWeight: '500' },
    resetBtn: { backgroundColor: '#FEF3C7', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 16, borderWidth: 1, borderColor: '#FDE68A' },
    resetText: { color: '#92400E', fontWeight: 'bold', fontSize: 16 },
});
