import { supabase } from './supabase';
import { buildRankingRows, RankingRow, getScoreText } from './ranking';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_PUSH_BATCH_SIZE = 100;

type PushTargetRow = {
  user_id: string;
  expo_push_token: string | null;
};

type NotifyUsersInput = {
  tournamentId: string;
  userIds: string[];
  type: string;
  title: string;
  body: string;
  matchId?: string | null;
  data?: Record<string, any>;
};

type NotifyDirectUsersInput = {
  userIds: string[];
  type: string;
  title: string;
  body: string;
  tournamentId?: string | null;
  matchId?: string | null;
  data?: Record<string, any>;
};

const normalizeUuidList = (userIds: string[]) =>
  [...new Set((userIds || []).filter((userId) => UUID_PATTERN.test(String(userId || '').trim())))];

const isExpoPushToken = (value: unknown) => {
  const token = String(value || '').trim();
  return token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[');
};

const chunkArray = <T>(items: T[], size: number) => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const createInAppNotifications = async (input: {
  userIds: string[];
  type: string;
  title: string;
  body: string;
  tournamentId?: string | null;
  matchId?: string | null;
}) => {
  const normalizedUserIds = normalizeUuidList(input.userIds);
  if (normalizedUserIds.length === 0) return;

  await Promise.allSettled(
    normalizedUserIds.map((userId) =>
      supabase.rpc('create_notification', {
        p_user_id: userId,
        p_type: input.type,
        p_title: input.title,
        p_body: input.body,
        p_tournament_id: input.tournamentId || null,
        p_match_id: input.matchId || null,
      })
    )
  );
};

const sendExpoMessages = async (
  messages: Array<{
    to: string;
    title: string;
    body: string;
    sound: 'default';
    channelId: 'default';
    priority: 'high';
    data?: Record<string, any>;
  }>
) => {
  if (!messages.length) return;

  const batches = chunkArray(messages, EXPO_PUSH_BATCH_SIZE);
  await Promise.allSettled(
    batches.map(async (batch) => {
      try {
        const response = await fetch(EXPO_PUSH_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(batch),
        });

        if (!response.ok) {
          const responseText = await response.text().catch(() => '');
          console.warn('[pushNotifications] Expo push failed:', response.status, responseText);
        }
      } catch (error) {
        console.warn('[pushNotifications] Expo push error:', error);
      }
    })
  );
};

const fetchTournamentPlayerPushTargets = async (tournamentId: string, userIds: string[]) => {
  const normalizedUserIds = normalizeUuidList(userIds);
  if (!normalizedUserIds.length) return [] as PushTargetRow[];

  const { data, error } = await supabase.rpc('get_tournament_player_push_targets', {
    p_tournament_id: tournamentId,
    p_player_ids: normalizedUserIds,
  });

  if (error) {
    console.warn('[pushNotifications] get_tournament_player_push_targets error:', error.message);
    return [] as PushTargetRow[];
  }

  return ((data || []) as PushTargetRow[]).filter((row) => UUID_PATTERN.test(String(row?.user_id || '').trim()));
};

const fetchDirectPlayerPushTargets = async (userIds: string[]) => {
  const normalizedUserIds = normalizeUuidList(userIds);
  if (!normalizedUserIds.length) return [] as PushTargetRow[];

  const { data, error } = await supabase
    .from('profiles')
    .select('id, expo_push_token, notifications_enabled')
    .in('id', normalizedUserIds);

  if (error) {
    console.warn('[pushNotifications] direct profile token fetch error:', error.message);
    return [] as PushTargetRow[];
  }

  return ((data || []) as Array<{ id: string; expo_push_token: string | null; notifications_enabled: boolean | null }>)
    .filter((row) => row.notifications_enabled !== false)
    .map((row) => ({
      user_id: row.id,
      expo_push_token: row.expo_push_token,
    }));
};

