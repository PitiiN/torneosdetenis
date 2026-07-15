import React, { useCallback, useMemo, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { borderRadius, spacing, useTheme } from '@/theme';
import { supabase } from '@/services/supabase';
import { TennisSpinner } from '@/components/TennisSpinner';
import { notificationService } from '@/services/notificationService';

type CalendarMatch = {
  id: string;
  tournament_id: string;
  player_a_id: string | null;
  player_a2_id: string | null;
  player_b_id: string | null;
  player_b2_id: string | null;
  round: string | null;
  round_number: number | null;
  match_order: number | null;
  scheduled_at: string;
  court: string | null;
  tournamentName: string;
  tournamentLevel: string | null;
  tournamentModality: string | null;
  opponentLabel: string;
};

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { dateLabel: 'Fecha por confirmar', timeLabel: '' };

  return {
    dateLabel: date.toLocaleDateString('es-CL', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
    }),
    timeLabel: date.toLocaleTimeString('es-CL', {
      hour: '2-digit',
      minute: '2-digit',
    }),
  };
};

const formatRound = (match: CalendarMatch) => {
  const round = String(match.round || '').trim();
  if (round) return round.replace(/^Consolaci[o\u00F3]n/i, 'Repechaje');
  return match.round_number ? `Ronda ${match.round_number}` : 'Cuadro';
};

