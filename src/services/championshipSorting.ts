import { TOURNAMENT_CATEGORIES } from '@/constants/tournamentOptions';

const normalizeText = (value?: string | null) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const CATEGORY_ORDER = TOURNAMENT_CATEGORIES.map((category) => normalizeText(category));

export const getModalityLabel = (modality?: string | null) =>
  normalizeText(modality).includes('doble') ? 'Dobles' : 'Singles';

export const getModalitySortRank = (modality?: string | null) =>
  normalizeText(modality).includes('doble') ? 1 : 0;

export const getCategorySortRank = (category?: string | null) => {
  const normalized = normalizeText(category);
  const index = CATEGORY_ORDER.indexOf(normalized);
  return index >= 0 ? index : CATEGORY_ORDER.length + 1;
};

export function sortChampionships<T extends { modality?: string | null; level?: string | null; name?: string | null }>(
  championships: T[]
) {
  return [...championships].sort((a, b) => {
    const modalityDiff = getModalitySortRank(a.modality) - getModalitySortRank(b.modality);
    if (modalityDiff !== 0) return modalityDiff;

    const categoryDiff = getCategorySortRank(a.level) - getCategorySortRank(b.level);
    if (categoryDiff !== 0) return categoryDiff;

    return String(a.name || '').localeCompare(String(b.name || ''), 'es');
  });
}

