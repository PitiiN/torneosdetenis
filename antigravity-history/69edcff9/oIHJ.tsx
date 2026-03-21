import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle, ActivityIndicator } from 'react-native';

interface ButtonProps {
    title: string;
    onPress: () => void;
    variant?: 'primary' | 'outline' | 'ghost';
    loading?: boolean;
    disabled?: boolean;
    style?: ViewStyle;
}

export const Button = ({ title, onPress, variant = 'primary', loading = false, disabled = false, style }: ButtonProps) => {
    const isOutline = variant === 'outline';
    const isGhost = variant === 'ghost';

    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled || loading}
            style={[
                styles.button,
                isOutline && styles.outlineButton,
                isGhost && styles.ghostButton,
                disabled && styles.disabledButton,
                style,
            ]}
        >
            {loading ? (
                <ActivityIndicator color={isOutline || isGhost ? '#10b981' : '#ffffff'} />
            ) : (
                <Text style={[
                    styles.text,
                    isOutline && styles.outlineText,
                    isGhost && styles.ghostText,
                    disabled && styles.disabledText
                ]}>
                    {title}
                </Text>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    button: {
        height: 50,
        backgroundColor: '#10b981', // Emerald-500
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 16,
    },
    outlineButton: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: '#10b981',
    },
    ghostButton: {
        backgroundColor: 'transparent',
    },
    disabledButton: {
        backgroundColor: '#e5e7eb',
        borderColor: '#d1d5db',
    },
    text: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '600',
    },
    outlineText: {
        color: '#10b981',
    },
    ghostText: {
        color: '#10b981',
    },
    disabledText: {
        color: '#9ca3af',
    },
});
