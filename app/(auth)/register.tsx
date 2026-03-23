import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ImageBackground, KeyboardAvoidingView, Platform, Alert, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '@/services/supabase';
import { colors, spacing, borderRadius } from '@/theme';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import {
    getSafeAuthErrorMessage,
    isAuthDuplicateUserError,
    isAuthSignupConfigurationError,
} from '@/services/errorMessages';
import { TennisSpinner } from '@/components/TennisSpinner';

export default function RegisterScreen() {
    const router = useRouter();
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    async function signUpWithEmail() {
        if (!firstName || !lastName || !email || !password) {
            Alert.alert('Error', 'Por favor, completa todos los campos.');
            return;
        }

        if (password.length < 8) {
            Alert.alert('Error', 'La contraseña debe tener al menos 8 caracteres.');
            return;
        }

        setLoading(true);
        try {
            const normalizedEmail = email.trim().toLowerCase();
            const fullName = `${firstName.trim()} ${lastName.trim()}`.replace(/\s+/g, ' ').slice(0, 80);
            let { data, error } = await supabase.auth.signUp({
                email: normalizedEmail,
                password,
                options: {
                    data: {
                        name: fullName,
                        full_name: fullName,
                        display_name: fullName,
                        first_name: firstName.trim(),
                        last_name: lastName.trim(),
                    },
                },
            });

            if (error && isAuthSignupConfigurationError(error)) {
                // Retry without metadata in case an old DB trigger expects a stricter payload path.
                const retry = await supabase.auth.signUp({
                    email: normalizedEmail,
                    password,
                });
                data = retry.data;
                error = retry.error;
            }

            if (error) throw error;

            // With some Supabase settings, duplicate emails may return a user with no identities.
            const identities = Array.isArray((data?.user as any)?.identities)
                ? (data?.user as any).identities
                : null;
            if (identities && identities.length === 0) {
                throw { message: 'user already registered', code: 'user_already_exists' };
            }

            if (data.user) {
                const { error: profileError } = await supabase
                    .from('profiles')
                    .update({
                        name: fullName,
                    })
                    .eq('id', data.user.id);

                if (profileError) {
                    Alert.alert('Aviso', 'Cuenta creada, pero no pudimos guardar el nombre de perfil.');
                }

                Alert.alert(
                    '¡Cuenta creada!',
                    'Tu cuenta ha sido creada exitosamente. Ya puedes iniciar sesión.',
                    [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]
                );
            }
        } catch (error: any) {
            if (isAuthDuplicateUserError(error)) {
                Alert.alert('Error', 'Este correo ya está registrado. Inicia sesión o recupera tu clave.');
                return;
            }
            Alert.alert('Error', getSafeAuthErrorMessage(error, 'register'));
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
                    <KeyboardAvoidingView 
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        style={styles.keyboardView}
                    >
                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 40 }}>
                            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                                <Ionicons name="arrow-back" size={24} color="#fff" />
                            </TouchableOpacity>

                            <View style={styles.header}>
                                <Text style={styles.title}>Crear Cuenta</Text>
                                <Text style={styles.subtitle}>Únete a la comunidad de tenis</Text>
                            </View>

                            <BlurView intensity={20} tint="dark" style={styles.formContainer}>
                                <View style={styles.row}>
                                    <View style={[styles.inputGroup, { flex: 1 }]}>
                                        <Text style={styles.label}>Nombre</Text>
                                        <View style={styles.inputWrapper}>
                                            <TextInput
                                                style={styles.input}
                                                placeholder="Ej: Juan"
                                                placeholderTextColor={colors.textTertiary}
                                                value={firstName}
                                                onChangeText={setFirstName}
                                            />
                                        </View>
                                    </View>
                                    <View style={[styles.inputGroup, { flex: 1, marginLeft: spacing.md }]}>
                                        <Text style={styles.label}>Apellido</Text>
                                        <View style={styles.inputWrapper}>
                                            <TextInput
                                                style={styles.input}
                                                placeholder="Ej: Pérez"
                                                placeholderTextColor={colors.textTertiary}
                                                value={lastName}
                                                onChangeText={setLastName}
                                            />
                                        </View>
                                    </View>
                                </View>

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

                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>Contraseña</Text>
                                    <View style={styles.inputWrapper}>
                                        <Ionicons name="lock-closed-outline" size={20} color={colors.textTertiary} style={styles.inputIcon} />
                                        <TextInput
                                            style={styles.input}
                                            placeholder="********"
                                            placeholderTextColor={colors.textTertiary}
                                            value={password}
                                            onChangeText={setPassword}
                                            secureTextEntry={!showPassword}
                                        />
                                        <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                            <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={colors.textTertiary} />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                <TouchableOpacity 
                                    style={styles.registerButton} 
                                    onPress={signUpWithEmail}
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <TennisSpinner size={16} color="#fff" />
                                    ) : (
                                        <Text style={styles.registerButtonText}>Registrarme</Text>
                                    )}
                                </TouchableOpacity>

                                <TouchableOpacity 
                                    style={styles.loginLink} 
                                    onPress={() => router.back()}
                                >
                                    <Text style={styles.loginLinkText}>¿Ya tienes cuenta? Inicia sesión</Text>
                                </TouchableOpacity>
                            </BlurView>
                        </ScrollView>
                    </KeyboardAvoidingView>
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
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: spacing.xl,
    },
    keyboardView: {
        flex: 1,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.xl,
    },
    header: {
        alignItems: 'center',
        marginBottom: spacing['2xl'],
    },
    title: {
        fontSize: 32,
        fontWeight: '900',
        color: '#fff',
        fontStyle: 'italic',
        letterSpacing: -1,
    },
    subtitle: {
        fontSize: 16,
        color: colors.textSecondary,
        marginTop: spacing.xs,
        fontWeight: '500',
    },
    formContainer: {
        padding: spacing.xl,
        borderRadius: borderRadius['3xl'],
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        overflow: 'hidden',
    },
    row: {
        flexDirection: 'row',
    },
    inputGroup: {
        marginBottom: spacing.lg,
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
    registerButton: {
        backgroundColor: colors.primary[500],
        height: 56,
        borderRadius: borderRadius.xl,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: spacing.md,
        shadowColor: colors.primary[500],
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    registerButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
    },
    loginLink: {
        marginTop: spacing.xl,
        alignItems: 'center',
    },
    loginLinkText: {
        color: colors.primary[400],
        fontSize: 14,
        fontWeight: '600',
    },
});

