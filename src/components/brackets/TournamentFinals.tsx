import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { colors, spacing, borderRadius } from '@/theme';

interface FinalMatch {
    title: string;
    player1: { name: string; group: string; image: string };
    player2: { name: string; group: string; image: string };
    time: string;
    isGrandFinal?: boolean;
}

interface TournamentFinalsProps {
    summary: {
        groupALeader: string;
        groupBLeader: string;
    };
    matches: FinalMatch[];
}

export const TournamentFinals = ({ summary, matches }: TournamentFinalsProps) => {
    return (
        <View style={styles.container}>
            {/* Summary */}
            <View style={styles.summaryGrid}>
                <View style={styles.summaryCard}>
                    <Text style={styles.summaryLabel}>LÍDER GRUPO A</Text>
                    <View style={styles.summaryRow}>
                        <Image source={{ uri: 'https://i.pravatar.cc/100?u=a' }} style={styles.miniAvatar} />
                        <Text style={styles.summaryName}>{summary.groupALeader}</Text>
                    </View>
                </View>
                <View style={styles.summaryCard}>
                    <Text style={styles.summaryLabel}>LÍDER GRUPO B</Text>
                    <View style={styles.summaryRow}>
                        <Image source={{ uri: 'https://i.pravatar.cc/100?u=b' }} style={styles.miniAvatar} />
                        <Text style={styles.summaryName}>{summary.groupBLeader}</Text>
                    </View>
                </View>
            </View>

            {/* Matches */}
            <Text style={styles.sectionTitle}>Partidos de Definición</Text>
            <View style={styles.matchesList}>
                {matches.map((match, idx) => (
                    <View 
                        key={idx} 
                        style={[
                            styles.matchCard, 
                            match.isGrandFinal && styles.grandFinalCard
                        ]}
                    >
                        {match.isGrandFinal && (
                            <View style={styles.grandFinalBadge}>
                                <Text style={styles.grandFinalText}>{match.title.toUpperCase()}</Text>
                            </View>
                        )}
                        {!match.isGrandFinal && (
                            <View style={styles.regularFinalBadge}>
                                <Text style={styles.regularFinalText}>{match.title.toUpperCase()}</Text>
                            </View>
                        )}

                        <View style={styles.matchContent}>
                            <View style={styles.playerWrapper}>
                                <Image source={{ uri: match.player1.image }} style={styles.matchAvatar} />
                                <Text style={styles.matchPlayerName}>{match.player1.name}</Text>
                                <Text style={styles.matchPlayerGroup}>{match.player1.group}</Text>
                            </View>

                            <View style={styles.vsWrapper}>
                                <Text style={styles.vsText}>VS</Text>
                                <View style={styles.timeBadge}>
                                    <Text style={styles.timeText}>{match.time}</Text>
                                </View>
                            </View>

                            <View style={styles.playerWrapper}>
                                <Image source={{ uri: match.player2.image }} style={styles.matchAvatar} />
                                <Text style={styles.matchPlayerName}>{match.player2.name}</Text>
                                <Text style={styles.matchPlayerGroup}>{match.player2.group}</Text>
                            </View>
                        </View>
                    </View>
                ))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        gap: spacing.xl,
        paddingHorizontal: spacing.xl,
    },
    summaryGrid: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    summaryCard: {
        flex: 1,
        backgroundColor: colors.surface,
        borderRadius: borderRadius.xl,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
        gap: 8,
    },
    summaryLabel: {
        fontSize: 10,
        fontWeight: '900',
        color: colors.primary[500],
        letterSpacing: 1,
    },
    summaryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    miniAvatar: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: colors.surfaceSecondary,
    },
    summaryName: {
        fontSize: 14,
        fontWeight: '700',
        color: '#fff',
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '900',
        color: '#fff',
    },
    matchesList: {
        gap: spacing.lg,
    },
    matchCard: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius['2xl'],
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
    },
    grandFinalCard: {
        borderColor: colors.primary[500],
        borderWidth: 2,
    },
    grandFinalBadge: {
        backgroundColor: colors.primary[500],
        paddingVertical: 4,
    },
    grandFinalText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '900',
        textAlign: 'center',
        letterSpacing: 1,
    },
    regularFinalBadge: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        paddingVertical: 4,
    },
    regularFinalText: {
        color: colors.textTertiary,
        fontSize: 10,
        fontWeight: '800',
        textAlign: 'center',
        letterSpacing: 1,
    },
    matchContent: {
        flexDirection: 'row',
        padding: spacing.xl,
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    playerWrapper: {
        flex: 1,
        alignItems: 'center',
        gap: 4,
    },
    matchAvatar: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: colors.surfaceSecondary,
        marginBottom: 4,
    },
    matchPlayerName: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
        textAlign: 'center',
    },
    matchPlayerGroup: {
        color: colors.primary[500],
        fontSize: 10,
        fontWeight: '800',
    },
    vsWrapper: {
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: spacing.md,
    },
    vsText: {
        fontSize: 24,
        fontWeight: '900',
        color: colors.primary[500],
        fontStyle: 'italic',
    },
    timeBadge: {
        backgroundColor: colors.surfaceSecondary,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    timeText: {
        color: colors.textSecondary,
        fontSize: 10,
        fontWeight: '700',
    }
});
