import type { Config } from 'tailwindcss'

const config: Config = {
    darkMode: 'class',
    content: [
        './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
        './src/components/**/*.{js,ts,jsx,tsx,mdx}',
        './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            colors: {
                // Dark theme colors based on the design
                background: '#0a0e1a',
                foreground: '#ffffff',
                card: {
                    DEFAULT: '#0f1629',
                    foreground: '#ffffff',
                },
                primary: {
                    DEFAULT: '#2563eb',
                    foreground: '#ffffff',
                    50: '#eff6ff',
                    100: '#dbeafe',
                    200: '#bfdbfe',
                    300: '#93c5fd',
                    400: '#60a5fa',
                    500: '#3b82f6',
                    600: '#2563eb',
                    700: '#1d4ed8',
                    800: '#1e40af',
                    900: '#1e3a8a',
                },
                secondary: {
                    DEFAULT: '#1e293b',
                    foreground: '#ffffff',
                },
                muted: {
                    DEFAULT: '#334155',
                    foreground: '#94a3b8',
                },
                accent: {
                    DEFAULT: '#0ea5e9',
                    foreground: '#ffffff',
                },
                destructive: {
                    DEFAULT: '#ef4444',
                    foreground: '#ffffff',
                },
                success: {
                    DEFAULT: '#22c55e',
                    foreground: '#ffffff',
                },
                warning: {
                    DEFAULT: '#f59e0b',
                    foreground: '#000000',
                },
                border: '#1e293b',
                input: '#1e293b',
                ring: '#2563eb',
            },
            borderRadius: {
                lg: '0.75rem',
                md: '0.5rem',
                sm: '0.25rem',
            },
        },
    },
    plugins: [],
}
export default config
