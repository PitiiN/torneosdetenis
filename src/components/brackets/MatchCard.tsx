import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, borderRadius } from '@/theme';

interface Player {
  name: string;
  avatarUrl?: string | null;
  scores?: (number | string)[];
  isWinner?: boolean;
}

interface MatchCardProps {
  player1: Player;
  player2: Player;
  status?: string;
  scheduledAt?: string | null;
  court?: string | null;
}

export const MatchCard = ({ player1, player2, status, scheduledAt, court }: MatchCardProps) => {
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

  const renderAvatar = (name: string, avatarUrl?: string | null) => {
    if (avatarUrl) {
      return <Image source={{ uri: avatarUrl, cache: 'force-cache' }} style={styles.playerAvatar} />;
    }

    return (
      <View style={styles.playerAvatar}>
        <Text style={styles.playerAvatarInitials}>{getInitials(name)}</Text>
      </View>
    );
  };

  const renderScores = (player: Player, otherPlayer: Player) => {
    if (!player.scores || player.scores.length === 0) {
      return (
        <View style={styles.scoreBox}>
          <Text style={styles.scoreText}>-</Text>
        </View>
      );
    }

    return player.scores.map((s, idx) => (
      <View key={idx} style={[styles.scoreBox, player.isWinner && styles.scoreBoxWinner]}>
        <Text style={[styles.scoreText, player.isWinner && styles.scoreTextWinner]}>
          {s ?? '-'}
        </Text>
      </View>
    ));
  };

  return (
    <View style={styles.card}>
      <View style={[styles.playerRow, player1.isWinner && styles.winnerRow]}>
        <View style={styles.playerInfo}>
          {renderAvatar(player1.name, player1.avatarUrl)}
          <Text style={[styles.playerName, !player1.isWinner && player2.isWinner && styles.loserText]} numberOfLines={1}>
            {player1.name}
          </Text>
        </View>
        <View style={styles.scoresRow}>
          {renderScores(player1, player2)}
        </View>
      </View>
      
      <View style={[styles.playerRow, player2.isWinner && styles.winnerRow, styles.bottomRow]}>
        <View style={styles.playerInfo}>
          {renderAvatar(player2.name, player2.avatarUrl)}
          <Text style={[styles.playerName, !player2.isWinner && player1.isWinner && styles.loserText]} numberOfLines={1}>
            {player2.name}
          </Text>
        </View>
        <View style={styles.scoresRow}>
          {renderScores(player2, player1)}
        </View>
      </View>
      
      {status && (
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>{status.toUpperCase()}</Text>
        </View>
      )}

      {(scheduledAt || court) && (
        <View style={styles.schedulingInfo}>
          {scheduledAt && (
             <View style={styles.scheduleRow}>
                <Ionicons name="time-outline" size={12} color={colors.textTertiary} />
                <Text style={styles.scheduleText}>{new Date(scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
             </View>
          )}
          {court && (
             <View style={styles.scheduleRow}>
                <Ionicons name="location-outline" size={12} color={colors.textTertiary} />
                <Text style={styles.scheduleText}>{court}</Text>
             </View>
          )}
        </View>
      )}
    </View>
  );
};

const getStyles = (colors: any) => StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    width: 240,
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
    backgroundColor: colors.primary[500] + '0D', // 0D is ~5% opacity
  },
  bottomRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  playerName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  playerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  playerAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary[500] + '20',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  playerAvatarInitials: {
    color: colors.primary[500],
    fontSize: 9,
    fontWeight: '800',
  },
  loserText: {
    color: colors.textTertiary,
    fontWeight: '400',
  },
  scoresRow: {
    flexDirection: 'row',
    gap: 4,
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
    backgroundColor: colors.primary[500] + '26', // 26 is ~15% opacity
    paddingVertical: 4,
    alignItems: 'center',
  },
  statusText: {
    color: colors.primary[500],
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  schedulingInfo: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: 4,
    backgroundColor: colors.background + '50',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  scheduleText: {
    fontSize: 10,
    color: colors.textTertiary,
    fontWeight: '700',
  }
});