export default function PlayerCalendarScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [matches, setMatches] = useState<CalendarMatch[]>([]);
  const [registeredTournaments, setRegisteredTournaments] = useState<any[]>([]);

  const nextMatch = matches[0] || null;
  const upcomingMatches = useMemo(() => matches.slice(1), [matches]);

  const loadCalendar = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const playerId = session?.user?.id;
      if (!playerId) {
        setMatches([]);
        setRegisteredTournaments([]);
        return;
      }

      const now = new Date().toISOString();
      const { data: matchRows, error: matchError } = await supabase
        .from('matches')
        .select('id, tournament_id, player_a_id, player_a2_id, player_b_id, player_b2_id, round, round_number, match_order, scheduled_at, court, status')
        .or(`player_a_id.eq.${playerId},player_a2_id.eq.${playerId},player_b_id.eq.${playerId},player_b2_id.eq.${playerId}`)
        .not('scheduled_at', 'is', null)
        .gte('scheduled_at', now)
        .neq('status', 'finished')
        .order('scheduled_at', { ascending: true });

      if (matchError) throw matchError;

      const rawMatches = (matchRows || []) as any[];
      const tournamentIds = [...new Set(rawMatches.map((match) => match.tournament_id).filter(Boolean))] as string[];
      const playerIds = [...new Set(
        rawMatches
          .flatMap((match) => [match.player_a_id, match.player_a2_id, match.player_b_id, match.player_b2_id])
          .filter(Boolean)
      )] as string[];

      const tournamentById: Record<string, any> = {};
      if (tournamentIds.length > 0) {
        const { data: tournamentRows, error: tournamentError } = await supabase
          .from('tournaments')
          .select('id, name, level, modality')
          .in('id', tournamentIds);
        if (tournamentError) throw tournamentError;
        (tournamentRows || []).forEach((tournament: any) => {
          tournamentById[tournament.id] = tournament;
        });
      }

      const profileNameById: Record<string, string> = {};
      if (playerIds.length > 0) {
        const { data: profileRows, error: profileError } = await supabase
          .from('public_profiles')
          .select('id, name')
          .in('id', playerIds);
        if (profileError) throw profileError;
        (profileRows || []).forEach((profile: any) => {
          profileNameById[profile.id] = profile.name || 'Jugador';
        });
      }

      const hydrated = rawMatches.map((match: any) => {
        const isSideA = match.player_a_id === playerId || match.player_a2_id === playerId;
        const opponentIds = (isSideA
          ? [match.player_b_id, match.player_b2_id]
          : [match.player_a_id, match.player_a2_id]
        ).filter(Boolean);
        const tournament = tournamentById[match.tournament_id] || {};

        return {
          ...match,
          tournamentName: tournament.name || 'Torneo',
          tournamentLevel: tournament.level || null,
          tournamentModality: tournament.modality || null,
          opponentLabel: opponentIds.length > 0
            ? opponentIds.map((id: string) => profileNameById[id] || 'Jugador').join(' / ')
            : 'Rival por definir',
        };
      });

      setMatches(hydrated);
      await notificationService.scheduleMatchReminders(hydrated);

      // Fetch active registered tournaments in two steps
      const { data: regRows, error: regError } = await supabase
        .from('registrations')
        .select('tournament_id')
        .eq('player_id', playerId)
        .eq('status', 'confirmed');

      let activeTournaments: any[] = [];
      if (!regError && regRows && regRows.length > 0) {
        const tournamentIds = [...new Set(regRows.map((r: any) => r.tournament_id).filter(Boolean))];
        if (tournamentIds.length > 0) {
          const { data: tournamentsRows, error: tournamentsError } = await supabase
            .from('tournaments')
            .select('id, name, level, modality, status, start_date, end_date')
            .in('id', tournamentIds);

          if (!tournamentsError && tournamentsRows) {
            const currentDateObj = new Date();
            activeTournaments = tournamentsRows.filter((tour: any) => {
              if (!tour) return false;
              const statusLower = String(tour.status || '').toLowerCase();
              if (
                statusLower === 'finished' ||
                statusLower === 'completed' ||
                statusLower === 'finalized' ||
                statusLower === 'cancelled' ||
                statusLower === 'draft' ||
                statusLower === 'pending'
              ) {
                return false;
              }

              if (tour.end_date) {
                const endDateObj = new Date(`${tour.end_date}T23:59:59`);
                if (currentDateObj >= endDateObj) return false;
              }
              return true;
            });
          }
        }
      }
      setRegisteredTournaments(activeTournaments);
    } catch (error) {
      console.error('Error loading player calendar:', error);
      Alert.alert('Error', 'No se pudo cargar tu calendario.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadCalendar();
    }, [loadCalendar])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadCalendar();
  }, [loadCalendar]);

  const openTournament = (tournamentId: string) => {
    router.push(`/(tabs)/tournaments/${tournamentId}` as any);
  };

  const renderMatchCard = (match: CalendarMatch, featured = false) => {
    const { dateLabel, timeLabel } = formatDateTime(match.scheduled_at);

    return (
      <TouchableOpacity
        key={match.id}
        style={[styles.matchCard, featured && styles.featuredCard]}
        activeOpacity={0.78}
        onPress={() => openTournament(match.tournament_id)}
      >
        <View style={styles.matchCardTop}>
          <View style={styles.dateBadge}>
            <Ionicons name="calendar" size={featured ? 24 : 18} color={colors.primary[500]} />
          </View>
          <View style={styles.matchMain}>
            <Text style={featured ? styles.featuredTitle : styles.matchTitle} numberOfLines={2}>
              {featured ? 'Siguiente partido' : match.tournamentName}
            </Text>
            {featured ? (
              <Text style={styles.featuredTournament} numberOfLines={1}>{match.tournamentName}</Text>
            ) : null}
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
        </View>

        <View style={styles.matchDetails}>
          <View style={styles.detailRow}>
            <Ionicons name="person-outline" size={15} color={colors.textSecondary} />
            <Text style={styles.detailText} numberOfLines={1}>{match.opponentLabel}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="time-outline" size={15} color={colors.textSecondary} />
            <Text style={styles.detailText}>{dateLabel}{timeLabel ? `, ${timeLabel}` : ''}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="git-branch-outline" size={15} color={colors.textSecondary} />
            <Text style={styles.detailText} numberOfLines={1}>
              {formatRound(match)}{match.court ? ` · ${match.court}` : ''}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, spacing.md) }]}>
        <View style={styles.headerContent}>
          <Ionicons name="calendar" size={24} color={colors.primary[500]} />
          <Text style={styles.headerTitle}>Mi Calendario</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <TennisSpinner size={42} />
          <Text style={styles.loadingText}>Cargando partidos...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary[500]} />}
        >
          {nextMatch ? (
            <>
              {renderMatchCard(nextMatch, true)}
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Próximos partidos</Text>
              </View>
              {upcomingMatches.length > 0 ? (
                <View style={styles.list}>{upcomingMatches.map((match) => renderMatchCard(match))}</View>
              ) : (
                <View style={styles.emptyCard}>
                  <Ionicons name="checkmark-circle-outline" size={28} color={colors.primary[500]} />
                  <Text style={styles.emptyText}>No tienes otros partidos futuros programados.</Text>
                </View>
              )}
            </>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={48} color={colors.textTertiary} />
              <Text style={styles.emptyTitle}>Sin partidos programados</Text>
              <Text style={styles.emptyText}>Cuando tengas partidos con horario definido aparecerán aquí.</Text>
            </View>
          )}

          {registeredTournaments.length > 0 && (
            <View style={styles.tournamentsSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Mis Torneos Activos</Text>
              </View>
              <View style={styles.tournamentsList}>
                {registeredTournaments.map((tournament) => (
                  <TouchableOpacity
                    key={tournament.id}
                    style={styles.tournamentCard}
                    activeOpacity={0.78}
                    onPress={() => openTournament(tournament.id)}
                  >
                    <View style={styles.tournamentCardTop}>
                      <View style={styles.trophyBadge}>
                        <Ionicons name="trophy" size={20} color={colors.primary[500]} />
                      </View>
                      <View style={styles.tournamentMain}>
                        <Text style={styles.tournamentName} numberOfLines={1}>{tournament.name}</Text>
                        <Text style={styles.tournamentDetail} numberOfLines={1}>
                          {tournament.level || 'Categoría'} · {String(tournament.modality || '').toLowerCase() === 'dobles' ? 'Dobles' : 'Singles'}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 44,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  scrollContent: {
    padding: spacing.xl,
    paddingBottom: 120,
    gap: spacing.lg,
  },
  matchCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  featuredCard: {
    borderColor: colors.primary[500] + '55',
    padding: spacing.lg,
  },
  matchCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  dateBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[500] + '18',
  },
  matchMain: {
    flex: 1,
  },
  featuredTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
  },
  featuredTournament: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  matchTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  matchDetails: {
    gap: spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  detailText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  sectionHeader: {
    marginTop: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  list: {
    gap: spacing.md,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyState: {
    minHeight: 420,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  tournamentsSection: {
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  tournamentsList: {
    gap: spacing.sm,
  },
  tournamentCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  tournamentCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  trophyBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[500] + '18',
  },
  tournamentMain: {
    flex: 1,
  },
  tournamentName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  tournamentDetail: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
});
