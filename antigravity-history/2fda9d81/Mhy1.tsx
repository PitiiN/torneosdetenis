import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Modal, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/services/supabase';
import { colors, spacing, borderRadius } from '@/theme';
import { FlatList, KeyboardAvoidingView, Platform } from 'react-native';

export default function AdminTournamentDetailScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [tournament, setTournament] = useState<any>(null);
    const [players, setPlayers] = useState<any[]>([]);
    const [matches, setMatches] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [activeTab, setActiveTab] = useState<'main' | 'consolacion' | 'groupA' | 'groupB'>('main');

    // Score Edit Modal
    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [selectedMatch, setSelectedMatch] = useState<any>(null);
    const [setScores, setSetScores] = useState<{ s1: string, s2: string }[]>([
        { s1: '', s2: '' },
        { s1: '', s2: '' },
        { s1: '', s2: '' }
    ]);
    const [savingMatch, setSavingMatch] = useState(false);

    const MATCH_HEIGHT = 130;
    const ROUND_GAP = 24;

    // Player Selection Modal
    const [isPlayerModalVisible, setIsPlayerModalVisible] = useState(false);
    const [selectedSlot, setSelectedSlot] = useState<{ matchId: string, slot: 1 | 2 } | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);

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

            if (tourData.format === 'round-robin') {
                setActiveTab('groupA');
            }

            // Load Players & Profiles
            const { data: playersData, error: plyErr } = await supabase
                .from('tournament_players')
                .select('*, profiles(full_name)')
                .eq('tournament_id', id);
            if (plyErr) throw plyErr;
            setPlayers(playersData || []);

            // Load Matches
            const { data: matchData, error: matchErr } = await supabase
                .from('tournament_matches')
                .select('*')
                .eq('tournament_id', id)
                .order('match_order', { ascending: true });
            if (matchErr) throw matchErr;
            setMatches(matchData || []);

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
        const setsToShow = tournament.set_type === 'best3' ? 3 : (tournament.set_type === 'best5' ? 5 : 1);
        const newSetScores = Array.from({ length: setsToShow }, () => ({ s1: '', s2: '' }));

        if (match.score) {
            const setStrings = match.score.split(' ');
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

    const saveMatchScore = async () => {
        if (!selectedMatch) return;
        setSavingMatch(true);

        // Construct score string "6-4 6-2"
        const finalScore = setScores
            .filter(set => set.s1 !== '' || set.s2 !== '')
            .map(set => `${set.s1}-${set.s2}`)
            .join(' ');

        try {
            const { error } = await supabase
                .from('tournament_matches')
                .update({ score: finalScore })
                .eq('id', selectedMatch.id);

            if (error) throw error;

            setMatches(matches.map(m => m.id === selectedMatch.id ? { ...m, score: finalScore } : m));
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
        const player = players.find(p => p.id === pId);
        return player ? (player.profiles?.full_name || 'Desconocido') : 'Por definir';
    };

    const handlePlayerPress = (matchId: string, slot: 1 | 2) => {
        setSelectedSlot({ matchId, slot });
        setSearchQuery('');
        setSearchResults([]);
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
                .select('id, full_name, email')
                .ilike('full_name', `%${searchQuery}%`)
                .limit(10);

            if (error) throw error;
            setSearchResults(data || []);
        } catch (error) {
            console.error('Error searching users:', error);
        } finally {
            setIsSearching(false);
        }
    };

    const updateMatchPlayer = async (profileId: string) => {
        if (!selectedSlot) return;
        const { matchId, slot } = selectedSlot;

        try {
            // First check if player is already in tournament_players
            let tournamentPlayerId = '';
            const existingPlayer = players.find(p => p.profile_id === profileId);

            if (existingPlayer) {
                tournamentPlayerId = existingPlayer.id;
            } else {
                // Add to tournament_players
                const { data: newPlayer, error: pErr } = await supabase
                    .from('tournament_players')
                    .insert({ tournament_id: id, profile_id: profileId })
                    .select()
                    .single();
                if (pErr) throw pErr;
                tournamentPlayerId = newPlayer.id;
                // Update local players list
                loadTournamentData();
            }

            const updateData: any = {};
            if (slot === 1) updateData.player1_id = tournamentPlayerId;
            else updateData.player2_id = tournamentPlayerId;

            const { error } = await supabase
                .from('tournament_matches')
                .update(updateData)
                .eq('id', matchId);

            if (error) throw error;

            // Update local matches state
            setMatches(matches.map(m => m.id === matchId ? { ...m, ...updateData } : m));
            setIsPlayerModalVisible(false);
        } catch (error) {
            console.error('Error updating match player:', error);
            Alert.alert('Error', 'No se pudo asignar el jugador.');
        }
    };

    const removeMatchPlayer = async () => {
        if (!selectedSlot) return;
        const { matchId, slot } = selectedSlot;

        try {
            const updateData: any = {};
            if (slot === 1) updateData.player1_id = null;
            else updateData.player2_id = null;

            const { error } = await supabase
                .from('tournament_matches')
                .update(updateData)
                .eq('id', matchId);

            if (error) throw error;

            setMatches(matches.map(m => m.id === matchId ? { ...m, ...updateData } : m));
            setIsPlayerModalVisible(false);
        } catch (error) {
            console.error('Error removing player:', error);
            Alert.alert('Error', 'No se pudo quitar el jugador.');
        }
    };

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

    const isRoundRobin = tournament.format === 'round-robin';

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

                            router.replace('/(admin)/tournaments' as any);
                        } catch (error) {
                            console.error('Error deleting tournament:', error);
                            Alert.alert('Error', 'Hubo un problema al eliminar el torneo.');
                        }
                    }
                }
            ]
        );
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
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
                        <TouchableOpacity style={[styles.tab, activeTab === 'groupA' && styles.activeTab]} onPress={() => setActiveTab('groupA')}>
                            <Text style={[styles.tabText, activeTab === 'groupA' && styles.activeTabText]}>Grupo A</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.tab, activeTab === 'groupB' && styles.activeTab]} onPress={() => setActiveTab('groupB')}>
                            <Text style={[styles.tabText, activeTab === 'groupB' && styles.activeTabText]}>Grupo B</Text>
                        </TouchableOpacity>
                    </>
                ) : (
                    <>
                        <TouchableOpacity style={[styles.tab, activeTab === 'main' && styles.activeTab]} onPress={() => setActiveTab('main')}>
                            <Text style={[styles.tabText, activeTab === 'main' && styles.activeTabText]}>Cuadro Principal</Text>
                        </TouchableOpacity>
                        {tournament.format === 'consolacion' && (
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
                        <Text style={styles.summaryText}>Categoría {tournament.category.toUpperCase().replace('-', ' ')} | {tournament.modality.toUpperCase()}</Text>
                    </View>
                    <Text style={styles.summaryTextSecondary}>{players.length} Jugadores | {tournament.format} | Sets: {tournament.set_type}</Text>
                </View>

                {matches.length === 0 ? (
                    <View style={styles.emptyMatches}>
                        <Ionicons name="git-network-outline" size={48} color={colors.border} />
                        <Text style={styles.emptyMatchesText}>No hay partidos generados aún.</Text>
                    </View>
                ) : isRoundRobin ? (
                    // Round Robin (Tabla + Partidos)
                    <View style={{ gap: spacing.xl }}>
                        {/* Tabla General */}
                        <View style={{ backgroundColor: colors.surface, borderRadius: borderRadius.xl, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, backgroundColor: colors.background }}>
                                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Tabla General - {activeTab === 'groupA' ? 'Grupo A' : 'Grupo B'}</Text>
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

                            {(() => {
                                const groupMatches = matches.filter(m => m.round_name.endsWith(activeTab === 'groupA' ? 'A' : 'B'));
                                const groupPlayerIds = [...new Set(groupMatches.flatMap(m => [m.player1_id, m.player2_id]))].filter(id => id !== null);
                                const groupPlayers = players.filter(p => groupPlayerIds.includes(p.id));

                                return groupPlayers.length > 0 ? groupPlayers.map((p, idx) => (
                                    <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: spacing.md, paddingHorizontal: spacing.md }}>
                                        <View style={{ flex: 3, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: idx === 0 ? colors.success : colors.textTertiary }} />
                                            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }} numberOfLines={1}>{getPlayerName(p.id)}</Text>
                                        </View>
                                        <Text style={{ flex: 1, fontSize: 13, fontWeight: '500', color: colors.textSecondary, textAlign: 'center' }}>0</Text>
                                        <Text style={{ flex: 1, fontSize: 13, fontWeight: '500', color: colors.textSecondary, textAlign: 'center' }}>0</Text>
                                        <Text style={{ flex: 1, fontSize: 13, fontWeight: '500', color: colors.textSecondary, textAlign: 'center' }}>0</Text>
                                        <Text style={{ flex: 1, fontSize: 13, fontWeight: '500', color: colors.textSecondary, textAlign: 'center' }}>0</Text>
                                        <Text style={{ flex: 1, fontSize: 13, fontWeight: '700', color: colors.primary[500], textAlign: 'center' }}>0</Text>
                                    </View>
                                )) : (
                                    <View style={{ padding: spacing.xl, alignItems: 'center' }}>
                                        <Text style={{ color: colors.textTertiary }}>No hay jugadores asignados a este grupo.</Text>
                                    </View>
                                );
                            })()}
                        </View>

                        {/* Rondas Partidos */}
                        <View>
                            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: spacing.md }}>Próximos Partidos</Text>
                            <View style={styles.matchesContainer}>
                                {matches
                                    .filter(m => m.round_name.endsWith(activeTab === 'groupA' ? 'A' : 'B'))
                                    .map(m => (
                                        <TouchableOpacity key={m.id} style={[styles.matchCard, { paddingVertical: spacing.lg }]} onPress={() => handleMatchPress(m)}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md }}>
                                                <TouchableOpacity
                                                    style={{ flex: 1, alignItems: 'center', gap: spacing.xs }}
                                                    onPress={() => handlePlayerPress(m.id, 1)}
                                                >
                                                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary[500] + '20', alignItems: 'center', justifyContent: 'center' }}>
                                                        <Text style={{ color: colors.primary[500], fontWeight: '700', fontSize: 14 }}>{getPlayerName(m.player1_id).substring(0, 2).toUpperCase()}</Text>
                                                    </View>
                                                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text, textAlign: 'center' }}>{getPlayerName(m.player1_id)}</Text>
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
                                                        <Text style={{ color: colors.primary[500], fontWeight: '700', fontSize: 14 }}>{getPlayerName(m.player2_id).substring(0, 2).toUpperCase()}</Text>
                                                    </View>
                                                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text, textAlign: 'center' }}>{getPlayerName(m.player2_id)}</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </TouchableOpacity>
                                    ))}
                            </View>
                        </View>
                    </View>
                ) : (
                    // Elimination Bracket Matching the HTML exact look
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: spacing.md }}>
                        <View style={{ flexDirection: 'row', gap: spacing['3xl'], paddingHorizontal: spacing.xl }}>
                            {(() => {
                                const filteredMatches = matches.filter(m => {
                                    if (activeTab === 'consolacion') return m.round_name.startsWith('Consolación');
                                    return !m.round_name.startsWith('Consolación');
                                });
                                const rounds = [...new Set(filteredMatches.map(m => m.round_number))].sort((a, b) => a - b);

                                return rounds.map((roundNum, index) => {
                                    const roundMatches = filteredMatches.filter(m => m.round_number === roundNum);
                                    const initialMarginTop = (Math.pow(2, index) - 1) * (MATCH_HEIGHT + ROUND_GAP) / 2;
                                    const matchGap = (Math.pow(2, index) - 1) * MATCH_HEIGHT + (Math.pow(2, index)) * ROUND_GAP;

                                    return (
                                        <View key={roundNum} style={{ width: 260 }}>
                                            <Text style={[styles.roundTitle, { marginBottom: spacing.lg }]}>{roundMatches[0]?.round_name}</Text>

                                            <View style={{ marginTop: initialMarginTop }}>
                                                {roundMatches.map((m, mIdx) => {
                                                    const isUnplayed = !m.score;
                                                    const isTBD = !m.player1_id || !m.player2_id;

                                                    // Special positioning for 3rd place match
                                                    const is3rdPlace = m.round_name.includes('3er y 4to');
                                                    const currentMatchGap = is3rdPlace ? spacing.xl : matchGap;

                                                    return (
                                                        <View
                                                            key={m.id}
                                                            style={[
                                                                styles.bracketMatchCard,
                                                                {
                                                                    height: MATCH_HEIGHT,
                                                                    marginBottom: mIdx === roundMatches.length - 1 ? 0 :
                                                                        (roundMatches[mIdx + 1]?.round_name.includes('3er y 4to') ? spacing.xl : currentMatchGap)
                                                                }
                                                            ]}
                                                        >
                                                            {m.round_name === '3er y 4to Puesto' && (
                                                                <View style={{ backgroundColor: colors.background, paddingVertical: 4 }}>
                                                                    <Text style={{ textAlign: 'center', fontSize: 10, fontWeight: '700', color: colors.textTertiary, textTransform: 'uppercase' }}>{m.round_name}</Text>
                                                                </View>
                                                            )}
                                                            <TouchableOpacity
                                                                style={{ padding: spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.background, flex: 1 }}
                                                                onPress={() => handlePlayerPress(m.id, 1)}
                                                            >
                                                                <Text style={{ fontSize: 13, fontWeight: isTBD ? '400' : '600', color: isTBD ? colors.textTertiary : colors.text }}>{getPlayerName(m.player1_id)}</Text>
                                                                <TouchableOpacity onPress={() => handleMatchPress(m)} style={{ flexDirection: 'row', gap: 4 }}>
                                                                    {(m.score ? m.score.split(' ') : ['-']).map((setStr, sIdx) => {
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
                                                                style={{ padding: spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', opacity: isTBD ? 0.6 : 1, flex: 1 }}
                                                                onPress={() => handlePlayerPress(m.id, 2)}
                                                            >
                                                                <Text style={{ fontSize: 13, fontWeight: isTBD ? '400' : '500', color: isTBD ? colors.textTertiary : colors.text }}>{getPlayerName(m.player2_id)}</Text>
                                                                <TouchableOpacity onPress={() => handleMatchPress(m)} style={{ flexDirection: 'row', gap: 4 }}>
                                                                    {(m.score ? m.score.split(' ') : ['-']).map((setStr, sIdx) => {
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
                                {getPlayerName(selectedMatch.player1_id)} vs {getPlayerName(selectedMatch.player2_id)}
                            </Text>
                        )}
                        <View style={{ gap: spacing.md, marginVertical: spacing.md }}>
                            {/* Column Headers */}
                            <View style={{ flexDirection: 'row', paddingLeft: 60, gap: spacing.md, marginBottom: -spacing.sm }}>
                                <Text style={{ flex: 1, color: colors.textSecondary, fontSize: 10, fontWeight: '700', textAlign: 'center' }} numberOfLines={1}>{getPlayerName(selectedMatch.player1_id)}</Text>
                                <View style={{ width: 10 }} />
                                <Text style={{ flex: 1, color: colors.textSecondary, fontSize: 10, fontWeight: '700', textAlign: 'center' }} numberOfLines={1}>{getPlayerName(selectedMatch.player2_id)}</Text>
                            </View>

                            {setScores.map((set, idx) => (
                                <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md }}>
                                    <Text style={{ color: colors.textSecondary, fontWeight: '700', width: 44 }}>Set {idx + 1}</Text>
                                    <TextInput
                                        style={[styles.scoreInput, { width: 60, color: colors.text, textAlign: 'center' }]}
                                        keyboardType="number-pad"
                                        maxLength={2}
                                        value={set.s1}
                                        onChangeText={(val) => {
                                            const newSets = [...setScores];
                                            newSets[idx] = { ...newSets[idx], s1: val };
                                            setSetScores(newSets);
                                        }}
                                    />
                                    <Text style={{ color: colors.textTertiary }}>-</Text>
                                    <TextInput
                                        style={[styles.scoreInput, { width: 60, color: colors.text, textAlign: 'center' }]}
                                        keyboardType="number-pad"
                                        maxLength={2}
                                        value={set.s2}
                                        onChangeText={(val) => {
                                            const newSets = [...setScores];
                                            newSets[idx] = { ...newSets[idx], s2: val };
                                            setSetScores(newSets);
                                        }}
                                    />
                                </View>
                            ))}
                        </View>
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

                    <TouchableOpacity
                        style={[styles.searchResultRow, { paddingHorizontal: spacing.xl, borderBottomWidth: 1, borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.error + '10' }]}
                        onPress={removeMatchPlayer}
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
