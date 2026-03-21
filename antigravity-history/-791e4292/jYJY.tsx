import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useNavigation } from '@react-navigation/native';

export default function ResetPasswordScreen() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const navigation = useNavigation();

    const handleReset = async () => {
        if (!email) {
            Alert.alert('Error', 'Por favor ingresa tu correo electrónico');
            return;
        }

        setLoading(true);
        const { error } = await supabase.auth.resetPasswordForEmail(email);

        if (error) {
            Alert.alert('Error', error.message);
        } else {
            Alert.alert('Solicitud enviada', 'Revisa tu correo para el enlace de recuperación', [
                { text: 'OK', onPress: () => navigation.goBack() }
            ]);
        }
        setLoading(false);
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1 bg-surface-50 justify-center px-6"
        >
            <TouchableOpacity onPress={() => navigation.goBack()} className="mb-6 absolute top-12 left-6">
                <Text className="text-primary-600 font-bold text-lg">← Volver</Text>
            </TouchableOpacity>

            <Text className="text-3xl font-bold text-primary-900 mb-2">Recuperar Clave</Text>
            <Text className="text-lg text-primary-700 mb-8">Te enviaremos un enlace para cambiarla</Text>

            <View className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <Text className="text-lg font-semibold text-slate-700 mb-2">Correo electrónico</Text>
                <TextInput
                    className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-lg mb-8 text-slate-800"
                    placeholder="juan@ejemplo.com"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                />

                <TouchableOpacity
                    className="bg-primary-500 rounded-xl py-4 items-center"
                    onPress={handleReset}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#ffffff" />
                    ) : (
                        <Text className="text-white text-xl font-bold">Enviar Enlace</Text>
                    )}
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}
