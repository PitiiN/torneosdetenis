import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme, spacing, borderRadius } from '@/theme';
import { supabase } from '@/services/supabase';
import { DateField } from '@/components/DateField';
import { buildTournamentDescription, buildTournamentFormatLabel, createInitialMatches, getRoundRobinGroupCount, normalizeTournamentFormat } from '@/services/tournamentStructure';
import { TOURNAMENT_CATEGORIES, CHILEAN_COMUNAS, TOURNAMENT_SURFACES, TOURNAMENT_SET_TYPES } from '@/constants/tournamentOptions';
import { canManageOrganization, getCurrentUserAccessContext } from '@/services/accessControl';
import { TennisSpinner } from '@/components/TennisSpinner';
import { normalizeTournamentStatus } from '@/services/tournamentStatus';

export default function EditTournamentScreen() {
    const { id } = useLocalSearchParams();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { colors } = useTheme();
    const styles = getStyles(colors);

    const [tournamentName, setTournamentName] = useState('');
    const [status, setStatus] = useState('draft');
    const [level, setLevel] = useState(TOURNAMENT_CATEGORIES[0]);
    const [surface, setSurface] = useState(TOURNAMENT_SURFACES[0]);
    const [maxPlayers, setMaxPlayers] = useState('8');
    const [format, setFormat] = useState('Eliminación Directa');
    const [setType, setSetType] = useState(TOURNAMENT_SET_TYPES[0]);
    const [groupCount, setGroupCount] = useState('2');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [registrationFee, setRegistrationFee] = useState('0');
    const [address, setAddress] = useState('');
    const [comuna, setComuna] = useState('');
    const [tournamentData, setTournamentData] = useState<any>(null);

    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Modal states
    const [showComunaModal, setShowComunaModal] = useState(false);
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [showSurfaceModal, setShowSurfaceModal] = useState(false);
    const [showSetTypeModal, setShowSetTypeModal] = useState(false);
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [showFormatModal, setShowFormatModal] = useState(false);

    const STATUS_OPTIONS = ['No Publicado', 'Publicado', 'En Progreso', 'Finalizado'];
    const STATUS_MAP_TO_UI: { [key: string]: string } = {
        'draft': 'No Publicado',
        'open': 'Publicado',
        'in_progress': 'En Progreso',
        'finished': 'Finalizado'
    };
    const STATUS_MAP_TO_DB: { [key: string]: string } = {
        'No Publicado': 'draft',
        'Publicado': 'open',
        'En Progreso': 'in_progress',
        'Finalizado': 'finished'
    };

    useEffect(() => {
        if (!id || id === 'undefined') return;
        loadTournament();
    }, [id]);

    const loadTournament = async () => {
        try {
            const access = await getCurrentUserAccessContext();
            if (!access) {
                router.replace('/(auth)/login');
                return;
            }

            const { data, error } = await supabase
                .from('tournaments')
                .select('id, organization_id, parent_tournament_id, is_tournament_master, name, status, level, modality, surface, max_players, format, set_type, description, start_date, end_date, registration_fee, registration_close_at, address, comuna')
                .eq('id', id)
                .single();
            if (error) throw error;
            if (!canManageOrganization(access, data.organization_id)) {
                router.replace('/(tabs)/tournaments');
                return;
            }

            setTournamentData(data);
            setTournamentName(data.name || '');
            const normalizedStatus = normalizeTournamentStatus(data.status);
            setStatus(STATUS_MAP_TO_UI[normalizedStatus] || 'No Publicado');
            setLevel(data.level || TOURNAMENT_CATEGORIES[0]);
            setSurface(data.surface || TOURNAMENT_SURFACES[0]);
            setMaxPlayers(String(data.max_players || '8'));
            setFormat(normalizeTournamentFormat(data.format) === 'round_robin' ? 'Round Robin' : (data.format || 'Eliminación Directa'));
            setSetType(data.set_type || TOURNAMENT_SET_TYPES[0]);
            setGroupCount(String(getRoundRobinGroupCount(data.format, data.description)));
            setStartDate(data.start_date || '');
            setEndDate(data.end_date || '');
            setRegistrationFee(String(data.registration_fee || '0'));
            setAddress(data.address || '');
            setComuna(data.comuna || '');
        } catch (error) {
            Alert.alert('Error', 'No se pudo cargar el torneo');
            router.back();
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        const isMasterTournament = Boolean(tournamentData?.is_tournament_master);

        if (isMasterTournament && (!startDate || !endDate)) {
            Alert.alert('Error', 'Debes definir fecha de inicio y fecha de fin.');
            return;
        }

        if (isMasterTournament && endDate < startDate) {
            Alert.alert('Error', 'La fecha de fin no puede ser menor que la fecha de inicio.');
            return;
        }

        setIsSubmitting(true);
        try {
            const access = await getCurrentUserAccessContext();
            if (!access || !canManageOrganization(access, tournamentData?.organization_id)) {
                Alert.alert('Error', 'No tienes permisos para editar este torneo.');
                return;
            }

            const maxPlayersValue = parseInt(maxPlayers) || 8;
            const tournamentFormat = buildTournamentFormatLabel(format, { groupCount: parseInt(groupCount) || 2 });
            const tournamentDescription = buildTournamentDescription(parseInt(groupCount) || 2, tournamentData?.description);
            const updatePayload: any = {
                name: tournamentName,
                level,
                format: tournamentFormat,
                description: tournamentDescription,
                set_type: setType,
                max_players: maxPlayersValue,
                registration_fee: parseInt(registrationFee) || 0,
            };

            if (isMasterTournament) {
                updatePayload.status = STATUS_MAP_TO_DB[status] || 'draft';
                updatePayload.surface = surface;
                updatePayload.start_date = startDate;
                updatePayload.end_date = endDate;
                updatePayload.address = address;
                updatePayload.comuna = comuna;
            }

            const { error } = await supabase
                .from('tournaments')
                .update(updatePayload)
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
            Alert.alert('Error', 'No se pudo actualizar el torneo');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <TennisSpinner size={34} />
            </View>
        );
    }

    const isMasterTournament = Boolean(tournamentData?.is_tournament_master);

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>{isMasterTournament ? 'Editar Torneo Completo' : 'Editar Campeonato'}</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
                <View style={styles.formSection}>
                    {/* Name */}
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

                    {/* Registration Fee */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>
                            <Ionicons name="cash-outline" size={18} color={colors.primary[500]} />
                            {' '}Valor de Inscripción ($)
                        </Text>
                        <TextInput
                            style={styles.textInput}
                            value={registrationFee}
                            onChangeText={setRegistrationFee}
                            keyboardType="numeric"
                            placeholder="Ej. 20000"
                            placeholderTextColor={colors.textTertiary}
                        />
                    </View>

                    {/* Max Players */}
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

                    {isMasterTournament && (
                        <>
                            {/* Address */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>
                                    <Ionicons name="location-outline" size={18} color={colors.primary[500]} />
                                    {' '}Dirección
                                </Text>
                                <TextInput
                                    style={styles.textInput}
                                    value={address}
                                    onChangeText={setAddress}
                                    placeholder="Ej. Avenida Principal 123"
                                    placeholderTextColor={colors.textTertiary}
                                />
                            </View>

                            {/* Comuna */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>
                                    <Ionicons name="map-outline" size={18} color={colors.primary[500]} />
                                    {' '}Comuna
                                </Text>
                                <TouchableOpacity style={styles.dropdown} onPress={() => setShowComunaModal(true)}>
                                    <Text style={styles.dropdownText}>{comuna || 'Seleccionar comuna...'}</Text>
                                    <Ionicons name="chevron-down" size={20} color={colors.textTertiary} />
                                </TouchableOpacity>
                            </View>

                            <DateField label="Fecha de Inicio" value={startDate} onChange={setStartDate} />

                            <DateField label="Fecha de Fin" value={endDate} onChange={setEndDate} />
                        </>
                    )}

                    {/* Format */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>
                            <Ionicons name="grid-outline" size={18} color={colors.primary[500]} />
                            {' '}Formato del Torneo
                        </Text>
                        <TouchableOpacity style={styles.dropdown} onPress={() => setShowFormatModal(true)}>
                            <Text style={styles.dropdownText}>{format}</Text>
                            <Ionicons name="chevron-down" size={20} color={colors.textTertiary} />
                        </TouchableOpacity>
                    </View>

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

                    {/* Set Type */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>
                            <Ionicons name="time-outline" size={18} color={colors.primary[500]} />
                            {' '}Tipo de Sets
                        </Text>
                        <TouchableOpacity style={styles.dropdown} onPress={() => setShowSetTypeModal(true)}>
                            <Text style={styles.dropdownText}>{setType}</Text>
                            <Ionicons name="chevron-down" size={20} color={colors.textTertiary} />
                        </TouchableOpacity>
                    </View>

                    {/* Category */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>
                            <Ionicons name="podium" size={18} color={colors.primary[500]} />
                            {' '}Categoría
                        </Text>
                        <TouchableOpacity style={styles.dropdown} onPress={() => setShowCategoryModal(true)}>
                            <Text style={styles.dropdownText}>{level}</Text>
                            <Ionicons name="chevron-down" size={20} color={colors.textTertiary} />
                        </TouchableOpacity>
                    </View>

                    {isMasterTournament && (
                        <>
                            {/* Surface */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>
                                    <Ionicons name="tennisball" size={18} color={colors.primary[500]} />
                                    {' '}Superficie
                                </Text>
                                <TouchableOpacity style={styles.dropdown} onPress={() => setShowSurfaceModal(true)}>
                                    <Text style={styles.dropdownText}>{surface}</Text>
                                    <Ionicons name="chevron-down" size={20} color={colors.textTertiary} />
                                </TouchableOpacity>
                            </View>

                            {/* Status */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>
                                    <Ionicons name="eye" size={18} color={colors.primary[500]} />
                                    {' '}Estado de Publicación
                                </Text>
                                <TouchableOpacity style={styles.dropdown} onPress={() => setShowStatusModal(true)}>
                                    <Text style={styles.dropdownText}>{status}</Text>
                                    <Ionicons name="chevron-down" size={20} color={colors.textTertiary} />
                                </TouchableOpacity>
                            </View>
                        </>
                    )}
                </View>
            </ScrollView>

            <View style={[styles.bottomBar, { paddingBottom: insets.bottom || spacing.md }]}>
                <TouchableOpacity
                    style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
                    onPress={handleSave}
                    disabled={isSubmitting}
                >
                    {isSubmitting ? (
                        <TennisSpinner size={18} color="#fff" />
                    ) : (
                        <>
                            <Ionicons name="save" size={20} color="#fff" />
                            <Text style={styles.submitBtnText}>Guardar Cambios</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>

            {/* Modals */}
            <SelectionModal
                visible={showComunaModal}
                title="Seleccionar Comuna"
                options={CHILEAN_COMUNAS}
                onSelect={(val: string) => { setComuna(val); setShowComunaModal(false); }}
                onClose={() => setShowComunaModal(false)}
            />
            <SelectionModal
                visible={showCategoryModal}
                title="Seleccionar Categoría"
                options={TOURNAMENT_CATEGORIES}
                onSelect={(val: string) => { setLevel(val); setShowCategoryModal(false); }}
                onClose={() => setShowCategoryModal(false)}
            />
            <SelectionModal
                visible={showFormatModal}
                title="Formato de Torneo"
                options={['Eliminación Directa', 'Round Robin', 'Eliminación Directa con Repechaje']}
                onSelect={(val: string) => { setFormat(val); setShowFormatModal(false); }}
                onClose={() => setShowFormatModal(false)}
            />
            <SelectionModal
                visible={showSetTypeModal}
                title="Tipo de Sets"
                options={TOURNAMENT_SET_TYPES}
                onSelect={(val: string) => { setSetType(val); setShowSetTypeModal(false); }}
                onClose={() => setShowSetTypeModal(false)}
            />
            <SelectionModal
                visible={showSurfaceModal}
                title="Seleccionar Superficie"
                options={TOURNAMENT_SURFACES}
                onSelect={(val: string) => { setSurface(val); setShowSurfaceModal(false); }}
                onClose={() => setShowSurfaceModal(false)}
            />
            <SelectionModal
                visible={showStatusModal}
                title="Estado del Torneo"
                options={STATUS_OPTIONS}
                onSelect={(val: string) => { setStatus(val); setShowStatusModal(false); }}
                onClose={() => setShowStatusModal(false)}
            />
        </View>
    );
}

// Helper Component
function SelectionModal({ visible, title, options, onSelect, onClose }: any) {
    const { colors } = useTheme();
    const styles = getStyles(colors);
    return (
        <Modal visible={visible} transparent={true} animationType="fade">
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>{title}</Text>
                    <ScrollView>
                        {options.map((opt: string) => (
                            <TouchableOpacity key={opt} style={styles.modalOption} onPress={() => onSelect(opt)}>
                                <Text style={styles.modalOptionText}>{opt}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                    <TouchableOpacity style={styles.modalClose} onPress={onClose}>
                        <Text style={styles.modalCloseText}>Cancelar</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

function getStyles(colors: any) {
    return StyleSheet.create({
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
    label: { fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: spacing.xs, alignItems: 'center' },
    textInput: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        color: colors.text,
        fontSize: 16,
    },
    dropdown: {
        height: 56,
        backgroundColor: colors.surface,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: spacing.md,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    dropdownText: {
        color: colors.text,
        fontSize: 16,
        fontWeight: '500',
    },
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
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xl,
    },
    modalContent: {
        width: '100%',
        backgroundColor: colors.surface,
        borderRadius: borderRadius['2xl'],
        padding: spacing.xl,
        maxHeight: '60%',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: colors.text,
        marginBottom: spacing.lg,
    },
    modalOption: {
        paddingVertical: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    modalOptionText: {
        color: colors.text,
        fontSize: 16,
        fontWeight: '600',
    },
    modalClose: {
        marginTop: spacing.xl,
        alignItems: 'center',
    },
    modalCloseText: {
        color: colors.primary[500],
        fontWeight: '700',
    },
    });
}
