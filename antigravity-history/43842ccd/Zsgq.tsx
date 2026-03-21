import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useNavigation } from '@react-navigation/native';

export default function RegisterScreen() {
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const navigation = useNavigation();

    const handleRegister = async () => {
        if (!email || !password || !fullName) {
            Alert.alert('Error', 'Por favor completa todos los campos');
            return;
        }

        setLoading(true);
        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName,
                },
            },
        });

        if (error) {
            Alert.alert('Error de registro', error.message);
        } else {
            Alert.alert('Registro exitoso', 'Por favor verifica tu correo para activar tu cuenta', [
                { text: 'OK', onPress: () => navigation.goBack() }
            ]);
        }
        setLoading(false);
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1 bg-surface-50"
        >
            <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, justifyContent: 'center' }}>
                <TouchableOpacity onPress={() => navigation.goBack()} className="mb-6">
                    <Text className="text-primary-600 font-bold text-lg">← Volver</Text>
                </TouchableOpacity>

                <Text className="text-3xl font-bold text-primary-900 mb-2">Crear Cuenta</Text>
                <Text className="text-lg text-primary-700 mb-8">Únete a tu junta de vecinos</Text>

                <View className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <Text className="text-lg font-semibold text-slate-700 mb-2">Nombre completo</Text>
                    <TextInput
                        className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-lg mb-4 text-slate-800"
                        placeholder="Juan Pérez"
                        value={fullName}
                        onChangeText={setFullName}
                        autoCapitalize="words"
                    />

                    <Text className="text-lg font-semibold text-slate-700 mb-2">Correo electrónico</Text>
                    <TextInput
                        className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-lg mb-4 text-slate-800"
                        placeholder="juan@ejemplo.com"
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                        keyboardType="email-address"
                    />

                    <Text className="text-lg font-semibold text-slate-700 mb-2">Contraseña</Text>
                    <TextInput
                        className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-lg mb-8 text-slate-800"
                        placeholder="Mínimo 6 caracteres"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                    />

                    <TouchableOpacity
                        className="bg-primary-500 rounded-xl py-4 items-center"
                        onPress={handleRegister}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#ffffff" />
                        ) : (
                            <Text className="text-white text-xl font-bold">Registrarme</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}
