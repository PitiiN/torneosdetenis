import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { useTheme, spacing, borderRadius } from '@/theme';

interface FinalMatch {
    title: string;
    player1: { name: string; group: string; image?: string | null };
    player2: { name: string; group: string; image?: string | null };
    time: string;
    isGrandFinal?: boolean;
}

interface TournamentFinalsProps {
    summary: {
        groupALeader: string;
        groupALeaderImage?: string | null;
        groupBLeader: string;
        groupBLeaderImage?: string | null;
    };
    matches: FinalMatch[];
}

export const TournamentFinals = ({ summary, matches }: TournamentFinalsProps) => {
    const { colors } = useTheme();
    const styles = getStyles(colors);

    const getInitials = (name: string) => {
        const chunks = String(name || '')
            .trim()
            .split(/\s+/)
            .filter(Boolean);
        if (chunks.length === 0) return 'PP';
        if (chunks.length === 1) return chunks[0].slice(0, 2).toUpperCase();
        return `${chunks[0][0] || ''}${chunks[1][0] || ''}`.toUpperCase();
    };

    const renderAvatar = (name: string, image?: string | null, size = 60) => {
        if (image) {
            return <Image source={{ uri: image, cache: 'force-cache' }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
        }

        return (
            <View style={[styles.fallbackAvatar, { width: size, height: size, borderRadius: size / 2 }]}>
                <Text style={[styles.fallbackAvatarText, { fontSize: Math.max(9, Math.floor(size * 0.32)) }]}>
                    {getInitials(name)}
                </Text>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.summaryGrid}>
                <View style={styles.summaryCard}>
                    <Text style={styles.summaryLabel}>LIDER GRUPO A</Text>
                    <View style={styles.summaryRow}>
                        {renderAvatar(summary.groupALeader, summary.groupALeaderImage, 24)}
                        <Text style={styles.summaryName}>{summary.groupALeader}</Text>
                    </View>
                </View>
                <View style={styles.summaryCard}>
                    <Text style={styles.summaryLabel}>LIDER GRUPO B</Text>
                    <View style={styles.summaryRow}>
                        {renderAvatar(summary.groupBLeader, summary.groupBLeaderImage, 24)}
                        <Text style={styles.summaryName}>{summary.groupBLeader}</Text>
                    </View>
                </View>
            </View>

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
                        {match.isGrandFinal ? (
                            <View style={styles.grandFinalBadge}>
                                <Text style={styles.grandFinalText}>{match.title.toUpperCase()}</Text>
                            </View>
                        ) : (
                            <View style={styles.regularFinalBadge}>
                                <Text style={styles.regularFinalText}>{match.title.toUpperCase()}</Text>
                            </View>
                        )}

                        <View style={styles.matchContent}>
                            <View style={styles.playerWrapper}>
                                {renderAvatar(match.player1.name, match.player1.image, 60)}
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
                                {renderAvatar(match.player2.name, match.player2.image, 60)}
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

const getStyles = (colors: any) => StyleSheet.create({
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
    summaryName: {
        fontSize: 14,
        fontWeight: '700',
        color: colors.text,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '900',
        color: colors.text,
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
        backgroundColor: colors.text + '0D',
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
    matchPlayerName: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '700',
        textAlign: 'center',
    },
    matchPlayerGroup: {
        color: colors.primary[500],
        fontSize: 10,
        fontWeight: '800',
    },
    fallbackAvatar: {
        backgroundColor: colors.primary[500] + '20',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    fallbackAvatarText: {
        color: colors.primary[500],
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
