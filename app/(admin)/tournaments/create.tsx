import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Dimensions, KeyboardAvoidingView, Platform, Modal, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, borderRadius } from '@/theme';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/services/supabase';
import { DateField } from '@/components/DateField';
import { buildTournamentDescription, buildTournamentFormatLabel, createInitialMatches, normalizeTournamentFormat } from '@/services/tournamentStructure';
import { TOURNAMENT_CATEGORIES, CHILEAN_COMUNAS } from '@/constants/tournamentOptions';
import { buildDescriptionWithRankingPoints, DEFAULT_RANKING_POINTS } from '@/services/ranking';
import { canManageOrganization, getCurrentUserAccessContext } from '@/services/accessControl';
import { TennisSpinner } from '@/components/TennisSpinner';

const { width } = Dimensions.get('window');

const CATEGORIES = TOURNAMENT_CATEGORIES;
const FORMATS = ['Eliminación Directa', 'Round Robin', 'Eliminación Directa con Repechaje'];
const SET_TYPES = ['Al mejor de 3 Sets', 'Set Corto', 'Al mejor de 5 Sets'];
const SURFACES = ['Arcilla', 'Césped', 'Dura', 'Carpeta'];
const STATUS_OPTIONS = ['Publicado', 'No Publicado'];
const STATUS_MAP: { [key: string]: string } = {
    'Publicado': 'open',
    'No Publicado': 'draft'
};

type RankingPointRow = {
    id: string;
    place: string;
    points: string;
};

// CHILEAN_COMUNAS is now imported from constants/tournamentOptions

