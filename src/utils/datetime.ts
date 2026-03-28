export const formatDateDDMMYYYY = (dateStr: string | null | undefined): string => {
  if (!dateStr) return 'Sin fecha';
  try {
    const [year, month, day] = dateStr.split('T')[0].split('-');
    if (!year || !month || !day) return dateStr;
    return `${day}-${month}-${year}`;
  } catch (e) {
    return dateStr || 'Sin fecha';
  }
};

export const formatTime24 = (dateStr: string | Date | null | undefined): string => {
  if (!dateStr) return '--:-- hrs';
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (isNaN(date.getTime())) return '--:-- hrs';
  
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes} hrs`;
};

export const parseTimeRelaxed = (timeStr: string): string | null => {
  // Handles 2200, 22:00, 22 00, etc.
  const cleaned = timeStr.replace(/[^0-9]/g, '');
  if (cleaned.length === 3) {
    // Treat as HMM (e.g. 930 -> 09:30)
    const h = cleaned.slice(0, 1).padStart(2, '0');
    const m = cleaned.slice(1);
    return `${h}:${m}`;
  }
  if (cleaned.length === 4) {
    // Treat as HHMM
    const h = cleaned.slice(0, 2);
    const m = cleaned.slice(2);
    if (parseInt(h) < 24 && parseInt(m) < 60) {
      return `${h}:${m}`;
    }
  }
  // Fallback to standard regex check if it already has colon
  const regex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  if (regex.test(timeStr)) return timeStr;
  
  return null;
};
