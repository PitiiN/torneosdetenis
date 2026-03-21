import { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity,
    StyleSheet, KeyboardAvoidingView, Platform,
    ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { authService } from '@/services/auth.service';
import { colors, spacing, borderRadius } from '@/theme';

export default function RegisterScreen() {
    const router = useRouter();
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleRegister = async () => {
        if (!fullName || !email || !password) {
            Alert.alert('Error', 'Por favor completa todos los campos obligatorios');
            return;
        }
        if (password.length < 6) {
            Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres');
            return;
        }
        if (password !== confirmPassword) {
            Alert.alert('Error', 'Las contraseñas no coinciden');
            return;
        }

        setLoading(true);
        const { error } = await authService.signUp(email.trim(), password, fullName.trim());
        setLoading(false);
        if (error) {
            Alert.alert('Error', error.message);
        } else {
            Alert.alert(
                '¡Cuenta creada!',
                'Revisa tu email para confirmar tu cuenta, o inicia sesión directamente.',
                [{ text: 'OK' }]
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
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>

                <View style={styles.header}>
                    <Text style={styles.title}>Crear cuenta</Text>
                    <Text style={styles.subtitle}>Únete a nuestra escuela de tenis</Text>
                </View>

                <View style={styles.form}>
                    <View style={styles.inputContainer}>
                        <Ionicons name="person-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Nombre completo *"
                            placeholderTextColor={colors.textTertiary}
                            value={fullName}
                            onChangeText={setFullName}
                            autoCapitalize="words"
                        />
                    </View>

                    <View style={styles.inputContainer}>
                        <Ionicons name="mail-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Email *"
                            placeholderTextColor={colors.textTertiary}
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />
                    </View>

                    <View style={styles.inputContainer}>
                        <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Contraseña *"
                            placeholderTextColor={colors.textTertiary}
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                        />
                    </View>

                    <View style={styles.inputContainer}>
                        <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Confirmar contraseña *"
                            placeholderTextColor={colors.textTertiary}
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            secureTextEntry
                        />
                    </View>

                    <TouchableOpacity
                        style={[styles.button, loading && styles.buttonDisabled]}
                        onPress={handleRegister}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color={colors.white} />
                        ) : (
                            <Text style={styles.buttonText}>Crear cuenta</Text>
                        )}
                    </TouchableOpacity>

                    <View style={styles.loginRow}>
                        <Text style={styles.loginLabel}>¿Ya tienes cuenta? </Text>
                        <Link href="/(auth)/login" asChild>
                            <TouchableOpacity>
                                <Text style={styles.loginLink}>Iniciar sesión</Text>
                            </TouchableOpacity>
                        </Link>
                    </View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { flexGrow: 1, padding: spacing['2xl'], paddingTop: spacing['5xl'] },
    backButton: { marginBottom: spacing.xl },
    header: { marginBottom: spacing['3xl'] },
    title: { fontSize: 28, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
    subtitle: { fontSize: 14, color: colors.textSecondary },
    form: { gap: spacing.lg },
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
    inputIcon: { marginRight: spacing.md },
    input: { flex: 1, color: colors.text, fontSize: 16 },
    button: {
        backgroundColor: colors.primary[500],
        height: 56,
        borderRadius: borderRadius.lg,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: spacing.sm,
    },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: colors.white, fontSize: 16, fontWeight: '600' },
    loginRow: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.lg },
    loginLabel: { color: colors.textSecondary, fontSize: 14 },
    loginLink: { color: colors.primary[400], fontSize: 14, fontWeight: '600' },
});
