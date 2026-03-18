import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors, spacing, borderRadius } from '@/theme';
import { supabase } from '@/services/supabase';
import { DateField } from '@/components/DateField';
import { buildTournamentDescription, buildTournamentFormatLabel, createInitialMatches, getRoundRobinGroupCount, normalizeTournamentFormat } from '@/services/tournamentStructure';

export default function EditTournamentScreen() {
    const { id } = useLocalSearchParams();
    const insets = useSafeAreaInsets();
    const router = useRouter();

    const [tournamentName, setTournamentName] = useState('');
    const [status, setStatus] = useState('draft');
    const [level, setLevel] = useState('beginner');
    const [surface, setSurface] = useState('clay');
    const [maxPlayers, setMaxPlayers] = useState('8');
    const [format, setFormat] = useState('Eliminación Directa');
    const [setType, setSetType] = useState('Al mejor de 3 Sets');
    const [groupCount, setGroupCount] = useState('2');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [registrationFee, setRegistrationFee] = useState('0');
    const [tournamentData, setTournamentData] = useState<any>(null);

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

            setTournamentData(data);
            setTournamentName(data.name || '');
            setStatus(data.status || 'draft');
            setLevel(data.level || 'beginner');
            setSurface(data.surface || 'clay');
            setMaxPlayers(String(data.max_players || '8'));
            setFormat(normalizeTournamentFormat(data.format) === 'round_robin' ? 'Round Robin' : (data.format || 'Eliminación Directa'));
            setSetType(data.set_type || 'Al mejor de 3 Sets');
            setGroupCount(String(getRoundRobinGroupCount(data.format, data.description)));
            setStartDate(data.start_date || '');
            setEndDate(data.end_date || '');
            setRegistrationFee(String(data.registration_fee || '0'));
        } catch (error) {
            console.error('Error loading tournament:', error);
            Alert.alert('Error', 'No se pudo cargar el torneo');
            router.back();
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if (!startDate || !endDate) {
            Alert.alert('Error', 'Debes definir fecha de inicio y fecha de fin.');
            return;
        }

        if (endDate < startDate) {
            Alert.alert('Error', 'La fecha de fin no puede ser menor que la fecha de inicio.');
            return;
        }

        setIsSubmitting(true);
        try {
            const maxPlayersValue = parseInt(maxPlayers) || 8;
            const tournamentFormat = buildTournamentFormatLabel(format, { groupCount: parseInt(groupCount) || 2 });
            const tournamentDescription = buildTournamentDescription(parseInt(groupCount) || 2, tournamentData?.description);
            const { error } = await supabase
                .from('tournaments')
                .update({
                    name: tournamentName,
                    status,
                    level,
                    surface,
                    format: tournamentFormat,
                    description: tournamentDescription,
                    set_type: setType,
                    max_players: maxPlayersValue,
                    start_date: startDate,
                    end_date: endDate,
                    registration_fee: parseInt(registrationFee) || 0
                })
                .eq('id', id);

            if (error) throw error;

            const structureChanged =
                tournamentData &&
                (Number(tournamentData.max_players || 0) !== maxPlayersValue ||
                    buildTournamentFormatLabel(format, { groupCount: parseInt(groupCount) || 2 }) !== tournamentData.format);

            if (structureChanged && tournamentData) {
                const { data: registrations, error: regError } = await supabase
                    .from('registrations')
                    .select('player_id')
                    .eq('tournament_id', id);

                if (regError) throw regError;

                const { error: deleteError } = await supabase
                    .from('matches')
                    .delete()
                    .eq('tournament_id', id);

                if (deleteError) throw deleteError;

                const rebuiltMatches = createInitialMatches({
                    tournamentId: String(id),
                    format: tournamentFormat,
                    description: tournamentDescription,
                    maxPlayers: maxPlayersValue,
                    participants: (registrations || []).map((registration: any) => ({ id: registration.player_id }))
                });

                if (rebuiltMatches.length > 0) {
                    const { error: insertError } = await supabase.from('matches').insert(rebuiltMatches);
                    if (insertError) throw insertError;
                }
            }

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

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>
                            <Ionicons name="people" size={18} color={colors.primary[500]} />
                            {' '}Máximo de Jugadores
                        </Text>
                        <TextInput
                            style={styles.textInput}
                            value={maxPlayers}
                            onChangeText={setMaxPlayers}
                            keyboardType="number-pad"
                            placeholder="Ej. 16"
                            placeholderTextColor={colors.textTertiary}
                        />
                    </View>

                    <DateField label="Fecha de Inicio" value={startDate} onChange={setStartDate} />

                    <DateField label="Fecha de Fin" value={endDate} onChange={setEndDate} />

                    {renderPicker('Formato del Torneo', 'grid-outline', format, setFormat, [
                        { label: 'Eliminación Directa', value: 'Eliminación Directa' },
                        { label: 'Round Robin', value: 'Round Robin' },
                        { label: 'Eliminación Directa con Repechaje', value: 'Eliminación Directa con Repechaje' }
                    ])}

                    {normalizeTournamentFormat(format) === 'round_robin' && (
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>
                                <Ionicons name="git-branch-outline" size={18} color={colors.primary[500]} />
                                {' '}Cantidad de Grupos
                            </Text>
                            <TextInput
                                style={styles.textInput}
                                value={groupCount}
                                onChangeText={setGroupCount}
                                keyboardType="number-pad"
                                placeholder="Ej. 2"
                                placeholderTextColor={colors.textTertiary}
                            />
                        </View>
                    )}

                    {renderPicker('Tipo de Sets', 'albums-outline', setType, setSetType, [
                        { label: 'Al mejor de 3 Sets', value: 'Al mejor de 3 Sets' },
                        { label: 'Set Corto', value: 'Set Corto' },
                        { label: 'Al mejor de 5 Sets', value: 'Al mejor de 5 Sets' }
                    ])}

                    {renderPicker('Estado de PublicaciÃ³n', 'eye', status, setStatus, [
                        { label: 'No Publicado', value: 'draft' },
                        { label: 'Publicado', value: 'open' },
                        { label: 'En Progreso', value: 'in_progress' },
                        { label: 'Finalizado', value: 'finished' }
                    ])}

                    {renderPicker('Categoría', 'podium', level, setLevel, [
                        { label: 'Escalafón', value: 'Escalafón' },
                        { label: 'Honor', value: 'Honor' },
                        { label: '1ra', value: '1ra' },
                        { label: '2da', value: '2da' },
                        { label: '3ra', value: '3ra' },
                        { label: '4ta', value: '4ta' },
                        { label: '5ta', value: '5ta' },
                        { label: 'Inicial', value: 'Inicial' }
                    ])}

                    {renderPicker('Superficie', 'tennisball', surface, setSurface, [
                        { label: 'Arcilla', value: 'Arcilla' },
                        { label: 'Dura', value: 'Dura' },
                        { label: 'Césped', value: 'Césped' },
                        { label: 'Carpeta', value: 'Carpeta' }
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