const groupRowsByTournament = (rows: any[]) =>
  (rows || []).reduce((acc: Record<string, any[]>, row: any) => {
    const tournamentId = String(row?.tournament_id || '').trim();
    if (!tournamentId) return acc;
    acc[tournamentId] = [...(acc[tournamentId] || []), row];
    return acc;
  }, {});

const fetchTournamentAdminPushTargets = async (tournamentId: string) => {
  const { data, error } = await supabase.rpc('get_tournament_admin_push_targets', {
    p_tournament_id: tournamentId,
  });

  if (error) {
    console.warn('[pushNotifications] get_tournament_admin_push_targets error:', error.message);
    return [] as PushTargetRow[];
  }

  return ((data || []) as PushTargetRow[]).filter((row) => UUID_PATTERN.test(String(row?.user_id || '').trim()));
};

export const notifyTournamentUsers = async (input: NotifyUsersInput) => {
  const normalizedUserIds = normalizeUuidList(input.userIds);
  if (!normalizedUserIds.length || !UUID_PATTERN.test(String(input.tournamentId || '').trim())) return;

  await createInAppNotifications({
    userIds: normalizedUserIds,
    type: input.type,
    title: input.title,
    body: input.body,
    tournamentId: input.tournamentId,
    matchId: input.matchId || null,
  });

  const rpcTargets = await fetchTournamentPlayerPushTargets(input.tournamentId, normalizedUserIds);
  const targets = rpcTargets.length ? rpcTargets : await fetchDirectPlayerPushTargets(normalizedUserIds);
  const tokens = [...new Set(targets.map((target) => String(target?.expo_push_token || '').trim()).filter(isExpoPushToken))];
  if (!tokens.length) return;

  await sendExpoMessages(
    tokens.map((token) => ({
      to: token,
      title: input.title,
      body: input.body,
      sound: 'default' as const,
      channelId: 'default' as const,
      priority: 'high' as const,
      data: input.data,
    }))
  );
};

export const notifyDirectUsers = async (input: NotifyDirectUsersInput) => {
  const normalizedUserIds = normalizeUuidList(input.userIds);
  if (!normalizedUserIds.length) return;

  await createInAppNotifications({
    userIds: normalizedUserIds,
    type: input.type,
    title: input.title,
    body: input.body,
    tournamentId: input.tournamentId || null,
    matchId: input.matchId || null,
  });

  const targets = await fetchDirectPlayerPushTargets(normalizedUserIds);
  const tokens = [...new Set(targets.map((target) => String(target?.expo_push_token || '').trim()).filter(isExpoPushToken))];
  if (!tokens.length) return;

  await sendExpoMessages(
    tokens.map((token) => ({
      to: token,
      title: input.title,
      body: input.body,
      sound: 'default' as const,
      channelId: 'default' as const,
      priority: 'high' as const,
      data: input.data,
    }))
  );
};

