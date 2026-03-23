import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Modal, TextInput, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/services/supabase';
import { useTheme, spacing, borderRadius } from '@/theme';
import { FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { createInitialMatches, getRoundRobinGroupNames, getRoundRobinSlots, getSetsToShow, hasConsolationBracket, isRoundRobinFormat } from '@/services/tournamentStructure';
import { DateField } from '@/components/DateField';
import { canManageOrganization, getCurrentUserAccessContext } from '@/services/accessControl';
import { TennisSpinner } from '@/components/TennisSpinner';
import { resolveStorageAssetUrl } from '@/services/storage';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COURT_OPTIONS = Array.from({ length: 20 }, (_current, index) => `Cancha ${index + 1}`);

export default function AdminTournamentDetailScreen() {
    const { id: rawId } = useLocalSearchParams();
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { colors } = useTheme();
    const styles = getStyles(colors); // Assuming getStyles is defined elsewhere or needs to be added.

    const [tournament, setTournament] = useState<any>(null);
    const [players, setPlayers] = useState<any[]>([]);
    const [matches, setMatches] = useState<any[]>([]);
    const [playerAvatarById, setPlayerAvatarById] = useState<Record<string, string | null>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('main');

    // Score Edit Modal
    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [selectedMatch, setSelectedMatch] = useState<any>(null);
    const [setScores, setSetScores] = useState<{ s1: string, s2: string }[]>([
        { s1: '', s2: '' },
        { s1: '', s2: '' },
        { s1: '', s2: '' }
    ]);
    const scoreInputRefs = useRef<Array<TextInput | null>>([]);
    const [savingMatch, setSavingMatch] = useState(false);

    const IS_DOUBLES = tournament?.modality === 'dobles';
    const MATCH_HEIGHT = IS_DOUBLES ? 180 : 130;
    const ROUND_GAP = 24;

    // Player Selection Modal
    const [isPlayerModalVisible, setIsPlayerModalVisible] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState<{ matchId: string, slot: 1 | 2 | 3 | 4 } | null>(null);
    const [selectedGroupSlot, setSelectedGroupSlot] = useState<{ groupName: string, slotIndex: number, member: 1 | 2 } | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [manualPlayerName, setManualPlayerName] = useState('');
    const [isManualPlayerModalVisible, setIsManualPlayerModalVisible] = useState(false);
    const [savingPlayer, setSavingPlayer] = useState(false);

    // Scheduling Modal
    const [isScheduleModalVisible, setIsScheduleModalVisible] = useState(false);
    const [scheduleData, setScheduleData] = useState({
        date: '',
        time: '',
        court: ''
    });
    const [isCourtPickerVisible, setIsCourtPickerVisible] = useState(false);
    const [savingSchedule, setSavingSchedule] = useState(false);

    const padTwo = (value: number) => String(value).padStart(2, '0');
    const formatScheduleDate = (scheduledAt?: string | null) => {
        if (!scheduledAt) return null;
        const date = new Date(scheduledAt);
        if (Number.isNaN(date.getTime())) return null;
        return date.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };
    const formatScheduleTime = (scheduledAt?: string | null) => {
        if (!scheduledAt) return null;
        const date = new Date(scheduledAt);
        if (Number.isNaN(date.getTime())) return null;
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const collectPlayerIds = (registrations: any[], tournamentMatches: any[]) => {
        const ids = new Set<string>();

        (registrations || []).forEach((registration: any) => {
            const playerId = String(registration?.player_id || '');
            if (UUID_PATTERN.test(playerId)) {
                ids.add(playerId);
            }
        });

        (tournamentMatches || []).forEach((match: any) => {
            [match?.player_a_id, match?.player_a2_id, match?.player_b_id, match?.player_b2_id].forEach((playerId) => {
                if (typeof playerId === 'string' && UUID_PATTERN.test(playerId)) {
                    ids.add(playerId);
                }
            });
        });

        return [...ids];
    };

    const fetchPublicProfileMap = async (playerIds: string[]) => {
        if (playerIds.length === 0) {
            return {} as Record<string, { name: string; avatarUrl: string | null }>;
        }

        const { data: publicProfiles, error: publicProfilesError } = await supabase
            .from('public_profiles')
            .select('id, name, avatar_url')
            .in('id', playerIds);

        if (publicProfilesError) throw publicProfilesError;

        const avatarPathById = (publicProfiles || []).reduce((acc: Record<string, string>, profile: any) => {
            const avatarPath = String(profile?.avatar_url || '').trim();
            if (avatarPath) acc[profile.id] = avatarPath;
            return acc;
        }, {});

        const signedAvatarByPath = new Map<string, string | null>();
        await Promise.all(
            Object.values(avatarPathById).map(async (path) => {
                if (signedAvatarByPath.has(path)) return;
                const signedAvatar = await resolveStorageAssetUrl(path);
                signedAvatarByPath.set(path, signedAvatar || null);
            })
        );

        return (publicProfiles || []).reduce((acc: Record<string, { name: string; avatarUrl: string | null }>, profile: any) => {
            const avatarPath = String(profile?.avatar_url || '').trim();
            acc[profile.id] = {
                name: profile.name || 'Jugador',
                avatarUrl: avatarPath ? (signedAvatarByPath.get(avatarPath) || null) : null,
            };
            return acc;
        }, {});
    };

    const resolveHydratedProfile = (
        playerId: string | null | undefined,
        profileMapById: Record<string, { name: string; avatarUrl: string | null }>
    ) => {
        if (!playerId) return null;
        if (playerId === 'BYE') return { id: playerId, name: 'BYE' };
        const profile = profileMapById[playerId];
        return {
            id: playerId,
            name: profile?.name || 'Desconocido',
            avatar_url: profile?.avatarUrl || null,
        };
    };

    const hydrateRegistrations = (
        registrations: any[],
        profileMapById: Record<string, { name: string; avatarUrl: string | null }>
    ) =>
        (registrations || []).map((registration: any) => ({
            ...registration,
            profiles: registration.player_id
                ? {
                    id: registration.player_id,
                    name: profileMapById[registration.player_id]?.name || 'Desconocido',
                    avatar_url: profileMapById[registration.player_id]?.avatarUrl || null,
                }
                : null,
        }));

    const hydrateMatches = (
        tournamentMatches: any[],
        profileMapById: Record<string, { name: string; avatarUrl: string | null }>
    ) =>
        (tournamentMatches || []).map((match: any) => ({
            ...match,
            player_a: resolveHydratedProfile(match.player_a_id, profileMapById),
            player_b: resolveHydratedProfile(match.player_b_id, profileMapById),
            player_a2: resolveHydratedProfile(match.player_a2_id, profileMapById),
            player_b2: resolveHydratedProfile(match.player_b2_id, profileMapById),
        }));

    const parseManualAssignments = (description?: string | null) => {
        const match = (description || '').match(/\[MANUAL_ASSIGNMENTS:([^\]]+)\]/);
        if (!match?.[1]) {
            return {
                rrSlots: {},
                matchSlots: {}
            } as {
                rrSlots: Record<string, Record<string, { name: string }>>;
                matchSlots: Record<string, Record<string, { name: string }>>;
            };
        }

        try {
            return JSON.parse(decodeURIComponent(match[1]));
        } catch {
            return { rrSlots: {}, matchSlots: {} };
        }
    };

    const buildTournamentDescriptionWithAssignments = (
        description: string | null | undefined,
        assignments: {
            rrSlots?: Record<string, Record<string, { name: string }>>;
            matchSlots?: Record<string, Record<string, { name: string }>>;
        }
    ) => {
        const baseDescription = (description || '').replace(/\s*\[MANUAL_ASSIGNMENTS:[^\]]+\]/g, '').trim();
        const hasAssignments =
            Object.keys(assignments.rrSlots || {}).length > 0 ||
            Object.keys(assignments.matchSlots || {}).length > 0;

        if (!hasAssignments) return baseDescription || null;

        const encodedAssignments = encodeURIComponent(JSON.stringify(assignments));
        return [baseDescription, `[MANUAL_ASSIGNMENTS:${encodedAssignments}]`].filter(Boolean).join(' ').trim();
    };

    const updateTournamentDescription = async (
        updater: (current: {
            rrSlots: Record<string, Record<string, { name: string }>>;
            matchSlots: Record<string, Record<string, { name: string }>>;
        }) => {
            rrSlots: Record<string, Record<string, { name: string }>>;
            matchSlots: Record<string, Record<string, { name: string }>>;
        }
    ) => {
        const currentAssignments = parseManualAssignments(tournament?.description);
        const nextAssignments = updater(currentAssignments);
        const nextDescription = buildTournamentDescriptionWithAssignments(tournament?.description, nextAssignments);

        const { error } = await supabase
            .from('tournaments')
            .update({ description: nextDescription })
            .eq('id', id);

        if (error) throw error;

        setTournament((prev: any) => prev ? { ...prev, description: nextDescription } : prev);
        return nextAssignments;
    };

    useEffect(() => {
        if (!id || id === 'undefined') return;
        loadTournamentData();
    }, [id]);

    const loadTournamentData = async () => {
        setIsLoading(true);
        try {
            const access = await getCurrentUserAccessContext();
            if (!access) {
                router.replace('/(auth)/login');
                return;
            }

            // Load Tournament
            const { data: tourData, error: tourErr } = await supabase
                .from('tournaments')
                .select('id, organization_id, name, level, format, status, description, set_type, surface, start_date, end_date, registration_fee, max_players, modality')
                .eq('id', id)
                .single();
            if (tourErr) throw tourErr;
            if (!canManageOrganization(access, tourData.organization_id)) {
                router.replace('/(tabs)/tournaments');
                return;
            }
            setTournament(tourData);

            if (isRoundRobinFormat(tourData.format)) {
                const availableGroups = getRoundRobinGroupNames(tourData.format, tourData.description);
                setActiveTab(currentTab => {
                    if (currentTab === 'finales') return currentTab;
                    if (currentTab === 'participantes') return currentTab;
                    if (currentTab.startsWith('group:')) {
                        const currentGroup = currentTab.replace('group:', '');
                        if (availableGroups.includes(currentGroup)) return currentTab;
                    }
                    return `group:${availableGroups[0] || 'A'}`;
                });
            }

            // Load Players
            const { data: playersDataRaw, error: plyErr } = await supabase
                .from('registrations')
                .select('id, tournament_id, player_id, status, fee_amount, is_paid')
                .eq('tournament_id', id);
            if (plyErr) throw plyErr;
            const playersData = (playersDataRaw || []) as any[];

            // Load Matches
            const { data: matchDataRaw, error: matchErr } = await supabase
                .from('matches')
                .select('id, tournament_id, player_a_id, player_a2_id, player_b_id, player_b2_id, round, round_number, match_order, status, score, winner_id, winner_2_id, scheduled_at, court')
                .eq('tournament_id', id)
                .order('match_order', { ascending: true });

            if (matchErr) throw matchErr;

            let loadedMatches = (matchDataRaw || []) as any[];
            if (loadedMatches.length === 0) {
                const scaffoldMatches = createInitialMatches({
                    tournamentId: String(id),
                    format: tourData.format,
                    description: tourData.description,
                    maxPlayers: tourData.max_players || 2,
                    participants: [],
                    modality: tourData.modality
                });

                if (scaffoldMatches.length > 0) {
                    const { error: scaffoldError } = await supabase.from('matches').insert(scaffoldMatches);
                    if (scaffoldError) throw scaffoldError;

                    const { data: regeneratedMatchesRaw, error: regeneratedError } = await supabase
                        .from('matches')
                        .select('id, tournament_id, player_a_id, player_a2_id, player_b_id, player_b2_id, round, round_number, match_order, status, score, winner_id, winner_2_id, scheduled_at, court')
                        .eq('tournament_id', id)
                        .order('match_order', { ascending: true });

                    if (regeneratedError) throw regeneratedError;
                    loadedMatches = (regeneratedMatchesRaw || []) as any[];
                }
            }

            const playerIds = collectPlayerIds(playersData, loadedMatches);
            const profileMapById = await fetchPublicProfileMap(playerIds);
            const hydratedPlayers = hydrateRegistrations(playersData, profileMapById);
            const hydratedMatches = hydrateMatches(loadedMatches, profileMapById);
            const nextAvatarMap = Object.entries(profileMapById).reduce((acc: Record<string, string | null>, [playerId, profile]) => {
                acc[playerId] = profile.avatarUrl || null;
                return acc;
            }, {});

            setPlayers(hydratedPlayers);
            setMatches(hydratedMatches);
            setPlayerAvatarById(nextAvatarMap);

            // check and move byes
            await checkAndProcessByes(hydratedMatches);

        } catch (error) {
            Alert.alert('Error', 'No se pudo cargar la información del torneo.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleMatchPress = (match: any) => {
        setSelectedMatch(match);

        // Parse existing score "6-4 6-2" into setScores array
        const setsToShow = getSetsToShow(tournament?.set_type);
        const newSetScores = Array.from({ length: setsToShow }, () => ({ s1: '', s2: '' }));

        if (match.score) {
            const setStrings = match.score.split(/\s*,\s*/);
            setStrings.forEach((setStr: string, idx: number) => {
                if (idx < setsToShow) {
                    const [s1, s2] = setStr.split(/[-]/);
                    newSetScores[idx] = { s1: s1 || '', s2: s2 || '' };
                }
            });
        }

        setSetScores(newSetScores);
        setIsEditModalVisible(true);
    };

    const handleSchedulePress = (match: any) => {
        setSelectedMatch(match);
        let initialDate = '';
        let initialTime = '';
        if (match.scheduled_at) {
            const d = new Date(match.scheduled_at);
            if (!Number.isNaN(d.getTime())) {
                initialDate = `${d.getFullYear()}-${padTwo(d.getMonth() + 1)}-${padTwo(d.getDate())}`;
                initialTime = `${padTwo(d.getHours())}:${padTwo(d.getMinutes())}`;
            }
        }
        const normalizedCourt = COURT_OPTIONS.includes(String(match.court || ''))
            ? String(match.court || '')
            : '';
        setScheduleData({
            date: initialDate,
            time: initialTime,
            court: normalizedCourt
        });
        setIsScheduleModalVisible(true);
    };

    const saveMatchSchedule = async () => {
        if (!selectedMatch) return;
        setSavingSchedule(true);

        try {
            const normalizedDate = String(scheduleData.date || '').trim();
            const normalizedTime = String(scheduleData.time || '').trim();
            const normalizedCourt = COURT_OPTIONS.includes(String(scheduleData.court || '').trim())
                ? String(scheduleData.court || '').trim()
                : '';
            let scheduledAt: string | null = null;

            if (!normalizedDate && normalizedTime) {
                Alert.alert('Error', 'Para guardar la hora primero debes seleccionar una fecha.');
                return;
            }

            if (normalizedDate) {
                const validTime = /^([01]\d|2[0-3]):([0-5]\d)$/.test(normalizedTime);
                if (!validTime) {
                    Alert.alert('Error', 'Ingresa una hora válida en formato HH:MM.');
                    return;
                }

                const localDateTime = new Date(`${normalizedDate}T${normalizedTime}:00`);
                if (Number.isNaN(localDateTime.getTime())) {
                    Alert.alert('Error', 'La fecha u hora ingresada no es válida.');
                    return;
                }
                scheduledAt = localDateTime.toISOString();
            }

            const { error } = await supabase
                .from('matches')
                .update({
                    scheduled_at: scheduledAt,
                    court: normalizedCourt
                })
                .eq('id', selectedMatch.id);

            if (error) throw error;
            
            await loadTournamentData();
            setIsScheduleModalVisible(false);
            Alert.alert('Éxito', 'Horario y cancha guardados.');
        } catch (error) {
            Alert.alert('Error', 'No se pudo guardar la programación.');
        } finally {
            setSavingSchedule(false);
        }
    };

    const resolveWinnerIds = (match: any, score: string) => {
        const sets = score.split(/\s*,\s*/).filter(Boolean);
        let playerAWins = 0;
        let playerBWins = 0;

        sets.forEach(setScore => {
            const [aRaw, bRaw] = setScore.split('-');
            const a = Number(aRaw);
            const b = Number(bRaw);
            if (Number.isNaN(a) || Number.isNaN(b)) return;
            if (a > b) playerAWins += 1;
            if (b > a) playerBWins += 1;
        });

        if (playerAWins === playerBWins) return { w1: null, w2: null };
        return playerAWins > playerBWins 
            ? { w1: match.player_a_id, w2: match.player_a2_id }
            : { w1: match.player_b_id, w2: match.player_b2_id };
    };

    async function propagateWinnerToNextMatch(match: any, winnerId: string | null, winner2Id: string | null = null) {
        if (!winnerId || String(match.round || '').startsWith('Grupo ')) return;

        const isRoundRobinFinal = String(match.round || '').includes('RR');
        const isConsolation = /^Consolaci/i.test(String(match.round || ''));
        const bracketMatches = matches
            .filter(candidate => {
                if (isRoundRobinFinal) return String(candidate.round || '').includes('RR');
                if (isConsolation) return /^Consolaci/i.test(String(candidate.round || ''));
                return !/^Consolaci/i.test(String(candidate.round || '')) && !String(candidate.round || '').includes('RR');
            })
            .sort((a, b) => {
                if ((a.round_number || 0) !== (b.round_number || 0)) return (a.round_number || 0) - (b.round_number || 0);
                return (a.match_order || 0) - (b.match_order || 0);
            });

        const currentRoundMatches = bracketMatches.filter(candidate => candidate.round_number === match.round_number);
        const nextRoundMatches = bracketMatches.filter(candidate => candidate.round_number === (match.round_number || 0) + 1);
        if (nextRoundMatches.length === 0) return;

        const currentIndex = currentRoundMatches.findIndex(candidate => candidate.id === match.id);
        if (currentIndex === -1) return;

        const nextMatch = nextRoundMatches[Math.floor(currentIndex / 2)];
        if (!nextMatch) return;

        const nextSlotField = currentIndex % 2 === 0 ? 'player_a_id' : 'player_b_id';
        const nextSlotField2 = currentIndex % 2 === 0 ? 'player_a2_id' : 'player_b2_id';
        
        const updateData: any = { [nextSlotField]: winnerId };
        if (winner2Id) {
            updateData[nextSlotField2] = winner2Id;
        }

        const { error } = await supabase
            .from('matches')
            .update(updateData)
            .eq('id', nextMatch.id);

        if (error) throw error;
        await checkAndProcessByes([...matches, { ...nextMatch, ...updateData }]);
    };

    async function checkAndProcessByes(allMatches: any[]) {
        const pendingMatches = allMatches.filter(m => m.status === 'pending');
        
        for (const m of pendingMatches) {
            const nameA = getDisplayName(m, 1);
            const nameB = getDisplayName(m, 2);

            const isABye = nameA === 'BYE';
            const isBBye = nameB === 'BYE';

            // If one is BYE and the other is a real player
            if (isABye || isBBye) {
                let winnerId = null;
                let score = 'W.O.';

                if (isABye && m.player_b_id && m.player_b_id !== 'BYE') {
                    winnerId = m.player_b_id;
                } else if (isBBye && m.player_a_id && m.player_a_id !== 'BYE') {
                    winnerId = m.player_a_id;
                }

                if (winnerId) {
                    const { error } = await supabase
                        .from('matches')
                        .update({ score, winner_id: winnerId, status: 'finished' })
                        .eq('id', m.id);
                    
                    if (!error) {
                        await propagateWinnerToNextMatch(m, winnerId);
                    }
                }
            }
        }
    }

    async function finalizeTournament() {
        Alert.alert(
            'Finalizar Torneo',
            '¿Estás seguro de que quieres dar por finalizado este torneo? Esto permitirá que los resultados se reflejen en los perfiles y rankings de los jugadores.',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Finalizar',
                    onPress: async () => {
                        const { error } = await supabase
                            .from('tournaments')
                            .update({ status: 'finished' })
                            .eq('id', id);

                        if (error) {
                            Alert.alert('Error', 'No se pudo finalizar el torneo.');
                        } else {
                            await loadTournamentData();
                            Alert.alert('Éxito', 'Torneo finalizado.');
                        }
                    }
                }
            ]
        );
    }

    const saveMatchScore = async () => {
        if (!selectedMatch) return;
        setSavingMatch(true);

        // Construct score string "6-4 6-2"
        const finalScore = setScores
            .filter(set => set.s1 !== '' || set.s2 !== '')
            .map(set => `${set.s1}-${set.s2}`)
            .join(', ');

        try {
            const { w1, w2 } = resolveWinnerIds(selectedMatch, finalScore);
            const { error } = await supabase
                .from('matches')
                .update({ 
                    score: finalScore, 
                    winner_id: w1, 
                    winner_2_id: w2,
                    status: 'finished' 
                })
                .eq('id', selectedMatch.id);

            if (error) throw error;
            await propagateWinnerToNextMatch(selectedMatch, w1, w2);
            await loadTournamentData();
            setIsEditModalVisible(false);
        } catch (error) {
            Alert.alert('Error', 'No se pudo guardar el resultado.');
        } finally {
            setSavingMatch(false);
        }
    };

    const generateMatches = async () => {
        // Dummy logic to generate initial structure based on format and players
        Alert.alert('Información', 'La lógica de scaffold está en desarrollo.');
    };

    const getPlayerName = (pId: string) => {
        if (!pId) return 'Por definir';
        const player = players.find(p => p.player_id === pId);
        return player ? (player.profiles?.name || 'Desconocido') : 'Por definir';
    };

    const getPlayerAvatar = (playerId: string | null | undefined) => {
        if (!playerId || playerId === 'BYE') return null;
        return playerAvatarById[playerId] || null;
    };

    const removeParticipant = async (pId: string) => {
        Alert.alert(
            'Eliminar Participante',
            '¿Estás seguro de que quieres eliminar a este participante de este torneo?',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Eliminar',
                    style: 'destructive',
                    onPress: async () => {
                        const { error } = await supabase
                            .from('registrations')
                            .delete()
                            .eq('tournament_id', id)
                            .eq('player_id', pId);

                        if (error) {
                            Alert.alert('Error', 'No se pudo eliminar el participante.');
                        } else {
                            await loadTournamentData();
                        }
                    }
                }
            ]
        );
    };

    const registerParticipant = async (pId: string) => {
        setSavingPlayer(true);
        try {
            const { error } = await supabase
                .from('registrations')
                .insert({
                    tournament_id: id,
                    player_id: pId,
                    status: 'confirmed',
                    fee_amount: tournament?.registration_fee || 0,
                    is_paid: false
                });

            if (error) throw error;
            setIsPlayerModalVisible(false);
            await loadTournamentData();
        } catch (error: any) {
            if (error.code === '23505') {
                Alert.alert('Información', 'Este jugador ya está registrado.');
            } else {
                Alert.alert('Error', 'No se pudo registrar al jugador.');
            }
        } finally {
            setSavingPlayer(false);
        }
    };

    const manualAssignments = useMemo(() => parseManualAssignments(tournament?.description), [tournament?.description]);

    const getAssignedNameForGroupSlot = (groupName: string, slotIndex: number) =>
        manualAssignments.rrSlots?.[groupName]?.[String(slotIndex)]?.name || null;

    const getAssignedNameForMatchSlot = (matchId: string, slot: 'player_a' | 'player_b') =>
        manualAssignments.matchSlots?.[matchId]?.[slot]?.name || null;

    const handlePlayerPress = (matchId: string, slot: 1 | 2 | 3 | 4) => {
        setSelectedSlot({ matchId, slot });
        setSelectedGroupSlot(null);
        setSearchQuery('');
        setSearchResults([]);
        setManualPlayerName('');
        setIsPlayerModalVisible(true);
    };

    const handleGroupSlotPress = (groupName: string, slotIndex: number, member: 1 | 2 = 1) => {
        setSelectedGroupSlot({ groupName, slotIndex, member });
        setSelectedSlot(null);
        setSearchQuery('');
        setSearchResults([]);
        setManualPlayerName('');
        setIsPlayerModalVisible(true);
    };

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            if (searchQuery.length >= 2) {
                searchUsers();
            } else {
                setSearchResults([]);
            }
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery]);

    const searchUsers = async () => {
        setIsSearching(true);
        try {
            const query = supabase
                .from('public_profiles')
                .select('id, name')
                .ilike('name', `%${searchQuery}%`)
                .limit(10);

            const { data, error } = await query;

            if (error) throw error;
            setSearchResults(data || []);
        } catch (error) {
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    };

    const createUuid = () => {
        if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => {
            const random = Math.floor(Math.random() * 16);
            const value = char === 'x' ? random : (random & 0x3) | 0x8;
            return value.toString(16);
        });
    };
    const isUuid = (value?: string | null) =>
        !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

    const getRoundRobinPairings = (slotCount: number) => {
        const pairings: Array<[number, number]> = [];
        for (let i = 0; i < slotCount; i++) {
            for (let j = i + 1; j < slotCount; j++) {
                pairings.push([i, j]);
            }
        }
        return pairings;
    };

    const ensureRegisteredPlayer = async (profileId: string) => {
        const existingPlayer = players.find(p => p.player_id === profileId);
        if (existingPlayer) return;

        const { error } = await supabase
            .from('registrations')
            .insert({ 
                tournament_id: id, 
                player_id: profileId, 
                status: 'confirmed',
                fee_amount: tournament?.registration_fee || 0,
                is_paid: false
            });

        if (error) {
            if (error.code !== '23505') throw error;
        }
    };

    const assignPlayerToSelectedSlot = async (profileId: string) => {
        await ensureRegisteredPlayer(profileId);
        if (selectedGroupSlot) {
            const { groupName, slotIndex, member } = selectedGroupSlot;
            const groupMatches = [...(roundRobinMatchesByGroup[groupName] || [])].sort(
                (a, b) => (a.match_order || 0) - (b.match_order || 0)
            );
            const assignPartnerSlot = IS_DOUBLES && member === 2;
            const slotCount = getRoundRobinSlots(tournamentMaxPlayers, groupName, tournamentFormat, tournament?.description).length;
            const pairings = getRoundRobinPairings(slotCount);

            for (let index = 0; index < groupMatches.length; index++) {
                const match = groupMatches[index];
                const pairing = pairings[index];
                if (!pairing) continue;

                const updateData: any = {};
                if (pairing[0] === slotIndex) {
                    if (assignPartnerSlot) updateData.player_a2_id = profileId;
                    else updateData.player_a_id = profileId;
                }
                if (pairing[1] === slotIndex) {
                    if (assignPartnerSlot) updateData.player_b2_id = profileId;
                    else updateData.player_b_id = profileId;
                }
                if (Object.keys(updateData).length === 0) continue;

                const { error } = await supabase
                    .from('matches')
                    .update(updateData)
                    .eq('id', match.id);

                if (error) throw error;
            }

            await updateTournamentDescription(current => {
                const next = {
                    rrSlots: { ...(current.rrSlots || {}) },
                    matchSlots: { ...(current.matchSlots || {}) }
                };
                if (next.rrSlots[groupName]) {
                    delete next.rrSlots[groupName][String(slotIndex)];
                    if (Object.keys(next.rrSlots[groupName]).length === 0) delete next.rrSlots[groupName];
                }
                return next;
            });
            return;
        }

        if (!selectedSlot) return;
        const { matchId, slot } = selectedSlot;
        const updateData: any = {};
        if (slot === 1) updateData.player_a_id = profileId;
        else if (slot === 2) updateData.player_a2_id = profileId;
        else if (slot === 3) updateData.player_b_id = profileId;
        else if (slot === 4) updateData.player_b2_id = profileId;

        const { error } = await supabase
            .from('matches')
            .update(updateData)
            .eq('id', matchId);

        if (error) throw error;

        await updateTournamentDescription(current => {
            const next = {
                rrSlots: { ...(current.rrSlots || {}) },
                matchSlots: { ...(current.matchSlots || {}) }
            };
            if (next.matchSlots[matchId]) {
                delete next.matchSlots[matchId][slot === 1 ? 'player_a' : 'player_b'];
                if (Object.keys(next.matchSlots[matchId]).length === 0) delete next.matchSlots[matchId];
            }
            return next;
        });
    };

    const createManualProfileAndAssign = async (name: string) => {
        const trimmedName = name.trim();
        if (!trimmedName) {
            Alert.alert('Error', 'Ingresa un nombre para el jugador manual.');
            return;
        }

        try {
            await removeMatchPlayer(false, false);

            if (selectedGroupSlot) {
                const { groupName, slotIndex } = selectedGroupSlot;
                await updateTournamentDescription(current => ({
                    rrSlots: {
                        ...(current.rrSlots || {}),
                        [groupName]: {
                            ...((current.rrSlots || {})[groupName] || {}),
                            [String(slotIndex)]: { name: trimmedName }
                        }
                    },
                    matchSlots: { ...(current.matchSlots || {}) }
                }));
            } else if (selectedSlot) {
                const { matchId, slot } = selectedSlot;
                await updateTournamentDescription(current => ({
                    rrSlots: { ...(current.rrSlots || {}) },
                    matchSlots: {
                        ...(current.matchSlots || {}),
                        [matchId]: {
                            ...((current.matchSlots || {})[matchId] || {}),
                            [slot === 1 ? 'player_a' : 'player_b']: { name: trimmedName }
                        }
                    }
                }));
            } else {
                return;
            }

            await loadTournamentData();
            setManualPlayerName('');
            setSelectedSlot(null);
            setSelectedGroupSlot(null);
            setSearchQuery('');
            setSearchResults([]);
            setIsPlayerModalVisible(false);
        } catch (error) {
            Alert.alert('Error', 'No se pudo crear el jugador manual.');
        }
    };

    const updateMatchPlayer = async (profileId: string) => {
        if (!selectedSlot && !selectedGroupSlot) {
            await registerParticipant(profileId);
            return;
        }

        try {
            await assignPlayerToSelectedSlot(profileId);
            await loadTournamentData();
            setSelectedSlot(null);
            setSelectedGroupSlot(null);
            setSearchQuery('');
            setSearchResults([]);
            setIsPlayerModalVisible(false);
        } catch (error) {
            Alert.alert('Error', 'No se pudo asignar el jugador.');
        }
    };

    const removeMatchPlayer = async (closeModal = true, reload = true) => {
        try {
            if (selectedGroupSlot) {
                const { groupName, slotIndex } = selectedGroupSlot;
                const groupMatches = [...(roundRobinMatchesByGroup[groupName] || [])].sort(
                    (a, b) => (a.match_order || 0) - (b.match_order || 0)
                );
                const groupRows = getGroupRows(groupName);
                const pairings = getRoundRobinPairings(groupRows.length);

                for (let index = 0; index < groupMatches.length; index++) {
                    const match = groupMatches[index];
                    const pairing = pairings[index];
                    if (!pairing) continue;

                    const updateData: any = {};
                    if (pairing[0] === slotIndex) {
                        updateData.player_a_id = null;
                        if (IS_DOUBLES) updateData.player_a2_id = null;
                    }
                    if (pairing[1] === slotIndex) {
                        updateData.player_b_id = null;
                        if (IS_DOUBLES) updateData.player_b2_id = null;
                    }
                    if (Object.keys(updateData).length === 0) continue;

                    const { error } = await supabase
                        .from('matches')
                        .update(updateData)
                        .eq('id', match.id);

                    if (error) throw error;
                }

                await updateTournamentDescription(current => {
                    const next = {
                        rrSlots: { ...(current.rrSlots || {}) },
                        matchSlots: { ...(current.matchSlots || {}) }
                    };
                    if (next.rrSlots[groupName]) {
                        delete next.rrSlots[groupName][String(slotIndex)];
                        if (Object.keys(next.rrSlots[groupName]).length === 0) delete next.rrSlots[groupName];
                    }
                    return next;
                });
            } else if (selectedSlot) {
                const { matchId, slot } = selectedSlot;
                const updateData: any = {};
                if (slot === 1) updateData.player_a_id = null;
                else if (slot === 2) updateData.player_a2_id = null;
                else if (slot === 3) updateData.player_b_id = null;
                else if (slot === 4) updateData.player_b2_id = null;

                const { error } = await supabase
                    .from('matches')
                    .update(updateData)
                    .eq('id', matchId);

                if (error) throw error;

                await updateTournamentDescription(current => {
                    const next = {
                        rrSlots: { ...(current.rrSlots || {}) },
                        matchSlots: { ...(current.matchSlots || {}) }
                    };
                    if (next.matchSlots[matchId]) {
                        delete next.matchSlots[matchId][slot === 1 ? 'player_a' : 'player_b'];
                        if (Object.keys(next.matchSlots[matchId]).length === 0) delete next.matchSlots[matchId];
                    }
                    return next;
                });
            }

            if (reload) {
                await loadTournamentData();
            }
            if (closeModal) {
                setSelectedSlot(null);
                setSelectedGroupSlot(null);
                setSearchQuery('');
                setSearchResults([]);
                setIsPlayerModalVisible(false);
            }
        } catch (error) {
            Alert.alert('Error', 'No se pudo quitar el jugador.');
        }
    };

    const tournamentFormat = tournament?.format;
    const tournamentMaxPlayers = tournament?.max_players || 2;
    const isRoundRobin = isRoundRobinFormat(tournamentFormat);
    const hasConsolation = hasConsolationBracket(tournamentFormat);

    const handleDeleteTournament = () => {
        Alert.alert(
            "Eliminar Torneo",
            "¿Estás seguro de que deseas eliminar este torneo completamente? Esta acción es irreversible.",
            [
                { text: "Cancelar", style: "cancel" },
                {
                    text: "Eliminar",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            const { error } = await supabase
                                .from('tournaments')
                                .delete()
                                .eq('id', id);

                            if (error) throw error;

                            router.replace({
                                pathname: '/(tabs)/tournaments',
                                params: { orgId: tournament?.organization_id }
                            } as any);
                        } catch (error) {
                            Alert.alert('Error', 'Hubo un problema al eliminar el torneo.');
                        }
                    }
                }
            ]
        );
    };

    const generateRoundRobinFinals = async (mode: 'standard' | 'alternate') => {
        try {
            const seededPlayers = roundRobinGroupNames
                .flatMap(groupName =>
                    getStandingsForGroup(groupName).map((row: any, index: number) => ({
                        ...row,
                        finish: index + 1,
                    }))
                )
                .sort((a, b) => {
                    if (a.finish !== b.finish) return a.finish - b.finish;
                    if (b.points !== a.points) return b.points - a.points;
                    if (b.diff !== a.diff) return b.diff - a.diff;
                    return b.gamesWon - a.gamesWon;
                })
                .slice(0, 4);

            const semifinals = finalRoundRobinMatches
                .filter(match => String(match.round || '').includes('Semifinal'))
                .sort((a, b) => (a.match_order || 0) - (b.match_order || 0));

            if (semifinals.length < 2 || seededPlayers.length < 4) {
                Alert.alert('Error', 'Se necesitan al menos 4 clasificados y 2 semifinales para generar las llaves.');
                return;
            }

            const pairings =
                mode === 'alternate'
                    ? [[seededPlayers[0], seededPlayers[2]], [seededPlayers[1], seededPlayers[3]]]
                    : [[seededPlayers[0], seededPlayers[3]], [seededPlayers[1], seededPlayers[2]]];

            for (let index = 0; index < semifinals.length; index++) {
                const match = semifinals[index];
                const [playerA, playerB] = pairings[index] || [];

                const updateData: any = {
                    player_a_id: isUuid(playerA?.id) ? playerA.id : null,
                    player_b_id: isUuid(playerB?.id) ? playerB.id : null,
                    winner_id: null,
                    score: null,
                    status: 'pending',
                };

                const { error } = await supabase.from('matches').update(updateData).eq('id', match.id);
                if (error) throw error;

                await updateTournamentDescription(current => ({
                    rrSlots: { ...(current.rrSlots || {}) },
                    matchSlots: {
                        ...(current.matchSlots || {}),
                        [match.id]: {
                            player_a: { name: playerA?.name || 'Por definir' },
                            player_b: { name: playerB?.name || 'Por definir' },
                        }
                    }
                }));
            }

            await loadTournamentData();
            Alert.alert('Éxito', 'Las llaves finales fueron generadas. Puedes ajustar cualquier cruce manualmente.');
        } catch (error) {
            Alert.alert('Error', 'No se pudieron generar las llaves finales.');
        }
    };

    const handleGenerateRoundRobinFinals = () => {
        Alert.alert(
            'Generar llaves',
            'Elige una combinación para crear las semifinales. Después puedes editarla manualmente.',
            [
                { text: 'Cancelar', style: 'cancel' },
                { text: '1 vs 4 / 2 vs 3', onPress: () => generateRoundRobinFinals('standard') },
                { text: '1 vs 3 / 2 vs 4', onPress: () => generateRoundRobinFinals('alternate') },
            ]
        );
    };

    const roundRobinGroupNames = useMemo(() => getRoundRobinGroupNames(tournamentFormat, tournament?.description), [tournamentFormat, tournament?.description]);
    const currentGroupName = activeTab.startsWith('group:') ? activeTab.replace('group:', '') : roundRobinGroupNames[0] || 'A';
    const roundRobinMatchesByGroup = useMemo(
        () =>
            roundRobinGroupNames.reduce((acc, groupName) => {
                acc[groupName] = matches.filter(m => m.round === `Grupo ${groupName}`);
                return acc;
            }, {} as Record<string, any[]>),
        [matches, roundRobinGroupNames]
    );
    const getRoundRobinSlotIndexForMatchSide = (groupName: string, matchId: string, slot: 1 | 2) => {
        const groupMatches = [...(roundRobinMatchesByGroup[groupName] || [])].sort(
            (a, b) => (a.match_order || 0) - (b.match_order || 0)
        );
        const slotCount = getRoundRobinSlots(tournamentMaxPlayers, groupName, tournamentFormat, tournament?.description).length;
        const pairings = getRoundRobinPairings(slotCount);
        const matchIndex = groupMatches.findIndex(match => match.id === matchId);
        const pairing = pairings[matchIndex];
        if (!pairing) return null;
        return slot === 1 ? pairing[0] : pairing[1];
    };
    const finalRoundRobinMatches = useMemo(
        () => matches.filter(m => !String(m.round || '').includes('Grupo')),
        [matches]
    );

    const getGroupRows = (groupName: string) => {
        const groupMatches = roundRobinMatchesByGroup[groupName] || [];
        const fallbackSlots = getRoundRobinSlots(tournamentMaxPlayers, groupName, tournamentFormat, tournament?.description);
        const playerPairs = groupMatches.reduce((acc: any, m) => {
            const slotA = getRoundRobinSlotIndexForMatchSide(groupName, m.id, 1);
            const slotB = getRoundRobinSlotIndexForMatchSide(groupName, m.id, 2);
            if (slotA !== null) {
                acc[slotA] = acc[slotA] || { p1: m.player_a_id, p2: m.player_a2_id };
            }
            if (slotB !== null) {
                acc[slotB] = acc[slotB] || { p1: m.player_b_id, p2: m.player_b2_id };
            }
            return acc;
        }, {});

        return fallbackSlots.map((slot, index) => {
            const pair = playerPairs[index];
            const p1Name = pair?.p1 ? getPlayerName(pair.p1) : (getAssignedNameForGroupSlot(groupName, index) || slot.name);
            const p2Name = pair?.p2 ? getPlayerName(pair.p2) : (IS_DOUBLES ? `${slot.name} (P2)` : null);
            
            return {
                id: pair?.p1 || slot.id,
                name: p2Name ? `${p1Name} / ${p2Name}` : p1Name,
                p1Name,
                p2Name,
                p1Id: pair?.p1,
                p2Id: pair?.p2,
                slotIndex: index,
            };
        });
    };

    const getStandingsForGroup = (groupName: string) => {
        const groupMatches = roundRobinMatchesByGroup[groupName] || [];
        const rows = getGroupRows(groupName);
        const statsMap = rows.reduce((acc, row) => {
            acc[`${groupName}:${row.slotIndex}`] = {
                ...row,
                played: 0,
                won: 0,
                lost: 0,
                diff: 0,
                points: 0,
                gamesWon: 0,
                gamesLost: 0,
            };
            return acc;
        }, {} as Record<string, any>);

        groupMatches.forEach(match => {
            if (!match.score) return;

            const slotA = getRoundRobinSlotIndexForMatchSide(groupName, match.id, 1);
            const slotB = getRoundRobinSlotIndexForMatchSide(groupName, match.id, 2);
            if (slotA === null || slotB === null) return;

            const rowA = statsMap[`${groupName}:${slotA}`];
            const rowB = statsMap[`${groupName}:${slotB}`];
            if (!rowA || !rowB) return;

            let playerAGames = 0;
            let playerBGames = 0;

            String(match.score)
                .split(/\s*,\s*/)
                .filter(Boolean)
                .forEach((setScore: string) => {
                    const [aRaw, bRaw] = setScore.split('-');
                    const a = Number(aRaw);
                    const b = Number(bRaw);
                    if (Number.isNaN(a) || Number.isNaN(b)) return;
                    playerAGames += a;
                    playerBGames += b;
                });

            if (playerAGames === 0 && playerBGames === 0) return;

            rowA.played += 1;
            rowB.played += 1;
            rowA.gamesWon += playerAGames;
            rowA.gamesLost += playerBGames;
            rowB.gamesWon += playerBGames;
            rowB.gamesLost += playerAGames;
            rowA.diff = rowA.gamesWon - rowA.gamesLost;
            rowB.diff = rowB.gamesWon - rowB.gamesLost;

            if (playerAGames > playerBGames) {
                rowA.won += 1;
                rowB.lost += 1;
                rowA.points += 1;
            } else if (playerBGames > playerAGames) {
                rowB.won += 1;
                rowA.lost += 1;
                rowB.points += 1;
            }
        });

        return Object.values(statsMap).sort((a: any, b: any) => {
            if (b.points !== a.points) return b.points - a.points;
            if (b.diff !== a.diff) return b.diff - a.diff;
            if (b.gamesWon !== a.gamesWon) return b.gamesWon - a.gamesWon;
            return String(a.name).localeCompare(String(b.name));
        });
    };

    const getPlayerIdBySlot = (match: any, slot: 1 | 2 | 3 | 4) => {
        if (slot === 1) return match.player_a_id;
        if (slot === 2) return match.player_a2_id;
        if (slot === 3) return match.player_b_id;
        return match.player_b2_id;
    };

    const getDisplayName = (match: any, slot: 1 | 2 | 3 | 4) => {
        const playerId = getPlayerIdBySlot(match, slot);
        if (playerId) return getPlayerName(playerId);

        if (String(match.round || '').startsWith('Grupo ')) {
            const groupName = String(match.round || '').replace('Grupo ', '');
            const entrySlot = (slot === 1 || slot === 2) ? 1 : 2;
            const slotIndex = getRoundRobinSlotIndexForMatchSide(groupName, match.id, entrySlot as 1 | 2);
            if (slotIndex !== null) {
                const assignedName = getAssignedNameForGroupSlot(groupName, slotIndex);
                if (assignedName) return assignedName;
                return `Cupo ${groupName}${slotIndex + 1}${ (slot === 2 || slot === 4) ? ' (P2)' : ''}`;
            }
        }

        const matchSlotKey = (slot === 1 || slot === 2) ? 'player_a' : 'player_b';
        const assignedName = getAssignedNameForMatchSlot(match.id, matchSlotKey);
        if (assignedName) return assignedName;

        return 'Por definir';
    };

    const getDisplayAvatar = (match: any, slot: 1 | 2 | 3 | 4) => {
        const playerId = getPlayerIdBySlot(match, slot);
        return getPlayerAvatar(playerId);
    };

    const getInitials = (name: string) => {
        const normalized = String(name || '')
            .trim()
            .split(/\s+/)
            .filter(Boolean);
        if (normalized.length === 0) return 'PP';
        if (normalized.length === 1) return normalized[0].slice(0, 2).toUpperCase();
        return `${normalized[0][0] || ''}${normalized[1][0] || ''}`.toUpperCase();
    };

    const renderPlayerAvatar = (name: string, avatarUrl: string | null, size = 40) => (
        <View
            style={{
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: colors.primary[500] + '20',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
            }}
        >
            {avatarUrl ? (
                <Image source={{ uri: avatarUrl, cache: 'force-cache' }} style={{ width: size, height: size }} />
            ) : (
                <Text style={{ color: colors.primary[500], fontWeight: '700', fontSize: Math.max(10, size * 0.35) }}>
                    {getInitials(name)}
                </Text>
            )}
        </View>
    );

    const currentGroupRows = useMemo(() => getGroupRows(currentGroupName), [currentGroupName, roundRobinMatchesByGroup, players, tournamentMaxPlayers, tournamentFormat, tournament?.description]);
    const currentGroupStandings = useMemo(() => getStandingsForGroup(currentGroupName), [currentGroupName, currentGroupRows, roundRobinMatchesByGroup]);

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
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.push({ pathname: '/(tabs)/tournaments', params: { orgId: tournament.organization_id } })} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle} numberOfLines={1}>{tournament.name}</Text>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                    <TouchableOpacity style={[styles.actionButton, { padding: 4 }]} onPress={() => router.push(`/(admin)/tournaments/edit/${id}` as any)}>
                        <Ionicons name="pencil" size={22} color={colors.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionButton, { padding: 4 }]} onPress={handleDeleteTournament}>
                        <Ionicons name="trash-outline" size={22} color="#EF4444" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Tabs */}
            <View style={styles.tabsContainer}>
                {isRoundRobin ? (
                    <>
                        {roundRobinGroupNames.map(groupName => (
                            <TouchableOpacity key={groupName} style={[styles.tab, activeTab === `group:${groupName}` && styles.activeTab]} onPress={() => setActiveTab(`group:${groupName}`)}>
                                <Text numberOfLines={1} style={[styles.tabText, activeTab === `group:${groupName}` && styles.activeTabText]}>{`Grupo ${groupName}`}</Text>
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity style={[styles.tab, activeTab === 'finales' && styles.activeTab]} onPress={() => setActiveTab('finales')}>
                            <Text numberOfLines={1} style={[styles.tabText, activeTab === 'finales' && styles.activeTabText]}>Finales</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.tab, activeTab === 'participantes' && styles.activeTab]} onPress={() => setActiveTab('participantes')}>
                            <Text
                                numberOfLines={1}
                                adjustsFontSizeToFit
                                minimumFontScale={0.75}
                                style={[styles.tabText, activeTab === 'participantes' && styles.activeTabText]}
                            >
                                Participantes
                            </Text>
                        </TouchableOpacity>
                    </>
                ) : (
                    <>
                        <TouchableOpacity style={[styles.tab, activeTab === 'main' && styles.activeTab]} onPress={() => setActiveTab('main')}>
                            <Text numberOfLines={1} style={[styles.tabText, activeTab === 'main' && styles.activeTabText]}>Cuadro Principal</Text>
                        </TouchableOpacity>
                        {hasConsolation && (
                            <TouchableOpacity style={[styles.tab, activeTab === 'consolacion' && styles.activeTab]} onPress={() => setActiveTab('consolacion')}>
                                <Text numberOfLines={1} style={[styles.tabText, activeTab === 'consolacion' && styles.activeTabText]}>Consolación</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity style={[styles.tab, activeTab === 'participantes' && styles.activeTab]} onPress={() => setActiveTab('participantes')}>
                            <Text
                                numberOfLines={1}
                                adjustsFontSizeToFit
                                minimumFontScale={0.75}
                                style={[styles.tabText, activeTab === 'participantes' && styles.activeTabText]}
                            >
                                Participantes
                            </Text>
                        </TouchableOpacity>
                    </>
                )}
            </View>

                        <ScrollView contentContainerStyle={styles.scrollContent}>

                {/* Summary Info Card */}
                <View style={[styles.summaryCard, { paddingVertical: spacing.lg }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 }}>
                            <Ionicons name="podium" size={20} color={colors.primary[500]} />
                            <Text style={[styles.summaryText, { flex: 1 }]} numberOfLines={2}>
                                Nivel {tournament.level?.toUpperCase().replace('-', ' ')} | {tournament.surface?.toUpperCase()}
                            </Text>
                        </View>
                    </View>
                    {tournament.status !== 'finished' && tournament.status !== 'completed' && (
                        <TouchableOpacity 
                            style={{ alignSelf: 'flex-start', backgroundColor: colors.primary[500], paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.sm, marginTop: spacing.sm }}
                            onPress={finalizeTournament}
                        >
                            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Finalizar Torneo</Text>
                        </TouchableOpacity>
                    )}
                    {(tournament.status === 'finished' || tournament.status === 'completed') && (
                        <View style={{ alignSelf: 'flex-start', backgroundColor: colors.success + '20', paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: borderRadius.sm, flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm }}>
                            <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                            <Text style={{ color: colors.success, fontSize: 11, fontWeight: '800' }}>FINALIZADO</Text>
                        </View>
                    )}
                    <Text style={[styles.summaryTextSecondary, { marginTop: spacing.xs }]}>{players.length} Jugadores | {tournament.format} | {tournament.modality === 'dobles' ? 'Dobles' : 'Singles'} | Máx: {tournament.max_players}</Text>
                </View>

                {activeTab === 'participantes' ? (
                    <View style={{ gap: spacing.md }}>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: spacing.md }}>Lista de Participantes</Text>
                        <TouchableOpacity 
                            style={[styles.generateBtn, { marginBottom: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, justifyContent: 'center' }]}
                            onPress={() => {
                                setSelectedSlot(null);
                                setSelectedGroupSlot(null);
                                setIsPlayerModalVisible(true);
                            }}
                        >
                            <Ionicons name="person-add-outline" size={18} color="#fff" />
                            <Text style={styles.generateBtnText}>Agregar Participante</Text>
                        </TouchableOpacity>

                        {players.length > 0 ? (
                            players.map((p) => (
                                // ... existing view (already handled by snippet above or I'll fix it in one go)
                                <View key={p.player_id} style={styles.playerListItem}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                        <View style={styles.playerListItemAvatar}>
                                            <Text style={styles.playerListItemInitials}>
                                                {p.profiles?.name?.substring(0, 2).toUpperCase()}
                                            </Text>
                                        </View>
                                        <Text style={styles.playerListItemName}>{p.profiles?.name || 'Desconocido'}</Text>
                                    </View>
                                    <TouchableOpacity 
                                        style={{ padding: spacing.sm }} 
                                        onPress={() => removeParticipant(p.player_id)}
                                    >
                                        <Ionicons name="trash-outline" size={20} color={colors.error} />
                                    </TouchableOpacity>
                                </View>
                            ))
                        ) : (
                            <View style={styles.emptyMatches}>
                                <Ionicons name="people-outline" size={48} color={colors.border} />
                                <Text style={styles.emptyMatchesText}>No hay participantes registrados aún.</Text>
                            </View>
                        )}
                    </View>
                ) : matches.length === 0 ? (
                    <View style={styles.emptyMatches}>
                        <Ionicons name="git-network-outline" size={48} color={colors.border} />
                        <Text style={styles.emptyMatchesText}>No hay partidos generados aún.</Text>
                    </View>
                ) : isRoundRobin ? (
                    activeTab === 'finales' ? (
                    <View style={{ gap: spacing.md }}>
                        <TouchableOpacity
                            style={[styles.modalBtn, styles.modalBtnSave, { alignSelf: 'flex-start', marginBottom: spacing.sm }]}
                            onPress={handleGenerateRoundRobinFinals}
                        >
                            <Text style={styles.modalBtnSaveText}>Generar llaves</Text>
                        </TouchableOpacity>
                        {finalRoundRobinMatches.map(m => (
                            <TouchableOpacity key={m.id} style={[styles.matchCard, { paddingVertical: spacing.lg }]} onPress={() => handleMatchPress(m)}>
                                <Text style={styles.roundText}>{m.round}</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md }}>
                                    {/* Team A */}
                                    <View style={{ flex: 1, gap: spacing.sm }}>
                                        <TouchableOpacity style={{ alignItems: 'center', gap: spacing.xs }} onPress={() => handlePlayerPress(m.id, 1)}>
                                            {renderPlayerAvatar(getDisplayName(m, 1), getDisplayAvatar(m, 1))}
                                            <Text style={{ fontSize: 11, fontWeight: '700', color: colors.text, textAlign: 'center' }} numberOfLines={1}>{getDisplayName(m, 1)}</Text>
                                        </TouchableOpacity>
                                        {IS_DOUBLES && (
                                            <TouchableOpacity style={{ alignItems: 'center', gap: spacing.xs }} onPress={() => handlePlayerPress(m.id, 2)}>
                                                {renderPlayerAvatar(getDisplayName(m, 2), getDisplayAvatar(m, 2))}
                                                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.text, textAlign: 'center' }} numberOfLines={1}>{getDisplayName(m, 2)}</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>

                                    <TouchableOpacity style={{ alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md }} onPress={() => handleMatchPress(m)}>
                                        <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textTertiary }}>VS</Text>
                                        <View style={{ backgroundColor: colors.background, paddingHorizontal: 8, paddingVertical: 4, borderRadius: borderRadius.sm }}>
                                            <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textSecondary }}>{m.score || 'Por definir'}</Text>
                                        </View>
                                    </TouchableOpacity>

                                    {/* Team B */}
                                    <View style={{ flex: 1, gap: spacing.sm }}>
                                        <TouchableOpacity style={{ alignItems: 'center', gap: spacing.xs }} onPress={() => handlePlayerPress(m.id, 3)}>
                                            {renderPlayerAvatar(getDisplayName(m, 3), getDisplayAvatar(m, 3))}
                                            <Text style={{ fontSize: 11, fontWeight: '700', color: colors.text, textAlign: 'center' }} numberOfLines={1}>{getDisplayName(m, 3)}</Text>
                                        </TouchableOpacity>
                                        {IS_DOUBLES && (
                                            <TouchableOpacity style={{ alignItems: 'center', gap: spacing.xs }} onPress={() => handlePlayerPress(m.id, 4)}>
                                                {renderPlayerAvatar(getDisplayName(m, 4), getDisplayAvatar(m, 4))}
                                                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.text, textAlign: 'center' }} numberOfLines={1}>{getDisplayName(m, 4)}</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>
                                {m.court || m.scheduled_at ? (
                                    <View style={{ marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <View style={{ flexDirection: 'row', gap: spacing.md }}>
                                            {m.scheduled_at && (
                                                <>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                        <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
                                                        <Text style={{ fontSize: 12, color: colors.textSecondary }}>{formatScheduleDate(m.scheduled_at)}</Text>
                                                    </View>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                        <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
                                                        <Text style={{ fontSize: 12, color: colors.textSecondary }}>{formatScheduleTime(m.scheduled_at)}</Text>
                                                    </View>
                                                </>
                                            )}
                                            {m.court && (
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                    <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
                                                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>{m.court}</Text>
                                                </View>
                                            )}
                                        </View>
                                        <TouchableOpacity onPress={() => handleSchedulePress(m)}>
                                            <Ionicons name="calendar-outline" size={18} color={colors.primary[500]} />
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    <TouchableOpacity 
                                        style={{ marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 }}
                                        onPress={() => handleSchedulePress(m)}
                                    >
                                        <Ionicons name="calendar-outline" size={14} color={colors.textTertiary} />
                                        <Text style={{ fontSize: 12, color: colors.textTertiary, fontWeight: '600' }}>Programar partido</Text>
                                    </TouchableOpacity>
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>
                    ) : (
                    // Round Robin (Tabla + Partidos)
                    <View style={{ gap: spacing.xl }}>
                        {/* Tabla General */}
                        <View style={{ backgroundColor: colors.surface, borderRadius: borderRadius.xl, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, backgroundColor: colors.background }}>
                                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text}}>{`Tabla General - Grupo ${currentGroupName}`}</Text>
                                <View style={{ backgroundColor: colors.primary[500] + '20', paddingHorizontal: 8, paddingVertical: 4, borderRadius: borderRadius.sm }}>
                                    <Text style={{ fontSize: 10, fontWeight: '700', color: colors.primary[500] }}>VIVO</Text>
                                </View>
                            </View>
                            <View style={{ flexDirection: 'row', backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: spacing.sm, paddingHorizontal: spacing.md }}>
                                <Text style={{ flex: 3, fontSize: 10, fontWeight: '700', color: colors.textTertiary, textTransform: 'uppercase' }}>Jugador</Text>
                                <Text style={{ flex: 1, fontSize: 10, fontWeight: '700', color: colors.textTertiary, textAlign: 'center' }}>PJ</Text>
                                <Text style={{ flex: 1, fontSize: 10, fontWeight: '700', color: colors.textTertiary, textAlign: 'center' }}>PG</Text>
                                <Text style={{ flex: 1, fontSize: 10, fontWeight: '700', color: colors.textTertiary, textAlign: 'center' }}>PP</Text>
                                <Text style={{ flex: 1, fontSize: 10, fontWeight: '700', color: colors.textTertiary, textAlign: 'center' }}>+/-</Text>
                                <Text style={{ flex: 1, fontSize: 10, fontWeight: '700', color: colors.textTertiary, textAlign: 'center' }}>PTS</Text>
                            </View>

                            {currentGroupStandings.length > 0 ? currentGroupStandings.map((playerRow: any, idx: number) => (
                                    <TouchableOpacity
                                        key={playerRow.id}
                                        onPress={() => {
                                            if (IS_DOUBLES) {
                                                Alert.alert(
                                                    'Asignar Jugador',
                                                    '¿Qué jugador deseas asignar?',
                                                    [
                                                        { text: 'Jugador 1', onPress: () => handleGroupSlotPress(currentGroupName, playerRow.slotIndex, 1) },
                                                        { text: 'Jugador 2', onPress: () => handleGroupSlotPress(currentGroupName, playerRow.slotIndex, 2) },
                                                        { text: 'Cancelar', style: 'cancel' }
                                                    ]
                                                );
                                            } else {
                                                handleGroupSlotPress(currentGroupName, playerRow.slotIndex, 1);
                                            }
                                        }}
                                        style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: spacing.md, paddingHorizontal: spacing.md }}
                                    >
                                        <View style={{ flex: 3, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: idx === 0 ? colors.success : colors.textTertiary }} />
                                            <View style={{ flex: 1, minWidth: 0 }}>
                                                <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: '700', color: colors.text }}>{playerRow.p1Name || playerRow.name}</Text>
                                                {IS_DOUBLES && (
                                                    <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: '700', color: colors.text }}>{playerRow.p2Name || 'Jugador 2 por definir'}</Text>
                                                )}
                                            </View>
                                        </View>
                                        <Text style={{ flex: 1, fontSize: 13, fontWeight: '500', color: colors.textSecondary, textAlign: 'center' }}>{playerRow.played}</Text>
                                        <Text style={{ flex: 1, fontSize: 13, fontWeight: '500', color: colors.textSecondary, textAlign: 'center' }}>{playerRow.won}</Text>
                                        <Text style={{ flex: 1, fontSize: 13, fontWeight: '500', color: colors.textSecondary, textAlign: 'center' }}>{playerRow.lost}</Text>
                                        <Text style={{ flex: 1, fontSize: 13, fontWeight: '500', color: colors.textSecondary, textAlign: 'center' }}>{playerRow.diff > 0 ? `+${playerRow.diff}` : playerRow.diff}</Text>
                                        <Text style={{ flex: 1, fontSize: 13, fontWeight: '700', color: colors.primary[500], textAlign: 'center' }}>{playerRow.points}</Text>
                                    </TouchableOpacity>
                                )) : (
                                    <View style={{ padding: spacing.xl, alignItems: 'center' }}>
                                        <Text style={{ color: colors.textTertiary }}>No hay jugadores asignados a este grupo.</Text>
                                    </View>
                                )}
                        </View>

                        {/* Rondas Partidos */}
                        <View>
                            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: spacing.md }}>Próximos Partidos</Text>
                            <View style={styles.matchesContainer}>
                                {(roundRobinMatchesByGroup[currentGroupName] || [])
                                    .map(m => (
                                        <TouchableOpacity key={m.id} style={[styles.matchCard, { paddingVertical: spacing.lg }]} onPress={() => handleMatchPress(m)}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md }}>
                                                {/* Team A */}
                                                <View style={{ flex: 1, gap: spacing.sm }}>
                                                    <TouchableOpacity style={{ alignItems: 'center', gap: spacing.xs }} onPress={() => handlePlayerPress(m.id, 1)}>
                                                        {renderPlayerAvatar(getDisplayName(m, 1), getDisplayAvatar(m, 1))}
                                                        <Text style={{ fontSize: 11, fontWeight: '700', color: colors.text, textAlign: 'center' }} numberOfLines={1}>{getDisplayName(m, 1)}</Text>
                                                    </TouchableOpacity>
                                                    {IS_DOUBLES && (
                                                        <TouchableOpacity style={{ alignItems: 'center', gap: spacing.xs }} onPress={() => handlePlayerPress(m.id, 2)}>
                                                            {renderPlayerAvatar(getDisplayName(m, 2), getDisplayAvatar(m, 2))}
                                                            <Text style={{ fontSize: 11, fontWeight: '700', color: colors.text, textAlign: 'center' }} numberOfLines={1}>{getDisplayName(m, 2)}</Text>
                                                        </TouchableOpacity>
                                                    )}
                                                </View>

                                                <View style={{ alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md }}>
                                                    <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textTertiary }}>VS</Text>
                                                    <View style={{ backgroundColor: colors.background, paddingHorizontal: 8, paddingVertical: 4, borderRadius: borderRadius.sm }}>
                                                        <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textSecondary }}>{m.score || 'Próximo'}</Text>
                                                    </View>
                                                </View>

                                                {/* Team B */}
                                                <View style={{ flex: 1, gap: spacing.sm }}>
                                                    <TouchableOpacity style={{ alignItems: 'center', gap: spacing.xs }} onPress={() => handlePlayerPress(m.id, 3)}>
                                                        {renderPlayerAvatar(getDisplayName(m, 3), getDisplayAvatar(m, 3))}
                                                        <Text style={{ fontSize: 11, fontWeight: '700', color: colors.text, textAlign: 'center' }} numberOfLines={1}>{getDisplayName(m, 3)}</Text>
                                                    </TouchableOpacity>
                                                    {IS_DOUBLES && (
                                                        <TouchableOpacity style={{ alignItems: 'center', gap: spacing.xs }} onPress={() => handlePlayerPress(m.id, 4)}>
                                                            {renderPlayerAvatar(getDisplayName(m, 4), getDisplayAvatar(m, 4))}
                                                            <Text style={{ fontSize: 11, fontWeight: '700', color: colors.text, textAlign: 'center' }} numberOfLines={1}>{getDisplayName(m, 4)}</Text>
                                                        </TouchableOpacity>
                                                    )}
                                                </View>
                                            </View>
                                            {m.court || m.scheduled_at ? (
                                                <View style={{ marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <View style={{ flexDirection: 'row', gap: spacing.md }}>
                                                        {m.scheduled_at && (
                                                            <>
                                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                                    <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
                                                                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>{formatScheduleDate(m.scheduled_at)}</Text>
                                                                </View>
                                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                                    <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
                                                                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>{formatScheduleTime(m.scheduled_at)}</Text>
                                                                </View>
                                                            </>
                                                        )}
                                                        {m.court && (
                                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                                <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
                                                                <Text style={{ fontSize: 12, color: colors.textSecondary }}>{m.court}</Text>
                                                            </View>
                                                        )}
                                                    </View>
                                                    <TouchableOpacity onPress={() => handleSchedulePress(m)}>
                                                        <Ionicons name="calendar-outline" size={18} color={colors.primary[500]} />
                                                    </TouchableOpacity>
                                                </View>
                                            ) : (
                                                <TouchableOpacity 
                                                    style={{ marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 }}
                                                    onPress={() => handleSchedulePress(m)}
                                                >
                                                    <Ionicons name="calendar-outline" size={14} color={colors.textTertiary} />
                                                    <Text style={{ fontSize: 12, color: colors.textTertiary, fontWeight: '600' }}>Programar partido</Text>
                                                </TouchableOpacity>
                                            )}
                                        </TouchableOpacity>
                                    ))}
                            </View>
                        </View>
                    </View>
                    )
                ) : (
                    // Elimination Bracket Matching the HTML exact look
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: spacing.md }}>
                        <View style={{ flexDirection: 'row', gap: spacing['3xl'], paddingHorizontal: spacing.xl }}>
                            {(() => {
                                const filteredMatches = matches.filter(m => {
                                    const isConsolationMatch = /^Consolaci/i.test(String(m.round || ''));
                                    if (activeTab === 'consolacion') return isConsolationMatch;
                                    return !isConsolationMatch;
                                });
                                const rounds = [...new Set(filteredMatches.map(m => m.round_number))].sort((a, b) => a - b);

                                return rounds.map((roundNum, index) => {
                                    const roundMatches = filteredMatches.filter(m => m.round_number === roundNum);
                                    const initialMarginTop = (Math.pow(2, index) - 1) * (MATCH_HEIGHT + ROUND_GAP) / 2;
                                    const matchGap = (Math.pow(2, index) - 1) * MATCH_HEIGHT + (Math.pow(2, index)) * ROUND_GAP;

                                    return (
                                        <View key={roundNum} style={{ width: 260 }}>
                                            <Text style={[styles.roundTitle, { marginBottom: spacing.lg }]}>{roundMatches[0]?.round}</Text>

                                            <View style={{ marginTop: initialMarginTop }}>
                                                {roundMatches.map((m, mIdx) => {
                                                    const isUnplayed = !m.score;
                                                    const isTBD = !m.player_a_id || !m.player_b_id;

                                                    // Special positioning for 3rd place match
                                                    const is3rdPlace = m.round?.includes('3er y 4to');
                                                    const currentMatchGap = is3rdPlace ? spacing.xl : matchGap;

                                                    return (
                                                        <View
                                                            key={m.id}
                                                            style={[
                                                                styles.bracketMatchCard,
                                                                {
                                                                    height: MATCH_HEIGHT,
                                                                    marginBottom: mIdx === roundMatches.length - 1 ? 0 :
                                                                        (roundMatches[mIdx + 1]?.round.includes('3er y 4to') ? spacing.xl : currentMatchGap)
                                                                }
                                                            ]}
                                                        >
                                                            {m.round === '3er y 4to Puesto' && (
                                                                <View style={{ backgroundColor: colors.background, paddingVertical: 4 }}>
                                                                    <Text style={{ textAlign: 'center', fontSize: 10, fontWeight: '700', color: colors.textTertiary, textTransform: 'uppercase' }}>{m.round}</Text>
                                                                </View>
                                                            )}
                                                            <View style={{ flex: 1, borderBottomWidth: 1, borderBottomColor: colors.background, backgroundColor: (m.winner_id === m.player_a_id || m.winner_2_id === m.player_a2_id) ? colors.primary[500] + '15' : colors.surface }}>
                                                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flex: 1 }}>
                                                                    <View style={{ flex: 1 }}>
                                                                        <TouchableOpacity
                                                                            style={{ paddingHorizontal: spacing.md, paddingVertical: IS_DOUBLES ? 4 : spacing.md, justifyContent: 'center' }}
                                                                            onPress={() => handlePlayerPress(m.id, 1)}
                                                                        >
                                                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                                                {renderPlayerAvatar(getDisplayName(m, 1), getDisplayAvatar(m, 1), 22)}
                                                                                <Text style={{ flex: 1, fontSize: IS_DOUBLES ? 11 : 13, fontWeight: m.winner_id === m.player_a_id ? '800' : (isTBD ? '400' : '600'), color: isTBD ? colors.textTertiary : colors.text }} numberOfLines={1}>{getDisplayName(m, 1)}</Text>
                                                                            </View>
                                                                        </TouchableOpacity>
                                                                        {IS_DOUBLES && (
                                                                            <TouchableOpacity
                                                                                style={{ paddingHorizontal: spacing.md, paddingVertical: 4, justifyContent: 'center' }}
                                                                                onPress={() => handlePlayerPress(m.id, 2)}
                                                                            >
                                                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                                                    {renderPlayerAvatar(getDisplayName(m, 2), getDisplayAvatar(m, 2), 22)}
                                                                                    <Text style={{ flex: 1, fontSize: 11, fontWeight: m.winner_2_id === m.player_a2_id ? '800' : (isTBD ? '400' : '600'), color: isTBD ? colors.textTertiary : colors.text }} numberOfLines={1}>{getDisplayName(m, 2)}</Text>
                                                                                </View>
                                                                            </TouchableOpacity>
                                                                        )}
                                                                    </View>
                                                                    <TouchableOpacity onPress={() => handleMatchPress(m)} style={{ flexDirection: 'row', gap: 4, paddingRight: spacing.md }}>
                                                                        {(m.score ? m.score.split(/\s*,\s*/) : ['-']).map((setStr: string, sIdx: number) => {
                                                                            const setScores = setStr.split(/[ -]/);
                                                                            return (
                                                                                <View key={sIdx} style={{ backgroundColor: isUnplayed ? colors.background : colors.primary[500], paddingHorizontal: 6, paddingVertical: 2, borderRadius: borderRadius.sm, minWidth: 24, alignItems: 'center' }}>
                                                                                    <Text style={{ color: isUnplayed ? colors.textSecondary : '#fff', fontSize: 11, fontWeight: '700' }}>
                                                                                        {isUnplayed ? '-' : setScores[0]}
                                                                                    </Text>
                                                                                </View>
                                                                            );
                                                                        })}
                                                                    </TouchableOpacity>
                                                                </View>
                                                            </View>

                                                            <View style={{ flex: 1, opacity: isTBD ? 0.6 : 1, backgroundColor: (m.winner_id === m.player_b_id || m.winner_2_id === m.player_b2_id) ? colors.primary[500] + '15' : colors.surface }}>
                                                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flex: 1 }}>
                                                                    <View style={{ flex: 1 }}>
                                                                        <TouchableOpacity
                                                                            style={{ paddingHorizontal: spacing.md, paddingVertical: IS_DOUBLES ? 4 : spacing.md, justifyContent: 'center' }}
                                                                            onPress={() => handlePlayerPress(m.id, 3)}
                                                                        >
                                                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                                                {renderPlayerAvatar(getDisplayName(m, 3), getDisplayAvatar(m, 3), 22)}
                                                                                <Text style={{ flex: 1, fontSize: IS_DOUBLES ? 11 : 13, fontWeight: m.winner_id === m.player_b_id ? '800' : (isTBD ? '400' : '500'), color: isTBD ? colors.textTertiary : colors.text }} numberOfLines={1}>{getDisplayName(m, 3)}</Text>
                                                                            </View>
                                                                        </TouchableOpacity>
                                                                        {IS_DOUBLES && (
                                                                            <TouchableOpacity
                                                                                style={{ paddingHorizontal: spacing.md, paddingVertical: 4, justifyContent: 'center' }}
                                                                                onPress={() => handlePlayerPress(m.id, 4)}
                                                                            >
                                                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                                                    {renderPlayerAvatar(getDisplayName(m, 4), getDisplayAvatar(m, 4), 22)}
                                                                                    <Text style={{ flex: 1, fontSize: 11, fontWeight: m.winner_2_id === m.player_b2_id ? '800' : (isTBD ? '400' : '500'), color: isTBD ? colors.textTertiary : colors.text }} numberOfLines={1}>{getDisplayName(m, 4)}</Text>
                                                                                </View>
                                                                            </TouchableOpacity>
                                                                        )}
                                                                    </View>
                                                                    <TouchableOpacity onPress={() => handleMatchPress(m)} style={{ flexDirection: 'row', gap: 4, paddingRight: spacing.md }}>
                                                                        {(m.score ? m.score.split(/\s*,\s*/) : ['-']).map((setStr: string, sIdx: number) => {
                                                                            const setScores = setStr.split(/[ -]/);
                                                                            return (
                                                                                <View key={sIdx} style={{ backgroundColor: isUnplayed ? colors.background : colors.primary[500], paddingHorizontal: 6, paddingVertical: 2, borderRadius: borderRadius.sm, minWidth: 24, alignItems: 'center' }}>
                                                                                    <Text style={{ color: isUnplayed ? colors.textSecondary : '#fff', fontSize: 11, fontWeight: '700' }}>
                                                                                        {isUnplayed ? '-' : setScores[1] || '0'}
                                                                                    </Text>
                                                                                </View>
                                                                            );
                                                                        })}
                                                                    </TouchableOpacity>
                                                                </View>
                                                            </View>
                                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 4, backgroundColor: colors.background + '50' }}>
                                                                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                                                                    {m.scheduled_at && (
                                                                        <>
                                                                            <Text style={{ fontSize: 9, color: colors.textTertiary, fontWeight: '600' }}>
                                                                                {formatScheduleDate(m.scheduled_at)}
                                                                            </Text>
                                                                            <Text style={{ fontSize: 9, color: colors.textTertiary, fontWeight: '600' }}>
                                                                                {formatScheduleTime(m.scheduled_at)}
                                                                            </Text>
                                                                        </>
                                                                    )}
                                                                    {m.court && (
                                                                        <Text style={{ fontSize: 9, color: colors.textTertiary, fontWeight: '600' }}>
                                                                            {m.court}
                                                                        </Text>
                                                                    )}
                                                                </View>
                                                                <TouchableOpacity onPress={() => handleSchedulePress(m)}>
                                                                    <Ionicons name="calendar-outline" size={12} color={colors.textTertiary} />
                                                                </TouchableOpacity>
                                                            </View>
                                                            {isTBD && (
                                                                <View style={{ backgroundColor: colors.primary[500] + '15', padding: 4, alignItems: 'center' }}>
                                                                    <Text style={{ color: colors.primary[500], fontSize: 9, fontWeight: '700', textTransform: 'uppercase' }}>Próximamente</Text>
                                                                </View>
                                                            )}
                                                        </View>
                                                    )
                                                })}
                                            </View>
                                        </View>
                                    )
                                })
                            })()}
                        </View>
                    </ScrollView>
                )}
            </ScrollView>

            {/* Edit Match Score Modal */}
            <Modal visible={isEditModalVisible} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Editar Resultado</Text>
                        {selectedMatch && (
                            <Text style={styles.modalSubtitle}>
                                {getDisplayName(selectedMatch, 1)} vs {getDisplayName(selectedMatch, 2)}
                            </Text>
                        )}
                        {selectedMatch && (
                            <View style={{ gap: spacing.md, marginVertical: spacing.md }}>
                                {/* Column Headers */}
                                <View style={{ flexDirection: 'row', paddingLeft: 60, gap: spacing.md, marginBottom: -spacing.sm }}>
                                    <Text style={{ flex: 1, color: colors.textSecondary, fontSize: 10, fontWeight: '700', textAlign: 'center' }} numberOfLines={1}>{getDisplayName(selectedMatch, 1)}</Text>
                                    <View style={{ width: 10 }} />
                                    <Text style={{ flex: 1, color: colors.textSecondary, fontSize: 10, fontWeight: '700', textAlign: 'center' }} numberOfLines={1}>{getDisplayName(selectedMatch, 2)}</Text>
                                </View>

                                {setScores.map((set, idx) => (
                                    <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md }}>
                                        <Text style={{ color: colors.textSecondary, fontWeight: '700', width: 44 }}>Set {idx + 1}</Text>
                                        <TextInput
                                            style={[styles.scoreInput, { width: 60, color: colors.text, textAlign: 'center' }]}
                                            keyboardType="number-pad"
                                            maxLength={2}
                                            value={set.s1}
                                            ref={ref => { scoreInputRefs.current[idx * 2] = ref; }}
                                            onChangeText={(val) => {
                                                const newSets = [...setScores];
                                                newSets[idx] = { ...newSets[idx], s1: val };
                                                setSetScores(newSets);
                                                if (val && scoreInputRefs.current[(idx * 2) + 1]) {
                                                    scoreInputRefs.current[(idx * 2) + 1]?.focus();
                                                }
                                            }}
                                        />
                                        <Text style={{ color: colors.textTertiary }}>-</Text>
                                        <TextInput
                                            style={[styles.scoreInput, { width: 60, color: colors.text, textAlign: 'center' }]}
                                            keyboardType="number-pad"
                                            maxLength={2}
                                            value={set.s2}
                                            ref={ref => { scoreInputRefs.current[(idx * 2) + 1] = ref; }}
                                            onChangeText={(val) => {
                                                const newSets = [...setScores];
                                                newSets[idx] = { ...newSets[idx], s2: val };
                                                setSetScores(newSets);
                                                if (val && scoreInputRefs.current[(idx * 2) + 2]) {
                                                    scoreInputRefs.current[(idx * 2) + 2]?.focus();
                                                }
                                            }}
                                        />
                                    </View>
                                ))}
                            </View>
                        )}
                        <View style={styles.modalButtons}>
                            <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={() => setIsEditModalVisible(false)}>
                                <Text style={styles.modalBtnCancelText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.modalBtn, styles.modalBtnSave]} onPress={saveMatchScore} disabled={savingMatch}>
                                {savingMatch ? <TennisSpinner size={18} color="#fff" /> : <Text style={styles.modalBtnSaveText}>Guardar</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

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
                        <Text style={styles.modalTitle}>Asignar Jugador</Text>
                        <TouchableOpacity onPress={() => setIsPlayerModalVisible(false)} style={styles.modalCloseBtn}>
                            <Ionicons name="close" size={24} color={colors.text} />
                        </TouchableOpacity>
                    </View>

                    <View style={{ paddingHorizontal: spacing.xl, gap: spacing.sm, marginTop: spacing.md, marginBottom: spacing.sm, flexDirection: 'row' }}>
                        <TouchableOpacity style={[styles.modalBtn, styles.modalBtnSave]} onPress={() => setIsManualPlayerModalVisible(true)}>
                            <Text style={styles.modalBtnSaveText}>Agregar Manual</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={() => createManualProfileAndAssign('BYE')}>
                            <Text style={styles.modalBtnCancelText}>Asignar BYE</Text>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                        style={[styles.searchResultRow, { paddingHorizontal: spacing.xl, borderBottomWidth: 1, borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.error + '10' }]}
                        onPress={() => removeMatchPlayer()}
                    >
                        <Ionicons name="trash-outline" size={20} color={colors.error} style={{ marginRight: spacing.md }} />
                        <Text style={{ color: colors.error, fontWeight: '600' }}>Quitar Jugador / Por definir</Text>
                    </TouchableOpacity>

                    <Text style={styles.modalSectionTitle}>Participantes Registrados</Text>
                    <ScrollView style={{ maxHeight: 300 }}>
                        {players.map((p) => (
                            <TouchableOpacity 
                                key={p.player_id} 
                                style={styles.playerSearchItem}
                                onPress={() => updateMatchPlayer(p.player_id)}
                            >
                                <View>
                                    <Text style={styles.playerSearchName}>{p.profiles?.name || 'Desconocido'}</Text>
                                    <Text style={styles.playerSearchRole}>Participante Inscrito</Text>
                                </View>
                                <Ionicons name="add-circle-outline" size={20} color={colors.primary[500]} />
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    <View style={styles.modalDivider}>
                        <Text style={styles.modalDividerText}>O buscar otros usuarios</Text>
                    </View>

                    <View style={styles.searchBox}>
                        <Ionicons name="search" size={20} color={colors.textTertiary} />
                        <TextInput
                            style={[styles.searchInput, { color: colors.text }]}
                            placeholder="Buscar usuario..."
                            placeholderTextColor={colors.textTertiary}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')}>
                                <Ionicons name="close-circle" size={20} color={colors.textTertiary} />
                            </TouchableOpacity>
                        )}
                    </View>

                    {isSearching ? (
                        <TennisSpinner size={18} style={{ marginTop: spacing.md }} />
                    ) : (
                        <ScrollView style={{ maxHeight: 200 }}>
                            {searchResults.map((user) => (
                                <TouchableOpacity 
                                    key={user.id} 
                                    style={styles.playerSearchItem}
                                    onPress={() => updateMatchPlayer(user.id)}
                                >
                                    <View>
                                        <Text style={styles.playerSearchName}>{user.name}</Text>
                                        <Text style={styles.playerSearchRole}>Usuario del sistema</Text>
                                    </View>
                                    <Ionicons name="add-circle-outline" size={20} color={colors.primary[500]} />
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    )}
                </KeyboardAvoidingView>
            </Modal>

            <Modal visible={isManualPlayerModalVisible} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Jugador Manual</Text>
                        <TextInput
                            style={[styles.scoreInput, { color: colors.text, textAlign: 'left' }]}
                            placeholder="Nombre del jugador"
                            placeholderTextColor={colors.textTertiary}
                            value={manualPlayerName}
                            onChangeText={setManualPlayerName}
                            autoFocus
                        />
                        <View style={styles.modalButtons}>
                            <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={() => setIsManualPlayerModalVisible(false)}>
                                <Text style={styles.modalBtnCancelText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalBtn, styles.modalBtnSave]}
                                onPress={async () => {
                                    await createManualProfileAndAssign(manualPlayerName);
                                    setIsManualPlayerModalVisible(false);
                                }}
                            >
                                <Text style={styles.modalBtnSaveText}>Guardar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Schedule Match Modal */}
            <Modal visible={isScheduleModalVisible} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Programar Partido</Text>
                        <View style={{ gap: spacing.md, marginVertical: spacing.md }}>
                            <DateField 
                                label="Fecha del partido"
                                value={scheduleData.date}
                                onChange={(date) => setScheduleData({ ...scheduleData, date })}
                            />
                            
                            <View>
                                <Text style={[styles.modalDividerText, { textAlign: 'left', marginBottom: 4 }]}>Hora (HH:MM)</Text>
                                <TextInput
                                    style={[styles.scoreInput, { color: colors.text, textAlign: 'left' }]}
                                    placeholder="Ej: 18:30"
                                    placeholderTextColor={colors.textTertiary}
                                    value={scheduleData.time}
                                    onChangeText={(time) => setScheduleData({ ...scheduleData, time })}
                                    maxLength={5}
                                />
                            </View>

                            <View>
                                <Text style={[styles.modalDividerText, { textAlign: 'left', marginBottom: 4 }]}>Cancha</Text>
                                <TouchableOpacity
                                    style={[styles.scoreInput, { justifyContent: 'center' }]}
                                    onPress={() => setIsCourtPickerVisible(true)}
                                >
                                    <Text style={{ color: scheduleData.court ? colors.text : colors.textTertiary, fontSize: 15, fontWeight: '600' }}>
                                        {scheduleData.court || 'Seleccionar cancha'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={styles.modalButtons}>
                            <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={() => setIsScheduleModalVisible(false)}>
                                <Text style={styles.modalBtnCancelText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.modalBtn, styles.modalBtnSave]} onPress={saveMatchSchedule} disabled={savingSchedule}>
                                {savingSchedule ? <TennisSpinner size={18} color="#fff" /> : <Text style={styles.modalBtnSaveText}>Guardar</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal visible={isCourtPickerVisible} transparent animationType="fade" onRequestClose={() => setIsCourtPickerVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Seleccionar Cancha</Text>
                        <ScrollView style={{ maxHeight: 340 }}>
                            {COURT_OPTIONS.map((courtName) => (
                                <TouchableOpacity
                                    key={courtName}
                                    style={styles.playerSearchItem}
                                    onPress={() => {
                                        setScheduleData((current) => ({ ...current, court: courtName }));
                                        setIsCourtPickerVisible(false);
                                    }}
                                >
                                    <Text style={styles.playerSearchName}>{courtName}</Text>
                                    {scheduleData.court === courtName && (
                                        <Ionicons name="checkmark-circle" size={18} color={colors.primary[500]} />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                        <TouchableOpacity style={[styles.modalBtn, styles.modalBtnCancel]} onPress={() => setIsCourtPickerVisible(false)}>
                            <Text style={styles.modalBtnCancelText}>Cerrar</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

function getStyles(colors: any) {
    return StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        centerAll: { justifyContent: 'center', alignItems: 'center' },
        errorText: { fontSize: 16, color: colors.error },

        header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingVertical: spacing.md, backgroundColor: colors.surface },
        backButton: {
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: colors.surfaceSecondary,
            borderWidth: 1,
            borderColor: colors.border,
            justifyContent: 'center',
            alignItems: 'center'
        },
        actionButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-end' },
        headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: colors.text, textAlign: 'center' },

        tabsContainer: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
        tab: { flex: 1, paddingVertical: spacing.md, paddingHorizontal: spacing.xs, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
        activeTab: { borderBottomColor: colors.primary[500] },
        tabText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
        activeTabText: { color: colors.primary[500] },

        scrollContent: { padding: spacing.xl, paddingBottom: 100 },

        summaryCard: { backgroundColor: colors.primary[500] + '10', padding: spacing.md, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.primary[500] + '20', marginBottom: spacing.xl, gap: spacing.xs },
        summaryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
        summaryText: { fontSize: 15, fontWeight: '700', color: colors.text },
        summaryTextSecondary: { fontSize: 13, color: colors.textSecondary },

        emptyMatches: { alignItems: 'center', marginTop: spacing['4xl'], gap: spacing.md },
        emptyMatchesText: { fontSize: 16, color: colors.textSecondary },
        generateBtn: { backgroundColor: colors.primary[500], paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: borderRadius.lg },
        generateBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

        matchesContainer: { gap: spacing.md },
        matchCard: { backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border },
        roundText: { fontSize: 12, fontWeight: '700', color: colors.textTertiary, textTransform: 'uppercase', marginBottom: spacing.sm },
        matchPlayersRow: { gap: spacing.xs },
        playerName: { fontSize: 14, fontWeight: '500', color: colors.text },
        scoreRow: { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, alignItems: 'center' },
        scoreText: { fontSize: 14, fontWeight: '700', color: colors.primary[500] },

        // Bracket Styles
        roundTitle: { color: colors.textTertiary, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', marginBottom: spacing.sm, textAlign: 'center', letterSpacing: 1 },
        bracketMatchCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.lg, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 },
        bracketPlayerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 10, backgroundColor: colors.surface },
        bracketPlayerName: { fontSize: 13, fontWeight: '600', color: colors.text },
        scoreBadge: { backgroundColor: colors.background, paddingHorizontal: 6, paddingVertical: 2, borderRadius: borderRadius.sm },
        scoreBadgeText: { color: colors.textSecondary, fontSize: 11, fontWeight: '700' },
        matchScoreFooter: { backgroundColor: colors.primary[500] + '15', padding: spacing.xs, alignItems: 'center' },
        matchScoreFooterText: { color: colors.primary[500], fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
        matchLabelText: { textAlign: 'center', fontSize: 10, fontWeight: '700', color: colors.textTertiary, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: colors.border },

        // Modal
        modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
        modalContent: { width: '100%', backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: spacing.xl, gap: spacing.md },
        modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text, textAlign: 'center' },
        modalSubtitle: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.sm },
        scoreInput: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md, height: 48, paddingHorizontal: spacing.md, fontSize: 16, textAlign: 'center' },
        modalButtons: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
        modalBtn: { flex: 1, height: 48, borderRadius: borderRadius.md, justifyContent: 'center', alignItems: 'center' },
        modalBtnCancel: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
        modalBtnSave: { backgroundColor: colors.primary[500] },
        modalBtnCancelText: { color: colors.text, fontWeight: '600' },
        modalBtnSaveText: { color: '#fff', fontWeight: '700' },

        // Player Selection Modal Styles
        modalContainer: { flex: 1, backgroundColor: colors.background },
        modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.xl, borderBottomWidth: 1, borderBottomColor: colors.border },
        modalCloseBtn: {
            width: 32,
            height: 32,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surfaceSecondary,
            alignItems: 'center',
            justifyContent: 'center',
        },
        searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, marginHorizontal: spacing.xl, marginBottom: spacing.md, paddingHorizontal: spacing.md, height: 48, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border },
        searchInput: { flex: 1, marginLeft: spacing.sm, fontSize: 16, color: colors.text },
        modalList: { paddingHorizontal: spacing.xl, paddingBottom: spacing['4xl'] },
        searchResultRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
        searchResultAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary[500] + '20', justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
        searchResultInitials: { fontSize: 14, fontWeight: '700', color: colors.primary[500] },
        searchResultName: { fontSize: 16, fontWeight: '500', color: colors.text },
        searchResultEmail: { fontSize: 13, color: colors.textSecondary },
        modalEmpty: { textAlign: 'center', color: colors.textTertiary, marginTop: spacing.xl },

        // New styles for participants list
        playerListItem: {
            flexDirection: 'row',
            alignItems: 'center',
            padding: spacing.md,
            backgroundColor: colors.surface,
            borderRadius: borderRadius.lg,
            borderWidth: 1,
            borderColor: colors.border,
        },
        playerListItemAvatar: {
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: colors.primary[500] + '20',
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: spacing.md,
        },
        playerListItemInitials: {
            fontSize: 12,
            fontWeight: '700',
            color: colors.primary[500],
        },
        playerListItemName: {
            fontSize: 15,
            fontWeight: '600',
            color: colors.text,
        },

        // Player search item in modal
        playerSearchItem: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingVertical: spacing.md,
            paddingHorizontal: spacing.xl,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
        },
        playerSearchName: {
            fontSize: 15,
            fontWeight: '700',
            color: colors.text,
        },
        playerSearchRole: {
            fontSize: 11,
            color: colors.textTertiary,
            marginTop: 2,
        },
        modalSectionTitle: {
            fontSize: 14,
            fontWeight: '800',
            color: colors.primary[500],
            marginLeft: spacing.xl,
            marginTop: spacing.lg,
            marginBottom: spacing.sm,
            textTransform: 'uppercase',
        },
        modalDivider: {
            flexDirection: 'row',
            alignItems: 'center',
            margin: spacing.xl,
        },
        modalDividerText: {
            flex: 1,
            fontSize: 12,
            fontWeight: '700',
            color: colors.textTertiary,
            textAlign: 'center',
            backgroundColor: colors.background,
            paddingHorizontal: spacing.sm,
        },
    });
}



