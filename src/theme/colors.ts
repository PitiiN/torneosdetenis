export const darkTheme = {
  primary: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e', 
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#14532d',
  },
  secondary: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
  },
  background: '#0a0a0a',
  surface: '#171717',
  surfaceSecondary: '#262626',
  border: '#2e2e2e',
  text: '#ffffff',
  textSecondary: '#a3a3a3',
  textTertiary: '#737373',
  error: '#ef4444',
  success: '#22c55e',
  warning: '#f59e0b',
  info: '#3b82f6',
};

export const lightTheme = {
  primary: {
    ...darkTheme.primary,
  },
  secondary: {
    ...darkTheme.secondary,
  },
  background: '#ffffff',
  surface: '#f3f4f6', 
  surfaceSecondary: '#e5e7eb',
  border: '#d1d5db',
  text: '#111827',
  textSecondary: '#4b5563',
  textTertiary: '#9ca3af',
  error: '#dc2626',
  success: '#16a34a',
  warning: '#d97706',
  info: '#2563eb',
};

export type ThemeColors = typeof darkTheme;
export const colors = lightTheme; // Default to light for compatibility
