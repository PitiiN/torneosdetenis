import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Dimensions } from 'react-native';
import { useAlertStore } from '@/store/alert.store';
import { colors, spacing, borderRadius } from '@/theme';

const { width } = Dimensions.get('window');

export function CustomAlert() {
    const { visible, title, message, buttons, hideAlert } = useAlertStore();

    if (!visible) return null;

    return (
        <Modal transparent visible={visible} animationType="fade">
            <View style={styles.overlay}>
                <View style={styles.alertBox}>
                    <Text style={styles.title}>{title}</Text>
                    {!!message && <Text style={styles.message}>{message}</Text>}

                    <View style={styles.buttonContainer}>
                        {buttons.map((btn, index) => {
                            const isDestructive = btn.style === 'destructive';
                            const isCancel = btn.style === 'cancel';
                            return (
                                <TouchableOpacity
                                    key={index}
                                    style={[
                                        styles.button,
                                        isCancel && styles.buttonCancel,
                                        isDestructive && styles.buttonDestructive,
                                    ]}
                                    onPress={() => {
                                        hideAlert();
                                        if (btn.onPress) btn.onPress();
                                    }}
                                >
                                    <Text style={[
                                        styles.buttonText,
                                        isCancel && styles.buttonTextCancel,
                                        isDestructive && styles.buttonTextDestructive,
                                    ]}>
                                        {btn.text}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: spacing.xl,
    },
    alertBox: {
        width: width - spacing.xl * 2,
        backgroundColor: colors.surface,
        borderRadius: borderRadius.xl,
        padding: spacing.xl,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        borderWidth: 1,
        borderColor: colors.border,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.text,
        marginBottom: spacing.xs,
        textAlign: 'center',
    },
    message: {
        fontSize: 14,
        color: colors.textSecondary,
        marginBottom: spacing.xl,
        textAlign: 'center',
        lineHeight: 20,
    },
    buttonContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: spacing.md,
    },
    button: {
        flex: 1,
        minWidth: '40%',
        height: 44,
        backgroundColor: colors.primary[500],
        borderRadius: borderRadius.lg,
        justifyContent: 'center',
        alignItems: 'center',
    },
    buttonText: {
        fontSize: 14,
        fontWeight: '700',
        color: colors.white,
    },
    buttonCancel: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: colors.border,
    },
    buttonTextCancel: {
        color: colors.textSecondary,
    },
    buttonDestructive: {
        backgroundColor: colors.error + '25',
        borderWidth: 1,
        borderColor: colors.error,
    },
    buttonTextDestructive: {
        color: colors.error,
    },
});
