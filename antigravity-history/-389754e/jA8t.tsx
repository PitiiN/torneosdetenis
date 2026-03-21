import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';

export type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'pendiente' | 'pagada' | 'cancelada';

interface BadgeProps {
    children: React.ReactNode;
    variant?: BadgeVariant;
}

export const Badge = ({ children, variant = 'default' }: BadgeProps) => {
    const getVariantStyle = (): [ViewStyle, TextStyle] => {
        switch (variant) {
            case 'pendiente':
                return [styles.pendienteContainer, styles.pendienteText];
            case 'pagada':
                return [styles.pagadaContainer, styles.pagadaText];
            case 'cancelada':
                return [styles.canceladaContainer, styles.canceladaText];
            case 'outline':
                return [styles.outlineContainer, styles.outlineText];
            default:
                return [styles.defaultContainer, styles.defaultText];
        }
    };

    const [containerStyle, textStyle] = getVariantStyle();

    return (
        <View style={[styles.container, containerStyle]}>
            <Text style={[styles.text, textStyle]}>{children}</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 9999,
        alignSelf: 'flex-start',
    },
    text: {
        fontSize: 12,
        fontWeight: '600',
    },
    defaultContainer: {
        backgroundColor: '#1f2937',
    },
    defaultText: {
        color: '#ffffff',
    },
    pendienteContainer: {
        backgroundColor: '#fef3c7',
        borderWidth: 1,
        borderColor: '#f59e0b',
    },
    pendienteText: {
        color: '#92400e',
    },
    pagadaContainer: {
        backgroundColor: '#ecfdf5',
        borderWidth: 1,
        borderColor: '#10b981',
    },
    pagadaText: {
        color: '#065f46',
    },
    canceladaContainer: {
        backgroundColor: '#fef2f2',
        borderWidth: 1,
        borderColor: '#ef4444',
    },
    canceladaText: {
        color: '#991b1b',
    },
    outlineContainer: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: '#d1d5db',
    },
    outlineText: {
        color: '#374151',
    },
});
