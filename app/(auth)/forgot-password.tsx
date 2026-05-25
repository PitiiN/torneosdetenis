import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ImageBackground, KeyboardAvoidingView, Platform, Alert, ScrollView, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '@/services/supabase';
import { colors, spacing, borderRadius } from '@/theme';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { TennisSpinner } from '@/components/TennisSpinner';
import { getSafeAuthErrorMessage } from '@/services/errorMessages';
import * as Linking from 'expo-linking';

import { useRouter } from 'expo-router';

export default function ForgotPasswordScreen() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);

    async function sendResetLink() {
        const normalizedEmail = email.trim().toLowerCase();
        if (!normalizedEmail) {
            Alert.alert('Error', 'Ingresa tu correo electrónico.');
            return;
        }

        setLoading(true);
        const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail);

        if (error) {
            Alert.alert('Error', getSafeAuthErrorMessage(error, 'general'));
        } else {
            Alert.alert(
                'Correo enviado',
                'Revisa tu bandeja de entrada. Te hemos enviado un código de 6 dígitos. Úsalo en la siguiente pantalla para actualizar tu contraseña.',
                [{ text: 'OK', onPress: () => router.replace({ pathname: '/(auth)/reset-password', params: { email: normalizedEmail } }) }]
            );
        }
        setLoading(false);
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
                            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                            keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
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
                                        <Ionicons name="lock-closed" size={50} color={colors.primary[500]} />
                                    </View>
                                    <Text style={styles.title}>Recuperar Contraseña</Text>
                                    <Text style={styles.subtitle}>Ingresa tu correo para recibir un enlace de recuperación</Text>
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
                                                autoCapitalize="none"
                                                keyboardType="email-address"
                                            />
                                        </View>
                                    </View>

                                    <TouchableOpacity 
                                        style={styles.submitButton} 
                                        onPress={sendResetLink}
                                        disabled={loading}
                                    >
                                        {loading ? (
                                            <TennisSpinner size={16} color="#fff" />
                                        ) : (
                                            <Text style={styles.submitButtonText}>Enviar Enlace</Text>
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
        paddingTop: spacing['4xl'],
        paddingBottom: spacing.xl,
    },
    header: {
        alignItems: 'center',
        marginBottom: spacing['3xl'],
        marginTop: spacing['2xl'],
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
        marginBottom: spacing.xl,
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
    },
    submitButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
        textAlign: 'center',
    },
});
