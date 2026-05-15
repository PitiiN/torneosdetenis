import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ImageBackground, KeyboardAvoidingView, Platform, Alert, ScrollView, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '@/services/supabase';
import { colors, spacing, borderRadius } from '@/theme';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { TennisSpinner } from '@/components/TennisSpinner';
import { getSafeAuthErrorMessage } from '@/services/errorMessages';
import { useRouter, useLocalSearchParams } from 'expo-router';

export default function ResetPasswordScreen() {
    const router = useRouter();
    const { email: emailParam } = useLocalSearchParams<{ email: string }>();
    const [email, setEmail] = useState(emailParam || '');
    const [token, setToken] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    async function handleResetPassword() {
        const code = token.trim();
        if (!code || !newPassword || !confirmPassword) {
            Alert.alert('Error', 'Completa todos los campos.');
            return;
        }

        if (newPassword !== confirmPassword) {
            Alert.alert('Error', 'Las contraseñas no coinciden.');
            return;
        }

        if (newPassword.length < 6) {
            Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres.');
            return;
        }

        setLoading(true);
        
        try {
            // 1. Verificar el código OTP (inicia sesión temporalmente)
            const { error: verifyError } = await supabase.auth.verifyOtp({
                email: email.trim().toLowerCase(),
                token: code,
                type: 'recovery',
            });

            if (verifyError) throw verifyError;

            // 2. Actualizar la contraseña del usuario (no requiere la contraseña antigua)
            const { error: updateError } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (updateError) throw updateError;

            Alert.alert(
                '¡Éxito!',
                'Tu contraseña ha sido actualizada correctamente.',
                [{ text: 'Iniciar Sesión', onPress: () => router.replace('/(auth)/login') }]
            );

        } catch (error: any) {
            Alert.alert('Error', getSafeAuthErrorMessage(error, 'general'));
        } finally {
            setLoading(false);
        }
    }

    return (
        <View style={styles.container}>
            <StatusBar style="light" />
            <ImageBackground 
                source={{ uri: 'https://images.unsplash.com/photo-1595435066311-665cd94b6139?q=80&w=2000&auto=format&fit=crop' }} 
                style={styles.bgImage}
                blurRadius={2}
            >
                <View style={styles.overlay}>
                    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
                        <KeyboardAvoidingView 
                            behavior={Platform.OS === 'ios' ? 'padding' : 'position'}
                            keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 32}
                            style={styles.keyboardView}
                        >
                            <ScrollView
                                contentContainerStyle={styles.keyboardScrollContent}
                                keyboardShouldPersistTaps="handled"
                                showsVerticalScrollIndicator={false}
                            >
                                <TouchableOpacity 
                                    style={styles.backButton} 
                                    onPress={() => router.back()}
                                >
                                    <Ionicons name="arrow-back" size={24} color="#fff" />
                                </TouchableOpacity>

                                <View style={styles.header}>
                                    <View style={styles.logoContainer}>
                                        <Ionicons name="key" size={50} color={colors.primary[500]} />
                                    </View>
                                    <Text style={styles.title}>Nueva Contraseña</Text>
                                    <Text style={styles.subtitle}>Ingresa el código que recibiste en tu correo y tu nueva contraseña</Text>
                                </View>

                                <BlurView intensity={20} tint="dark" style={styles.formContainer}>
                                    <View style={styles.inputGroup}>
                                        <Text style={styles.label}>Correo Electrónico</Text>
                                        <View style={styles.inputWrapper}>
                                            <Ionicons name="mail-outline" size={20} color={colors.textTertiary} style={styles.inputIcon} />
                                            <TextInput
                                                style={styles.input}
                                                placeholder="ejemplo@correo.com"
                                                placeholderTextColor={colors.textTertiary}
                                                value={email}
                                                onChangeText={setEmail}
                                                keyboardType="email-address"
                                                autoCapitalize="none"
                                            />
                                        </View>
                                    </View>

                                    <View style={styles.inputGroup}>
                                        <Text style={styles.label}>Código recibido</Text>
                                        <View style={styles.inputWrapper}>
                                            <Ionicons name="key-outline" size={20} color={colors.textTertiary} style={styles.inputIcon} />
                                            <TextInput
                                                style={styles.input}
                                                placeholder="Ingresa el código"
                                                placeholderTextColor={colors.textTertiary}
                                                value={token}
                                                onChangeText={setToken}
                                                keyboardType="default"
                                                autoCapitalize="none"
                                                autoCorrect={false}
                                            />
                                        </View>
                                    </View>

                                    <View style={styles.inputGroup}>
                                        <Text style={styles.label}>Nueva Contraseña</Text>
                                        <View style={styles.inputWrapper}>
                                            <Ionicons name="lock-closed-outline" size={20} color={colors.textTertiary} style={styles.inputIcon} />
                                            <TextInput
                                                style={styles.input}
                                                placeholder="********"
                                                placeholderTextColor={colors.textTertiary}
                                                value={newPassword}
                                                onChangeText={setNewPassword}
                                                secureTextEntry={!showPassword}
                                            />
                                            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                                <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={colors.textTertiary} />
                                            </TouchableOpacity>
                                        </View>
                                    </View>

                                    <View style={styles.inputGroup}>
                                        <Text style={styles.label}>Confirmar Contraseña</Text>
                                        <View style={styles.inputWrapper}>
                                            <Ionicons name="lock-closed-outline" size={20} color={colors.textTertiary} style={styles.inputIcon} />
                                            <TextInput
                                                style={styles.input}
                                                placeholder="********"
                                                placeholderTextColor={colors.textTertiary}
                                                value={confirmPassword}
                                                onChangeText={setConfirmPassword}
                                                secureTextEntry={!showPassword}
                                            />
                                        </View>
                                    </View>

                                    <TouchableOpacity 
                                        style={styles.submitButton} 
                                        onPress={handleResetPassword}
                                        disabled={loading}
                                    >
                                        {loading ? (
                                            <TennisSpinner size={16} color="#fff" />
                                        ) : (
                                            <Text style={styles.submitButtonText}>Actualizar Contraseña</Text>
                                        )}
                                    </TouchableOpacity>
                                </BlurView>
                            </ScrollView>
                        </KeyboardAvoidingView>
                    </TouchableWithoutFeedback>
                </View>
            </ImageBackground>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    bgImage: {
        flex: 1,
        width: '100%',
    },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        padding: spacing.xl,
    },
    backButton: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 40 : 20,
        left: 0,
        zIndex: 10,
        padding: spacing.sm,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 20,
    },
    keyboardView: {
        flex: 1,
    },
    keyboardScrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        paddingTop: spacing.xl,
        paddingBottom: 120,
    },
    header: {
        alignItems: 'center',
        marginBottom: spacing.xl,
        marginTop: spacing.md,
    },
    logoContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(34, 197, 94, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: 'rgba(34, 197, 94, 0.3)',
    },
    title: {
        fontSize: 28,
        fontWeight: '900',
        color: '#fff',
        letterSpacing: -0.5,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 15,
        color: colors.textSecondary,
        marginTop: spacing.sm,
        fontWeight: '500',
        textAlign: 'center',
        paddingHorizontal: spacing.lg,
    },
    formContainer: {
        padding: spacing.xl,
        borderRadius: borderRadius['3xl'],
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        overflow: 'hidden',
    },
    inputGroup: {
        marginBottom: spacing.md,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textSecondary,
        marginBottom: spacing.xs,
        marginLeft: 4,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: spacing.md,
        height: 56,
    },
    inputIcon: {
        marginRight: spacing.sm,
    },
    input: {
        flex: 1,
        color: '#fff',
        fontSize: 16,
    },
    submitButton: {
        backgroundColor: colors.primary[500],
        height: 56,
        borderRadius: borderRadius.xl,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: colors.primary[500],
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
        marginTop: spacing.md,
    },
    submitButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
        textAlign: 'center',
    },
});
