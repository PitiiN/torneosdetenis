import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';

interface CardProps {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
}

export const Card = ({ children, style }: CardProps) => (
    <View style={[styles.card, style]}>{children}</View>
);

export const CardHeader = ({ children, style }: CardProps) => (
    <View style={[styles.header, style]}>{children}</View>
);

export const CardTitle = ({ children, style }: CardProps) => (
    <View style={style}>{children}</View>
);

export const CardDescription = ({ children, style }: CardProps) => (
    <View style={style}>{children}</View>
);

export const CardContent = ({ children, style }: CardProps) => (
    <View style={[styles.content, style]}>{children}</View>
);

export const CardFooter = ({ children, style }: CardProps) => (
    <View style={[styles.footer, style]}>{children}</View>
);

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 15,
        elevation: 2,
        overflow: 'hidden',
    },
    header: {
        padding: 16,
    },
    content: {
        padding: 16,
        paddingTop: 0,
    },
    footer: {
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
    },
});
