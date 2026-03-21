import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/AuthStack';

type NavigationProp = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const navigation = useNavigation<NavigationProp>();

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Por favor ingresa email y contraseña');
            return;
        }

        setLoading(true);
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            Alert.alert('Error de inicio de sesión', error.message);
        }
        setLoading(false);
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1 bg-surface-50 justify-center px-6"
        >
            <View className="items-center mb-10">
                <View className="w-24 h-24 bg-primary-500 rounded-full items-center justify-center mb-4 shadow-sm">
                    <Text className="text-white text-3xl font-bold">JJVV</Text>
                </View>
                <Text className="text-3xl font-bold text-primary-900 mb-2">Bienvenido</Text>
                <Text className="text-lg text-primary-700 text-center">Tu junta de vecinos en tu bolsillo</Text>
            </View>

            <View className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <Text className="text-lg font-semibold text-slate-700 mb-2">Correo electrónico</Text>
                <TextInput
                    className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-lg mb-4 text-slate-800"
                    placeholder="juan@ejemplo.com"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    accessibilityLabel="Correo electrónico"
                />

                <Text className="text-lg font-semibold text-slate-700 mb-2">Contraseña</Text>
                <TextInput
                    className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-lg mb-6 text-slate-800"
                    placeholder="••••••••"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    accessibilityLabel="Contraseña"
                />

                <TouchableOpacity
                    className="bg-primary-500 rounded-xl py-4 items-center mb-4"
                    onPress={handleLogin}
                    disabled={loading}
                    accessibilityRole="button"
                    accessibilityLabel="Iniciar sesión"
                >
                    {loading ? (
                        <ActivityIndicator color="#ffffff" />
                    ) : (
                        <Text className="text-white text-xl font-bold">Iniciar Sesión</Text>
                    )}
                </TouchableOpacity>

                <View className="flex-row justify-between mt-2">
                    <TouchableOpacity onPress={() => navigation.navigate('ResetPassword')} className="p-2">
                        <Text className="text-primary-600 text-base font-medium">¿Olvidaste tu clave?</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => navigation.navigate('Register')} className="p-2">
                        <Text className="text-primary-600 text-base font-medium">Registrarse</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}
