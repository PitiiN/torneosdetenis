import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

type AccessibilityContextType = {
    fontScale: number;
    highContrast: boolean;
    accessibilityMode: boolean; // "Simple mode"
    setFontScale: (scale: number) => Promise<void>;
    setHighContrast: (enabled: boolean) => Promise<void>;
    setAccessibilityMode: (enabled: boolean) => Promise<void>;
    isLoading: boolean;
};

const AccessibilityContext = createContext<AccessibilityContextType>({
    fontScale: 1.0,
    highContrast: false,
    accessibilityMode: true,
    setFontScale: async () => { },
    setHighContrast: async () => { },
    setAccessibilityMode: async () => { },
    isLoading: true,
});

export const AccessibilityProvider = ({ children }: { children: React.ReactNode }) => {
    const { user } = useAuth();
    const [fontScale, setFontScaleState] = useState(1.0);
    const [highContrast, setHighContrastState] = useState(false);
    const [accessibilityMode, setAccessibilityModeState] = useState(true);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchPreferences = async () => {
            if (!user) {
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            const { data, error } = await supabase
                .from('profiles')
                .select('preferred_font_scale, high_contrast_mode, accessibility_mode')
                .eq('user_id', user.id)
                .single();

            if (!error && data) {
                setFontScaleState(Number(data.preferred_font_scale) || 1.0);
                setHighContrastState(data.high_contrast_mode || false);
                setAccessibilityModeState(data.accessibility_mode ?? true);
            }
            setIsLoading(false);
        };

        fetchPreferences();
    }, [user]);

    const setFontScale = async (scale: number) => {
        setFontScaleState(scale);
        if (user) {
            await supabase.from('profiles').update({ preferred_font_scale: scale }).eq('user_id', user.id);
        }
    };

    const setHighContrast = async (enabled: boolean) => {
        setHighContrastState(enabled);
        if (user) {
            await supabase.from('profiles').update({ high_contrast_mode: enabled }).eq('user_id', user.id);
        }
    };

    const setAccessibilityMode = async (enabled: boolean) => {
        setAccessibilityModeState(enabled);
        if (user) {
            await supabase.from('profiles').update({ accessibility_mode: enabled }).eq('user_id', user.id);
        }
    };

    return (
        <AccessibilityContext.Provider
            value={{
                fontScale,
                highContrast,
                accessibilityMode,
                setFontScale,
                setHighContrast,
                setAccessibilityMode,
                isLoading
            }}
        >
            {/* 
        You could wrap children in a provider that injects styles dynamically based on these settings
        or use them directly in components via the hook.
      */}
            {children}
        </AccessibilityContext.Provider>
    );
};

export const useAccessibility = () => useContext(AccessibilityContext);
