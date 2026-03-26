import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Alert, Image, BackHandler } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, borderRadius } from '@/theme';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { SingleEliminationBracket } from '@/components/brackets/SingleEliminationBracket';
import { RoundRobinTable } from '@/components/brackets/RoundRobinTable';
import { TournamentFinals } from '@/components/brackets/TournamentFinals';
import { supabase } from '@/services/supabase';
import { getRoundRobinGroupNames, getRoundRobinSlots, hasConsolationBracket, isRoundRobinFormat } from '@/services/tournamentStructure';
import { TennisSpinner } from '@/components/TennisSpinner';
import { resolveStorageAssetUrl } from '@/services/storage';
import { RegistrationProofModal } from '@/components/tournaments/RegistrationProofModal';
import {
    TournamentRegistrationRequest,
    getRequestStatusLabel,
    isRegistrationWindowClosed,
    submitTournamentRegistrationRequest,
} from '@/services/registrationRequests';

const { width } = Dimensions.get('window');
const OPEN_STATUSES = new Set(['open', 'ongoing', 'in_progress']);

const getReadableRequestError = (error: unknown) => {
    const raw = String((error as any)?.message || '').trim();
    const normalized = raw.toLowerCase();

    if (!raw) return 'No se pudo enviar el comprobante.';
    if (normalized.includes('duplicate') || normalized.includes('pending_uidx')) {
        return 'Ya tienes una solicitud pendiente para este torneo.';
    }
    if (normalized.includes('registration request deadline reached')) {
        return 'Se cumplio la fecha de cierre de inscripciones.';
    }
    if (normalized.includes('registration request window is closed')) {
        return 'Este torneo ya no acepta solicitudes.';
    }
    if (normalized.includes('invalid proof_path')) {
        return 'El comprobante no cumple el formato permitido. Usa JPG, PNG, WEBP, HEIC o HEIF.';
    }

    return raw;
};

const formatRegistrationDeadline = (dateValue?: string | null, timeValue?: string | null) => {
    if (!dateValue) return null;
    const parsedDate = new Date(`${dateValue}T00:00:00`);
    const dateLabel = Number.isNaN(parsedDate.getTime())
        ? dateValue
        : parsedDate.toLocaleDateString('es-ES');
    const timeLabel = String(timeValue || '').slice(0, 5) || '23:59';
    return `${dateLabel} ${timeLabel}`;
};

