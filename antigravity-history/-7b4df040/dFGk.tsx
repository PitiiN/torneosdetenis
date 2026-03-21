import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/services/supabase';
import { colors, spacing, borderRadius } from '@/theme';

export default function UserTournamentDetailScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [tournament, setTournament] = useState<any>(null);
    const [players, setPlayers] = useState<any[]>([]);
    const [matches, setMatches] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [activeTab, setActiveTab] = useState<'main' | 'consolacion' | 'groupA' | 'groupB'>('main');

    useEffect(() => {
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

                {matches.length === 0 ? (
                    <View style={styles.emptyMatches}>
                        <Ionicons name="git-network-outline" size={48} color={colors.border} />
                        <Text style={styles.emptyMatchesText}>Los cuadros aún no han sido generados.</Text>
                        <Text style={styles.emptyMatchesSubText}>Vuelve a revisar más tarde.</Text>
                    </View>
                ) : isRoundRobin ? (
                    // Simple table for round robin placeholder
                    <View style={styles.matchesContainer}>
                        {matches.map(m => (
                            <View key={m.id} style={styles.matchCard}>
                                <Text style={styles.roundText}>{m.round_name}</Text>
                                <View style={styles.matchPlayersRow}>
                                    <Text style={styles.playerName}>{getPlayerName(m.player1_id)}</Text>
                                    <Text style={styles.playerName}>{getPlayerName(m.player2_id)}</Text>
                                </View>
                                <View style={styles.scoreRow}>
                                    <Text style={styles.scoreText}>{m.score || 'vs'}</Text>
                                </View>
                            </View>
                        ))}
                    </View>
                ) : (
                    // Elimination Bracket
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: spacing.md }}>
                        <View style={{ flexDirection: 'row', minWidth: 800, gap: spacing['3xl'] }}>
                            {[...new Set(matches.map(m => m.round_number))].sort().map(roundNum => {
                                const roundMatches = matches.filter(m => m.round_number === roundNum);
                                return (
                                    <View key={roundNum} style={{ flex: 1, minWidth: 240, justifyContent: 'space-around', gap: spacing.xl }}>
                                        <Text style={styles.roundTitle}>{roundMatches[0]?.round_name}</Text>

                                        <View style={{ gap: spacing.lg }}>
                                            {roundMatches.map(m => (
                                                <View key={m.id} style={styles.bracketMatchCard}>
                                                    {m.round_name === '3er y 4to Puesto' && (
                                                        <Text style={styles.matchLabelText}>{m.round_name}</Text>
                                                    )}
                                                    <View style={styles.bracketPlayerRow}>
                                                        <Text style={styles.bracketPlayerName}>{getPlayerName(m.player1_id)}</Text>
                                                        <View style={styles.scoreBadge}><Text style={styles.scoreBadgeText}>-</Text></View>
                                                    </View>
                                                    <View style={[styles.bracketPlayerRow, { borderTopWidth: 1, borderTopColor: colors.border }]}>
                                                        <Text style={styles.bracketPlayerName}>{getPlayerName(m.player2_id)}</Text>
                                                        <View style={styles.scoreBadge}><Text style={styles.scoreBadgeText}>-</Text></View>
                                                    </View>
                                                    <View style={styles.matchScoreFooter}>
                                                        <Text style={styles.matchScoreFooterText}>{m.score || 'Próximamente'}</Text>
                                                    </View>
                                                </View>
                                            ))}
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