export const notifyRankingChangesOnTournamentFinished = async (input: {
  tournamentId: string;
}) => {
  const tournamentId = String(input.tournamentId || '').trim();
  if (!UUID_PATTERN.test(tournamentId)) return;

  const { data: tournament, error: tournamentError } = await supabase
    .from('tournaments')
    .select('id, name, organization_id, level, modality, status')
    .eq('id', tournamentId)
    .maybeSingle();

  if (tournamentError || !tournament?.organization_id || !tournament?.level) {
    if (tournamentError) console.warn('[pushNotifications] tournament ranking fetch error:', tournamentError.message);
    return;
  }

  const { data: contextTournamentsRows, error: contextTournamentsError } = await supabase
    .from('tournaments')
    .select('id, name, organization_id, level, modality, status, format, description, start_date, end_date, created_at')
    .eq('organization_id', tournament.organization_id)
    .eq('level', tournament.level)
    .in('status', ['completed', 'finalized', 'finished']);

  if (contextTournamentsError) {
    console.warn('[pushNotifications] ranking tournaments fetch error:', contextTournamentsError.message);
    return;
  }

  const modality = tournament.modality === 'dobles' ? 'dobles' : 'singles';
  const contextTournaments = (contextTournamentsRows || []).filter((row: any) =>
    modality === 'dobles' ? row.modality === 'dobles' : (!row.modality || row.modality === 'singles')
  );
  const currentTournaments = contextTournaments.some((row: any) => row.id === tournamentId)
    ? contextTournaments
    : [...contextTournaments, tournament];
  const previousTournaments = currentTournaments.filter((row: any) => row.id !== tournamentId);
  const tournamentIds = currentTournaments.map((row: any) => row.id).filter(Boolean);

  if (!tournamentIds.length) return;

  const { data: matchesRows, error: matchesError } = await supabase
    .from('matches')
    .select('id, tournament_id, player_a_id, player_a2_id, player_b_id, player_b2_id, winner_id, winner_2_id, round, round_number, match_order, score, status')
    .in('tournament_id', tournamentIds);

  if (matchesError) {
    console.warn('[pushNotifications] ranking matches fetch error:', matchesError.message);
    return;
  }

  const { data: registrationsRows, error: registrationsError } = await supabase
    .from('registrations')
    .select('tournament_id, player_id, status')
    .in('tournament_id', tournamentIds);

  if (registrationsError) {
    console.warn('[pushNotifications] ranking registrations fetch error:', registrationsError.message);
    return;
  }

  const matchesByTournament = groupRowsByTournament(matchesRows || []);
  const registrationsByTournament = groupRowsByTournament(registrationsRows || []);
  const playerIds = [...new Set([
    ...(matchesRows || []).flatMap((match: any) => [match.player_a_id, match.player_a2_id, match.player_b_id, match.player_b2_id]),
    ...(registrationsRows || []).map((registration: any) => registration.player_id),
  ].map((id) => String(id || '').trim()).filter((id) => UUID_PATTERN.test(id)))];

  if (!playerIds.length) return;

  const { data: profilesRows } = await supabase
    .from('public_profiles')
    .select('id, name')
    .in('id', playerIds);

  const profileNameById = (profilesRows || []).reduce((acc: Record<string, string>, profile: any) => {
    acc[profile.id] = profile.name || 'Jugador';
    return acc;
  }, {});

  const currentRows = buildRankingRows(currentTournaments, matchesByTournament, registrationsByTournament, profileNameById);
  const previousRows = buildRankingRows(previousTournaments, matchesByTournament, registrationsByTournament, profileNameById);
  const currentRankByPlayer = new Map(currentRows.map((row) => [row.playerId, row.rank]));
  const previousRankByPlayer = new Map(previousRows.map((row) => [row.playerId, row.rank]));

  const currentTournamentMatches = matchesByTournament[tournamentId] || [];
  const currentTournamentRegistrations = registrationsByTournament[tournamentId] || [];
  const participantIds = new Set([
    ...currentTournamentMatches.flatMap((match: any) => [match.player_a_id, match.player_a2_id, match.player_b_id, match.player_b2_id]),
    ...currentTournamentRegistrations.map((registration: any) => registration.player_id),
  ].map((id) => String(id || '').trim()).filter((id) => UUID_PATTERN.test(id)));

  await Promise.allSettled(
    Array.from(participantIds).map((playerId) => {
      const currentRank = currentRankByPlayer.get(playerId);
      if (!currentRank) return Promise.resolve();
      const previousRank = previousRankByPlayer.get(playerId);
      const body = previousRank === currentRank
        ? '¡Has mantenido tu posición actual en el ranking!'
        : `Tu nueva posición en el ranking de ${tournament.level} es #${currentRank}.`;

      return notifyTournamentUsers({
        tournamentId,
        userIds: [playerId],
        type: 'ranking_position_updated',
        title: 'Ranking actualizado',
        body,
        data: {
          type: 'ranking_position_updated',
          tournamentId,
          organizationId: tournament.organization_id,
          level: tournament.level,
          modality,
          rank: currentRank,
          previousRank: previousRank || null,
        },
      });
    })
  );

  const nonParticipantRankingPlayerIds = currentRows
    .map((row) => row.playerId)
    .filter((playerId) => !participantIds.has(playerId));
  if (nonParticipantRankingPlayerIds.length > 0) {
    await notifyTournamentUsers({
      tournamentId,
      userIds: nonParticipantRankingPlayerIds,
      type: 'ranking_category_updated',
      title: 'Ranking actualizado',
      body: '¡Hubo cambios en el ranking de tu categoría! ¡Entra a revisarlos! 😱',
      data: {
        type: 'ranking_category_updated',
        tournamentId,
        organizationId: tournament.organization_id,
        level: tournament.level,
        modality,
      },
    });
  }

  const previousLeader = previousRows.find((row) => row.rank === 1);
  const currentLeader = currentRows.find((row) => row.rank === 1);
  if (currentLeader && (!previousLeader || previousLeader.playerId !== currentLeader.playerId)) {
    await notifyTournamentUsers({
      tournamentId,
      userIds: currentRows.map((row) => row.playerId),
      type: 'ranking_new_number_one',
      title: 'Nuevo #1',
      body: `¡Tenemos nuevo líder! ¡Felicidades a ${currentLeader.name} por su #1 en el ranking!`,
      data: {
        type: 'ranking_new_number_one',
        tournamentId,
        organizationId: tournament.organization_id,
        level: tournament.level,
        modality,
        playerId: currentLeader.playerId,
      },
    });
  }
};

