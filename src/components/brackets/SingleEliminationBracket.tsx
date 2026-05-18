import React, { useRef } from 'react';
import { Animated, View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme, spacing } from '@/theme';
import { MatchCard } from './MatchCard';

interface SingleEliminationProps {
    rounds: {
        title: string;
        originalIdx?: number;
        matches: {
            id: string;
            player1: { name: string; avatarUrl?: string | null; scores?: (number | string)[]; isWinner?: boolean; id?: string | null };
            player2: { name: string; avatarUrl?: string | null; scores?: (number | string)[]; isWinner?: boolean; id?: string | null };
            status?: string;
            scheduledAt?: string | null;
            court?: string | null;
            canSubmitScore?: boolean;
            onSubmitScore?: () => void;
            round?: string;
        }[];
    }[];
    onPlayerPress?: (playerId: string) => void;
    matchHeight?: number;
    roundGap?: number;
    isShareImage?: boolean;
    isMirror?: boolean;
}

export const SingleEliminationBracket = ({ 
    rounds, 
    onPlayerPress,
    matchHeight = 130,
    roundGap = 24,
    isShareImage = false,
    isMirror = false
}: SingleEliminationProps) => {
    const scale = useRef(new Animated.Value(1)).current;
    const baseScaleRef = useRef(1);
    const startDistanceRef = useRef<number | null>(null);
    const { colors } = useTheme();
    const styles = getStyles(colors);

    const distanceBetweenTouches = (touches: any[]) => {
        if (touches.length < 2) return null;
        const [firstTouch, secondTouch] = touches;
        const dx = secondTouch.pageX - firstTouch.pageX;
        const dy = secondTouch.pageY - firstTouch.pageY;
        return Math.sqrt(dx * dx + dy * dy);
    };

    // Calculate dynamic spacing parameters when generating share image for few players/rounds
    const numRounds = rounds.length;
    const numMatchesInFirstRound = rounds[0]?.matches?.length || 1;

    let columnWidth = 240;
    let columnGap = 32;
    let horizontalPadding = spacing.xl;

    if (isShareImage && numRounds > 0) {
        // Adjust column width dynamically based on total rounds to fit the 1600px canvas perfectly
        if (numRounds >= 7) {
            columnWidth = 180;
            columnGap = 16;
        } else if (numRounds === 6) {
            columnWidth = 210;
            columnGap = 24;
        } else if (numRounds === 5) {
            columnWidth = 230;
            columnGap = 32;
        } else {
            columnWidth = 240;
            const viewportWidth = 1500;
            const totalColumnsWidth = numRounds * columnWidth;
            const availableHorizontalSpace = viewportWidth - totalColumnsWidth;
            if (availableHorizontalSpace > 0) {
                const calculatedGap = availableHorizontalSpace / (numRounds + 1);
                columnGap = Math.max(32, Math.min(calculatedGap, 200));
            }
        }
        
        // Center the content inside the 1600px poster width (leaving 32px padding on each side)
        const totalContentWidth = numRounds * columnWidth + (numRounds - 1) * columnGap;
        horizontalPadding = Math.max(16, (1536 - totalContentWidth) / 2);
    }

    let finalRoundGap = roundGap;
    let containerPaddingTop = 0;

    if (isShareImage) {
        const viewportHeight = 1450; // Use a conservative safe height for content viewport
        if (numMatchesInFirstRound > 1) {
            const totalCardsHeight = numMatchesInFirstRound * matchHeight;
            const availableVerticalSpace = viewportHeight - totalCardsHeight;
            
            if (availableVerticalSpace > 0) {
                const calculatedGap = availableVerticalSpace / (numMatchesInFirstRound - 1);
                // Cap the round gap to 2x card height so cards don't look completely disconnected, but still spacious
                const maxAllowedGap = Math.max(80, matchHeight * 2);
                finalRoundGap = Math.min(calculatedGap, maxAllowedGap);
                
                const totalBracketHeight = numMatchesInFirstRound * matchHeight + (numMatchesInFirstRound - 1) * finalRoundGap;
                if (viewportHeight > totalBracketHeight) {
                    containerPaddingTop = (viewportHeight - totalBracketHeight) / 2;
                }
            }
        } else if (numMatchesInFirstRound === 1) {
            // If there's only 1 match (e.g. Gran Final), center it completely vertically
            containerPaddingTop = (viewportHeight - matchHeight) / 2;
        }
    }

    // Build display rounds with original index tracking to handle mirroring elegantly
    const displayRounds = isMirror 
        ? rounds.map((r, idx) => ({ ...r, originalIdx: r.originalIdx !== undefined ? r.originalIdx : idx })).reverse()
        : rounds.map((r, idx) => ({ ...r, originalIdx: r.originalIdx !== undefined ? r.originalIdx : idx }));

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
            <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                contentContainerStyle={[
                    styles.scrollContent,
                    {
                        paddingHorizontal: horizontalPadding,
                        gap: columnGap,
                        paddingTop: containerPaddingTop
                    }
                ]}
            >
                {displayRounds.map((round) => {
                    const index = round.originalIdx;
                    const initialMarginTop = (Math.pow(2, index) - 1) * (matchHeight + finalRoundGap) / 2;
                    const matchGap = (Math.pow(2, index) - 1) * matchHeight + (Math.pow(2, index)) * finalRoundGap;

                    return (
                        <View key={round.title} style={[styles.roundColumn, { width: columnWidth }]}>
                            <Text style={styles.roundTitle}>{round.title.toUpperCase()}</Text>
                            <View style={{ marginTop: initialMarginTop }}>
                                {round.matches.map((match, mIdx) => {
                                    const is3rdPlace = match.round?.includes('3er y 4to');
                                    const nextIs3rdPlace = round.matches[mIdx + 1]?.round?.includes('3er y 4to');
                                    const currentMatchGap = is3rdPlace ? 24 : matchGap;
                                    const marginBottom = mIdx === round.matches.length - 1 
                                        ? 0 
                                        : (nextIs3rdPlace ? 24 : currentMatchGap);

                                    return (
                                        <View 
                                            key={match.id} 
                                            style={[
                                                styles.matchWrapper, 
                                                { 
                                                    width: columnWidth,
                                                    height: matchHeight,
                                                    marginBottom,
                                                    justifyContent: 'center'
                                                }
                                            ]}
                                        >
                                            <MatchCard 
                                                player1={match.player1}
                                                player2={match.player2}
                                                status={match.status}
                                                scheduledAt={match.scheduledAt}
                                                court={match.court}
                                                onPlayerPress={onPlayerPress}
                                                canSubmitScore={match.canSubmitScore}
                                                onSubmitScore={match.onSubmitScore}
                                                width={columnWidth}
                                            />
                                        </View>
                                    );
                                })}
                            </View>
                        </View>
                    );
                })}
            </ScrollView>
        </Animated.View>
    );
};

const getStyles = (colors: any) => StyleSheet.create({
    scrollContent: {
        paddingHorizontal: spacing.xl,
        gap: spacing['3xl'],
        paddingBottom: spacing.xl,
    },
    roundColumn: {
        width: 240,
        alignItems: 'center',
    },
    roundTitle: {
        color: colors.textTertiary,
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 1.5,
        marginBottom: spacing.xl,
    },
    matchWrapper: {
        position: 'relative',
        width: 240,
    }
});
