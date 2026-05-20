import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { useTheme, spacing, borderRadius } from '@/theme';

interface FinalMatch {
    title: string;
    player1: { name: string; group: string; image?: string | null; id?: string | null };
    player2: { name: string; group: string; image?: string | null; id?: string | null };
    time: string;
    isGrandFinal?: boolean;
    scheduledDate?: string | null;
    scheduledTime?: string | null;
    court?: string | null;
}

interface TournamentFinalsProps {
    summary: {
        groupALeader: string;
        groupALeaderImage?: string | null;
        groupBLeader: string;
        groupBLeaderImage?: string | null;
    };
    matches: FinalMatch[];
    onPlayerPress?: (playerId: string) => void;
}

export const TournamentFinals = ({ summary, matches, onPlayerPress }: TournamentFinalsProps) => {
    const { colors } = useTheme();
    const styles = getStyles(colors);

    const getInitials = (name: string) => {
        if (name.includes('/')) {
            const parts = name.split('/');
            const first = parts[0]?.trim() || '';
            const second = parts[1]?.trim() || '';
            return `${first[0] || ''}${second[0] || ''}`.toUpperCase();
        }
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

    const isTappable = (player: FinalMatch['player1']) =>
        !!onPlayerPress && player.name && player.name !== 'Por definir' && player.name !== 'TBD' && player.name !== 'BYE';

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
                            <TouchableOpacity
                                style={styles.playerWrapper}
                                disabled={!isTappable(match.player1)}
                                onPress={() => onPlayerPress?.(match.player1.id || 'non_registered')}
                                activeOpacity={0.6}
                            >
                                {renderAvatar(match.player1.name, match.player1.image, 60)}
                                <Text style={[styles.matchPlayerName, isTappable(match.player1) && styles.tappableName]}>{match.player1.name}</Text>
                                <Text style={styles.matchPlayerGroup}>{match.player1.group}</Text>
                            </TouchableOpacity>

                            <View style={styles.vsWrapper}>
                                <Text style={styles.vsText}>VS</Text>
                                <View style={styles.timeBadge}>
                                    <Text style={styles.timeText}>{match.time}</Text>
                                </View>
                            </View>

                            <TouchableOpacity
                                style={styles.playerWrapper}
                                disabled={!isTappable(match.player2)}
                                onPress={() => onPlayerPress?.(match.player2.id || 'non_registered')}
                                activeOpacity={0.6}
                            >
                                {renderAvatar(match.player2.name, match.player2.image, 60)}
                                <Text style={[styles.matchPlayerName, isTappable(match.player2) && styles.tappableName]}>{match.player2.name}</Text>
                                <Text style={styles.matchPlayerGroup}>{match.player2.group}</Text>
                            </TouchableOpacity>
                        </View>

                        {(match.scheduledDate || match.court) && (
                            <View style={{ 
                                backgroundColor: colors.background + '40', 
                                borderTopWidth: 1, 
                                borderTopColor: colors.border, 
                                paddingVertical: spacing.sm, 
                                paddingHorizontal: spacing.xl, 
                                flexDirection: 'row', 
                                justifyContent: 'space-between', 
                                alignItems: 'center' 
                            }}>
                                <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
                                    {match.scheduledDate && (
                                        <Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: '600' }}>
                                            📅 {match.scheduledDate}
                                        </Text>
                                    )}
                                    {match.scheduledTime && (
                                        <Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: '600' }}>
                                            ⏰ {match.scheduledTime}
                                        </Text>
                                    )}
                                </View>
                                {match.court && (
                                    <Text style={{ fontSize: 11, color: colors.primary[500], fontWeight: '800' }}>
                                        📍 {match.court.toUpperCase()}
                                    </Text>
                                )}
                            </View>
                        )}
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
    tappableName: {
        textDecorationLine: 'underline',
        textDecorationStyle: 'dotted',
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