export const notifyTournamentAdminsOnRegistrationRequest = async (input: {
  tournamentId: string;
  tournamentName: string;
  playerName: string;
}) => {
  if (!UUID_PATTERN.test(String(input.tournamentId || '').trim())) return;

  const targets = await fetchTournamentAdminPushTargets(input.tournamentId);
  const adminUserIds = [...new Set(targets.map((target) => String(target.user_id || '').trim()).filter((userId) => UUID_PATTERN.test(userId)))];
  if (!adminUserIds.length) return;

  const title = 'Nueva solicitud de inscripción';
  const body = `${input.playerName || 'Un jugador'} envió un comprobante para ${input.tournamentName || 'un torneo'}.`;

  await createInAppNotifications({
    userIds: adminUserIds,
    type: 'registration_request',
    title,
    body,
    tournamentId: input.tournamentId,
    matchId: null,
  });

  const tokens = [...new Set(targets.map((target) => String(target?.expo_push_token || '').trim()).filter(isExpoPushToken))];
  if (!tokens.length) return;

  await sendExpoMessages(
    tokens.map((token) => ({
      to: token,
      title,
      body,
      sound: 'default' as const,
      channelId: 'default' as const,
      priority: 'high' as const,
      data: {
        type: 'registration_request',
        tournamentId: input.tournamentId,
        target: 'admin_finance',
      },
    }))
  );
};