export default function TournamentDetailScreen() {
    const { id } = useLocalSearchParams();
    const tournamentId = Array.isArray(id) ? id[0] : id;
    const insets = useSafeAreaInsets();
    const { colors } = useTheme();
    const styles = getStyles(colors);
    const router = useRouter();
    const [activeTab, setActiveTab] = useState('principal');
    const [tournament, setTournament] = useState<any>(null);
    const [matches, setMatches] = useState<any[]>([]);
    const [isRegistered, setIsRegistered] = useState(false);
    const [latestRequest, setLatestRequest] = useState<TournamentRegistrationRequest | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showProofModal, setShowProofModal] = useState(false);
    const [selectedProofUri, setSelectedProofUri] = useState<string | null>(null);
    const [selectedProofMimeType, setSelectedProofMimeType] = useState<string | null>(null);
    const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);

    useEffect(() => {
        if (tournamentId) {
            loadTournamentData();
        }

        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            router.back();
            return true;
        });

        return () => backHandler.remove();
    }, [tournamentId]);

    const loadTournamentData = async () => {
        setIsLoading(true);
        try {
            // Fetch Tournament
            const { data: tourData, error: tourErr } = await supabase
                .from('tournaments')
                .select('id, name, status, format, level, set_type, surface, start_date, address, comuna, registration_fee, max_players, description, modality, organization_id, parent_tournament_id, registration_close_at, registration_close_time, is_tournament_master')
                .eq('id', tournamentId)
                .single();
            
            if (tourErr) throw tourErr;
            let effectiveRegistrationCloseAt = tourData?.registration_close_at || null;
            let effectiveRegistrationCloseTime = tourData?.registration_close_time || null;

            if (tourData?.parent_tournament_id) {
                const { data: parentDeadlineData } = await supabase
                    .from('tournaments')
                    .select('registration_close_at, registration_close_time')
                    .eq('id', tourData.parent_tournament_id)
                    .maybeSingle();

                if (parentDeadlineData?.registration_close_at) {
                    effectiveRegistrationCloseAt = parentDeadlineData.registration_close_at;
                    effectiveRegistrationCloseTime = parentDeadlineData.registration_close_time || null;
                }
            }

            setTournament({
                ...tourData,
                effective_registration_close_at: effectiveRegistrationCloseAt,
                effective_registration_close_time: effectiveRegistrationCloseTime,
            });

            if (tourData?.is_tournament_master) {
                router.replace(`/(tabs)/tournaments/master/${tourData.id}`);
                return;
            }

            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user?.id) {
                const { count } = await supabase
                    .from('registrations')
                    .select('id', { count: 'exact', head: true })
                    .eq('tournament_id', tournamentId)
                    .eq('player_id', session.user.id);
                setIsRegistered(Boolean(count && count > 0));

                const { data: requestRows, error: requestError } = await supabase
                    .from('tournament_registration_requests')
                    .select('id, tournament_id, player_id, status, rejection_reason, proof_path, created_at, updated_at')
                    .eq('tournament_id', tournamentId)
                    .eq('player_id', session.user.id)
                    .order('created_at', { ascending: false })
                    .limit(1);

                if (requestError) throw requestError;
                setLatestRequest((requestRows || [])[0] || null);
            } else {
                setIsRegistered(false);
                setLatestRequest(null);
            }

            // Fetch Matches
            const { data: matchData, error: matchErr } = await supabase
                .from('matches')
                .select(`
                    id,
                    tournament_id,
                    player_a_id,
                    player_a2_id,
                    player_b_id,
                    player_b2_id,
                    round,
                    round_number,
                    match_order,
                    status,
                    score,
                    scheduled_at,
                    court,
                    winner_id,
                    winner_2_id
                `)
                .eq('tournament_id', tournamentId)
                .order('match_order', { ascending: true });
            
            if (matchErr) throw matchErr;

            const loadedMatches = matchData || [];
            const playerIds = [...new Set(
                loadedMatches
                    .flatMap((match: any) => [match.player_a_id, match.player_a2_id, match.player_b_id, match.player_b2_id])
                    .filter(Boolean)
            )];

            let playerNameMap: Record<string, string> = {};
            let playerAvatarMap: Record<string, string | null> = {};
            if (playerIds.length > 0) {
                const { data: playerRows, error: playerErr } = await supabase
                    .from('public_profiles')
                    .select('id, name, avatar_url')
                    .in('id', playerIds);

                if (playerErr) throw playerErr;

                const avatarPaths = [...new Set(
                    (playerRows || [])
                        .map((row: any) => String(row?.avatar_url || '').trim())
                        .filter(Boolean)
                )];
                const signedAvatarByPath = new Map<string, string | null>();
                await Promise.all(
                    avatarPaths.map(async (path) => {
                        const signedUrl = await resolveStorageAssetUrl(path);
                        signedAvatarByPath.set(path, signedUrl || null);
                    })
                );

                playerNameMap = (playerRows || []).reduce((acc: Record<string, string>, currentRow: any) => {
                    acc[currentRow.id] = currentRow.name || 'TBD';
                    return acc;
                }, {});
                playerAvatarMap = (playerRows || []).reduce((acc: Record<string, string | null>, currentRow: any) => {
                    const avatarPath = String(currentRow?.avatar_url || '').trim();
                    acc[currentRow.id] = avatarPath ? (signedAvatarByPath.get(avatarPath) || null) : null;
                    return acc;
                }, {});
            }

            setMatches(
                loadedMatches.map((match: any) => ({
                    ...match,
                    player_a: { name: playerNameMap[match.player_a_id] || 'TBD', avatar_url: playerAvatarMap[match.player_a_id] || null },
                    player_a2: { name: playerNameMap[match.player_a2_id] || 'TBD', avatar_url: playerAvatarMap[match.player_a2_id] || null },
                    player_b: { name: playerNameMap[match.player_b_id] || 'TBD', avatar_url: playerAvatarMap[match.player_b_id] || null },
                    player_b2: { name: playerNameMap[match.player_b2_id] || 'TBD', avatar_url: playerAvatarMap[match.player_b2_id] || null },
                }))
            );

        } catch (error) {
            Alert.alert('Error', 'No se pudo cargar la información del torneo.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (!tournament) return;

        if (isRoundRobinFormat(tournament.format)) {
            const firstGroup = getRoundRobinGroupNames(tournament.format, tournament.description)[0] || 'A';
            if (!activeTab.startsWith('group:') && activeTab !== 'finales') {
                setActiveTab(`group:${firstGroup}`);
            }
            return;
        }

        if (activeTab.startsWith('group:') || activeTab === 'finales') {
            setActiveTab('principal');
        }
    }, [tournament?.format]);

    const transformToRounds = (matchesList: any[]) => {
        const filteredMatches = matchesList.filter(m => {
            const isConsolationMatch = /^Consolaci/i.test(String(m.round || ''));
            if (activeTab === 'consolacion') return isConsolationMatch;
            return !isConsolationMatch;
        });

        const roundsMap: { [key: number]: any } = {};
        filteredMatches.forEach(m => {
            const roundNum = m.round_number || 1;
            if (!roundsMap[roundNum]) {
                roundsMap[roundNum] = {
                    title: m.round || `Ronda ${roundNum}`,
                    matches: []
                };
            }

            const scoreStr = m.score || '';
            const setScores = scoreStr.split(/\s*,\s*/).map((s: string) => s.split('-'));
            
            roundsMap[roundNum].matches.push({
                id: m.id,
                player1: { 
                    name: m.player_a?.name || 'TBD', 
                    avatarUrl: m.player_a?.avatar_url || null,
                    scores: setScores.map((s: string[]) => s[0]).filter((s: string | undefined) => s !== undefined),
                    isWinner: m.winner_id === m.player_a_id && !!m.player_a_id 
                },
                player2: { 
                    name: m.player_b?.name || 'TBD', 
                    avatarUrl: m.player_b?.avatar_url || null,
                    scores: setScores.map((s: string[]) => s[1]).filter((s: string | undefined) => s !== undefined),
                    isWinner: m.winner_id === m.player_b_id && !!m.player_b_id 
                },
                status: m.status === 'finished' ? 'Finalizado' : (m.status === 'live' ? 'En Vivo' : 'Pendiente'),
                scheduledAt: m.scheduled_at,
                court: m.court
            });
        });

        return Object.keys(roundsMap)
            .sort((a, b) => Number(a) - Number(b))
            .map(key => roundsMap[Number(key)]);
    };

    const handleJoin = async () => {
        if (!tournamentId) {
            Alert.alert('Error', 'No se encontro el torneo.');
            return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            Alert.alert('Sesion requerida', 'Debes iniciar sesion para inscribirte.');
            return;
        }

        if (!OPEN_STATUSES.has(tournament?.status)) {
            Alert.alert('Aviso', 'Este torneo ya no acepta solicitudes.');
            return;
        }

        if (isRegistrationWindowClosed(
            tournament?.effective_registration_close_at || tournament?.registration_close_at,
            tournament?.effective_registration_close_time || tournament?.registration_close_time
        )) {
            Alert.alert('Inscripcion cerrada', 'Se cumplio la fecha de cierre de inscripciones.');
            return;
        }

        if (latestRequest?.status === 'pending') {
            Alert.alert('Solicitud pendiente', 'Ya enviaste un comprobante. Espera la revision del admin.');
            return;
        }

        setSelectedProofUri(null);
        setSelectedProofMimeType(null);
        setShowProofModal(true);
    };

    const handlePickProof = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permiso requerido', 'Debes permitir acceso a tu galeria para adjuntar el comprobante.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.8,
        });

        if (result.canceled || !result.assets?.[0]) return;
        const asset = result.assets[0];
        setSelectedProofUri(asset.uri);
        setSelectedProofMimeType(asset.mimeType || null);
    };

    const handleSubmitJoinRequest = async () => {
        if (!tournamentId || !tournament || !selectedProofUri) return;

        setIsSubmittingRequest(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user?.id) {
                Alert.alert('Sesion requerida', 'Debes iniciar sesion para inscribirte.');
                return;
            }

            await submitTournamentRegistrationRequest({
                tournamentId,
                organizationId: tournament.organization_id,
                playerId: session.user.id,
                assetUri: selectedProofUri,
                mimeType: selectedProofMimeType,
            });

            Alert.alert('Solicitud enviada', 'Tu comprobante fue enviado para revision.');
            setShowProofModal(false);
            setSelectedProofUri(null);
            setSelectedProofMimeType(null);
            await loadTournamentData();
        } catch (error) {
            const readableMessage = getReadableRequestError(error);
            if (readableMessage.toLowerCase().includes('solicitud pendiente') || readableMessage.toLowerCase().includes('ya tienes una solicitud pendiente')) {
                Alert.alert('Solicitud pendiente', readableMessage);
            } else {
                Alert.alert('Error', readableMessage);
            }
        } finally {
            setIsSubmittingRequest(false);
        }
    };

    const tournamentFormat = tournament?.format;
    const tournamentMaxPlayers = tournament?.max_players || 2;
    const isRoundRobin = isRoundRobinFormat(tournamentFormat);
    const hasConsolation = hasConsolationBracket(tournamentFormat);
    const roundRobinGroupNames = useMemo(() => getRoundRobinGroupNames(tournamentFormat, tournament?.description), [tournamentFormat, tournament?.description]);
    const currentGroupName = activeTab.startsWith('group:') ? activeTab.replace('group:', '') : roundRobinGroupNames[0] || 'A';
    const rounds = transformToRounds(matches);
    const groupMatchesByName = useMemo(
        () =>
            roundRobinGroupNames.reduce((acc, groupName) => {
                acc[groupName] = matches.filter(match => match.round === `Grupo ${groupName}`);
                return acc;
            }, {} as Record<string, any[]>),
        [matches, roundRobinGroupNames]
    );
    const finalsMatches = matches.filter(match => !String(match.round || '').includes('Grupo'));
    const latestRequestStatus = latestRequest?.status;
    const registrationClosed = isRegistrationWindowClosed(
        tournament?.effective_registration_close_at || tournament?.registration_close_at,
        tournament?.effective_registration_close_time || tournament?.registration_close_time
    );
    const isOpenForRequests = OPEN_STATUSES.has(String(tournament?.status || ''));
    const shouldShowRequestFooter = isOpenForRequests && !isRegistered && latestRequestStatus !== 'approved';
    const canRequestRegistration = shouldShowRequestFooter && latestRequestStatus !== 'pending' && !registrationClosed;
    const requestButtonLabel = latestRequestStatus === 'rejected'
        ? 'Reenviar comprobante'
        : (latestRequestStatus === 'pending'
            ? 'Solicitud pendiente'
            : (registrationClosed ? 'Inscripcion cerrada' : 'Inscribirse al Torneo'));

    const createStandings = (groupName: string, groupMatches: any[]) => {
        const fallbackSlots = getRoundRobinSlots(tournamentMaxPlayers, groupName, tournamentFormat, tournament?.description);
        return fallbackSlots.map((slot, index) => {
            const playerIds = [...new Set(groupMatches.flatMap(match => [match.player_a_id, match.player_b_id]).filter(Boolean))];
            const playerId = playerIds[index];
            const matchA = groupMatches.find(match => match.player_a_id === playerId);
            const matchB = groupMatches.find(match => match.player_b_id === playerId);
            const profile = matchA?.player_a || matchB?.player_b;
            const profile2 = matchA?.player_a2 || matchB?.player_b2;
            
            let displayName = profile?.name || slot.name;
            if (tournament?.modality === 'dobles' && profile2?.name) {
                displayName += ` / ${profile2.name}`;
            }

            return {
                name: displayName,
                pj: 0,
                pg: 0,
                pp: 0,
                diff: 0,
                pts: 0,
                isActive: index === 0 && !!profile?.name,
            };
        });
    };

    const getInitials = (name: string) => {
        const chunks = String(name || '')
            .trim()
            .split(/\s+/)
            .filter(Boolean);
        if (chunks.length === 0) return 'PP';
        if (chunks.length === 1) return chunks[0].slice(0, 2).toUpperCase();
        return `${chunks[0][0] || ''}${chunks[1][0] || ''}`.toUpperCase();
    };

    const renderPlayerAvatar = (name: string, avatarUrl: string | null, size = 28) => (
        <View style={[styles.groupMatchAvatar, { width: size, height: size, borderRadius: size / 2 }]}>
            {avatarUrl ? (
                <Image source={{ uri: avatarUrl, cache: 'force-cache' }} style={{ width: size, height: size, borderRadius: size / 2 }} />
            ) : (
                <Text style={[styles.groupMatchInitials, { fontSize: Math.max(9, Math.floor(size * 0.36)) }]}>{getInitials(name)}</Text>
            )}
        </View>
    );

    const standingsByGroup = useMemo(
        () =>
            roundRobinGroupNames.reduce((acc, groupName) => {
                acc[groupName] = createStandings(groupName, groupMatchesByName[groupName] || []);
                return acc;
            }, {} as Record<string, any[]>),
        [groupMatchesByName, roundRobinGroupNames, tournamentMaxPlayers, tournamentFormat]
    );

    if (isLoading) {
        return (
            <View style={[styles.container, styles.centerAll, { paddingTop: insets.top }]}>
                <TennisSpinner size={34} />
            </View>
        );
    }

    if (!tournament) {
        return (
            <View style={[styles.container, styles.centerAll, { paddingTop: insets.top }]}>
                <Text style={styles.errorText}>Torneo no encontrado</Text>
                <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20 }}>
                    <Text style={{ color: colors.primary[500] }}>Volver</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={[styles.header, { paddingTop: Math.max(insets.top, spacing.md) }]}>
                <View style={styles.headerContent}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
                        <Ionicons name="arrow-back" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle} numberOfLines={1}>{tournament.name}</Text>
                    <TouchableOpacity style={styles.iconButton} onPress={loadTournamentData}>
                        <Ionicons name="refresh-outline" size={24} color={colors.text} />
                    </TouchableOpacity>
                </View>

                <View style={styles.tabBar}>
                    {isRoundRobin ? (
                        <>
                            {roundRobinGroupNames.map(groupName => (
                                <TouchableOpacity
                                    key={groupName}
                                    style={[styles.tab, activeTab === `group:${groupName}` && styles.activeTab]}
                                    onPress={() => setActiveTab(`group:${groupName}`)}
                                >
                                    <Text style={[styles.tabText, activeTab === `group:${groupName}` && styles.activeTabText]}>{`Grupo ${groupName}`}</Text>
                                </TouchableOpacity>
                            ))}
                            <TouchableOpacity
                                style={[styles.tab, activeTab === 'finales' && styles.activeTab]}
                                onPress={() => setActiveTab('finales')}
                            >
                                <Text style={[styles.tabText, activeTab === 'finales' && styles.activeTabText]}>Finales</Text>
                            </TouchableOpacity>
                        </>
                    ) : (
                        <>
                            <TouchableOpacity
                                style={[styles.tab, activeTab === 'principal' && styles.activeTab]}
                                onPress={() => setActiveTab('principal')}
                            >
                                <Text style={[styles.tabText, activeTab === 'principal' && styles.activeTabText]}>Cuadro Principal</Text>
                            </TouchableOpacity>
                            {hasConsolation && (
                                <TouchableOpacity
                                    style={[styles.tab, activeTab === 'consolacion' && styles.activeTab]}
                                    onPress={() => setActiveTab('consolacion')}
                                >
                                    <Text style={[styles.tabText, activeTab === 'consolacion' && styles.activeTabText]}>Consolacion</Text>
                                </TouchableOpacity>
                            )}
                        </>
                    )}
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.statusSection}>
                    <View style={[styles.statusBadge, { 
                        backgroundColor: tournament.status === 'open' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255, 255, 255, 0.05)' 
                    }]}>
                        <Text style={[styles.statusText, { 
                            color: tournament.status === 'open' ? colors.success : colors.textSecondary 
                        }]}>
                            {tournament.status === 'open' ? 'INSCRIPCIÓN ABIERTA' : tournament.status?.toUpperCase()}
                        </Text>
                    </View>
                </View>

                <View style={styles.infoCard}>
                    <View style={styles.infoRow}>
                        <Ionicons name="hammer-outline" size={20} color={colors.primary[500]} />
                        <Text style={styles.infoTitle}>Información del Torneo</Text>
                    </View>
                    <Text style={styles.infoSubtitle}>
                        Formato: {tournament.format} | {tournament.level} | {tournament.set_type}
                    </Text>
                    <Text style={styles.infoSubtitle}>
                        Modalidad: {tournament.modality === 'dobles' ? 'Dobles' : 'Singles'}
                    </Text>
                    <Text style={styles.infoSubtitle}>
                        Superficie: {tournament.surface} | Inicio: {new Date(tournament.start_date).toLocaleDateString()}
                    </Text>
                    {(tournament.address || tournament.comuna) && (
                        <View style={[styles.infoRow, { marginTop: 4 }]}>
                            <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
                            <Text style={styles.infoSubtitle}>
                                {tournament.address}{tournament.address && tournament.comuna ? ', ' : ''}{tournament.comuna}
                            </Text>
                        </View>
                    )}
                    <View style={[styles.infoRow, { marginTop: 4 }]}>
                        <Ionicons name="cash-outline" size={16} color={colors.primary[500]} />
                        <Text style={[styles.infoSubtitle, { color: colors.primary[500], fontWeight: '800' }]}>
                            Inscripción: ${tournament.registration_fee || 0}
                        </Text>
                    </View>
                    {formatRegistrationDeadline(
                        tournament.effective_registration_close_at || tournament.registration_close_at,
                        tournament.effective_registration_close_time || tournament.registration_close_time
                    ) && (
                        <View style={[styles.infoRow, { marginTop: 4 }]}>
                            <Ionicons name="hourglass-outline" size={16} color={colors.textSecondary} />
                            <Text style={styles.infoSubtitle}>
                                Cierre inscripciones: {formatRegistrationDeadline(
                                    tournament.effective_registration_close_at || tournament.registration_close_at,
                                    tournament.effective_registration_close_time || tournament.registration_close_time
                                )}
                            </Text>
                        </View>
                    )}
                </View>

                {latestRequest && (
                    <View style={styles.requestCard}>
                        <Text style={styles.requestCardTitle}>
                            Estado de solicitud: {getRequestStatusLabel(latestRequest.status)}
                        </Text>
                        {latestRequest.status === 'rejected' && latestRequest.rejection_reason && (
                            <Text style={styles.requestCardReason}>Motivo: {latestRequest.rejection_reason}</Text>
                        )}
                    </View>
                )}

                {isRoundRobin ? (
                    activeTab === 'finales' ? (
                        <TournamentFinals
                            summary={{
                                groupALeader: standingsByGroup[roundRobinGroupNames[0] || 'A']?.[0]?.name || `Cupo ${roundRobinGroupNames[0] || 'A'}1`,
                                groupBLeader: standingsByGroup[roundRobinGroupNames[1] || roundRobinGroupNames[0] || 'A']?.[0]?.name || `Cupo ${(roundRobinGroupNames[1] || roundRobinGroupNames[0] || 'A')}1`,
                            }}
                            matches={finalsMatches.map((match, index) => ({
                                title: match.round || `Final ${index + 1}`,
                                player1: {
                                    name: match.player_a?.name || 'Por definir',
                                    group: 'CLASIFICADO',
                                    image: match.player_a?.avatar_url || null,
                                },
                                player2: {
                                    name: match.player_b?.name || 'Por definir',
                                    group: 'CLASIFICADO',
                                    image: match.player_b?.avatar_url || null,
                                },
                                time: match.score || 'Por definir',
                                isGrandFinal: String(match.round || '').includes('Gran Final'),
                            }))}
                        />
                    ) : (
                        <View style={styles.roundRobinContainer}>
                            <RoundRobinTable
                                groupName={`Grupo ${currentGroupName}`}
                                standings={standingsByGroup[currentGroupName] || []}
                            />
                            <View style={styles.groupMatchesCard}>
                                <Text style={styles.groupMatchesTitle}>
                                    {`Proximos Partidos - Grupo ${currentGroupName}`}
                                </Text>
                                {(groupMatchesByName[currentGroupName] || []).map(match => (
                                    <View key={match.id} style={{ gap: 4 }}>
                                        <View style={styles.groupMatchRow}>
                                            <View style={styles.groupMatchPlayer}>
                                                {renderPlayerAvatar(match.player_a?.name || 'Por definir', match.player_a?.avatar_url || null)}
                                                <Text style={styles.groupMatchName} numberOfLines={1}>{match.player_a?.name || 'Por definir'}</Text>
                                            </View>
                                            <Text style={styles.groupMatchScore}>{match.score || 'VS'}</Text>
                                            <View style={[styles.groupMatchPlayer, { justifyContent: 'flex-end' }]}>
                                                <Text style={[styles.groupMatchName, { textAlign: 'right' }]} numberOfLines={1}>{match.player_b?.name || 'Por definir'}</Text>
                                                {renderPlayerAvatar(match.player_b?.name || 'Por definir', match.player_b?.avatar_url || null)}
                                            </View>
                                        </View>
                                        {(match.scheduled_at || match.court) && (
                                            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.lg, marginBottom: spacing.sm }}>
                                                {match.scheduled_at && (
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                        <Ionicons name="time-outline" size={12} color={colors.textTertiary} />
                                                        <Text style={{ fontSize: 10, color: colors.textTertiary, fontWeight: '600' }}>
                                                            {new Date(match.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </Text>
                                                    </View>
                                                )}
                                                {match.court && (
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                        <Ionicons name="location-outline" size={12} color={colors.textTertiary} />
                                                        <Text style={{ fontSize: 10, color: colors.textTertiary, fontWeight: '600' }}>{match.court}</Text>
                                                    </View>
                                                )}
                                            </View>
                                        )}
                                    </View>
                                ))}
                            </View>
                        </View>
                    )
                ) : (
                    <View style={styles.bracketContainer}>
                        <SingleEliminationBracket rounds={rounds} />
                    </View>
                )}
            </ScrollView>

            {shouldShowRequestFooter && (
                <View style={[styles.footerActions, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
                    <TouchableOpacity
                        style={[styles.joinButton, !canRequestRegistration && styles.joinButtonDisabled]}
                        onPress={handleJoin}
                        disabled={!canRequestRegistration}
                    >
                        <Text style={styles.joinButtonText}>{requestButtonLabel}</Text>
                        <Ionicons name="enter-outline" size={20} color="#fff" />
                    </TouchableOpacity>
                </View>
            )}

            <RegistrationProofModal
                visible={showProofModal}
                tournamentName={tournament.name}
                selectedImageUri={selectedProofUri}
                submitting={isSubmittingRequest}
                onClose={() => {
                    if (isSubmittingRequest) return;
                    setShowProofModal(false);
                }}
                onPickImage={handlePickProof}
                onSubmit={handleSubmitJoinRequest}
            />
        </View>
    );
}

