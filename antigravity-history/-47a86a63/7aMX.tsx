import { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity,
    StyleSheet, KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { authService } from '@/services/auth.service';
import { colors, spacing, borderRadius } from '@/theme';
import { useAlertStore } from '@/store/alert.store';

export default function ForgotPasswordScreen() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);

    const handleReset = async () => {
        if (!email) {
            useAlertStore.getState().showAlert('Error', 'Por favor ingresa tu email');
            return;
        }
        setLoading(true);
        const { error } = await authService.resetPassword(email.trim());
        setLoading(false);
        if (error) {
            useAlertStore.getState().showAlert('Error', error.message);
        } else {
            setSent(true);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <View style={styles.content}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>

                <View style={styles.header}>
                    <View style={styles.iconCircle}>
                        <Ionicons name="key-outline" size={32} color={colors.primary[400]} />
                    </View>
                    <Text style={styles.title}>Recuperar contraseña</Text>
                    <Text style={styles.subtitle}>
                        {sent
                            ? 'Revisa tu bandeja de entrada para restablecer tu contraseña.'
                            : 'Ingresa tu email y te enviaremos un enlace para restablecer tu contraseña.'
                        }
                    </Text>
                </View>

                {!sent ? (
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
                            />
                        </View>

                        <TouchableOpacity
                            style={[styles.button, loading && styles.buttonDisabled]}
                            onPress={handleReset}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color={colors.white} />
                            ) : (
                                <Text style={styles.buttonText}>Enviar enlace</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.successContainer}>
                        <Ionicons name="checkmark-circle" size={64} color={colors.success} />
                        <Text style={styles.successText}>¡Email enviado!</Text>
                        <TouchableOpacity style={styles.button} onPress={() => router.back()}>
                            <Text style={styles.buttonText}>Volver al login</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { flex: 1, padding: spacing['2xl'], paddingTop: spacing['5xl'] },
    backButton: { marginBottom: spacing.xl },
    header: { alignItems: 'center', marginBottom: spacing['3xl'] },
    iconCircle: {
        width: 80, height: 80, borderRadius: 40,
        backgroundColor: colors.surface,
        justifyContent: 'center', alignItems: 'center',
        marginBottom: spacing.lg,
    },
    title: { fontSize: 24, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
    subtitle: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
    form: { gap: spacing.lg },
    inputContainer: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.surface, borderRadius: borderRadius.lg,
        borderWidth: 1, borderColor: colors.border,
        paddingHorizontal: spacing.lg, height: 56,
    },
    inputIcon: { marginRight: spacing.md },
    input: { flex: 1, color: colors.text, fontSize: 16 },
    button: {
        backgroundColor: colors.primary[500], height: 56,
        borderRadius: borderRadius.lg,
        justifyContent: 'center', alignItems: 'center',
    },
    buttonDisabled: { opacity: 0.6 },
    buttonText: { color: colors.white, fontSize: 16, fontWeight: '600' },
    successContainer: { alignItems: 'center', gap: spacing.xl },
    successText: { fontSize: 18, fontWeight: '600', color: colors.success },
});
