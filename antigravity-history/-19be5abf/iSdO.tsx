import { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity,
    StyleSheet, KeyboardAvoidingView, Platform,
    ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { authService } from '@/services/auth.service';
import { colors, spacing, borderRadius } from '@/theme';

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Por favor ingresa tu email y contraseña');
            return;
        }
        setLoading(true);
        const { error } = await authService.signIn(email.trim(), password);
        setLoading(false);
        if (error) {
            Alert.alert('Error', error.message === 'Invalid login credentials'
                ? 'Email o contraseña incorrectos'
                : error.message
            );
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <ScrollView
                contentContainerStyle={styles.scroll}
                keyboardShouldPersistTaps="handled"
            >
                {/* Logo Section */}
                <View style={styles.logoSection}>
                    <View style={styles.logoCircle}>
                        <Ionicons name="tennisball" size={48} color={colors.secondary[500]} />
                    </View>
                    <Text style={styles.appName}>Escuela de Tenis</Text>
                    <Text style={styles.subtitle}>Gestiona tus clases de tenis</Text>
                </View>

                {/* Form */}
                <View style={styles.form}>
                    <View style={styles.inputContainer}>
                        <Ionicons name="mail-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Email"
                            placeholderTextColor={colors.textTertiary}
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                    </View>

                    <View style={styles.inputContainer}>
                        <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Contraseña"
                            placeholderTextColor={colors.textTertiary}
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry={!showPassword}
                        />
                        <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                            <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    <Link href="/(auth)/forgot-password" asChild>
                        <TouchableOpacity style={styles.forgotLink}>
                            <Text style={styles.forgotText}>¿Olvidaste tu contraseña?</Text>
                        </TouchableOpacity>
                    </Link>

                    <TouchableOpacity
                        style={[styles.button, loading && styles.buttonDisabled]}
                        onPress={handleLogin}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color={colors.white} />
                        ) : (
                            <Text style={styles.buttonText}>Iniciar Sesión</Text>
                        )}
                    </TouchableOpacity>

                    <View style={styles.registerRow}>
                        <Text style={styles.registerLabel}>¿No tienes cuenta? </Text>
                        <Link href="/(auth)/register" asChild>
                            <TouchableOpacity>
                                <Text style={styles.registerLink}>Crear cuenta</Text>
                            </TouchableOpacity>
                        </Link>
                    </View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    scroll: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: spacing['2xl'],
    },
    logoSection: {
        alignItems: 'center',
        marginBottom: spacing['4xl'],
    },
    logoCircle: {
        width: 96,
        height: 96,
        borderRadius: 48,
        backgroundColor: colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.lg,
        borderWidth: 2,
        borderColor: colors.primary[500],
    },
    appName: {
        fontSize: 28,
        fontWeight: '700',
        color: colors.text,
        marginBottom: spacing.xs,
    },
    subtitle: {
        fontSize: 14,
        color: colors.textSecondary,
    },
    form: {
        gap: spacing.lg,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: spacing.lg,
        height: 56,
    },
    inputIcon: {
        marginRight: spacing.md,
    },
    input: {
        flex: 1,
        color: colors.text,
        fontSize: 16,
    },
    eyeIcon: {
        padding: spacing.xs,
    },
    forgotLink: {
        alignSelf: 'flex-end',
    },
    forgotText: {
        color: colors.primary[400],
        fontSize: 13,
    },
    button: {
        backgroundColor: colors.primary[500],
        height: 56,
        borderRadius: borderRadius.lg,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: spacing.sm,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    buttonText: {
        color: colors.white,
        fontSize: 16,
        fontWeight: '600',
    },
    registerRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: spacing.lg,
    },
    registerLabel: {
        color: colors.textSecondary,
        fontSize: 14,
    },
    registerLink: {
        color: colors.primary[400],
        fontSize: 14,
        fontWeight: '600',
    },
});