const getStyles = (colors: any) => StyleSheet.create({
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
    headerTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.text,
        flex: 1,
        textAlign: 'center',
    },
    iconButton: {
        padding: spacing.xs,
    },
    tabBar: {
        flexDirection: 'row',
        paddingHorizontal: spacing.xl,
    },
    tab: {
        flex: 1,
        paddingVertical: spacing.lg,
        alignItems: 'center',
        borderBottomWidth: 3,
        borderBottomColor: 'transparent',
    },
    activeTab: {
        borderBottomColor: colors.primary[500],
    },
    tabText: {
        fontSize: 13,
        fontWeight: '700',
        color: colors.textTertiary,
    },
    activeTabText: {
        color: colors.primary[500],
    },
    scrollContent: {
        paddingVertical: spacing.xl,
        gap: spacing['2xl'],
        paddingBottom: 100,
    },
    statusSection: {
        paddingHorizontal: spacing.xl,
        alignItems: 'flex-start',
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: borderRadius.full,
    },
    statusText: {
        fontSize: 11,
        fontWeight: '900',
    },
    infoCard: {
        marginHorizontal: spacing.xl,
        backgroundColor: colors.surface,
        borderRadius: borderRadius.xl,
        padding: spacing.xl,
        borderWidth: 1,
        borderColor: colors.border,
        gap: 8,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    infoTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: colors.text,
    },
    infoSubtitle: {
        fontSize: 13,
        color: colors.textSecondary,
        lineHeight: 18,
    },
    requestCard: {
        marginHorizontal: spacing.xl,
        marginTop: -spacing.lg,
        backgroundColor: colors.surface,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
        gap: spacing.xs,
    },
    requestCardTitle: {
        color: colors.text,
        fontSize: 12,
        fontWeight: '800',
    },
    requestCardReason: {
        color: colors.error,
        fontSize: 11,
        lineHeight: 16,
        fontWeight: '600',
    },
    bracketContainer: {
        flex: 1,
    },
    roundRobinContainer: {
        paddingHorizontal: spacing.xl,
        gap: spacing.xl,
    },
    groupMatchesCard: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.lg,
        gap: spacing.md,
    },
    groupMatchesTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: colors.text,
    },
    groupMatchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    groupMatchPlayer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        minWidth: 0,
    },
    groupMatchAvatar: {
        backgroundColor: colors.primary[500] + '20',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    groupMatchInitials: {
        color: colors.primary[500],
        fontWeight: '800',
    },
    groupMatchName: {
        color: colors.text,
        fontSize: 13,
        fontWeight: '700',
        flexShrink: 1,
    },
    groupMatchScore: {
        color: colors.primary[500],
        fontSize: 12,
        fontWeight: '800',
    },
    footerActions: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: colors.background,
        padding: spacing.xl,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    joinButton: {
        backgroundColor: colors.primary[500],
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.lg,
        borderRadius: borderRadius.xl,
        gap: spacing.sm,
        shadowColor: colors.primary[500],
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    joinButtonDisabled: {
        opacity: 0.6,
    },
    joinButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '800',
    },
    centerAll: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.background,
    },
    errorText: {
        color: colors.textSecondary,
        fontSize: 16,
    },
});

