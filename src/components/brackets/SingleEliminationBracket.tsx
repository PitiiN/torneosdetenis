import React, { useRef } from 'react';
import { Animated, View, Text, StyleSheet, ScrollView } from 'react-native';
import { colors, spacing } from '@/theme';
import { MatchCard } from './MatchCard';

interface SingleEliminationProps {
    rounds: {
        title: string;
        matches: {
            id: string;
            player1: { name: string; score?: number; isWinner?: boolean };
            player2: { name: string; score?: number; isWinner?: boolean };
            status?: string;
        }[];
    }[];
}

export const SingleEliminationBracket = ({ rounds }: SingleEliminationProps) => {
    const scale = useRef(new Animated.Value(1)).current;
    const baseScaleRef = useRef(1);
    const startDistanceRef = useRef<number | null>(null);

    const distanceBetweenTouches = (touches: any[]) => {
        if (touches.length < 2) return null;
        const [firstTouch, secondTouch] = touches;
        const dx = secondTouch.pageX - firstTouch.pageX;
        const dy = secondTouch.pageY - firstTouch.pageY;
        return Math.sqrt(dx * dx + dy * dy);
    };

    return (
        <Animated.View
            onTouchStart={(event) => {
                const distance = distanceBetweenTouches(Array.from(event.nativeEvent.touches || []));
                if (distance) startDistanceRef.current = distance;
            }}
            onTouchMove={(event) => {
                const touches = Array.from(event.nativeEvent.touches || []);
                if (touches.length < 2 || !startDistanceRef.current) return;
                const currentDistance = distanceBetweenTouches(touches);
                if (!currentDistance) return;
                const nextScale = Math.max(0.75, Math.min(baseScaleRef.current * (currentDistance / startDistanceRef.current), 2));
                scale.setValue(nextScale);
            }}
            onTouchEnd={(event) => {
                const touches = Array.from(event.nativeEvent.touches || []);
                if (touches.length < 2) {
                    scale.stopAnimation((value: number) => {
                        baseScaleRef.current = value;
                    });
                    startDistanceRef.current = null;
                }
            }}
            style={{ transform: [{ scale }] }}
        >
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                {rounds.map((round) => (
                    <View key={round.title} style={styles.roundColumn}>
                        <Text style={styles.roundTitle}>{round.title.toUpperCase()}</Text>
                        <View style={styles.matchesContainer}>
                            {round.matches.map((match) => (
                                <View key={match.id} style={styles.matchWrapper}>
                                    <MatchCard 
                                        player1={match.player1}
                                        player2={match.player2}
                                        status={match.status}
                                    />
                                </View>
                            ))}
                        </View>
                    </View>
                ))}
            </ScrollView>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    scrollContent: {
        paddingHorizontal: spacing.xl,
        gap: spacing['3xl'],
        paddingBottom: spacing.xl,
    },
    roundColumn: {
        alignItems: 'center',
    },
    roundTitle: {
        color: colors.textTertiary,
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 1.5,
        marginBottom: spacing.xl,
    },
    matchesContainer: {
        justifyContent: 'space-around',
        flex: 1,
        gap: spacing['2xl'],
    },
    matchWrapper: {
        position: 'relative',
    }
});
