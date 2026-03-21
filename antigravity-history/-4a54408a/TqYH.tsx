import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, Modal, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, spacing, borderRadius } from '@/theme';
import { supabase } from '@/services/supabase';

interface Profile {
    id: string;
    full_name: string;
    email: string;
}

export default function CreateTournamentScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();

    const [playersCount, setPlayersCount] = useState('8');
    const [tournamentName, setTournamentName] = useState('');
    const [modality, setModality] = useState('singles');
    const [category, setCategory] = useState('primera');
    const [format, setFormat] = useState('eliminacion');
    const [setType, setSetType] = useState('best3');
    const [shortSetGames, setShortSetGames] = useState('4');

    // Player Selection
    const [selectedPlayers, setSelectedPlayers] = useState<Profile[]>([]);
    const [isPlayerModalVisible, setIsPlayerModalVisible] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [createdTournamentId, setCreatedTournamentId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<Profile[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isPlayerModalVisible) {
            searchPlayers(''); // Load initial 50
        }
    }, [isPlayerModalVisible]);

    useEffect(() => {
        const delaySearch = setTimeout(() => {
            searchPlayers(searchQuery);
        }, 300);
        return () => clearTimeout(delaySearch);
    }, [searchQuery]);

    const searchPlayers = async (query: string) => {
        setIsSearching(true);
        try {
            let q = supabase
                .from('profiles')
                .select('id, full_name, email')
                .eq('role', 'student')
                .limit(20);

            if (query) {
                q = q.ilike('full_name', `%${query}%`);
            }

            const { data, error } = await q;
            if (error) throw error;

            // Filter out already selected players
            const filteredResults = (data || []).filter(
                p => !selectedPlayers.find(sp => sp.id === p.id)
            );

            setSearchResults(filteredResults);
        } catch (error) {
            console.error('Error searching players:', error);
        } finally {
            setIsSearching(false);
        }
    };

    const handleAddPlayer = (player: Profile) => {
        const targetCount = parseInt(playersCount) || 0;
        if (selectedPlayers.length >= targetCount) {
            Alert.alert('Límite alcanzado', 'Ya has seleccionado el número máximo de jugadores.');
            return;
        }
        setSelectedPlayers([...selectedPlayers, player]);
        setIsPlayerModalVisible(false);
        setSearchQuery('');
    };

    const handleRemovePlayer = (playerId: string) => {
        setSelectedPlayers(selectedPlayers.filter(p => p.id !== playerId));
    };

    const generateTournament = async (forceIncomplete: boolean = false) => {
        const targetCount = parseInt(playersCount) || 0;
        if (!forceIncomplete && selectedPlayers.length !== targetCount) {
            Alert.alert('Faltan jugadores', `Debes seleccionar exactamente ${targetCount} jugadores.`);
            return;
        }

        setIsSubmitting(true);
        try {
            // 1. Create Tournament
            const finalTournamentName = tournamentName.trim() || `Torneo ${category.toUpperCase().replace('-', ' ')}`;
            const { data: tourData, error: tourError } = await supabase
                .from('tournaments')
                .insert([{
                    name: finalTournamentName,
                    modality,
                    category,
                    format,
                    set_type: setType,
                    short_set_games: setType === 'short' ? parseInt(shortSetGames) || 4 : null,
                    status: 'draft',
                    start_date: new Date().toISOString()
                }])
                .select()
                .single();

            if (tourError) throw tourError;
            const tournamentId = tourData.id;

            // 2. Create Tournament Players
            const playersToInsert = selectedPlayers.map((p, index) => ({
                tournament_id: tournamentId,
                profile_id: p.id,
                seed: index + 1 // Assign seed sequentially for now
            }));

            const { error: playersError } = await supabase
                .from('tournament_players')
                .insert(playersToInsert);

            if (playersError) throw playersError;

            // 3. Generate matches
            const matchesToInsert = [];
            const drawSize = Math.pow(2, Math.ceil(Math.log2(targetCount > 0 ? targetCount : 8)));

            if (format === 'eliminacion' || format === 'consolacion') {
                let matchOrder = 1;
                let currentRoundGames = drawSize / 2;
                let roundNumber = 1;

                while (currentRoundGames >= 1) {
                    let roundName = 'Ronda ' + roundNumber;
                    if (currentRoundGames === 4) roundName = 'Cuartos de Final';
                    if (currentRoundGames === 2) roundName = 'Semifinales';
                    if (currentRoundGames === 1) roundName = 'Gran Final';

                    for (let i = 0; i < currentRoundGames; i++) {
                        let p1 = null;
                        let p2 = null;

                        // Seed logic only for round 1
                        if (roundNumber === 1) {
                            p1 = selectedPlayers[i * 2]?.id || null;
                            p2 = selectedPlayers[i * 2 + 1]?.id || null;
                        }

                        matchesToInsert.push({
                            tournament_id: tournamentId,
                            round_name: roundName,
                            round_number: roundNumber,
                            match_order: matchOrder++,
                            player1_id: p1,
                            player2_id: p2
                        });
                    }

                    // Add 3rd place if it's the final round
                    if (currentRoundGames === 1) {
                        matchesToInsert.push({
                            tournament_id: tournamentId,
                            round_name: '3er y 4to Puesto',
                            round_number: roundNumber, // group with final
                            match_order: matchOrder++,
                            player1_id: null,
                            player2_id: null
                        });
                    }

                    currentRoundGames = currentRoundGames / 2;
                    roundNumber++;
                }
            } else if (format === 'round-robin') {
                // Round Robin Simple Scaffold (Group A)
                let matchOrder = 1;
                const playersToScaffold = selectedPlayers.length > 1 ? selectedPlayers : Array.from({ length: 4 }).map((_, i) => ({ id: null }));

                for (let i = 0; i < playersToScaffold.length; i++) {
                    for (let j = i + 1; j < playersToScaffold.length; j++) {
                        matchesToInsert.push({
                            tournament_id: tournamentId,
                            round_name: 'Fase de Grupos - A',
                            round_number: 1,
                            match_order: matchOrder++,
                            player1_id: playersToScaffold[i].id,
                            player2_id: playersToScaffold[j].id
                        });
                    }
                }
            }

            if (matchesToInsert.length > 0) {
                const { error: matchesError } = await supabase
                    .from('tournament_matches')
                    .insert(matchesToInsert);
                if (matchesError) throw matchesError;
            }

            setCreatedTournamentId(tournamentId);
            setShowSuccessModal(true);

        } catch (error) {
            console.error('Error generating tournament:', error);
            Alert.alert('Error', 'Hubo un problema al crear el torneo.');
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

    const neededPlayers = parseInt(playersCount) || 0;

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Nuevo Torneo</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>

                {/* Visual Area */}
                <View style={styles.heroArea}>
                    <View style={styles.heroOverlay} />
                    <Ionicons name="tennisball" size={48} color={colors.primary[500]} />
                    <Text style={styles.heroText}>Configuración de Cuadro</Text>
                </View>

                {/* Forms */}
                <View style={styles.formSection}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>
                            <Ionicons name="text" size={18} color={colors.primary[500]} />
                            {' '}Nombre del Torneo (Opcional)
                        </Text>
                        <TextInput
                            style={styles.textInput}
                            value={tournamentName}
                            onChangeText={setTournamentName}
                            placeholder={`Ej. Torneo ${category.toUpperCase().replace('-', ' ')}`}
                            placeholderTextColor={colors.textTertiary}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>
                            <Ionicons name="people" size={18} color={colors.primary[500]} />
                            {' '}Número de Jugadores
                        </Text>
                        <TextInput
                            style={styles.textInput}
                            keyboardType="number-pad"
                            value={playersCount}
                            onChangeText={setPlayersCount}
                            placeholder="Ej. 16"
                            placeholderTextColor={colors.textTertiary}
                        />
                    </View>

                    {renderPicker('Modalidad', 'people', modality, setModality, [
                        { label: 'Singles', value: 'singles' },
                        { label: 'Dobles', value: 'dobles' }
                    ])}

                    {renderPicker('Categoría', 'podium', category, setCategory, [
                        { label: 'Escalafón', value: 'escalafon' },
                        { label: 'Honor', value: 'honor' },
                        { label: 'Primera', value: 'primera' },
                        { label: 'Segunda', value: 'segunda' },
                        { label: 'Tercera', value: 'tercera' },
                        { label: 'Cuarta', value: 'cuarta' }
                    ])}

                    {renderPicker('Formato del Torneo', 'git-network', format, setFormat, [
                        { label: 'Eliminación Directa', value: 'eliminacion' },
                        { label: 'Round Robin', value: 'round-robin' },
                        { label: 'Consolación', value: 'consolacion' }
                    ])}

                    {renderPicker('Tipo de Sets', 'time', setType, setSetType, [
                        { label: 'Al mejor de 3 sets', value: 'best3' },
                        { label: 'Set corto', value: 'short' },
                        { label: 'Tie-break a 10 ptos', value: 'tb10' }
                    ])}

                    {setType === 'short' && (
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>
                                <Ionicons name="game-controller-outline" size={18} color={colors.primary[500]} />
                                {' '}Juegos por set
                            </Text>
                            <TextInput
                                style={styles.textInput}
                                keyboardType="number-pad"
                                value={shortSetGames}
                                onChangeText={setShortSetGames}
                                placeholder="Ej. 4"
                                placeholderTextColor={colors.textTertiary}
                            />
                        </View>
                    )}

                    {/* Players List */}
                    <View style={styles.playersSection}>
                        <View style={styles.playersHeader}>
                            <Text style={styles.playersTitle}>
                                <Ionicons name="person-add" size={18} color={colors.primary[500]} />
                                {' '}Lista de Jugadores
                            </Text>
                            <View style={styles.countBadge}>
                                <Text style={styles.countText}>{selectedPlayers.length} / {neededPlayers}</Text>
                            </View>
                        </View>

                        <View style={styles.playersList}>
                            {selectedPlayers.map((player, index) => (
                                <View key={player.id} style={styles.playerRow}>
                                    <View style={styles.playerInfo}>
                                        <View style={styles.playerAvatar}>
                                            <Text style={styles.playerAvatarText}>{index + 1}</Text>
                                        </View>
                                        <Text style={styles.playerName}>{player.full_name}</Text>
                                    </View>
                                    <TouchableOpacity onPress={() => handleRemovePlayer(player.id)}>
                                        <Ionicons name="close" size={20} color={colors.error} />
                                    </TouchableOpacity>
                                </View>
                            ))}

                            {selectedPlayers.length < neededPlayers && (
                                <TouchableOpacity
                                    style={styles.addPlayerRow}
                                    onPress={() => setIsPlayerModalVisible(true)}
                                >
                                    <View style={styles.playerInfo}>
                                        <View style={styles.playerAvatarEmpty}>
                                            <Text style={styles.playerAvatarTextEmpty}>{selectedPlayers.length + 1}</Text>
                                        </View>
                                        <Text style={styles.emptyPlayerText}>Esperando Jugador {selectedPlayers.length + 1}...</Text>
                                    </View>
                                    <Ionicons name="add-circle" size={24} color={colors.primary[500]} />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </View>

            </ScrollView>

            <Modal
                visible={showSuccessModal}
                transparent={true}
                animationType="fade"
            >
                <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.7)' }]}>
                    <View style={[styles.modalContent, { alignItems: 'center', padding: spacing.xl }]}>
                        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.success + '20', justifyContent: 'center', alignItems: 'center', marginBottom: spacing.lg }}>
                            <Ionicons name="checkmark-circle" size={40} color={colors.success} />
                        </View>
                        <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: spacing.xs, textAlign: 'center' }}>Torneo Creado</Text>
                        <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.xl }}>El torneo y sus llaves se han generado exitosamente.</Text>

                        <TouchableOpacity
                            style={[styles.primaryButton, { width: '100%', marginBottom: 0 }]}
                            onPress={() => {
                                setShowSuccessModal(false);
                                router.replace(`/tournaments/${createdTournamentId}` as any);
                            }}
                        >
                            <Text style={[styles.primaryButtonText, { textAlign: 'center' }]}>Ver Torneo</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <View style={[styles.bottomBar, { paddingBottom: insets.bottom || spacing.md }]}>
                {selectedPlayers.length < neededPlayers ? (
                    <TouchableOpacity
                        style={[styles.submitBtn, { backgroundColor: colors.warning }]}
                        onPress={() => generateTournament(true)}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <>
                                <Ionicons name="warning-outline" size={20} color="#fff" />
                                <Text style={styles.submitBtnText}>Forzar Generación Incompleta</Text>
                            </>
                        )}
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
                        onPress={() => generateTournament(false)}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <>
                                <Ionicons name="grid" size={20} color="#fff" />
                                <Text style={styles.submitBtnText}>Generar Cuadro</Text>
                            </>
                        )}
                    </TouchableOpacity>
                )}
            </View>

            {/* Select Player Modal */}
            <Modal
                visible={isPlayerModalVisible}
                animationType="slide"
                presentationStyle="pageSheet"
            >
                <KeyboardAvoidingView
                    style={styles.modalContainer}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                >
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Añadir Jugador</Text>
                        <TouchableOpacity onPress={() => setIsPlayerModalVisible(false)} style={styles.modalCloseBtn}>
                            <Ionicons name="close" size={24} color={colors.text} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.searchBox}>
                        <Ionicons name="search" size={20} color={colors.textTertiary} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Buscar alumno..."
                            placeholderTextColor={colors.textTertiary}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            autoFocus
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')}>
                                <Ionicons name="close-circle" size={20} color={colors.textTertiary} />
                            </TouchableOpacity>
                        )}
                    </View>

                    {isSearching ? (
                        <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.primary[500]} />
                    ) : (
                        <FlatList
                            data={searchResults}
                            keyExtractor={item => item.id}
                            contentContainerStyle={styles.modalList}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={styles.searchResultRow}
                                    onPress={() => handleAddPlayer(item)}
                                >
                                    <View style={styles.searchResultAvatar}>
                                        <Text style={styles.searchResultInitials}>
                                            {item.full_name?.substring(0, 2).toUpperCase()}
                                        </Text>
                                    </View>
                                    <View>
                                        <Text style={styles.searchResultName}>{item.full_name}</Text>
                                        <Text style={styles.searchResultEmail}>{item.email}</Text>
                                    </View>
                                </TouchableOpacity>
                            )}
                            ListEmptyComponent={
                                <Text style={styles.modalEmpty}>No se encontraron jugadores.</Text>
                            }
                        />
                    )}
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingVertical: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
    backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
    title: { fontSize: 18, fontWeight: '700', color: colors.text },

    scrollContent: { paddingBottom: 100 },

    heroArea: { height: 120, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center', position: 'relative', overflow: 'hidden' },
    heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.primary[500] + '10' },
    heroText: { marginTop: spacing.xs, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, color: colors.textSecondary },

    formSection: { padding: spacing.xl, gap: spacing.lg },

    inputGroup: { gap: spacing.sm },
    label: { fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.xs },
    textInput: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.lg, height: 56, paddingHorizontal: spacing.xl, fontSize: 16, color: colors.text },

    pickerContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    pickerOption: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
    pickerOptionActive: { backgroundColor: colors.primary[500] + '15', borderColor: colors.primary[500] },
    pickerOptionText: { fontSize: 14, fontWeight: '500', color: colors.textSecondary },
    pickerOptionTextActive: { color: colors.primary[500], fontWeight: '700' },

    playersSection: { marginTop: spacing.md },
    playersHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
    playersTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
    countBadge: { backgroundColor: colors.primary[500] + '15', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
    countText: { fontSize: 12, fontWeight: '700', color: colors.primary[500] },

    playersList: { gap: spacing.sm },
    playerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border },
    playerInfo: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    playerAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary[500], justifyContent: 'center', alignItems: 'center' },
    playerAvatarText: { color: '#fff', fontSize: 12, fontWeight: '700' },
    playerName: { fontSize: 15, fontWeight: '500', color: colors.text },

    addPlayerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed' },
    playerAvatarEmpty: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.border, justifyContent: 'center', alignItems: 'center' },
    playerAvatarTextEmpty: { color: colors.textTertiary, fontSize: 12, fontWeight: '700' },
    emptyPlayerText: { fontSize: 15, color: colors.textTertiary, fontStyle: 'italic' },

    bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.background, paddingHorizontal: spacing.xl, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
    submitBtn: { backgroundColor: colors.primary[500], height: 56, borderRadius: borderRadius.xl, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.sm },
    submitBtnDisabled: { opacity: 0.5 },
    submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

    // Modal Styles
    modalContainer: { flex: 1, backgroundColor: colors.background },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.xl, borderBottomWidth: 1, borderBottomColor: colors.border },
    modalTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
    modalCloseBtn: { padding: spacing.xs },
    searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, margin: spacing.xl, paddingHorizontal: spacing.md, height: 48, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border },
    searchInput: { flex: 1, marginLeft: spacing.sm, fontSize: 16, color: colors.text },
    modalList: { paddingHorizontal: spacing.xl, paddingBottom: spacing['4xl'] },
    searchResultRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
    searchResultAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary[500] + '20', justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
    searchResultInitials: { fontSize: 14, fontWeight: '700', color: colors.primary[500] },
    searchResultName: { fontSize: 16, fontWeight: '500', color: colors.text },
    searchResultEmail: { fontSize: 13, color: colors.textSecondary },
    modalEmpty: { textAlign: 'center', color: colors.textTertiary, marginTop: spacing.xl },
});
