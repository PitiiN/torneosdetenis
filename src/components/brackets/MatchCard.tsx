import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, borderRadius } from '@/theme';

interface Player {
  name: string;
  score?: number | string;
  isWinner?: boolean;
}

interface MatchCardProps {
  player1: Player;
  player2: Player;
  status?: string;
}

export const MatchCard = ({ player1, player2, status }: MatchCardProps) => {
  return (
    <View style={styles.card}>
      <View style={[styles.playerRow, player1.isWinner && styles.winnerRow]}>
        <Text style={[styles.playerName, !player1.isWinner && player2.isWinner && styles.loserText]}>
          {player1.name}
        </Text>
        <View style={[styles.scoreBox, player1.isWinner && styles.scoreBoxWinner]}>
          <Text style={[styles.scoreText, player1.isWinner && styles.scoreTextWinner]}>
            {player1.score ?? '-'}
          </Text>
        </View>
      </View>
      
      <View style={[styles.playerRow, player2.isWinner && styles.winnerRow, styles.bottomRow]}>
        <Text style={[styles.playerName, !player2.isWinner && player1.isWinner && styles.loserText]}>
          {player2.name}
        </Text>
        <View style={[styles.scoreBox, player2.isWinner && styles.scoreBoxWinner]}>
          <Text style={[styles.scoreText, player2.isWinner && styles.scoreTextWinner]}>
            {player2.score ?? '-'}
          </Text>
        </View>
      </View>
      
      {status && (
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>{status.toUpperCase()}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    width: 200,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  playerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    height: 48,
  },
  winnerRow: {
    backgroundColor: 'rgba(236, 91, 19, 0.05)',
  },
  bottomRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  playerName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  loserText: {
    color: colors.textTertiary,
    fontWeight: '400',
  },
  scoreBox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: colors.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  scoreBoxWinner: {
    backgroundColor: colors.primary[500],
  },
  scoreText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  scoreTextWinner: {
    color: '#fff',
  },
  statusBadge: {
    backgroundColor: 'rgba(236, 91, 19, 0.15)',
    paddingVertical: 4,
    alignItems: 'center',
  },
  statusText: {
    color: colors.primary[500],
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  }
});
