import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ImageBackground, KeyboardAvoidingView, Platform, Alert, ScrollView, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '@/services/supabase';
import { colors, spacing, borderRadius, typography } from '@/theme';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { getSafeAuthErrorMessage } from '@/services/errorMessages';
import { TennisSpinner } from '@/components/TennisSpinner';

import { useRouter } from 'expo-router';

export default function LoginScreen() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [keyboardVisible, setKeyboardVisible] = useState(false);

    useEffect(() => {
        const showSubscription = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
        const hideSubscription = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));

        return () => {
            showSubscription.remove();
            hideSubscription.remove();
        };
    }, []);

    async function signInWithEmail() {
        const normalizedEmail = email.trim().toLowerCase();
        const normalizedPassword = password;
        if (!normalizedEmail || !normalizedPassword) {
            Alert.alert('Error', 'Ingresa correo y contraseña.');
            return;
        }

        setLoading(true);
        const { error } = await supabase.auth.signInWithPassword({
            email: normalizedEmail,
            password: normalizedPassword,
        });

        if (error) {
            Alert.alert('Error', getSafeAuthErrorMessage(error, 'login'));
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
                            behavior={Platform.OS === 'ios' ? 'padding' : 'position'}
                            keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 32}
                            style={styles.keyboardView}
                        >
                            <ScrollView
                                contentContainerStyle={[
                                    styles.keyboardScrollContent,
                                    keyboardVisible && styles.keyboardScrollContentWithKeyboard,
                                ]}
                                keyboardShouldPersistTaps="handled"
                                showsVerticalScrollIndicator={false}
                            >
                                <View style={styles.header}>
                                    <View style={styles.logoContainer}>
                                        <Ionicons name="tennisball" size={60} color={colors.primary[500]} />
                                    </View>
                                    <Text style={styles.title}>SweetSpot</Text>
                                    <Text style={styles.subtitle}>Tu próximo torneo comienza aquí</Text>
                                </View>

                                <BlurView intensity={20} tint="dark" style={styles.formContainer}>
                                    <Text style={styles.formTitle}>Bienvenido</Text>
                                    
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
                                        style={styles.loginButton} 
                                        onPress={signInWithEmail}
                                        disabled={loading}
                                    >
                                        {loading ? (
                                            <TennisSpinner size={16} color="#fff" />
                                        ) : (
                                            <Text style={styles.loginButtonText}>Iniciar Sesión</Text>
                                        )}
                                    </TouchableOpacity>

                                    <TouchableOpacity 
                                        style={styles.registerButton} 
                                        onPress={() => router.push('/(auth)/register')}
                                        disabled={loading}
                                    >
                                        <Text style={styles.registerButtonText}>Crear una cuenta</Text>
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
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: spacing.xl,
    },
    keyboardView: {
        flex: 1,
    },
    keyboardScrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        paddingBottom: spacing.xl,
    },
    keyboardScrollContentWithKeyboard: {
        justifyContent: 'flex-start',
        paddingTop: spacing['3xl'],
        paddingBottom: spacing['4xl'],
    },
    header: {
        alignItems: 'center',
        marginBottom: spacing['4xl'],
    },
    logoContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: 'rgba(34, 197, 94, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: 'rgba(34, 197, 94, 0.3)',
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
    formTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#fff',
        marginBottom: spacing.xl,
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
    loginButton: {
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
    loginButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
    },
    registerButton: {
        marginTop: spacing.xl,
        alignItems: 'center',
    },
    registerButtonText: {
        color: colors.primary[400],
        fontSize: 14,
        fontWeight: '600',
    },
});
