const normalizeText = (value?: string | null) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

export const normalizeTournamentStatus = (status?: string | null) => {
  const normalized = normalizeText(status);

  if (!normalized) return '';

  if (
    normalized === 'open' ||
    normalized === 'published' ||
    normalized === 'publicado' ||
    normalized.includes('inscripcion abierta')
  ) {
    return 'open';
  }

  if (
    normalized === 'ongoing' ||
    normalized === 'in_progress' ||
    normalized === 'in progress' ||
    normalized === 'en progreso' ||
    normalized === 'en curso'
  ) {
    return 'in_progress';
  }

  if (
    normalized === 'finished' ||
    normalized === 'completed' ||
    normalized === 'finalized' ||
    normalized === 'finalizado'
  ) {
    return 'finished';
  }

  if (
    normalized === 'draft' ||
    normalized === 'borrador' ||
    normalized === 'no publicado'
  ) {
    return 'draft';
  }

  if (normalized === 'pending' || normalized === 'pendiente') {
    return 'pending';
  }

  if (normalized === 'cancelled' || normalized === 'cancelado') {
    return 'cancelled';
  }

  return normalized;
};

const parseDateOnly = (value?: string | null) => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const parsed = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

export const getEffectiveTournamentStatus = (params: {
  status?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  now?: Date;
}) => {
  const normalizedStatus = normalizeTournamentStatus(params.status);

  if (normalizedStatus === 'finished' || normalizedStatus === 'cancelled') {
    return normalizedStatus;
  }

  if (normalizedStatus === 'draft' || normalizedStatus === 'pending') {
    return normalizedStatus;
  }

  const now = params.now || new Date();
  const startDate = parseDateOnly(params.startDate);
  const endDate = parseDateOnly(params.endDate || params.startDate);

  if (endDate) {
    const endOfDay = new Date(endDate);
    endOfDay.setHours(23, 59, 59, 999);
    if (now >= endOfDay) {
      return 'finished';
    }
  }

  if (startDate && now >= startDate) {
    return 'in_progress';
  }

  return normalizedStatus || 'open';
};
