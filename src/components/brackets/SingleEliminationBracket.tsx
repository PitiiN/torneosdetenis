import React, { useRef, useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
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
            player1Partner?: { name: string; avatarUrl?: string | null; id?: string | null } | null;
            player2Partner?: { name: string; avatarUrl?: string | null; id?: string | null } | null;
            status?: string;
            scheduledAt?: string | null;
            court?: string | null;
            canSubmitScore?: boolean;
            onSubmitScore?: () => void;
            round?: string;
            rawMatch?: any;
        }[];
    }[];
    onPlayerPress?: (playerId: string) => void;
    matchHeight?: number;
    roundGap?: number;
    isShareImage?: boolean;
    isMirror?: boolean;
    isAdmin?: boolean;
    onAdminPlayerPress?: (matchId: string, slot: number) => void;
    onAdminPlayerLongPress?: (playerId: string | null) => void;
    onAdminMatchPress?: (match: any) => void;
    onAdminSchedulePress?: (match: any) => void;
    children?: React.ReactNode;
}

export const SingleEliminationBracket = ({ 
    rounds, 
    onPlayerPress,
    matchHeight = 130,
    roundGap = 24,
    isShareImage = false,
    isMirror = false,
    isAdmin = false,
    onAdminPlayerPress,
    onAdminPlayerLongPress,
    onAdminMatchPress,
    onAdminSchedulePress,
    children
}: SingleEliminationProps) => {
    const { colors } = useTheme();
    const styles = getStyles(colors);
    const { width: screenWidth } = useWindowDimensions();

    const headerScrollRef = useRef<ScrollView>(null);
    const bodyScrollRef = useRef<ScrollView>(null);
    const verticalScrollRef = useRef<ScrollView>(null);
    const [viewportHeight, setViewportHeight] = useState(600);
    const activeColRef = useRef<number>(0);

    // Calculate dynamic spacing parameters when generating share image for few players/rounds
    const numRounds = rounds.length;
    const numMatchesInFirstRound = rounds[0]?.matches?.length || 1;

    let columnWidth = 240;
    let columnGap = 32;
    let horizontalPadding = spacing.xl;

    if (isShareImage && numRounds > 0) {
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
        const totalContentWidth = numRounds * columnWidth + (numRounds - 1) * columnGap;
        horizontalPadding = Math.max(16, (1536 - totalContentWidth) / 2);
    }

    let finalRoundGap = roundGap;
    let containerPaddingTop = 0;

    if (isShareImage) {
        const viewportHeightVal = 1450;
        if (numMatchesInFirstRound > 1) {
            const totalCardsHeight = numMatchesInFirstRound * matchHeight;
            const availableVerticalSpace = viewportHeightVal - totalCardsHeight;
            
            if (availableVerticalSpace > 0) {
                const calculatedGap = availableVerticalSpace / (numMatchesInFirstRound - 1);
                const maxAllowedGap = Math.max(80, matchHeight * 2);
                finalRoundGap = Math.min(calculatedGap, maxAllowedGap);
                
                const totalBracketHeight = numMatchesInFirstRound * matchHeight + (numMatchesInFirstRound - 1) * finalRoundGap;
                if (viewportHeightVal > totalBracketHeight) {
                    containerPaddingTop = (viewportHeightVal - totalBracketHeight) / 2;
                }
            }
        } else if (numMatchesInFirstRound === 1) {
            containerPaddingTop = (viewportHeightVal - matchHeight) / 2;
        }
    }

    const totalHeight = numMatchesInFirstRound * matchHeight + numMatchesInFirstRound * finalRoundGap;

    const displayRounds = isMirror 
        ? rounds.map((r, idx) => ({ ...r, originalIdx: r.originalIdx !== undefined ? r.originalIdx : idx })).reverse()
        : rounds.map((r, idx) => ({ ...r, originalIdx: r.originalIdx !== undefined ? r.originalIdx : idx }));

    const snapOffsets = useMemo(() => {
        return displayRounds.map((_, i) => {
            const centerOfCol = horizontalPadding + i * (columnWidth + columnGap) + columnWidth / 2;
            return Math.max(0, centerOfCol - screenWidth / 2);
        });
    }, [displayRounds, horizontalPadding, columnWidth, columnGap, screenWidth]);

    const handleBodyHorizontalScroll = (event: any) => {
        const x = event.nativeEvent.contentOffset.x;
        headerScrollRef.current?.scrollTo({ x, animated: false });
    };

    return (
        <View style={styles.container}>
            {/* Body Container (Vertical Scroll) */}
            <ScrollView
                ref={verticalScrollRef}
                style={{ flex: 1 }}
                scrollEnabled={!isShareImage}
                stickyHeaderIndices={!isShareImage ? [1] : undefined}
                contentContainerStyle={{ 
                    paddingBottom: spacing.xl,
                }}
            >
                {/* 0. Optional Header details */}
                <View>
                    {!isShareImage && children}
                </View>

                {/* 1. Header Row (Horizontal Scroll, sticky round titles) */}
                {!isShareImage && (
                    <View style={[styles.headerContainer, { backgroundColor: colors.surface }]}>
                        <ScrollView
                            ref={headerScrollRef}
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            scrollEnabled={false}
                            pointerEvents="none"
                            contentContainerStyle={{
                                paddingHorizontal: horizontalPadding,
                                gap: columnGap,
                            }}
                        >
                            {displayRounds.map((round) => (
                                <View key={round.title} style={{ width: columnWidth, alignItems: 'center', justifyContent: 'center' }}>
                                    <Text style={styles.roundTitle}>{round.title.toUpperCase()}</Text>
                                </View>
                            ))}
                        </ScrollView>
                    </View>
                )}

                {/* 2. Horizontal Scroll for columns */}
                <ScrollView
                    ref={bodyScrollRef}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    scrollEnabled={!isShareImage}
                    onScroll={handleBodyHorizontalScroll}
                    scrollEventThrottle={16}
                    snapToOffsets={snapOffsets}
                    decelerationRate="fast"
                    snapToAlignment="center"
                    contentContainerStyle={{
                        paddingHorizontal: horizontalPadding,
                        gap: columnGap,
                        height: totalHeight,
                        paddingTop: isShareImage ? 0 : spacing.xl,
                    }}
                >
                    {displayRounds.map((round, rIdx) => {
                        const index = round.originalIdx || 0;
                        const initialMarginTop = (Math.pow(2, index) - 1) * (matchHeight + finalRoundGap) / 2;
                        const matchGap = (Math.pow(2, index) - 1) * matchHeight + (Math.pow(2, index)) * finalRoundGap;

                        return (
                            <View 
                                key={round.title} 
                                style={[
                                    styles.roundColumn, 
                                    { 
                                        width: columnWidth,
                                        marginTop: initialMarginTop,
                                    }
                                ]}
                            >
                                {isShareImage && (
                                    <Text style={[styles.roundTitle, { marginBottom: spacing.xl, alignSelf: 'center', textAlign: 'center' }]}>
                                        {round.title.toUpperCase()}
                                    </Text>
                                )}
                                {round.matches.map((match, mIdx) => {
                                    const isEven = mIdx % 2 === 0;
                                    const hasSibling = isEven 
                                        ? mIdx + 1 < round.matches.length
                                        : mIdx - 1 >= 0;

                                    const is3rdPlace = match.round?.includes('3er y 4to');
                                    const nextIs3rdPlace = round.matches[mIdx + 1]?.round?.includes('3er y 4to');
                                    const currentMatchGap = is3rdPlace 
                                        ? 0 
                                        : (nextIs3rdPlace ? 24 : matchGap);

                                    return (
                                        <View 
                                            key={match.id} 
                                            style={[
                                                styles.matchWrapper, 
                                                { 
                                                    width: columnWidth,
                                                    height: matchHeight,
                                                    marginBottom: mIdx === round.matches.length - 1 ? 0 : currentMatchGap,
                                                    justifyContent: 'center'
                                                }
                                            ]}
                                        >
                                            {/* Left horizontal connector line */}
                                            {rIdx > 0 && (
                                                <View 
                                                    style={{
                                                        position: 'absolute',
                                                        left: -columnGap / 2,
                                                        top: matchHeight / 2 - 1,
                                                        width: columnGap / 2,
                                                        height: 2,
                                                        backgroundColor: colors.border,
                                                    }}
                                                />
                                            )}

                                            {/* Right horizontal connector line */}
                                            {rIdx < displayRounds.length - 1 && (
                                                <View 
                                                    style={{
                                                        position: 'absolute',
                                                        right: -columnGap / 2,
                                                        top: matchHeight / 2 - 1,
                                                        width: columnGap / 2,
                                                        height: 2,
                                                        backgroundColor: colors.border,
                                                    }}
                                                />
                                            )}

                                            {/* Vertical connector line joining sibling pairs */}
                                            {rIdx < displayRounds.length - 1 && hasSibling && (
                                                <View 
                                                    style={{
                                                        position: 'absolute',
                                                        right: -columnGap / 2,
                                                        width: 2,
                                                        height: (matchHeight + currentMatchGap) / 2,
                                                        backgroundColor: colors.border,
                                                        ...(isEven ? {
                                                            top: matchHeight / 2,
                                                        } : {
                                                            bottom: matchHeight / 2,
                                                        })
                                                    }}
                                                />
                                            )}

                                            <MatchCard 
                                                player1={match.player1}
                                                player2={match.player2}
                                                player1Partner={match.player1Partner}
                                                player2Partner={match.player2Partner}
                                                status={match.status}
                                                scheduledAt={match.scheduledAt}
                                                court={match.court}
                                                onPlayerPress={onPlayerPress}
                                                canSubmitScore={match.canSubmitScore}
                                                onSubmitScore={match.onSubmitScore}
                                                width={columnWidth}
                                                isAdmin={isAdmin}
                                                onAdminPlayerPress={onAdminPlayerPress}
                                                onAdminPlayerLongPress={onAdminPlayerLongPress}
                                                onAdminMatchPress={onAdminMatchPress}
                                                onAdminSchedulePress={onAdminSchedulePress}
                                                rawMatch={match.rawMatch}
                                            />
                                        </View>
                                    );
                                })}
                            </View>
                        );
                    })}
                </ScrollView>
            </ScrollView>
        </View>
    );
};

const getStyles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        width: '100%',
    },
    headerContainer: {
        height: 48,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        justifyContent: 'center',
    },
    scrollContent: {
        paddingBottom: spacing.xl,
    },
    roundColumn: {
        alignItems: 'center',
    },
    roundTitle: {
        color: colors.textTertiary,
        fontSize: 11,
        fontWeight: '900',
        letterSpacing: 1.5,
    },
    matchWrapper: {
        position: 'relative',
    }
});
