/**
 * Color tokens derived from reference image:
 * Dark theme with vibrant purple primary, green secondary,
 * orange and pink accents on near-black background.
 */
export const colors = {
    // Primary — Vibrant Purple
    primary: {
        50: '#F5F3FF',
        100: '#EDE9FE',
        200: '#DDD6FE',
        300: '#C4B5FD',
        400: '#A78BFA',
        500: '#7C3AED',
        600: '#6D28D9',
        700: '#5B21B6',
        800: '#4C1D95',
        900: '#3B0764',
    },

    // Secondary — Tennis Green
    secondary: {
        50: '#F0FDF4',
        100: '#DCFCE7',
        200: '#BBF7D0',
        300: '#86EFAC',
        400: '#4ADE80',
        500: '#22C55E',
        600: '#16A34A',
        700: '#15803D',
        800: '#166534',
        900: '#14532D',
    },

    // Accent — Orange
    accent: {
        50: '#FFF7ED',
        100: '#FFEDD5',
        300: '#FDBA74',
        500: '#F97316',
        700: '#C2410C',
    },

    // Semantic
    success: '#22C55E',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',

    // Surfaces — Dark theme
    background: '#0A0A0A',
    surface: '#1A1A2E',
    surfaceLight: '#252540',
    card: '#16162A',
    border: '#2D2D4A',
    borderLight: '#3D3D5C',

    // Text
    text: '#FFFFFF',
    textSecondary: '#A0A0B8',
    textTertiary: '#6B6B80',
    textInverse: '#0A0A0A',

    // White
    white: '#FFFFFF',
    black: '#000000',

    // Class level colors
    level: {
        beginner: '#22C55E',
        intermediate: '#3B82F6',
        advanced: '#F59E0B',
        elite: '#EF4444',
        competition: '#7C3AED',
    },

    // Payment status colors
    payment: {
        paid: '#22C55E',
        pending: '#F59E0B',
        overdue: '#EF4444',
        refunded: '#3B82F6',
        cancelled: '#6B7280',
    },
} as const;

export type Colors = typeof colors;
