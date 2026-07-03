import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, borderRadius } from '@/theme';

interface Player {
  name: string;
  avatarUrl?: string | null;
  scores?: (number | string)[];
  isWinner?: boolean;
  id?: string | null;
}

interface MatchCardProps {
  player1: Player;
  player2: Player;
  player1Partner?: Player | null;
  player2Partner?: Player | null;
  status?: string;
  scheduledAt?: string | null;
  court?: string | null;
  onPlayerPress?: (playerId: string) => void;
  canSubmitScore?: boolean;
  onSubmitScore?: () => void;
  width?: number;
  // Admin-specific props
  isAdmin?: boolean;
  onAdminPlayerPress?: (matchId: string, slot: number) => void;
  onAdminPlayerLongPress?: (playerId: string | null) => void;
  onAdminMatchPress?: (match: any) => void;
  onAdminSchedulePress?: (match: any) => void;
  rawMatch?: any;
}

export const MatchCard = ({
  player1,
  player2,
  player1Partner,
  player2Partner,
  status,
  scheduledAt,
  court,
  onPlayerPress,
  canSubmitScore,
  onSubmitScore,
  width,
  isAdmin = false,
  onAdminPlayerPress,
  onAdminPlayerLongPress,
  onAdminMatchPress,
  onAdminSchedulePress,
  rawMatch,
}: MatchCardProps) => {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const isDoubles = !!(player1Partner || player2Partner);

  const getInitials = (name: string) => {
    const chunks = String(name || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (chunks.length === 0) return 'PP';
    if (chunks.length === 1) return chunks[0].slice(0, 2).toUpperCase();
    return `${chunks[0][0] || ''}${chunks[1][0] || ''}`.toUpperCase();
  };

  const renderAvatar = (name: string, avatarUrl?: string | null, size = 20) => {
    if (avatarUrl) {
      return <Image source={{ uri: avatarUrl, cache: 'force-cache' }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
    }

    return (
      <View style={[styles.playerAvatar, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={[styles.playerAvatarInitials, { fontSize: Math.max(7, Math.floor(size * 0.38)) }]}>{getInitials(name)}</Text>
      </View>
    );
  };

  const parseSetScore = (val: string | number | undefined | null): number => {
    if (val === undefined || val === null) return 0;
    const str = String(val).trim();
    const match = str.match(/^(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  };

  const renderScores = (player: Player, otherPlayer: Player) => {
    if (!player.scores || player.scores.length === 0) {
      return (
        <View style={styles.scoreBox}>
          <Text style={styles.scoreText}>-</Text>
        </View>
      );
    }

    return player.scores.map((s, idx) => {
      const currentVal = parseSetScore(s);
      const otherVal = parseSetScore(otherPlayer.scores?.[idx]);

      const isSetWinner = currentVal > otherVal;
      const isSetLoser = currentVal < otherVal;

      let boxStyle: any = styles.scoreBox;
      let textStyle: any = styles.scoreText;

      if (isSetWinner) {
        boxStyle = [styles.scoreBox, styles.scoreBoxWinner];
        textStyle = [styles.scoreText, styles.scoreTextWinner];
      } else if (isSetLoser) {
        boxStyle = [styles.scoreBox, styles.scoreBoxLoser];
        textStyle = [styles.scoreText, styles.scoreTextLoser];
      }

      return (
        <View key={idx} style={boxStyle}>
          <Text style={textStyle}>
            {s ?? '-'}
          </Text>
        </View>
      );
    });
  };

  const isTappable = (player: Player) => 
    isAdmin || (!!onPlayerPress && player.name && player.name !== 'TBD' && player.name !== 'BYE');

  const handlePlayerPress = (player: Player, slot: number) => {
    if (isAdmin) {
      onAdminPlayerPress?.(rawMatch?.id, slot);
    } else if (isTappable(player)) {
      onPlayerPress?.(player.id || 'non_registered');
    }
  };

  const handlePlayerLongPress = (player: Player) => {
    if (isAdmin) {
      onAdminPlayerLongPress?.(player.id || null);
    }
  };

  const renderScoreColumn = (p: Player, op: Player) => {
    const scoreViews = renderScores(p, op);
    if (isAdmin) {
      return (
        <TouchableOpacity 
          style={styles.scoresRow} 
          onPress={() => onAdminMatchPress?.(rawMatch)}
          activeOpacity={0.6}
        >
          {scoreViews}
        </TouchableOpacity>
      );
    }
    return <View style={styles.scoresRow}>{scoreViews}</View>;
  };

  return (
    <View style={[styles.card, width !== undefined && { width }]}>
      {/* Player 1 Row */}
      <View style={[styles.playerRow, player1.isWinner && styles.winnerRow, isDoubles && { height: 'auto', paddingVertical: 4 }]}>
        {isDoubles ? (
          <View style={{ flex: 1, gap: 4 }}>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
              onPress={() => handlePlayerPress(player1, 1)}
              onLongPress={() => handlePlayerLongPress(player1)}
              disabled={!isTappable(player1)}
              activeOpacity={0.6}
              delayLongPress={isAdmin ? 1500 : undefined}
            >
              {renderAvatar(player1.name, player1.avatarUrl, 16)}
              <Text style={[styles.playerName, !player1.isWinner && player2.isWinner && styles.loserText, isTappable(player1) && styles.tappableName, { fontSize: 11 }]} numberOfLines={1}>
                {player1.name}
              </Text>
            </TouchableOpacity>
            {player1Partner && (
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                onPress={() => handlePlayerPress(player1Partner, 2)}
                onLongPress={() => handlePlayerLongPress(player1Partner)}
                disabled={!isTappable(player1Partner)}
                activeOpacity={0.6}
                delayLongPress={isAdmin ? 1500 : undefined}
              >
                {renderAvatar(player1Partner.name, player1Partner.avatarUrl, 16)}
                <Text style={[styles.playerName, { fontSize: 10, fontWeight: '500' }, !player1.isWinner && player2.isWinner && styles.loserText, isTappable(player1Partner) && styles.tappableName]} numberOfLines={1}>
                  {player1Partner.name}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <TouchableOpacity
            style={styles.playerInfo}
            onPress={() => handlePlayerPress(player1, 1)}
            onLongPress={() => handlePlayerLongPress(player1)}
            disabled={!isTappable(player1)}
            activeOpacity={0.6}
            delayLongPress={isAdmin ? 1500 : undefined}
          >
            {renderAvatar(player1.name, player1.avatarUrl)}
            <Text style={[styles.playerName, !player1.isWinner && player2.isWinner && styles.loserText, isTappable(player1) && styles.tappableName]} numberOfLines={1}>
              {player1.name}
            </Text>
          </TouchableOpacity>
        )}
        {renderScoreColumn(player1, player2)}
      </View>
      
      {/* Player 2 Row */}
      <View style={[styles.playerRow, player2.isWinner && styles.winnerRow, styles.bottomRow, isDoubles && { height: 'auto', paddingVertical: 4 }]}>
        {isDoubles ? (
          <View style={{ flex: 1, gap: 4 }}>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
              onPress={() => handlePlayerPress(player2, 3)}
              onLongPress={() => handlePlayerLongPress(player2)}
              disabled={!isTappable(player2)}
              activeOpacity={0.6}
              delayLongPress={isAdmin ? 1500 : undefined}
            >
              {renderAvatar(player2.name, player2.avatarUrl, 16)}
              <Text style={[styles.playerName, !player2.isWinner && player1.isWinner && styles.loserText, isTappable(player2) && styles.tappableName, { fontSize: 11 }]} numberOfLines={1}>
                {player2.name}
              </Text>
            </TouchableOpacity>
            {player2Partner && (
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                onPress={() => handlePlayerPress(player2Partner, 4)}
                onLongPress={() => handlePlayerLongPress(player2Partner)}
                disabled={!isTappable(player2Partner)}
                activeOpacity={0.6}
                delayLongPress={isAdmin ? 1500 : undefined}
              >
                {renderAvatar(player2Partner.name, player2Partner.avatarUrl, 16)}
                <Text style={[styles.playerName, { fontSize: 10, fontWeight: '500' }, !player2.isWinner && player1.isWinner && styles.loserText, isTappable(player2Partner) && styles.tappableName]} numberOfLines={1}>
                  {player2Partner.name}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <TouchableOpacity
            style={styles.playerInfo}
            onPress={() => handlePlayerPress(player2, 3)}
            onLongPress={() => handlePlayerLongPress(player2)}
            disabled={!isTappable(player2)}
            activeOpacity={0.6}
            delayLongPress={isAdmin ? 1500 : undefined}
          >
            {renderAvatar(player2.name, player2.avatarUrl)}
            <Text style={[styles.playerName, !player2.isWinner && player1.isWinner && styles.loserText, isTappable(player2) && styles.tappableName]} numberOfLines={1}>
              {player2.name}
            </Text>
          </TouchableOpacity>
        )}
        {renderScoreColumn(player2, player1)}
      </View>
      
      {status && (
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>{status.toUpperCase()}</Text>
        </View>
      )}

      {(scheduledAt || court) && (
        <View style={styles.schedulingInfo}>
          {scheduledAt && (
             <>
               <View style={styles.scheduleRow}>
                  <Ionicons name="calendar-outline" size={10} color={colors.textTertiary} />
                  <Text style={styles.scheduleText}>{new Date(scheduledAt).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}</Text>
               </View>
               <View style={styles.scheduleRow}>
                  <Ionicons name="time-outline" size={10} color={colors.textTertiary} />
                  <Text style={styles.scheduleText}>{new Date(scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
               </View>
             </>
          )}
          {court && (
             <View style={styles.scheduleRow}>
                <Ionicons name="location-outline" size={10} color={colors.textTertiary} />
                <Text style={styles.scheduleText}>{court}</Text>
             </View>
          )}
        </View>
      )}

      {/* Admin Programar Partido Button */}
      {isAdmin && player1.id && player2.id && !scheduledAt && (!rawMatch?.score) && (
        <TouchableOpacity 
          style={styles.adminScheduleButton} 
          onPress={() => onAdminSchedulePress?.(rawMatch)}
          activeOpacity={0.7}
        >
          <Ionicons name="calendar-outline" size={12} color={colors.textSecondary} />
          <Text style={styles.adminScheduleText}>Programar partido</Text>
        </TouchableOpacity>
      )}

      {canSubmitScore && (
        <TouchableOpacity style={styles.submitScoreButton} onPress={onSubmitScore} activeOpacity={0.82}>
          <Ionicons name="create-outline" size={12} color={colors.primary[500]} />
          <Text style={styles.submitScoreText}>Ingresar resultado</Text>
        </TouchableOpacity>
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
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    height: 36,
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
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  tappableName: {
    textDecorationLine: 'underline',
  },
  playerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  playerAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary[500] + '20',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  playerAvatarInitials: {
    color: colors.primary[500],
    fontSize: 8,
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
    minWidth: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: colors.surfaceSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.sm,
    paddingHorizontal: 4,
  },
  scoreBoxWinner: {
    backgroundColor: colors.primary[500],
  },
  scoreBoxLoser: {
    backgroundColor: colors.surfaceSecondary,
  },
  scoreText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  scoreTextWinner: {
    color: '#fff',
    fontWeight: '800',
  },
  scoreTextLoser: {
    color: colors.textTertiary,
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
  },
  submitScoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.primary[500] + '12',
  },
  submitScoreText: {
    color: colors.primary[500],
    fontSize: 11,
    fontWeight: '800',
  },
  adminScheduleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
  },
  adminScheduleText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
});
