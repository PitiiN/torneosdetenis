import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { darkTheme, lightTheme } from './colors';
import { typography } from './typography';
import { spacing, borderRadius } from './spacing';

type ThemeType = 'dark' | 'light';

interface ThemeContextType {
    theme: ThemeType;
    colors: typeof darkTheme;
    toggleTheme: () => void;
    isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'app_theme_preference';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [theme, setTheme] = useState<ThemeType>('dark');

    useEffect(() => {
        loadTheme();
    }, []);

    const loadTheme = async () => {
        try {
            const savedTheme = await SecureStore.getItemAsync(THEME_STORAGE_KEY);
            if (savedTheme === 'light' || savedTheme === 'dark') {
                setTheme(savedTheme);
            }
        } catch {
        }
    };

    const toggleTheme = async () => {
        const nextTheme = theme === 'dark' ? 'light' : 'dark';
        setTheme(nextTheme);
        try {
            await SecureStore.setItemAsync(THEME_STORAGE_KEY, nextTheme);
        } catch {
        }
    };

    const colors = theme === 'dark' ? darkTheme : lightTheme;

    return (
        <ThemeContext.Provider value={{ theme, colors, toggleTheme, isDark: theme === 'dark' }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};

export const useOptionalTheme = () => useContext(ThemeContext);

// STATIC EXPORTS for compatibility
// Warning: These will NOT react to theme changes if used directly in StyleSheet.create
export const colors = darkTheme;

export const theme = {
    colors: darkTheme,
    typography,
    spacing,
    borderRadius,
    shadows: {
        sm: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.3,
            shadowRadius: 2,
            elevation: 2,
        },
        md: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.4,
            shadowRadius: 4,
            elevation: 4,
        },
        lg: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.5,
            shadowRadius: 8,
            elevation: 8,
        },
    },
} as const;

export { darkTheme, lightTheme } from './colors';
export { typography } from './typography';
export { spacing, borderRadius } from './spacing';
