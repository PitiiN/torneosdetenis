import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/services/supabase';
import { colors, spacing, borderRadius } from '@/theme';

const MATCH_HEIGHT = 130;
const ROUND_GAP = 24;

export default function UserTournamentDetailScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [tournament, setTournament] = useState<any>(null);
    const [players, setPlayers] = useState<any[]>([]);
    const [matches, setMatches] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [activeTab, setActiveTab] = useState<'main' | 'consolacion' | 'groupA' | 'groupB'>('main');

    const filteredMatches = React.useMemo(() => {
        return matches.filter(m => {
            if (activeTab === 'consolacion') return m.round_name.startsWith('Consolación');
            if (activeTab === 'main') return !m.round_name.startsWith('Consolación');
            return true; // For groups, we might need more specific logic later
        });
    }, [matches, activeTab]);

    const rounds = React.useMemo(() => {
        return [...new Set(filteredMatches.map(m => m.round_number))].sort((a, b) => a - b);
    }, [filteredMatches]);

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

    const getPlayerName = (pId: string) => {
        const player = players.find(p => p.id === pId);
        return player ? player.profiles.full_name : 'Por definir';
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

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle} numberOfLines={1}>{tournament.name}</Text>
                <View style={{ width: 40 }} />
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
                        <TouchableOpacity style={[styles.tab, activeTab === 'consolacion' && styles.activeTab]} onPress={() => setActiveTab('consolacion')}>
                            <Text style={[styles.tabText, activeTab === 'consolacion' && styles.activeTabText]}>Consolación</Text>
                        </TouchableOpacity>
                    </>
                )}
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>

                {/* Summary Info */}
                <View style={styles.summaryCard}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
                        <Ionicons name="podium" size={20} color={colors.primary[500]} />
                        <Text style={styles.summaryText}>Categoría {tournament.category.toUpperCase().replace('-', ' ')} | {tournament.modality.toUpperCase()}</Text>
                    </View>
                    <Text style={styles.summaryTextSecondary}>{players.length} Jugadores | {tournament.format} | Sets: {tournament.set_type}</Text>
                </View>

                {filteredMatches.length === 0 ? (
                    <View style={styles.emptyMatches}>
                        <Ionicons name="git-network-outline" size={48} color={colors.border} />
                        <Text style={styles.emptyMatchesText}>Los cuadros aún no han sido generados.</Text>
                        <Text style={styles.emptyMatchesSubText}>Vuelve a revisar más tarde.</Text>
                    </View>
                ) : isRoundRobin ? (
                    // Round Robin (Tabla + Partidos)
                    <View style={{ gap: spacing.xl }}>
                        {/* Tabla General */}
                        <View style={{ backgroundColor: colors.surface, borderRadius: borderRadius.xl, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, backgroundColor: colors.background }}>
                                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Tabla General - Grupo A</Text>
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

                            {players.map((p, idx) => (
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
                            ))}
                        </View>

                        {/* Rondas Partidos */}
                        <View>
                            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: spacing.md }}>Próximos Partidos</Text>
                            <View style={styles.matchesContainer}>
                                {filteredMatches.map(m => (
                                    <View key={m.id} style={[styles.matchCard, { paddingVertical: spacing.lg }]}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md }}>
                                            <View style={{ flex: 1, alignItems: 'center', gap: spacing.xs }}>
                                                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary[500] + '20', alignItems: 'center', justifyContent: 'center' }}>
                                                    <Text style={{ color: colors.primary[500], fontWeight: '700', fontSize: 14 }}>{getPlayerName(m.player1_id).substring(0, 2).toUpperCase()}</Text>
                                                </View>
                                                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text, textAlign: 'center' }}>{getPlayerName(m.player1_id)}</Text>
                                            </View>
                                            <View style={{ alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md }}>
                                                <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textTertiary }}>VS</Text>
                                                <View style={{ backgroundColor: colors.background, paddingHorizontal: 8, paddingVertical: 4, borderRadius: borderRadius.sm }}>
                                                    <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textSecondary }}>{m.score || 'Próximo'}</Text>
                                                </View>
                                            </View>
                                            <View style={{ flex: 1, alignItems: 'center', gap: spacing.xs }}>
                                                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary[500] + '20', alignItems: 'center', justifyContent: 'center' }}>
                                                    <Text style={{ color: colors.primary[500], fontWeight: '700', fontSize: 14 }}>{getPlayerName(m.player2_id).substring(0, 2).toUpperCase()}</Text>
                                                </View>
                                                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text, textAlign: 'center' }}>{getPlayerName(m.player2_id)}</Text>
                                            </View>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        </View>
                    </View>
                ) : (
                    // Elimination Bracket
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: spacing.md }}>
                        <View style={{ flexDirection: 'row', gap: ROUND_GAP }}>
                            {rounds.map((roundNum: number, roundIndex: number) => {
                                const roundMatches = filteredMatches.filter((m: any) => m.round_number === roundNum).sort((a: any, b: any) => a.match_order - b.match_order);
                                const numMatchesInRound = roundMatches.length;
                                const prevRoundNumMatches = roundIndex > 0 ? filteredMatches.filter((m: any) => m.round_number === rounds[roundIndex - 1]).length : 0;

                                // Calculate vertical spacing for matches to align them
                                let matchGap = 0;
                                let initialMarginTop = 0;

                                if (roundIndex === 0) {
                                    matchGap = MATCH_HEIGHT + spacing.xl; // Default gap for first round
                                } else {
                                    // Calculate gap based on previous round's matches
                                    // Each match in the current round corresponds to two matches in the previous round
                                    // The gap should be (2 * prevMatchHeight + prevMatchGap) - currentMatchHeight
                                    // This formula needs adjustment for visual alignment
                                    const prevRoundMatchHeightWithGap = MATCH_HEIGHT + (roundIndex === 1 ? spacing.xl : matchGap); // Assuming previous round also uses MATCH_HEIGHT
                                    matchGap = (prevRoundMatchHeightWithGap * 2) - MATCH_HEIGHT;
                                    matchGap = Math.max(spacing.xl, matchGap); // Ensure minimum gap
                                }

                                // Adjust initial margin top for alignment
                                if (roundIndex > 0) {
                                    const prevRoundMatchHeightWithGap = MATCH_HEIGHT + (roundIndex === 1 ? spacing.xl : matchGap);
                                    initialMarginTop = (prevRoundMatchHeightWithGap / 2) - (MATCH_HEIGHT / 2);
                                }

                                // Special handling for 3rd place match, if it's in the last round
                                const isFinalRound = roundNum === rounds[rounds.length - 1];
                                const has3rdPlaceMatch = roundMatches.some(m => m.round_name.includes('3er y 4to Puesto'));

                                if (isFinalRound && has3rdPlaceMatch && numMatchesInRound > 1) {
                                    // If there's a 3rd place match in the final round, it should be positioned differently
                                    // We'll render it separately or adjust its margin
                                    // For now, let's assume it's the last match in the roundMatches array
                                    const finalMatch = roundMatches.find(m => !m.round_name.includes('3er y 4to Puesto'));
                                    const thirdPlaceMatch = roundMatches.find(m => m.round_name.includes('3er y 4to Puesto'));

                                    return (
                                        <View key={roundNum} style={{ width: 260 }}>
                                            <Text style={[styles.roundTitle, { marginBottom: spacing.lg }]}>{finalMatch?.round_name || 'Final'}</Text>
                                            <View style={{ marginTop: initialMarginTop }}>
                                                {finalMatch && (
                                                    <View
                                                        key={finalMatch.id}
                                                        style={[
                                                            styles.bracketMatchCard,
                                                            {
                                                                height: MATCH_HEIGHT,
                                                                marginBottom: spacing.xl // Gap after final match
                                                            }
                                                        ]}
                                                    >
                                                        <View style={{ padding: spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.background }}>
                                                            <Text style={{ fontSize: 14, fontWeight: finalMatch.player1_id ? '600' : '400', color: finalMatch.player1_id ? colors.text : colors.textTertiary }}>{getPlayerName(finalMatch.player1_id)}</Text>
                                                            <View style={{ backgroundColor: finalMatch.score ? colors.primary[500] : colors.background, paddingHorizontal: 8, paddingVertical: 2, borderRadius: borderRadius.sm }}>
                                                                <Text style={{ color: finalMatch.score ? '#fff' : colors.textSecondary, fontSize: 12, fontWeight: '700' }}>{finalMatch.score ? finalMatch.score.split(' ')[0] : '-'}</Text>
                                                            </View>
                                                        </View>
                                                        <View style={{ padding: spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', opacity: finalMatch.player2_id ? 1 : 0.6 }}>
                                                            <Text style={{ fontSize: 14, fontWeight: finalMatch.player2_id ? '600' : '400', color: finalMatch.player2_id ? colors.text : colors.textTertiary }}>{getPlayerName(finalMatch.player2_id)}</Text>
                                                            <View style={{ backgroundColor: finalMatch.score ? colors.primary[500] : colors.background, paddingHorizontal: 8, paddingVertical: 2, borderRadius: borderRadius.sm }}>
                                                                <Text style={{ color: finalMatch.score ? '#fff' : colors.textSecondary, fontSize: 12, fontWeight: '700' }}>{finalMatch.score ? finalMatch.score.split(' ')[1] || '0' : '-'}</Text>
                                                            </View>
                                                        </View>
                                                        {(!finalMatch.player1_id || !finalMatch.player2_id) && (
                                                            <View style={{ backgroundColor: colors.primary[500] + '15', padding: 6, alignItems: 'center' }}>
                                                                <Text style={{ color: colors.primary[500], fontSize: 10, fontWeight: '700', textTransform: 'uppercase' }}>Próximamente</Text>
                                                            </View>
                                                        )}
                                                    </View>
                                                )}
                                                {thirdPlaceMatch && (
                                                    <View
                                                        key={thirdPlaceMatch.id}
                                                        style={[
                                                            styles.bracketMatchCard,
                                                            {
                                                                height: MATCH_HEIGHT,
                                                                marginTop: spacing.xl * 2 // Extra space for 3rd place match
                                                            }
                                                        ]}
                                                    >
                                                        <View style={{ backgroundColor: colors.background, paddingVertical: 4 }}>
                                                            <Text style={{ textAlign: 'center', fontSize: 10, fontWeight: '700', color: colors.textTertiary, textTransform: 'uppercase' }}>{thirdPlaceMatch.round_name}</Text>
                                                        </View>
                                                        <View style={{ padding: spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.background }}>
                                                            <Text style={{ fontSize: 14, fontWeight: thirdPlaceMatch.player1_id ? '600' : '400', color: thirdPlaceMatch.player1_id ? colors.text : colors.textTertiary }}>{getPlayerName(thirdPlaceMatch.player1_id)}</Text>
                                                            <View style={{ backgroundColor: thirdPlaceMatch.score ? colors.primary[500] : colors.background, paddingHorizontal: 8, paddingVertical: 2, borderRadius: borderRadius.sm }}>
                                                                <Text style={{ color: thirdPlaceMatch.score ? '#fff' : colors.textSecondary, fontSize: 12, fontWeight: '700' }}>{thirdPlaceMatch.score ? thirdPlaceMatch.score.split(' ')[0] : '-'}</Text>
                                                            </View>
                                                        </View>
                                                        <View style={{ padding: spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', opacity: thirdPlaceMatch.player2_id ? 1 : 0.6 }}>
                                                            <Text style={{ fontSize: 14, fontWeight: thirdPlaceMatch.player2_id ? '600' : '400', color: thirdPlaceMatch.player2_id ? colors.text : colors.textTertiary }}>{getPlayerName(thirdPlaceMatch.player2_id)}</Text>
                                                            <View style={{ backgroundColor: thirdPlaceMatch.score ? colors.primary[500] : colors.background, paddingHorizontal: 8, paddingVertical: 2, borderRadius: borderRadius.sm }}>
                                                                <Text style={{ color: thirdPlaceMatch.score ? '#fff' : colors.textSecondary, fontSize: 12, fontWeight: '700' }}>{thirdPlaceMatch.score ? thirdPlaceMatch.score.split(' ')[1] || '0' : '-'}</Text>
                                                            </View>
                                                        </View>
                                                        {(!thirdPlaceMatch.player1_id || !thirdPlaceMatch.player2_id) && (
                                                            <View style={{ backgroundColor: colors.primary[500] + '15', padding: 6, alignItems: 'center' }}>
                                                                <Text style={{ color: colors.primary[500], fontSize: 10, fontWeight: '700', textTransform: 'uppercase' }}>Próximamente</Text>
                                                            </View>
                                                        )}
                                                    </View>
                                                )}
                                            </View>
                                        </View>
                                    );
                                }

                                return (
                                    <View key={roundNum} style={{ width: 260 }}>
                                        <Text style={[styles.roundTitle, { marginBottom: spacing.lg }]}>{roundMatches[0]?.round_name}</Text>
                                        <View style={{ marginTop: initialMarginTop }}>
                                            {roundMatches.map((m, mIdx) => {
                                                const isUnplayed = !m.score;
                                                const isTBD = !m.player1_id || !m.player2_id;
                                                const is3rdPlace = m.round_name.includes('3er y 4to');

                                                // For 3rd place in the final round, use a smaller gap
                                                const currentMatchGap = is3rdPlace ? spacing.xl : matchGap;

                                                return (
                                                    <View
                                                        key={m.id}
                                                        style={[
                                                            styles.bracketMatchCard,
                                                            {
                                                                height: MATCH_HEIGHT,
                                                                marginBottom: mIdx < numMatchesInRound - 1 ? currentMatchGap : 0
                                                            }
                                                        ]}
                                                    >
                                                        {m.round_name === '3er y 4to Puesto' && (
                                                            <View style={{ backgroundColor: colors.background, paddingVertical: 4 }}>
                                                                <Text style={{ textAlign: 'center', fontSize: 10, fontWeight: '700', color: colors.textTertiary, textTransform: 'uppercase' }}>{m.round_name}</Text>
                                                            </View>
                                                        )}
                                                        <View style={{ padding: spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.background }}>
                                                            <Text style={{ fontSize: 14, fontWeight: isTBD ? '400' : '600', color: isTBD ? colors.textTertiary : colors.text }}>{getPlayerName(m.player1_id)}</Text>
                                                            <View style={{ backgroundColor: isUnplayed ? colors.background : colors.primary[500], paddingHorizontal: 8, paddingVertical: 2, borderRadius: borderRadius.sm }}>
                                                                <Text style={{ color: isUnplayed ? colors.textSecondary : '#fff', fontSize: 12, fontWeight: '700' }}>{isUnplayed ? '-' : m.score.split(' ')[0]}</Text>
                                                            </View>
                                                        </View>
                                                        <View style={{ padding: spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', opacity: isTBD ? 0.6 : 1 }}>
                                                            <Text style={{ fontSize: 14, fontWeight: isTBD ? '400' : '500', color: isTBD ? colors.textTertiary : colors.text }}>{getPlayerName(m.player2_id)}</Text>
                                                            <View style={{ backgroundColor: isUnplayed ? colors.background : colors.primary[500], paddingHorizontal: 8, paddingVertical: 2, borderRadius: borderRadius.sm }}>
                                                                <Text style={{ color: isUnplayed ? colors.textSecondary : '#fff', fontSize: 12, fontWeight: '700' }}>{isUnplayed ? '-' : m.score.split(' ')[1] || '0'}</Text>
                                                            </View>
                                                        </View>
                                                        {isTBD && (
                                                            <View style={{ backgroundColor: colors.primary[500] + '15', padding: 6, alignItems: 'center' }}>
                                                                <Text style={{ color: colors.primary[500], fontSize: 10, fontWeight: '700', textTransform: 'uppercase' }}>Próximamente</Text>
                                                            </View>
                                                        )}
                                                    </View>
                                                );
                                            })}
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    </ScrollView>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    centerAll: { justifyContent: 'center', alignItems: 'center' },
    errorText: { fontSize: 16, color: colors.error },

    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingVertical: spacing.md, backgroundColor: colors.surface },
    backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
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

    emptyMatches: { alignItems: 'center', marginTop: spacing['4xl'], gap: spacing.xs },
    emptyMatchesText: { fontSize: 16, color: colors.textSecondary, marginTop: spacing.md },
    emptyMatchesSubText: { fontSize: 14, color: colors.textTertiary },

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
});
