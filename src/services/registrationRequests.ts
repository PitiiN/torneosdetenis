import { supabase } from './supabase';
import { notifyTournamentAdminsOnRegistrationRequest } from './pushNotifications';
import { normalizeTournamentStatus } from './tournamentStatus';

const STORAGE_BUCKET = 'organizations';
const ALLOWED_IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OPEN_TOURNAMENT_STATUSES = new Set(['open', 'ongoing', 'in_progress']);

export type TournamentRegistrationRequestStatus = 'pending' | 'approved' | 'rejected';

export type TournamentRegistrationRequest = {
  id: string;
  tournament_id: string;
  player_id: string;
  status: TournamentRegistrationRequestStatus;
  rejection_reason: string | null;
  proof_path: string;
  created_at: string;
  updated_at: string;
};

const normalizeText = (value?: string | null) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const getExtensionFromUri = (uri: string) => {
  const cleanUri = uri.split('?')[0].split('#')[0];
  const lastDotIndex = cleanUri.lastIndexOf('.');
  if (lastDotIndex < 0 || lastDotIndex === cleanUri.length - 1) return null;
  return cleanUri.slice(lastDotIndex + 1).toLowerCase();
};

const toImageContentType = (extension: string) => {
  if (extension === 'jpg') return 'image/jpeg';
  if (extension === 'heic') return 'image/heic';
  if (extension === 'heif') return 'image/heif';
  return `image/${extension}`;
};

const resolveImageExtension = (uri: string, mimeType?: string | null) => {
  const fromUri = getExtensionFromUri(uri);
  if (fromUri && ALLOWED_IMAGE_EXTENSIONS.has(fromUri)) return fromUri;

  const normalizedMime = normalizeText(mimeType);
  if (normalizedMime.startsWith('image/')) {
    const fromMime = normalizedMime.replace('image/', '');
    if (ALLOWED_IMAGE_EXTENSIONS.has(fromMime)) return fromMime;
    if (fromMime === 'jpeg') return 'jpg';
  }

  return null;
};

const buildProofPath = (
  organizationId: string,
  tournamentId: string,
  playerId: string,
  extension: string
) => {
  const safeRandom = Math.random().toString(36).slice(2, 8);
  return `payment-proofs/${organizationId}/${tournamentId}/${playerId}/${Date.now()}-${safeRandom}.${extension}`;
};

const ensureUuid = (value: string, fieldName: string) => {
  if (!UUID_PATTERN.test(value)) {
    throw new Error(`${fieldName} invalido`);
  }
};

const normalizeTimeFragment = (value?: string | null) => {
  const raw = String(value || '').trim();
  if (!raw) return '23:59:59';
  if (/^\d{2}:\d{2}$/.test(raw)) return `${raw}:00`;
  if (/^\d{2}:\d{2}:\d{2}$/.test(raw)) return raw;
  return '23:59:59';
};

export const isRegistrationWindowClosed = (
  registrationCloseAt?: string | null,
  registrationCloseTime?: string | null
) => {
  if (!registrationCloseAt) return false;

  const closeDate = new Date(`${registrationCloseAt}T${normalizeTimeFragment(registrationCloseTime)}`);
  if (Number.isNaN(closeDate.getTime())) return false;
  return closeDate.getTime() < Date.now();
};

export const getRequestStatusLabel = (status?: string | null) => {
  if (status === 'approved') return 'Aprobada';
  if (status === 'rejected') return 'Rechazada';
  return 'Pendiente';
};

export async function submitTournamentRegistrationRequest(options: {
  tournamentId: string;
  organizationId: string;
  playerId: string;
  assetUri: string;
  mimeType?: string | null;
  tournamentName?: string | null;
  playerName?: string | null;
}) {
  const { tournamentId, organizationId, playerId, assetUri, mimeType } = options;

  ensureUuid(tournamentId, 'tournamentId');
  ensureUuid(organizationId, 'organizationId');
  ensureUuid(playerId, 'playerId');

  const { data: tournamentRow, error: tournamentError } = await supabase
    .from('tournaments')
    .select('id, status')
    .eq('id', tournamentId)
    .maybeSingle();

  if (tournamentError || !tournamentRow) {
    throw new Error('registration request window is closed');
  }

  const tournamentStatus = normalizeTournamentStatus(tournamentRow.status);
  if (!OPEN_TOURNAMENT_STATUSES.has(tournamentStatus)) {
    throw new Error('registration request window is closed');
  }

  const extension = resolveImageExtension(assetUri, mimeType);
  if (!extension) {
    throw new Error('Solo se permiten imagenes JPG, PNG o WEBP');
  }

  const contentType = toImageContentType(extension);
  const proofPath = buildProofPath(organizationId, tournamentId, playerId, extension);

  const uploadResponse = await fetch(assetUri);
  const fileBytes = typeof uploadResponse.arrayBuffer === 'function'
    ? await uploadResponse.arrayBuffer()
    : await (await uploadResponse.blob()).arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(proofPath, fileBytes, {
      contentType,
      upsert: false,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data, error } = await supabase
    .from('tournament_registration_requests')
    .insert({
      tournament_id: tournamentId,
      organization_id: organizationId,
      player_id: playerId,
      proof_path: proofPath,
    })
    .select('id, tournament_id, player_id, status, rejection_reason, proof_path, created_at, updated_at')
    .single();

  if (error) {
    await supabase.storage.from(STORAGE_BUCKET).remove([proofPath]);
    throw error;
  }

  const [tournamentNameResult, playerNameResult] = await Promise.allSettled([
    options.tournamentName
      ? Promise.resolve(String(options.tournamentName))
      : supabase
          .from('tournaments')
          .select('name')
          .eq('id', tournamentId)
          .maybeSingle()
          .then((response) => String(response.data?.name || 'Torneo')),
    options.playerName
      ? Promise.resolve(String(options.playerName))
      : supabase
          .from('public_profiles')
          .select('name')
          .eq('id', playerId)
          .maybeSingle()
          .then((response) => String(response.data?.name || 'Jugador')),
  ]);

  const resolvedTournamentName =
    tournamentNameResult.status === 'fulfilled' ? tournamentNameResult.value : 'Torneo';
  const resolvedPlayerName =
    playerNameResult.status === 'fulfilled' ? playerNameResult.value : 'Jugador';

  notifyTournamentAdminsOnRegistrationRequest({
    tournamentId,
    tournamentName: resolvedTournamentName,
    playerName: resolvedPlayerName,
  }).catch((notificationError) => {
    console.warn('[registrationRequests] admin notification failed:', notificationError);
  });

  return data as TournamentRegistrationRequest;
}
