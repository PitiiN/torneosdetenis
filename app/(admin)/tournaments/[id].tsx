import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Modal, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/services/supabase';
import { colors, spacing, borderRadius } from '@/theme';
import { FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { createInitialMatches, getRoundRobinGroupNames, getRoundRobinSlots, getSetsToShow, hasConsolationBracket, isRoundRobinFormat } from '@/services/tournamentStructure';

export default function AdminTournamentDetailScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [tournament, setTournament] = useState<any>(null);
    const [players, setPlayers] = useState<any[]>([]);
    const [matches, setMatches] = useState<any[]>([]);
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

    const MATCH_HEIGHT = 130;
    const ROUND_GAP = 24;

    // Player Selection Modal
    const [isPlayerModalVisible, setIsPlayerModalVisible] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState<{ matchId: string, slot: 1 | 2 } | null>(null);
    const [selectedGroupSlot, setSelectedGroupSlot] = useState<{ groupName: string, slotIndex: number } | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [manualPlayerName, setManualPlayerName] = useState('');
    const [isManualPlayerModalVisible, setIsManualPlayerModalVisible] = useState(false);

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
            // Load Tournament
            const { data: tourData, error: tourErr } = await supabase
                .from('tournaments')
                .select('*')
                .eq('id', id)
                .single();
            if (tourErr) throw tourErr;
            setTournament(tourData);

            if (isRoundRobinFormat(tourData.format)) {
                const availableGroups = getRoundRobinGroupNames(tourData.format, tourData.description);
                setActiveTab(currentTab => {
                    if (currentTab === 'finales') return currentTab;
                    if (currentTab.startsWith('group:')) {
                        const currentGroup = currentTab.replace('group:', '');
                        if (availableGroups.includes(currentGroup)) return currentTab;
                    }
                    return `group:${availableGroups[0] || 'A'}`;
                });
            }

            // Load Players & Profiles
            const { data: playersData, error: plyErr } = await supabase
                .from('registrations')
                .select('*, profiles(name)')
                .eq('tournament_id', id);
            if (plyErr) throw plyErr;
            setPlayers(playersData || []);

            // Load Matches
            const { data: matchData, error: matchErr } = await supabase
                .from('matches')
                .select('*')
                .eq('tournament_id', id)
                .order('match_order', { ascending: true });
            if (matchErr) throw matchErr;

            const loadedMatches = matchData || [];
            if (loadedMatches.length === 0) {
                const scaffoldMatches = createInitialMatches({
                    tournamentId: String(id),
                    format: tourData.format,
                    description: tourData.description,
                    maxPlayers: tourData.max_players || 2,
                    participants: (playersData || []).map((registration: any) => ({ id: registration.player_id }))
                });

                if (scaffoldMatches.length > 0) {
                    const { error: scaffoldError } = await supabase.from('matches').insert(scaffoldMatches);
                    if (scaffoldError) throw scaffoldError;

                    const { data: regeneratedMatches, error: regeneratedError } = await supabase
                        .from('matches')
                        .select('*')
                        .eq('tournament_id', id)
                        .order('match_order', { ascending: true });

                    if (regeneratedError) throw regeneratedError;
                    setMatches(regeneratedMatches || []);
                } else {
                    setMatches([]);
                }
            } else {
                setMatches(loadedMatches);
            }

        } catch (error) {
            console.error('Error loading tournament details:', error);
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

    const resolveWinnerId = (match: any, score: string) => {
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

        if (playerAWins === playerBWins) return null;
        return playerAWins > playerBWins ? match.player_a_id : match.player_b_id;
    };

    const propagateWinnerToNextMatch = async (match: any, winnerId: string | null) => {
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
        const { error } = await supabase
            .from('matches')
            .update({ [nextSlotField]: winnerId })
            .eq('id', nextMatch.id);

        if (error) throw error;
    };

    const saveMatchScore = async () => {
        if (!selectedMatch) return;
        setSavingMatch(true);

        // Construct score string "6-4 6-2"
        const finalScore = setScores
            .filter(set => set.s1 !== '' || set.s2 !== '')
            .map(set => `${set.s1}-${set.s2}`)
            .join(', ');

        try {
            const winnerId = resolveWinnerId(selectedMatch, finalScore);
            const { error } = await supabase
                .from('matches')
                .update({ score: finalScore, winner_id: winnerId, status: 'finished' })
                .eq('id', selectedMatch.id);

            if (error) throw error;
            await propagateWinnerToNextMatch(selectedMatch, winnerId);
            await loadTournamentData();
            setIsEditModalVisible(false);
        } catch (error) {
            console.error('Error saving score:', error);
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

    const manualAssignments = useMemo(() => parseManualAssignments(tournament?.description), [tournament?.description]);

    const getAssignedNameForGroupSlot = (groupName: string, slotIndex: number) =>
        manualAssignments.rrSlots?.[groupName]?.[String(slotIndex)]?.name || null;

    const getAssignedNameForMatchSlot = (matchId: string, slot: 1 | 2) =>
        manualAssignments.matchSlots?.[matchId]?.[slot === 1 ? 'player_a' : 'player_b']?.name || null;

    const handlePlayerPress = (matchId: string, slot: 1 | 2) => {
        setSelectedSlot({ matchId, slot });
        setSelectedGroupSlot(null);
        setSearchQuery('');
        setSearchResults([]);
        setManualPlayerName('');
        setIsPlayerModalVisible(true);
    };

    const handleGroupSlotPress = (groupName: string, slotIndex: number) => {
        setSelectedGroupSlot({ groupName, slotIndex });
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
            const { data, error } = await supabase
                .from('profiles')
                .select('id, name')
                .ilike('name', `%${searchQuery}%`)
                .limit(10);

            if (error) throw error;
            setSearchResults(data || []);
        } catch (error) {
            console.error('Error searching users:', error);
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

        if (error) throw error;
    };

    const assignPlayerToSelectedSlot = async (profileId: string) => {
        await ensureRegisteredPlayer(profileId);
        if (selectedGroupSlot) {
            const { groupName, slotIndex } = selectedGroupSlot;
            const groupMatches = [...(roundRobinMatchesByGroup[groupName] || [])].sort(
                (a, b) => (a.match_order || 0) - (b.match_order || 0)
            );
            const pairings = getRoundRobinPairings(currentGroupRows.length);

            for (let index = 0; index < groupMatches.length; index++) {
                const match = groupMatches[index];
                const pairing = pairings[index];
                if (!pairing) continue;

                const updateData: any = {};
                if (pairing[0] === slotIndex) updateData.player_a_id = profileId;
                if (pairing[1] === slotIndex) updateData.player_b_id = profileId;
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
        else updateData.player_b_id = profileId;

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
            console.error('Error creating manual player:', error);
            Alert.alert('Error', 'No se pudo crear el jugador manual.');
        }
    };

    const updateMatchPlayer = async (profileId: string) => {
        if (!selectedSlot && !selectedGroupSlot) return;

        try {
            await assignPlayerToSelectedSlot(profileId);
            await loadTournamentData();
            setSelectedSlot(null);
            setSelectedGroupSlot(null);
            setSearchQuery('');
            setSearchResults([]);
            setIsPlayerModalVisible(false);
        } catch (error) {
            console.error('Error updating match player:', error);
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
                const pairings = getRoundRobinPairings(currentGroupRows.length);

                for (let index = 0; index < groupMatches.length; index++) {
                    const match = groupMatches[index];
                    const pairing = pairings[index];
                    if (!pairing) continue;

                    const updateData: any = {};
                    if (pairing[0] === slotIndex) updateData.player_a_id = null;
                    if (pairing[1] === slotIndex) updateData.player_b_id = null;
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
                else updateData.player_b_id = null;

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
            console.error('Error removing player:', error);
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
                            console.error('Error deleting tournament:', error);
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
            console.error('Error generating round robin finals:', error);
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
        () => matches.filter(m => String(m.round || '').includes('RR')),
        [matches]
    );

    const getGroupRows = (groupName: string) => {
        const groupMatches = roundRobinMatchesByGroup[groupName] || [];
        const fallbackSlots = getRoundRobinSlots(tournamentMaxPlayers, groupName, tournamentFormat, tournament?.description);
        const playerIds = [...new Set(groupMatches.flatMap(m => [m.player_a_id, m.player_b_id]).filter(Boolean))];

        return fallbackSlots.map((slot, index) => {
            const playerId = playerIds[index];
            return {
                id: playerId || slot.id,
                name: playerId ? getPlayerName(playerId) : (getAssignedNameForGroupSlot(groupName, index) || slot.name),
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

    const getDisplayName = (match: any, slot: 1 | 2) => {
        const playerId = slot === 1 ? match.player_a_id : match.player_b_id;
        if (playerId) return getPlayerName(playerId);

        if (String(match.round || '').startsWith('Grupo ')) {
            const groupName = String(match.round || '').replace('Grupo ', '');
            const slotIndex = getRoundRobinSlotIndexForMatchSide(groupName, match.id, slot);
            if (slotIndex !== null) {
                return getAssignedNameForGroupSlot(groupName, slotIndex) || 'Por definir';
            }
        }

        return getAssignedNameForMatchSlot(match.id, slot) || 'Por definir';
    };

    const currentGroupRows = useMemo(() => getGroupRows(currentGroupName), [currentGroupName, roundRobinMatchesByGroup, players, tournamentMaxPlayers, tournamentFormat, tournament?.description]);
    const currentGroupStandings = useMemo(() => getStandingsForGroup(currentGroupName), [currentGroupName, currentGroupRows, roundRobinMatchesByGroup]);

    if (isLoading) {
        return (
            <View style={[styles.container, styles.centerAll, { paddingTop: insets.top }]}>
                <ActivityIndicator size="large" color={colors.primary[500]} />
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
                                <Text style={[styles.tabText, activeTab === `group:${groupName}` && styles.activeTabText]}>{`Grupo ${groupName}`}</Text>
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity style={[styles.tab, activeTab === 'finales' && styles.activeTab]} onPress={() => setActiveTab('finales')}>
                            <Text style={[styles.tabText, activeTab === 'finales' && styles.activeTabText]}>Finales</Text>
                        </TouchableOpacity>
                    </>
                ) : (
                    <>
                        <TouchableOpacity style={[styles.tab, activeTab === 'main' && styles.activeTab]} onPress={() => setActiveTab('main')}>
                            <Text style={[styles.tabText, activeTab === 'main' && styles.activeTabText]}>Cuadro Principal</Text>
                        </TouchableOpacity>
                        {hasConsolation && (
                            <TouchableOpacity style={[styles.tab, activeTab === 'consolacion' && styles.activeTab]} onPress={() => setActiveTab('consolacion')}>
                                <Text style={[styles.tabText, activeTab === 'consolacion' && styles.activeTabText]}>Consolación</Text>
                            </TouchableOpacity>
                        )}
                    </>
                )}
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>

                {/* Summary Info Card like in HTML */}
                <View style={styles.summaryCard}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
                        <Ionicons name="podium" size={20} color={colors.primary[500]} />
                        <Text style={styles.summaryText}>Nivel {tournament.level?.toUpperCase().replace('-', ' ')} | {tournament.surface?.toUpperCase()}</Text>
                    </View>
                    <Text style={styles.summaryTextSecondary}>{players.length} Jugadores | {tournament.format} | Máx: {tournament.max_players}</Text>
                </View>

                {matches.length === 0 ? (
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
                                    <TouchableOpacity style={{ flex: 1, alignItems: 'center', gap: spacing.xs }} onPress={() => handlePlayerPress(m.id, 1)}>
                                        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary[500] + '20', alignItems: 'center', justifyContent: 'center' }}>
                                            <Text style={{ color: colors.primary[500], fontWeight: '700', fontSize: 14 }}>{getDisplayName(m, 1).substring(0, 2).toUpperCase()}</Text>
                                        </View>
                                        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text, textAlign: 'center' }}>{getDisplayName(m, 1)}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={{ alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md }} onPress={() => handleMatchPress(m)}>
                                        <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textTertiary }}>VS</Text>
                                        <View style={{ backgroundColor: colors.background, paddingHorizontal: 8, paddingVertical: 4, borderRadius: borderRadius.sm }}>
                                            <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textSecondary }}>{m.score || 'Por definir'}</Text>
                                        </View>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={{ flex: 1, alignItems: 'center', gap: spacing.xs }} onPress={() => handlePlayerPress(m.id, 2)}>
                                        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary[500] + '20', alignItems: 'center', justifyContent: 'center' }}>
                                            <Text style={{ color: colors.primary[500], fontWeight: '700', fontSize: 14 }}>{getDisplayName(m, 2).substring(0, 2).toUpperCase()}</Text>
                                        </View>
                                        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text, textAlign: 'center' }}>{getDisplayName(m, 2)}</Text>
                                    </TouchableOpacity>
                                </View>
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
                                    <TouchableOpacity key={playerRow.id} onPress={() => handleGroupSlotPress(currentGroupName, playerRow.slotIndex)} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: spacing.md, paddingHorizontal: spacing.md }}>
                                        <View style={{ flex: 3, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: idx === 0 ? colors.success : colors.textTertiary }} />
                                            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }} numberOfLines={1}>{playerRow.name}</Text>
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
                                                <TouchableOpacity
                                                    style={{ flex: 1, alignItems: 'center', gap: spacing.xs }}
                                                    onPress={() => handlePlayerPress(m.id, 1)}
                                                >
                                                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary[500] + '20', alignItems: 'center', justifyContent: 'center' }}>
                                                        <Text style={{ color: colors.primary[500], fontWeight: '700', fontSize: 14 }}>{getDisplayName(m, 1).substring(0, 2).toUpperCase()}</Text>
                                                    </View>
                                                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text, textAlign: 'center' }}>{getDisplayName(m, 1)}</Text>
                                                </TouchableOpacity>
                                                <View style={{ alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md }}>
                                                    <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textTertiary }}>VS</Text>
                                                    <View style={{ backgroundColor: colors.background, paddingHorizontal: 8, paddingVertical: 4, borderRadius: borderRadius.sm }}>
                                                        <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textSecondary }}>{m.score || 'Próximo'}</Text>
                                                    </View>
                                                </View>
                                                <TouchableOpacity
                                                    style={{ flex: 1, alignItems: 'center', gap: spacing.xs }}
                                                    onPress={() => handlePlayerPress(m.id, 2)}
                                                >
                                                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary[500] + '20', alignItems: 'center', justifyContent: 'center' }}>
                                                        <Text style={{ color: colors.primary[500], fontWeight: '700', fontSize: 14 }}>{getDisplayName(m, 2).substring(0, 2).toUpperCase()}</Text>
                                                    </View>
                                                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text, textAlign: 'center' }}>{getDisplayName(m, 2)}</Text>
                                                </TouchableOpacity>
                                            </View>
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
                                                            <TouchableOpacity
                                                                style={{ padding: spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.background, flex: 1, backgroundColor: m.winner_id === m.player_a_id ? colors.primary[500] + '15' : colors.surface }}
                                                                onPress={() => handlePlayerPress(m.id, 1)}
                                                            >
                                                                <Text style={{ fontSize: 13, fontWeight: m.winner_id === m.player_a_id ? '800' : (isTBD ? '400' : '600'), color: isTBD ? colors.textTertiary : colors.text }}>{getDisplayName(m, 1)}</Text>
                                                                <TouchableOpacity onPress={() => handleMatchPress(m)} style={{ flexDirection: 'row', gap: 4 }}>
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
                                                            </TouchableOpacity>
                                                            <TouchableOpacity
                                                                style={{ padding: spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', opacity: isTBD ? 0.6 : 1, flex: 1, backgroundColor: m.winner_id === m.player_b_id ? colors.primary[500] + '15' : colors.surface }}
                                                                onPress={() => handlePlayerPress(m.id, 2)}
                                                            >
                                                                <Text style={{ fontSize: 13, fontWeight: m.winner_id === m.player_b_id ? '800' : (isTBD ? '400' : '500'), color: isTBD ? colors.textTertiary : colors.text }}>{getDisplayName(m, 2)}</Text>
                                                                <TouchableOpacity onPress={() => handleMatchPress(m)} style={{ flexDirection: 'row', gap: 4 }}>
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
                                                            </TouchableOpacity>
                                                            {isTBD && (
                                                                <View style={{ backgroundColor: colors.primary[500] + '15', padding: 4, alignItems: 'center' }}>
                                                                    <Text style={{ color: colors.primary[500], fontSize: 9, fontWeight: '700', textTransform: 'uppercase' }}>Próximamente</Text>
                                                                </View>
                                                            )}
                                                        </View>
                                                    );
                                                })}
                                            </View>
                                        </View>
                                    );
                                });
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
                                {savingMatch ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalBtnSaveText}>Guardar</Text>}
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

                    <View style={styles.searchBox}>
                        <Ionicons name="search" size={20} color={colors.textTertiary} />
                        <TextInput
                            style={[styles.searchInput, { color: colors.text }]}
                            placeholder="Buscar jugador..."
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

                    <View style={{ paddingHorizontal: spacing.xl, gap: spacing.sm, marginTop: -spacing.sm, marginBottom: spacing.sm, flexDirection: 'row' }}>
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
                                    onPress={() => updateMatchPlayer(item.id)}
                                >
                                    <View style={styles.searchResultAvatar}>
                                        <Text style={styles.searchResultInitials}>
                                            {item.name?.substring(0, 2).toUpperCase()}
                                        </Text>
                                    </View>
                                    <View>
                                        <Text style={styles.searchResultName}>{item.name}</Text>
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
        </View >
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    centerAll: { justifyContent: 'center', alignItems: 'center' },
    errorText: { fontSize: 16, color: colors.error },

    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingVertical: spacing.md, backgroundColor: colors.surface },
    backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
    actionButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-end' },
    headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: colors.text, textAlign: 'center' },

    tabsContainer: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
    tab: { flex: 1, paddingVertical: spacing.md, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
    activeTab: { borderBottomColor: colors.primary[500] },
    tabText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
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


