import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors, spacing, borderRadius } from '@/theme';
import { supabase } from '@/services/supabase';

export default function EditTournamentScreen() {
    const { id } = useLocalSearchParams();
    const insets = useSafeAreaInsets();
    const router = useRouter();

    const [tournamentName, setTournamentName] = useState('');
    const [status, setStatus] = useState('draft');

    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!id || id === 'undefined') return;
        loadTournament();
    }, [id]);

    const loadTournament = async () => {
        try {
            const { data, error } = await supabase
                .from('tournaments')
                .select('*')
                .eq('id', id)
                .single();
            if (error) throw error;

            setTournamentName(data.name || '');
            setStatus(data.status || 'draft');
        } catch (error) {
            console.error('Error loading tournament:', error);
            Alert.alert('Error', 'No se pudo cargar el torneo');
            router.back();
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        setIsSubmitting(true);
        try {
            const { error } = await supabase
                .from('tournaments')
                .update({
                    name: tournamentName,
                    status
                })
                .eq('id', id);

            if (error) throw error;
            router.back();
        } catch (error) {
            console.error('Error updating tournament:', error);
            Alert.alert('Error', 'No se pudo actualizar el torneo');
        } finally {
            setIsSubmitting(false);
        }
    };

    const renderPicker = (label: string, icon: any, value: string, setValue: (val: string) => void, options: { label: string, value: string }[]) => (
        <View style={styles.inputGroup}>
            <Text style={styles.label}>
                <Ionicons name={icon} size={18} color={colors.primary[500]} />
                {' '}{label}
            </Text>
            <View style={styles.pickerContainer}>
                {options.map((opt) => (
                    <TouchableOpacity
                        key={opt.value}
                        style={[
                            styles.pickerOption,
                            value === opt.value && styles.pickerOptionActive
                        ]}
                        onPress={() => setValue(opt.value)}
                    >
                        <Text style={[
                            styles.pickerOptionText,
                            value === opt.value && styles.pickerOptionTextActive
                        ]}>
                            {opt.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );

    if (isLoading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={colors.primary[500]} />
            </View>
        );
    }

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Editar Torneo</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
                <View style={styles.formSection}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>
                            <Ionicons name="text" size={18} color={colors.primary[500]} />
                            {' '}Nombre del Torneo
                        </Text>
                        <TextInput
                            style={styles.textInput}
                            value={tournamentName}
                            onChangeText={setTournamentName}
                            placeholder="Ej. Torneo de Verano"
                            placeholderTextColor={colors.textTertiary}
                        />
                    </View>

                    {renderPicker('Estado', 'flag', status, setStatus, [
                        { label: 'Borrador', value: 'draft' },
                        { label: 'En Curso', value: 'in_progress' },
                        { label: 'Finalizado', value: 'completed' }
                    ])}
                </View>
            </ScrollView>

            <View style={[styles.bottomBar, { paddingBottom: insets.bottom || spacing.md }]}>
                <TouchableOpacity
                    style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
                    onPress={handleSave}
                    disabled={isSubmitting}
                >
                    {isSubmitting ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <>
                            <Ionicons name="save" size={20} color="#fff" />
                            <Text style={styles.submitBtnText}>Guardar Cambios</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    backButton: { padding: spacing.xs },
    title: { fontSize: 20, fontWeight: '700', color: colors.text },
    scrollContent: { padding: spacing.xl },
    formSection: { gap: spacing.xl },
    inputGroup: { gap: spacing.sm },
    label: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
    textInput: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        color: colors.text,
        fontSize: 16,
    },
    pickerContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    pickerOption: {
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
    },
    pickerOptionActive: {
        backgroundColor: colors.primary[500] + '20',
        borderColor: colors.primary[500],
    },
    pickerOptionText: { color: colors.textSecondary, fontSize: 14, fontWeight: '500' },
    pickerOptionTextActive: { color: colors.primary[500], fontWeight: '700' },
    bottomBar: {
        padding: spacing.xl,
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    submitBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.primary[500],
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        gap: spacing.sm,
    },
    submitBtnDisabled: { opacity: 0.5 },
    submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
