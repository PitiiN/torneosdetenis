import { supabase } from './supabase';

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

export const notifyTournamentAdminsOnRegistrationRequest = async (input: {
  tournamentId: string;
  tournamentName: string;
  playerName: string;
}) => {
  if (!UUID_PATTERN.test(String(input.tournamentId || '').trim())) return;

  const targets = await fetchTournamentAdminPushTargets(input.tournamentId);
  const adminUserIds = [...new Set(targets.map((target) => String(target.user_id || '').trim()).filter((userId) => UUID_PATTERN.test(userId)))];
  if (!adminUserIds.length) return;

  const title = 'Nueva solicitud de inscripcion';
  const body = `${input.playerName || 'Un jugador'} envio un comprobante para ${input.tournamentName || 'un torneo'}.`;

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
      },
    }))
  );
};
