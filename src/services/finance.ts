export const parseFinanceMetadata = (description?: string | null) => {
  const entryFeeMatch = (description || '').match(/\[ENTRY_FEE:(\d+)\]/);
  const paymentsMatch = (description || '').match(/\[PAYMENTS:([^\]]+)\]/);

  let payments: Record<string, boolean> = {};
  if (paymentsMatch?.[1]) {
    try {
      payments = JSON.parse(decodeURIComponent(paymentsMatch[1]));
    } catch {
      payments = {};
    }
  }

  return {
    entryFee: entryFeeMatch ? Number(entryFeeMatch[1]) : 0,
    payments,
  };
};

export const buildFinanceDescription = (
  description: string | null | undefined,
  entryFee: number,
  payments: Record<string, boolean>
) => {
  const baseDescription = (description || '')
    .replace(/\s*\[ENTRY_FEE:\d+\]/g, '')
    .replace(/\s*\[PAYMENTS:[^\]]+\]/g, '')
    .trim();

  const parts = [baseDescription];
  parts.push(`[ENTRY_FEE:${Math.max(0, entryFee || 0)}]`);

  if (Object.keys(payments).length > 0) {
    parts.push(`[PAYMENTS:${encodeURIComponent(JSON.stringify(payments))}]`);
  }

  return parts.filter(Boolean).join(' ').trim();
};
