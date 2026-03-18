import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, borderRadius } from '@/theme';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SingleEliminationBracket } from '@/components/brackets/SingleEliminationBracket';
import { RoundRobinTable } from '@/components/brackets/RoundRobinTable';
import { TournamentFinals } from '@/components/brackets/TournamentFinals';
import { supabase } from '@/services/supabase';
import { createInitialMatches, getRoundRobinGroupNames, getRoundRobinSlots, hasConsolationBracket, isRoundRobinFormat } from '@/services/tournamentStructure';

const { width } = Dimensions.get('window');

export default function TournamentDetailScreen() {
    const { id } = useLocalSearchParams();
    const insets = useSafeAreaInsets();
    const { colors } = useTheme();
    const styles = getStyles(colors);
    const router = useRouter();
    const [activeTab, setActiveTab] = useState('principal');
    const [tournament, setTournament] = useState<any>(null);
    const [matches, setMatches] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (id) {
            loadTournamentData();
        }
    }, [id]);

    const loadTournamentData = async () => {
        setIsLoading(true);
        try {
            // Fetch Tournament
            const { data: tourData, error: tourErr } = await supabase
                .from('tournaments')
                .select('*')
                .eq('id', id)
                .single();
            
            if (tourErr) throw tourErr;
            setTournament(tourData);

            // Fetch Matches with player names
            const { data: matchData, error: matchErr } = await supabase
                .from('matches')
                .select(`
                    *,
                    player_a:profiles!player_a_id(name),
                    player_b:profiles!player_b_id(name)
                `)
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
                });

                if (scaffoldMatches.length > 0) {
                    const { error: scaffoldError } = await supabase.from('matches').insert(scaffoldMatches);
                    if (scaffoldError) throw scaffoldError;

                    const { data: regeneratedMatches, error: regeneratedError } = await supabase
                        .from('matches')
                        .select(`
                            *,
                            player_a:profiles!player_a_id(name),
                            player_b:profiles!player_b_id(name)
                        `)
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
            console.error('Error loading tournament:', error);
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
                    scores: setScores.map((s: string[]) => s[0]).filter((s: string | undefined) => s !== undefined),
                    isWinner: m.winner_id === m.player_a_id && !!m.player_a_id 
                },
                player2: { 
                    name: m.player_b?.name || 'TBD', 
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
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                Alert.alert('Sesión requerida', 'Debes iniciar sesión para inscribirte.');
                return;
            }

            const { error: regError } = await supabase
                .from('registrations')
                .insert({
                    tournament_id: id,
                    player_id: session.user.id,
                    status: 'confirmed',
                    fee_amount: tournament?.registration_fee || 0,
                    is_paid: false
                });

            if (regError) {
                if (regError.code === '23505') {
                    Alert.alert('Aviso', 'Ya estás inscrito en este torneo.');
                } else {
                    throw regError;
                }
                return;
            }

            Alert.alert('¡Éxito!', 'Te has inscrito correctamente en el torneo.');
            loadTournamentData();
        } catch (error) {
            console.error('Error joining tournament:', error);
            Alert.alert('Error', 'No se pudo realizar la inscripción.');
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

    const createStandings = (groupName: string, groupMatches: any[]) => {
        const fallbackSlots = getRoundRobinSlots(tournamentMaxPlayers, groupName, tournamentFormat, tournament?.description);
        return fallbackSlots.map((slot, index) => {
            const playerIds = [...new Set(groupMatches.flatMap(match => [match.player_a_id, match.player_b_id]).filter(Boolean))];
            const playerId = playerIds[index];
            const profile =
                groupMatches.find(match => match.player_a_id === playerId)?.player_a ||
                groupMatches.find(match => match.player_b_id === playerId)?.player_b;

            return {
                name: profile?.name || slot.name,
                pj: 0,
                pg: 0,
                pp: 0,
                diff: 0,
                pts: 0,
                isActive: index === 0 && !!profile?.name,
            };
        });
    };

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
                </View>

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
                                    image: `https://i.pravatar.cc/100?u=${match.id}-a`,
                                },
                                player2: {
                                    name: match.player_b?.name || 'Por definir',
                                    group: 'CLASIFICADO',
                                    image: `https://i.pravatar.cc/100?u=${match.id}-b`,
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
                                            <Text style={styles.groupMatchName}>{match.player_a?.name || 'Por definir'}</Text>
                                            <Text style={styles.groupMatchScore}>{match.score || 'VS'}</Text>
                                            <Text style={styles.groupMatchName}>{match.player_b?.name || 'Por definir'}</Text>
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

            {tournament.status === 'open' && (
                <View style={[styles.footerActions, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
                    <TouchableOpacity style={styles.joinButton} onPress={handleJoin}>
                        <Text style={styles.joinButtonText}>Inscribirse al Torneo</Text>
                        <Ionicons name="enter-outline" size={20} color="#fff" />
                    </TouchableOpacity>
                </View>
            )}
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
        justifyContent: 'space-between',
        gap: spacing.sm,
        paddingVertical: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    groupMatchName: {
        flex: 1,
        color: colors.text,
        fontSize: 13,
        fontWeight: '700',
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
