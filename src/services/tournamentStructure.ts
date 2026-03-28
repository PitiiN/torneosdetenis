const normalizeText = (value?: string | null) =>
  (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const nextPowerOfTwo = (value: number) => {
  let size = 2;
  while (size < value) size *= 2;
  return size;
};

const getEliminationRoundName = (roundIndex: number, roundsCount: number) => {
  if (roundsCount === 1) return 'Gran Final';
  if (roundIndex === roundsCount) return 'Gran Final';
  if (roundIndex === roundsCount - 1) return 'Semifinales';
  if (roundIndex === roundsCount - 2) return 'Cuartos de Final';
  if (roundIndex === roundsCount - 3) return 'Octavos de Final';
  return `Ronda ${roundIndex}`;
};

export const normalizeTournamentFormat = (format?: string | null) => {
  const normalized = normalizeText(format);
  if (normalized.includes('round robin')) return 'round_robin';
  if (normalized.includes('repechaje')) return 'single_elimination_repechage';
  if (normalized.includes('eliminacion directa')) return 'single_elimination';
  return normalized;
};

export const isRoundRobinFormat = (format?: string | null) =>
  normalizeTournamentFormat(format) === 'round_robin';

export const hasConsolationBracket = (format?: string | null) =>
  normalizeTournamentFormat(format) === 'single_elimination_repechage';

export const getRoundRobinGroupCount = (format?: string | null, description?: string | null) => {
  const metadataMatch = (description || '').match(/\[RR_GROUPS:(\d+)\]/i);
  if (metadataMatch) return Math.max(2, Math.min(Number(metadataMatch[1]), 8));
  const normalized = normalizeText(format);
  const match = normalized.match(/(\d+)\s+grupos?/);
  const parsed = match ? Number(match[1]) : 2;
  return Math.max(2, Math.min(parsed, 8));
};

export const buildTournamentFormatLabel = (
  baseFormat: string,
  options?: { groupCount?: number }
) => {
  return normalizeTournamentFormat(baseFormat) === 'round_robin' ? 'Round Robin' : baseFormat;
};

export const buildTournamentDescription = (groupCount?: number, description?: string | null) => {
  const cleanDescription = (description || '').replace(/\[RR_GROUPS:\d+\]/g, '').trim();
  if (!groupCount || groupCount <= 2) return cleanDescription || null;
  return [cleanDescription, `[RR_GROUPS:${groupCount}]`].filter(Boolean).join(' ').trim();
};

export const getSetsToShow = (setType?: string | null) => {
  const normalized = normalizeText(setType);
  if (normalized.includes('mejor de 5') || normalized === 'best5') return 5;
  if (normalized.includes('mejor de 3') || normalized === 'best3') return 3;
  if (normalized.includes('set corto') || normalized === 'short') return 1;
  return 1;
};

export const getRoundRobinGroupSizes = (maxPlayers: number, groupCount = 2) => {
  const totalSlots = Math.max(2, maxPlayers || 2);
  const safeGroupCount = Math.max(2, groupCount);
  const baseSize = Math.floor(totalSlots / safeGroupCount);
  const remainder = totalSlots % safeGroupCount;

  return Array.from({ length: safeGroupCount }, (_, index) => baseSize + (index < remainder ? 1 : 0))
    .map(size => Math.max(size, 1));
};

export const getRoundRobinGroupNames = (format?: string | null, description?: string | null) => {
  const count = getRoundRobinGroupCount(format, description);
  return Array.from({ length: count }, (_, index) => String.fromCharCode(65 + index));
};

export const getRoundRobinSlots = (maxPlayers: number, groupName: string, format?: string | null, description?: string | null) => {
  const groupNames = getRoundRobinGroupNames(format, description);
  const sizes = getRoundRobinGroupSizes(maxPlayers, groupNames.length);
  const groupIndex = Math.max(groupNames.indexOf(groupName), 0);
  const count = sizes[groupIndex] || 1;
  return Array.from({ length: count }, (_, index) => ({
    id: `${groupName}-${index + 1}`,
    name: `Cupo ${groupName}${index + 1}`,
  }));
};

export const createInitialMatches = ({
  tournamentId,
  format,
  description,
  maxPlayers,
  participants = [],
  modality,
}: {
  tournamentId: string;
  format?: string | null;
  description?: string | null;
  maxPlayers: number;
  participants?: Array<{ id: string }>;
  modality?: string | null;
}) => {
  const normalizedFormat = normalizeTournamentFormat(format);
  const totalSlots = Math.max(2, maxPlayers || 2);
  const isDobles = modality === 'dobles';

  if (normalizedFormat === 'round_robin') {
    const matches: any[] = [];
    let matchOrder = 1;
    const groupNames = getRoundRobinGroupNames(format, description);
    const groupSizes = getRoundRobinGroupSizes(totalSlots, groupNames.length);
    let participantOffset = 0;

    const buildGroupMatches = (startIndex: number, size: number, round: string) => {
      for (let i = 0; i < size; i++) {
        for (let j = i + 1; j < size; j++) {
          matches.push({
            tournament_id: tournamentId,
            player_a_id: isDobles ? participants[(startIndex + i) * 2]?.id || null : participants[startIndex + i]?.id || null,
            player_a2_id: isDobles ? participants[(startIndex + i) * 2 + 1]?.id || null : null,
            player_b_id: isDobles ? participants[(startIndex + j) * 2]?.id || null : participants[startIndex + j]?.id || null,
            player_b2_id: isDobles ? participants[(startIndex + j) * 2 + 1]?.id || null : null,
            round,
            round_number: 1,
            match_order: matchOrder++,
            status: 'pending',
          });
        }
      }
    };

    groupNames.forEach((groupName, index) => {
      const size = groupSizes[index] || 1;
      buildGroupMatches(participantOffset, size, `Grupo ${groupName}`);
      participantOffset += size;
    });

    // Optional placement matches (3rd, 5th, etc.) are now generated on-demand in the admin panel
    const placementMatches: string[] = [];

    placementMatches.forEach((roundName, index) => {
      matches.push({
        tournament_id: tournamentId,
        player_a_id: null,
        player_b_id: null,
        round: roundName,
        round_number: 2 + index,
        match_order: matchOrder++,
        status: 'pending',
      });
    });

    return matches;
  }

  const bracketSize = nextPowerOfTwo(totalSlots);
  const roundsCount = Math.log2(bracketSize);
  const matches: any[] = [];
  let matchOrder = 1;

  let matchesInRound = bracketSize / 2;
  for (let roundIndex = 1; roundIndex <= roundsCount; roundIndex++) {
    const roundName = getEliminationRoundName(roundIndex, roundsCount);
    for (let matchIndex = 0; matchIndex < matchesInRound; matchIndex++) {
      const firstRoundOffset = matchIndex * 2;
      matches.push({
        tournament_id: tournamentId,
        player_a_id: roundIndex === 1
          ? (isDobles ? participants[firstRoundOffset * 2]?.id || null : participants[firstRoundOffset]?.id || null)
          : null,
        player_a2_id: (roundIndex === 1 && isDobles) ? participants[firstRoundOffset * 2 + 1]?.id || null : null,
        player_b_id: roundIndex === 1
          ? (isDobles ? participants[(firstRoundOffset + 1) * 2]?.id || null : participants[firstRoundOffset + 1]?.id || null)
          : null,
        player_b2_id: (roundIndex === 1 && isDobles) ? participants[(firstRoundOffset + 1) * 2 + 1]?.id || null : null,
        round: roundName,
        round_number: roundIndex,
        match_order: matchOrder++,
        status: 'pending',
      });
    }
    matchesInRound /= 2;
  }

  if (normalizedFormat === 'single_elimination_repechage' && bracketSize >= 4) {
    const consolationSize = bracketSize / 2;
    const consolationRounds = Math.log2(consolationSize);
    let consolationMatchesInRound = consolationSize / 2;

    for (let roundIndex = 1; roundIndex <= consolationRounds; roundIndex++) {
      let roundName = `Consolacion - Ronda ${roundIndex}`;
      if (roundIndex === consolationRounds) roundName = 'Consolacion - Final';
      else if (roundIndex === consolationRounds - 1) roundName = 'Consolacion - Semifinales';

      for (let matchIndex = 0; matchIndex < consolationMatchesInRound; matchIndex++) {
        matches.push({
          tournament_id: tournamentId,
          player_a_id: null,
          player_b_id: null,
          round: roundName,
          round_number: roundIndex,
          match_order: 1000 + matchOrder++,
          status: 'pending',
        });
      }

      consolationMatchesInRound /= 2;
    }
  }

  return matches;
};