export default function CreateTournamentScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { orgId } = useLocalSearchParams<{ orgId: string | string[] }>();
    const routeOrgId = Array.isArray(orgId) ? orgId[0] : orgId;
    const { colors } = useTheme();
    const styles = getStyles(colors);
    const [activeOrgId, setActiveOrgId] = useState<string | null>(routeOrgId || null);

    useEffect(() => {
        const checkAccess = async () => {
            const access = await getCurrentUserAccessContext();
            if (!access) {
                router.replace('/(auth)/login');
                return;
            }

            let resolvedOrgId = routeOrgId || null;
            if (!resolvedOrgId && !access.isSuperAdmin && access.profile.org_id) {
                resolvedOrgId = access.profile.org_id;
            }

            if (!resolvedOrgId) {
                router.replace('/(tabs)/tournaments');
                return;
            }

            setActiveOrgId(resolvedOrgId);
            const canManage = canManageOrganization(access, resolvedOrgId);

            if (!canManage) {
                router.replace('/(tabs)/tournaments');
            }
        };
        checkAccess();
    }, [routeOrgId]);

    const [tournamentName, setTournamentName] = useState('');
    const [numPlayers, setNumPlayers] = useState('');
    const [modality, setModality] = useState('singles');
    const [category, setCategory] = useState(CATEGORIES[0]);
    const [format, setFormat] = useState(FORMATS[0]);
    const [setType, setSetType] = useState(SET_TYPES[0]);
    const [surface, setSurface] = useState(SURFACES[0]);
    const [status, setStatus] = useState(STATUS_OPTIONS[0]);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [registrationFee, setRegistrationFee] = useState('');
    const [groupCount, setGroupCount] = useState('2');
    const [address, setAddress] = useState('');
    const [comuna, setComuna] = useState('');
    const rankingPointRowCounter = useRef(4);
    const nextRankingPointRowId = () => {
        rankingPointRowCounter.current += 1;
        return `ranking-point-${rankingPointRowCounter.current}`;
    };
    const [rankingPoints, setRankingPoints] = useState<RankingPointRow[]>([
        { id: 'ranking-point-1', place: '1', points: String(DEFAULT_RANKING_POINTS['1']) },
        { id: 'ranking-point-2', place: '2', points: String(DEFAULT_RANKING_POINTS['2']) },
        { id: 'ranking-point-3', place: '3', points: String(DEFAULT_RANKING_POINTS['3']) },
        { id: 'ranking-point-4', place: '4', points: String(DEFAULT_RANKING_POINTS['4']) },
    ]);

    const [players, setPlayers] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [showPlayerModal, setShowPlayerModal] = useState(false);

    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [showFormatModal, setShowFormatModal] = useState(false);
    const [showSetTypeModal, setShowSetTypeModal] = useState(false);
    const [showSurfaceModal, setShowSurfaceModal] = useState(false);
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [showComunaModal, setShowComunaModal] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    const searchPlayers = async (query: string) => {
        setSearchQuery(query);
        if (query.length < 2) {
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        const queryBuilder = supabase
            .from('public_profiles')
            .select('id, name')
            .ilike('name', `%${query}%`)
            .limit(10);

        const { data, error } = await queryBuilder;

        if (error) {
            setSearchResults([]);
        } else if (data) {
            setSearchResults(data);
        }
        setIsSearching(false);
    };

    const addPlayer = (player: any) => {
        if (players.length >= parseInt(numPlayers)) return;
        if (players.find(p => p.id === player.id)) return;

        setPlayers([...players, player]);
        setShowPlayerModal(false);
        setSearchQuery('');
        setSearchResults([]);
    };

    const removePlayer = (id: string) => {
        setPlayers(players.filter(p => p.id !== id));
    };

    const createSingleEliminationDraw = async (tournamentId: string, participants: any[]) => {
        const totalSlots = parseInt(numPlayers);
        if (totalSlots < 2) return;

        const roundsCount = Math.log2(totalSlots);
        const matches: any[] = [];
        let matchCounter = 1;

        // 1. Generate First Round with available participants
        for (let i = 0; i < totalSlots / 2; i++) {
            const playerA = participants[i * 2] || null;
            const playerB = participants[i * 2 + 1] || null;

            let roundName = 'Octavos de Final';
            if (totalSlots === 2) roundName = 'Gran Final';
            else if (totalSlots === 4) roundName = 'Semifinales';
            else if (totalSlots === 8) roundName = 'Cuartos de Final';

            matches.push({
                tournament_id: tournamentId,
                player_a_id: playerA?.id || null,
                player_b_id: playerB?.id || null,
                round: roundName,
                round_number: 1,
                match_order: matchCounter++,
                status: 'pending'
            });
        }

        // 2. Generate Placeholder matches for subsequent rounds
        let prevRoundMatches = totalSlots / 2;
        for (let r = 2; r <= roundsCount; r++) {
            const currentRoundMatches = prevRoundMatches / 2;
            let roundName = `Ronda ${r}`;
            if (r === roundsCount) roundName = 'Gran Final';
            else if (r === roundsCount - 1) roundName = 'Semifinales';
            else if (r === roundsCount - 2) roundName = 'Cuartos de Final';

            for (let i = 0; i < currentRoundMatches; i++) {
                matches.push({
                    tournament_id: tournamentId,
                    player_a_id: null,
                    player_b_id: null,
                    round: roundName,
                    round_number: r,
                    match_order: matchCounter++,
                    status: 'pending'
                });
            }
            prevRoundMatches = currentRoundMatches;
        }

        const { error } = await supabase.from('matches').insert(matches);
        if (error) throw error;

        // 3. Generate Consolación matches if Repechaje
        if (format.includes('Repechaje') && totalSlots >= 4) {
            const consolationMatches: any[] = [];
            const playersInConsolidation = totalSlots / 2;
            let consolationRounds = Math.log2(playersInConsolidation);
            let cMatchCounter = 1001;

            let prevCRoundMatches = playersInConsolidation / 2;
            for (let r = 1; r <= consolationRounds; r++) {
                const currentRoundMatches = prevCRoundMatches;
                let roundName = `Consolación - Ronda ${r}`;
                if (r === consolationRounds) roundName = 'Consolación - Final';
                else if (r === consolationRounds - 1) roundName = 'Consolación - Semifinales';

                for (let i = 0; i < currentRoundMatches; i++) {
                    consolationMatches.push({
                        tournament_id: tournamentId,
                        player_a_id: null,
                        player_b_id: null,
                        round: roundName,
                        round_number: r,
                        match_order: cMatchCounter++,
                        status: 'pending'
                    });
                }
                prevCRoundMatches = currentRoundMatches / 2;
            }

            if (consolationMatches.length > 0) {
                const { error: cError } = await supabase.from('matches').insert(consolationMatches);
                if (cError) throw cError;
            }
        }
    };

    const createRoundRobinDraw = async (tournamentId: string, participants: any[]) => {
        const totalSlots = parseInt(numPlayers);
        if (totalSlots < 2) return;

        const matches: any[] = [];
        let matchCounter = 1;

        // Group A: top half, Group B: bottom half
        const groupASlots = Math.ceil(totalSlots / 2);
        const groupBSlots = totalSlots - groupASlots;

        // Generate Group Stage Matches (Placeholder matches for the grid)
        // Group A
        for (let i = 0; i < groupASlots; i++) {
            for (let j = i + 1; j < groupASlots; j++) {
                matches.push({
                    tournament_id: tournamentId,
                    player_a_id: participants[i]?.id || null,
                    player_b_id: participants[j]?.id || null,
                    round: 'Grupo A',
                    round_number: 1,
                    match_order: matchCounter++,
                    status: 'pending'
                });
            }
        }

        // Group B
        for (let i = groupASlots; i < totalSlots; i++) {
            for (let j = i + 1; j < totalSlots; j++) {
                matches.push({
                    tournament_id: tournamentId,
                    player_a_id: participants[i]?.id || null,
                    player_b_id: participants[j]?.id || null,
                    round: 'Grupo B',
                    round_number: 1,
                    match_order: matchCounter++,
                    status: 'pending'
                });
            }
        }

        // Finals stage (1st A vs 2nd B, etc.)
        const finalRounds = ['Semifinales RR', 'Gran Final RR'];
        finalRounds.forEach((round, idx) => {
            const count = round.includes('Final') ? 1 : 2;
            for (let i = 0; i < count; i++) {
                matches.push({
                    tournament_id: tournamentId,
                    player_a_id: null,
                    player_b_id: null,
                    round: round,
                    round_number: idx + 2,
                    match_order: matchCounter++,
                    status: 'pending'
                });
            }
        });

        if (matches.length > 0) {
            const { error } = await supabase.from('matches').insert(matches);
            if (error) throw error;
        }
    };

    const handleCreate = async () => {
        if (!tournamentName || !activeOrgId || !startDate || !endDate) {
            Alert.alert('Error', 'Por favor ingresa nombre, fecha de inicio y fecha de fin.');
            return;
        }

        if (endDate < startDate) {
            Alert.alert('Error', 'La fecha de fin no puede ser menor que la fecha de inicio.');
            return;
        }
        setIsGenerating(true);

        try {
            // 1. Create Tournament
            const tournamentFormat = buildTournamentFormatLabel(format, { groupCount: parseInt(groupCount) || 2 });
            const tournamentDescription = buildDescriptionWithRankingPoints(
                rankingPoints.reduce((acc, currentRow) => {
                    const key = currentRow.place.trim();
                    if (!key) return acc;
                    acc[key] = parseInt(currentRow.points) || 0;
                    return acc;
                }, {} as Record<string, number>),
                buildTournamentDescription(parseInt(groupCount) || 2)
            );
            const { data: tournament, error: tError } = await supabase
                .from('tournaments')
                .insert({
                    name: tournamentName,
                    organization_id: activeOrgId,
                    level: category,
                    format: tournamentFormat,
                    description: tournamentDescription,
                    set_type: setType,
                    max_players: parseInt(numPlayers),
                    status: STATUS_MAP[status] || 'open',
                    start_date: startDate,
                    end_date: endDate,
                    surface: surface,
                    registration_fee: parseInt(registrationFee) || 0,
                    address: address,
                    comuna: comuna,
                    modality: modality
                })
                .select('id')
                .single();

            if (tError) throw tError;

            // 2. Register Players
            if (players.length > 0) {
                const registrations = players.map(p => ({
                    tournament_id: tournament.id,
                    player_id: p.id,
                    status: 'confirmed',
                    fee_amount: parseInt(registrationFee) || 0,
                    is_paid: false
                }));

                const { error: rError } = await supabase
                    .from('registrations')
                    .insert(registrations);

                if (rError) throw rError;
            }

            // 3. Generate the editable structure immediately, even without players
            const initialMatches = createInitialMatches({
                tournamentId: tournament.id,
                format: tournamentFormat,
                description: tournamentDescription,
                maxPlayers: parseInt(numPlayers) || 2,
                participants: [],
                modality: modality
            });
            if (initialMatches.length > 0) {
                const { error: mError } = await supabase.from('matches').insert(initialMatches);
                if (mError) throw mError;
            }

            Alert.alert('Éxito', 'Torneo creado y cuadro generado correctamente.');
            router.replace(`/(admin)/tournaments/${tournament.id}`);
        } catch (error) {
            Alert.alert('Error', 'No se pudo crear el torneo. Revisa la consola para más detalles.');
        } finally {
            setIsGenerating(false);
        }
    };


    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={[styles.header, { paddingTop: Math.max(insets.top, spacing.md) }]}>
                <View style={styles.headerContent}>
                    <TouchableOpacity onPress={() => router.push({ pathname: '/(tabs)/tournaments', params: { orgId: activeOrgId || '' } })} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Nuevo Torneo</Text>
                    <View style={{ width: 40 }} />
                </View>
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    {/* Hero Visual Area */}
                    <View style={styles.heroSection}>
                        <LinearGradient
                            colors={['#2d5a27', '#1a3a16']}
                            style={styles.heroGradient}
                        >
                            <View style={styles.heroOverlay} />
                            <Ionicons name="tennisball" size={48} color={colors.primary[500]} />
                            <Text style={styles.heroText}>CONFIGURACIÓN DE CUADRO</Text>
                        </LinearGradient>
                    </View>

                    {/* Form Fields */}
                    <View style={styles.form}>
                        {/* Tournament Name */}
                        <View style={styles.inputGroup}>
                            <View style={styles.labelRow}>
                                <Ionicons name="trophy-outline" size={18} color={colors.primary[500]} />
                                <Text style={styles.label}>Nombre del Torneo</Text>
                            </View>
                            <TextInput
                                style={styles.input}
                                value={tournamentName}
                                onChangeText={setTournamentName}
                                placeholder="Ej. Torneo de Verano 2024"
                                placeholderTextColor={colors.textTertiary}
                            />
                        </View>

                        {/* Registration Fee */}
                        <View style={styles.inputGroup}>
                            <View style={styles.labelRow}>
                                <Ionicons name="cash-outline" size={18} color={colors.primary[500]} />
                                <Text style={styles.label}>Valor de Inscripción ($)</Text>
                            </View>
                            <TextInput
                                style={styles.input}
                                value={registrationFee}
                                onChangeText={setRegistrationFee}
                                keyboardType="numeric"
                                placeholder="Ej. 20000"
                                placeholderTextColor={colors.textTertiary}
                            />
                        </View>

                        {/* Address */}
                        <View style={styles.inputGroup}>
                            <View style={styles.labelRow}>
                                <Ionicons name="location-outline" size={18} color={colors.primary[500]} />
                                <Text style={styles.label}>Dirección</Text>
                            </View>
                            <TextInput
                                style={styles.input}
                                value={address}
                                onChangeText={setAddress}
                                placeholder="Ej. Avenida Principal 123"
                                placeholderTextColor={colors.textTertiary}
                            />
                        </View>

                        {/* Comuna */}
                        <View style={styles.inputGroup}>
                            <View style={styles.labelRow}>
                                <Ionicons name="map-outline" size={18} color={colors.primary[500]} />
                                <Text style={styles.label}>Comuna</Text>
                            </View>
                            <TouchableOpacity style={styles.dropdown} onPress={() => setShowComunaModal(true)}>
                                <Text style={styles.dropdownText}>{comuna || 'Seleccionar comuna...'}</Text>
                                <Ionicons name="chevron-down" size={20} color={colors.textTertiary} />
                            </TouchableOpacity>
                        </View>

                        {/* Num Players */}
                        <View style={styles.inputGroup}>

                            <View style={styles.labelRow}>
                                <Ionicons name="people" size={18} color={colors.primary[500]} />
                                <Text style={styles.label}>Número de Jugadores</Text>
                            </View>
                            <TextInput
                                style={styles.input}
                                value={numPlayers}
                                onChangeText={setNumPlayers}
                                keyboardType="numeric"
                                placeholder="Ej. 16"
                                placeholderTextColor={colors.textTertiary}
                            />
                        </View>

                        <DateField label="Fecha de Inicio" value={startDate} onChange={setStartDate} />

                        <DateField label="Fecha de Fin" value={endDate} onChange={setEndDate} />

                        {/* Modality */}
                        <View style={styles.inputGroup}>
                            <View style={styles.labelRow}>
                                <Ionicons name="people-circle" size={18} color={colors.primary[500]} />
                                <Text style={styles.label}>Modalidad</Text>
                            </View>
                            <View style={styles.selectRow}>
                                <TouchableOpacity
                                    style={[styles.selectOption, modality === 'singles' && styles.selectOptionActive]}
                                    onPress={() => setModality('singles')}
                                >
                                    <Text style={[styles.selectOptionText, modality === 'singles' && styles.selectOptionTextActive]}>Singles</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.selectOption, modality === 'dobles' && styles.selectOptionActive]}
                                    onPress={() => setModality('dobles')}
                                >
                                    <Text style={[styles.selectOptionText, modality === 'dobles' && styles.selectOptionTextActive]}>Dobles</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Category */}
                        <View style={styles.inputGroup}>
                            <View style={styles.labelRow}>
                                <Ionicons name="ribbon-outline" size={18} color={colors.primary[500]} />
                                <Text style={styles.label}>Categoría</Text>
                            </View>
                            <TouchableOpacity style={styles.dropdown} onPress={() => setShowCategoryModal(true)}>
                                <Text style={styles.dropdownText}>{category}</Text>
                                <Ionicons name="chevron-down" size={20} color={colors.textTertiary} />
                            </TouchableOpacity>
                        </View>

                        {/* Format */}
                        <View style={styles.inputGroup}>
                            <View style={styles.labelRow}>
                                <Ionicons name="grid-outline" size={18} color={colors.primary[500]} />
                                <Text style={styles.label}>Formato del Torneo</Text>
                            </View>
                            <TouchableOpacity style={styles.dropdown} onPress={() => setShowFormatModal(true)}>
                                <Text style={styles.dropdownText}>{format}</Text>
                                <Ionicons name="chevron-down" size={20} color={colors.textTertiary} />
                            </TouchableOpacity>
                        </View>

                        {normalizeTournamentFormat(format) === 'round_robin' && (
                            <View style={styles.inputGroup}>
                                <View style={styles.labelRow}>
                                    <Ionicons name="git-branch-outline" size={18} color={colors.primary[500]} />
                                    <Text style={styles.label}>Cantidad de Grupos</Text>
                                </View>
                                <TextInput
                                    style={styles.input}
                                    value={groupCount}
                                    onChangeText={setGroupCount}
                                    keyboardType="numeric"
                                    placeholder="Ej. 2"
                                    placeholderTextColor={colors.textTertiary}
                                />
                            </View>
                        )}

                        {/* Set Type */}
                        <View style={styles.inputGroup}>
                            <View style={styles.labelRow}>
                                <Ionicons name="time-outline" size={18} color={colors.primary[500]} />
                                <Text style={styles.label}>Tipo de Sets</Text>
                            </View>
                            <TouchableOpacity style={styles.dropdown} onPress={() => setShowSetTypeModal(true)}>
                                <Text style={styles.dropdownText}>{setType}</Text>
                                <Ionicons name="chevron-down" size={20} color={colors.textTertiary} />
                            </TouchableOpacity>
                        </View>

                        {/* Surface */}
                        <View style={styles.inputGroup}>
                            <View style={styles.labelRow}>
                                <Ionicons name="layers-outline" size={18} color={colors.primary[500]} />
                                <Text style={styles.label}>Superficie</Text>
                            </View>
                            <TouchableOpacity style={styles.dropdown} onPress={() => setShowSurfaceModal(true)}>
                                <Text style={styles.dropdownText}>{surface}</Text>
                                <Ionicons name="chevron-down" size={20} color={colors.textTertiary} />
                            </TouchableOpacity>
                        </View>

                        {/* Status */}
                        <View style={styles.inputGroup}>
                            <View style={styles.labelRow}>
                                <Ionicons name="eye-outline" size={18} color={colors.primary[500]} />
                                <Text style={styles.label}>Estado Inicial</Text>
                            </View>
                            <TouchableOpacity style={styles.dropdown} onPress={() => setShowStatusModal(true)}>
                                <Text style={styles.dropdownText}>{status}</Text>
                                <Ionicons name="chevron-down" size={20} color={colors.textTertiary} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.inputGroup}>
                            <View style={styles.labelRow}>
                                <Ionicons name="trophy-outline" size={18} color={colors.primary[500]} />
                                <Text style={styles.label}>Puntos para Ranking</Text>
                            </View>
                            <View style={{ gap: spacing.sm }}>
                                {rankingPoints.map((item, index) => (
                                    <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                                        <TextInput
                                            style={[styles.input, { flex: 1.3 }]}
                                            value={item.place}
                                            onChangeText={(value) => setRankingPoints((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, place: value } : row))}
                                            placeholder="Ej. 1 o 5-8"
                                            placeholderTextColor={colors.textTertiary}
                                        />
                                        <TextInput
                                            style={[styles.input, { flex: 1 }]}
                                            value={item.points}
                                            onChangeText={(value) => setRankingPoints((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, points: value } : row))}
                                            keyboardType="numeric"
                                            placeholder="Puntos"
                                            placeholderTextColor={colors.textTertiary}
                                        />
                                        {index >= 4 && (
                                            <TouchableOpacity onPress={() => setRankingPoints((current) => current.filter((_, rowIndex) => rowIndex !== index))}>
                                                <Ionicons name="trash-outline" size={20} color={colors.error} />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                ))}
                                <TouchableOpacity
                                    style={[styles.dropdown, { justifyContent: 'center', alignItems: 'center' }]}
                                    onPress={() => setRankingPoints((current) => [...current, { id: nextRankingPointRowId(), place: '', points: '' }])}
                                >
                                    <Text style={styles.dropdownText}>Agregar tramo manual</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Players List */}
                        <View style={styles.playersSection}>
                            <View style={styles.sectionHeader}>
                                <View style={styles.labelRow}>
                                    <Ionicons name="person-add" size={18} color={colors.primary[500]} />
                                    <Text style={styles.sectionTitle}>Lista de Jugadores</Text>
                                </View>
                                <View style={styles.countBadge}>
                                    <Text style={styles.countText}>{players.length} / {numPlayers}</Text>
                                </View>
                            </View>

                            <View style={styles.playerList}>
                                {players.map((p, idx) => (
                                    <View key={p.id} style={styles.playerRow}>
                                        <View style={styles.playerInfo}>
                                            <View style={styles.playerNumber}>
                                                <Text style={styles.playerNumberText}>{idx + 1}</Text>
                                            </View>
                                            <View>
                                                <Text style={styles.playerName}>{p.name}</Text>
                                            </View>
                                        </View>
                                        <TouchableOpacity onPress={() => removePlayer(p.id)}>
                                            <Ionicons name="close-circle" size={20} color={colors.error} />
                                        </TouchableOpacity>
                                    </View>
                                ))}

                                {players.length < parseInt(numPlayers) && (
                                    <TouchableOpacity
                                        style={[styles.playerRow, styles.addPlayerRow]}
                                        onPress={() => setShowPlayerModal(true)}
                                    >
                                        <View style={styles.playerInfo}>
                                            <View style={[styles.playerNumber, { backgroundColor: colors.surfaceSecondary }]}>
                                                <Text style={[styles.playerNumberText, { color: colors.textTertiary }]}>{players.length + 1}</Text>
                                            </View>
                                            <Text style={styles.addPlayerText}>Añadir jugador...</Text>
                                        </View>
                                        <Ionicons name="add-circle" size={24} color={colors.primary[500]} />
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Modales de Selección */}
            <SelectionModal
                visible={showCategoryModal}
                title="Seleccionar Categoría"
                options={CATEGORIES}
                onSelect={(val: string) => { setCategory(val); setShowCategoryModal(false); }}
                onClose={() => setShowCategoryModal(false)}
            />
            <SelectionModal
                visible={showFormatModal}
                title="Formato de Torneo"
                options={FORMATS}
                onSelect={(val: string) => { setFormat(val); setShowFormatModal(false); }}
                onClose={() => setShowFormatModal(false)}
            />
            <SelectionModal
                visible={showSetTypeModal}
                title="Tipo de Sets"
                options={SET_TYPES}
                onSelect={(val: string) => { setSetType(val); setShowSetTypeModal(false); }}
                onClose={() => setShowSetTypeModal(false)}
            />
            <SelectionModal
                visible={showSurfaceModal}
                title="Seleccionar Superficie"
                options={SURFACES}
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
            <SelectionModal
                visible={showComunaModal}
                title="Seleccionar Comuna"
                options={CHILEAN_COMUNAS}
                onSelect={(val: string) => { setComuna(val); setShowComunaModal(false); }}
                onClose={() => setShowComunaModal(false)}
            />

            {/* Modal de Búsqueda de Jugadores */}
            <Modal visible={showPlayerModal} animationType="slide" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={styles.playerModalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Añadir Jugador</Text>
                            <TouchableOpacity
                                onPress={() => setShowPlayerModal(false)}
                                style={{ width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, justifyContent: 'center', alignItems: 'center' }}
                            >
                                <Ionicons name="close" size={20} color={colors.text} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.searchContainer}>
                            <Ionicons name="search" size={20} color={colors.textTertiary} />
                            <TextInput
                                style={styles.searchBar}
                                placeholder="Buscar por nombre..."
                                placeholderTextColor={colors.textTertiary}
                                value={searchQuery}
                                onChangeText={searchPlayers}
                                autoFocus
                            />
                        </View>

                        {isSearching ? (
                            <TennisSpinner size={28} style={{ marginTop: 20 }} />
                        ) : (
                            <ScrollView style={styles.resultsList}>
                                {searchResults.map(p => (
                                    <TouchableOpacity
                                        key={p.id}
                                        style={styles.resultItem}
                                        onPress={() => addPlayer(p)}
                                    >
                                        <View style={styles.resultInfo}>
                                            <Text style={styles.resultName}>{p.name}</Text>
                                        </View>
                                        <Ionicons name="add-circle-outline" size={24} color={colors.primary[500]} />
                                    </TouchableOpacity>
                                ))}
                                {searchQuery.length >= 2 && searchResults.length === 0 && (
                                    <Text style={styles.noResults}>No se encontraron jugadores.</Text>
                                )}
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>

            {/* Action Button */}
            <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
                <TouchableOpacity
                    style={[styles.generateButton, (isGenerating || !tournamentName) && { opacity: 0.5 }]}
                    onPress={handleCreate}
                    disabled={isGenerating || !tournamentName}
                >
                    {isGenerating ? (
                        <TennisSpinner size={18} color="#fff" />
                    ) : (
                        <>
                            <Ionicons name="grid" size={20} color="#fff" />
                            <Text style={styles.generateButtonText}>GENERAR CUADRO</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>
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
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    headerContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.xl,
        paddingBottom: spacing.md,
        height: 60,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.surfaceSecondary,
        borderWidth: 1,
        borderColor: colors.border,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.text,
    },
    scrollContent: {
        paddingBottom: 120,
    },
    heroSection: {
        padding: spacing.xl,
    },
    heroGradient: {
        height: 140,
        borderRadius: borderRadius.xl,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    heroOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.2)',
    },
    heroText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 2,
        marginTop: spacing.sm,
    },
    form: {
        paddingHorizontal: spacing.xl,
        gap: spacing.xl,
    },
    inputGroup: {
        gap: spacing.sm,
    },
    labelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    label: {
        fontSize: 14,
        fontWeight: '700',
        color: colors.textSecondary,
    },
    input: {
        height: 56,
        backgroundColor: colors.surface,
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: spacing.lg,
        color: colors.text,
        fontSize: 16,
        fontWeight: '600',
    },
    selectRow: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    selectOption: {
        flex: 1,
        height: 56,
        backgroundColor: colors.surface,
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: colors.border,
        justifyContent: 'center',
        alignItems: 'center',
    },
    selectOptionActive: {
        backgroundColor: colors.primary[500] + '20',
        borderColor: colors.primary[500],
    },
    selectOptionText: {
        color: colors.textSecondary,
        fontSize: 14,
        fontWeight: '700',
    },
    selectOptionTextActive: {
        color: colors.primary[500],
    },
    dropdown: {
        height: 56,
        backgroundColor: colors.surface,
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: spacing.lg,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    dropdownText: {
        color: colors.text,
        fontSize: 16,
        fontWeight: '600',
    },
    playersSection: {
        marginTop: spacing.xl,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.text,
    },
    countBadge: {
        backgroundColor: 'rgba(236, 91, 19, 0.1)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: borderRadius.full,
    },
    countText: {
        color: colors.primary[500],
        fontSize: 12,
        fontWeight: '800',
    },
    playerList: {
        gap: spacing.sm,
    },
    playerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: colors.surface,
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.border,
    },
    playerInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    playerNumber: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#2d5a27',
        justifyContent: 'center',
        alignItems: 'center',
    },
    playerNumberText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '800',
    },
    playerName: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '600',
    },
    addPlayerRow: {
        borderStyle: 'dashed',
        opacity: 0.7,
    },
    addPlayerText: {
        color: colors.textTertiary,
        fontSize: 14,
        fontWeight: '600',
    },
    playerEmail: {
        fontSize: 10,
        color: colors.textTertiary,
    },
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
    playerModalContent: {
        width: '100%',
        backgroundColor: colors.surface,
        borderRadius: borderRadius['2xl'],
        padding: spacing.xl,
        height: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.xl,
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
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surfaceSecondary,
        borderRadius: borderRadius.lg,
        paddingHorizontal: spacing.md,
        marginBottom: spacing.lg,
    },
    searchBar: {
        flex: 1,
        height: 48,
        color: colors.text,
        marginLeft: spacing.sm,
        fontSize: 14,
    },
    resultsList: {
        flex: 1,
    },
    resultItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    resultInfo: {
        flex: 1,
    },
    resultName: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '700',
    },
    resultEmail: {
        color: colors.textTertiary,
        fontSize: 12,
    },
    noResults: {
        color: colors.textTertiary,
        textAlign: 'center',
        marginTop: 20,
    },
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: spacing.xl,
        backgroundColor: colors.background,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    generateButton: {
        height: 60,
        backgroundColor: colors.primary[500],
        borderRadius: borderRadius.xl,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: spacing.sm,
        shadowColor: colors.primary[500],
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
    },
    generateButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '900',
        letterSpacing: 1,
    }
    });
}