export const notifyRankingChangesForManualAdjustment = async (input: {
  organizationId: string;
  level: string;
  modality: 'singles' | 'dobles';
  previousRows: RankingRow[];
  currentRows: RankingRow[];
  affectedPlayerId: string;
}) => {
  const organizationId = String(input.organizationId || '').trim();
  const level = String(input.level || '').trim();
  const affectedPlayerId = String(input.affectedPlayerId || '').trim();
  if (!UUID_PATTERN.test(organizationId) || !level) return;

  const previousRankByPlayer = new Map(input.previousRows.map((row) => [row.playerId, row.rank]));
  const currentRankByPlayer = new Map(input.currentRows.map((row) => [row.playerId, row.rank]));
  const changedPlayers = input.currentRows
    .filter((row) => previousRankByPlayer.get(row.playerId) !== row.rank)
    .map((row) => row.playerId);

  const playersToNotify = [...new Set([affectedPlayerId, ...changedPlayers].filter((playerId) => UUID_PATTERN.test(playerId)))];

  await Promise.allSettled(
    playersToNotify.map((playerId) => {
      const currentRank = currentRankByPlayer.get(playerId);
      if (!currentRank) return Promise.resolve();
      const previousRank = previousRankByPlayer.get(playerId);
      const body = previousRank === currentRank
        ? 'Tu posición en el ranking se mantuvo sin cambios.'
        : `Tu nueva posición en el ranking de ${level} es #${currentRank}.`;

      return notifyDirectUsers({
        userIds: [playerId],
        type: 'ranking_position_updated',
        title: 'Ranking actualizado',
        body,
        data: {
          type: 'ranking_position_updated',
          organizationId,
          level,
          modality: input.modality,
          rank: currentRank,
          previousRank: previousRank || null,
        },
      });
    })
  );

  const otherPlayerIds = input.currentRows
    .map((row) => row.playerId)
    .filter((playerId) => !playersToNotify.includes(playerId));

  if (otherPlayerIds.length > 0 && changedPlayers.length > 0) {
    await notifyDirectUsers({
      userIds: otherPlayerIds,
      type: 'ranking_category_updated',
      title: 'Ranking actualizado',
      body: '¡Hubo cambios en el ranking de tu categoría! ¡Entra a revisarlos!',
      data: {
        type: 'ranking_category_updated',
        organizationId,
        level,
        modality: input.modality,
      },
    });
  }

  const previousLeader = input.previousRows.find((row) => row.rank === 1);
  const currentLeader = input.currentRows.find((row) => row.rank === 1);
  if (currentLeader && (!previousLeader || previousLeader.playerId !== currentLeader.playerId)) {
    await notifyDirectUsers({
      userIds: input.currentRows.map((row) => row.playerId),
      type: 'ranking_new_number_one',
      title: 'Nuevo #1',
      body: `¡Tenemos nuevo líder! ¡Felicidades a ${currentLeader.name} por su #1 en el ranking!`,
      data: {
        type: 'ranking_new_number_one',
        organizationId,
        level,
        modality: input.modality,
        playerId: currentLeader.playerId,
      },
    });
  }
};

const fetchOrganizationFollowerPushTargets = async (organizationId: string) => {
  const { data, error } = await supabase.rpc('get_organization_follower_push_targets', {
    p_organization_id: organizationId,
  });

  if (error) {
    console.warn('[pushNotifications] get_organization_follower_push_targets error:', error.message);
    return [] as PushTargetRow[];
  }

  return ((data || []) as PushTargetRow[]).filter((row) => UUID_PATTERN.test(String(row?.user_id || '').trim()));
};

export const notifyOrganizationFollowersOnNewTournament = async (input: {
  organizationId: string;
  organizationName: string;
  tournamentId: string;
  tournamentName: string;
}) => {
  if (!UUID_PATTERN.test(String(input.organizationId || '').trim())) return;

  const targets = await fetchOrganizationFollowerPushTargets(input.organizationId);
  const followerUserIds = [...new Set(targets.map((target) => String(target.user_id || '').trim()).filter((userId) => UUID_PATTERN.test(userId)))];
  if (!followerUserIds.length) return;

  const title = '¡Nuevo torneo publicado!';
  const body = `${input.organizationName || 'La organización'} ha publicado el torneo ${input.tournamentName || 'nuevo'}. ¡Inscríbete ahora!`;

  await createInAppNotifications({
    userIds: followerUserIds,
    type: 'new_tournament_published',
    title,
    body,
    tournamentId: input.tournamentId,
    matchId: null,
  });

  const tokens = [...new Set(targets.map((target) => String(target?.expo_push_token || '').trim()).filter(isExpoPushToken))];
  if (!tokens.length) return;

  await sendExpoMessages(
    tokens.map((token) => ({
      to: token,
      title,
      body,
      sound: 'default' as const,
      channelId: 'default' as const,
      priority: 'high' as const,
      data: {
        type: 'new_tournament_published',
        tournamentId: input.tournamentId,
        organizationId: input.organizationId,
      },
    }))
  );
};
