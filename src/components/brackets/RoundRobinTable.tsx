import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { colors, spacing, borderRadius } from '@/theme';

interface Standing {
    name: string;
    pj: number;
    pg: number;
    pp: number;
    diff: number;
    pts: number;
    isActive?: boolean;
}

interface RoundRobinTableProps {
    groupName: string;
    standings: Standing[];
}

export const RoundRobinTable = ({ groupName, standings }: RoundRobinTableProps) => {
    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.groupTitle}>Tabla General - {groupName}</Text>
                <View style={styles.liveBadge}>
                    <Text style={styles.liveText}>VIVO</Text>
                </View>
            </View>

            <View style={styles.tableCard}>
                <View style={styles.tableHeader}>
                    <Text style={[styles.headerCell, styles.nameCell]}>JUGADOR</Text>
                    <Text style={styles.headerCell}>PJ</Text>
                    <Text style={styles.headerCell}>PG</Text>
                    <Text style={styles.headerCell}>PP</Text>
                    <Text style={styles.headerCell}>+/-</Text>
                    <Text style={[styles.headerCell, styles.ptsCell]}>PTS</Text>
                </View>

                {standings.map((s, idx) => (
                    <View key={s.name} style={[styles.row, idx === standings.length - 1 && styles.lastRow]}>
                        <View style={[styles.cell, styles.nameCell]}>
                            <View style={[styles.statusDot, s.isActive && styles.activeDot]} />
                            <Text style={styles.playerName}>{s.name}</Text>
                        </View>
                        <Text style={styles.cell}>{s.pj}</Text>
                        <Text style={styles.cell}>{s.pg}</Text>
                        <Text style={styles.cell}>{s.pp}</Text>
                        <Text style={styles.cell}>{s.diff}</Text>
                        <Text style={[styles.cell, styles.ptsValue]}>{s.pts}</Text>
                    </View>
                ))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        gap: spacing.md,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    groupTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#fff',
    },
    liveBadge: {
        backgroundColor: 'rgba(236, 91, 19, 0.15)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    liveText: {
        color: colors.primary[500],
        fontSize: 10,
        fontWeight: '900',
    },
    tableCard: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
    },
    tableHeader: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.03)',
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    headerCell: {
        flex: 1,
        textAlign: 'center',
        fontSize: 10,
        fontWeight: '900',
        color: colors.textTertiary,
        letterSpacing: 1,
    },
    nameCell: {
        flex: 3,
        textAlign: 'left',
        paddingLeft: spacing.lg,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    ptsCell: {
        paddingRight: spacing.lg,
    },
    row: {
        flexDirection: 'row',
        paddingVertical: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
        alignItems: 'center',
    },
    lastRow: {
        borderBottomWidth: 0,
    },
    cell: {
        flex: 1,
        textAlign: 'center',
        fontSize: 14,
        color: colors.textSecondary,
        fontWeight: '600',
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.surfaceSecondary,
    },
    activeDot: {
        backgroundColor: colors.success,
    },
    playerName: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 14,
    },
    ptsValue: {
        color: colors.primary[500],
        fontWeight: '900',
        paddingRight: spacing.lg,
    }
});
