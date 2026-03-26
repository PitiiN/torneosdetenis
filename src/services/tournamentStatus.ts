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
