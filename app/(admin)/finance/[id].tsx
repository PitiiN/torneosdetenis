import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius } from '@/theme';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/services/supabase';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BackHandler } from 'react-native';

type Registration = {
    id: string;
    player_id: string;
    fee_amount: number;
    is_paid: boolean;
    profiles: {
        name: string | null;
    } | null;
};

export default function TournamentFinanceDetail() {
    const { id } = useLocalSearchParams();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [tournament, setTournament] = useState<any>(null);
    const [registrations, setRegistrations] = useState<Registration[]>([]);

    useEffect(() => {
        if (id) {
            loadTournamentFinance();
        }

        const backAction = () => {
            router.replace('/(tabs)/finance');
            return true;
        };

        const backHandler = BackHandler.addEventListener(
            'hardwareBackPress',
            backAction,
        );

        return () => backHandler.remove();
    }, [id]);

    const loadTournamentFinance = async () => {
        setLoading(true);
        try {
            // Load tournament
            const { data: tourData, error: tourError } = await supabase
                .from('tournaments')
                .select('*')
                .eq('id', id)
                .single();

            if (tourError) throw tourError;
            setTournament(tourData);

            // Load registrations
            const { data: regData, error: regError } = await supabase
                .from('registrations')
                .select('id, player_id, fee_amount, is_paid, profiles(name)')
                .eq('tournament_id', id);

            if (regError) throw regError;
            setRegistrations((regData || []) as any[]);
        } catch (error) {
            console.error('Error loading tournament finance:', error);
            Alert.alert('Error', 'No se pudo cargar la información financiera.');
        } finally {
            setLoading(false);
        }
    };

    const totals = useMemo(() => {
        return registrations.reduce((acc, reg) => {
            const amount = reg.fee_amount || 0;
            if (reg.is_paid) {
                acc.income += amount;
            } else {
                acc.debt += amount;
            }
            return acc;
        }, { income: 0, debt: 0 });
    }, [registrations]);

    const handleUpdateRegistration = async (regId: string, updates: Partial<Registration>) => {
        setSaving(regId);
        try {
            const { error } = await supabase
                .from('registrations')
                .update(updates)
                .eq('id', regId);

            if (error) throw error;

            setRegistrations(current => 
                current.map(reg => reg.id === regId ? { ...reg, ...updates } : reg)
            );
        } catch (error) {
            console.error('Error updating registration:', error);
            Alert.alert('Error', 'No se pudo actualizar el registro.');
        } finally {
            setSaving(null);
        }
    };

    const togglePayment = (reg: Registration) => {
        handleUpdateRegistration(reg.id, { is_paid: !reg.is_paid });
    };

    const handleFeeChange = (regId: string, value: string) => {
        const amount = parseInt(value) || 0;
        setRegistrations(current => 
            current.map(reg => reg.id === regId ? { ...reg, fee_amount: amount } : reg)
        );
    };

    const saveFeeChange = (reg: Registration) => {
        handleUpdateRegistration(reg.id, { fee_amount: reg.fee_amount });
    };

    if (loading) {
        return (
            <View style={[styles.container, styles.center]}>
                <ActivityIndicator size="large" color={colors.primary[500]} />
            </View>
        );
    }

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.replace('/(tabs)/finance')} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <View style={styles.headerTextContainer}>
                    <Text style={styles.title} numberOfLines={1}>{tournament?.name}</Text>
                    <Text style={styles.subtitle}>Detalle Financiero</Text>
                </View>
                <View style={{ width: 40 }} />
            </View>

            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={styles.content}>
                    <View style={styles.summaryGrid}>
                        <View style={styles.summaryCard}>
                            <Text style={styles.summaryLabel}>Ingresos Reales</Text>
                            <Text style={[styles.summaryValue, { color: colors.success }]}>${totals.income}</Text>
                        </View>
                        <View style={styles.summaryCard}>
                            <Text style={styles.summaryLabel}>Deuda Pendiente</Text>
                            <Text style={[styles.summaryValue, { color: colors.error }]}>${totals.debt}</Text>
                        </View>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Jugadores e Inscripciones</Text>
                        <View style={styles.playersList}>
                            {registrations.map((reg) => (
                                <View key={reg.id} style={styles.playerCard}>
                                    <View style={styles.playerHeader}>
                                        <View style={styles.playerInfo}>
                                            <Text style={styles.playerName}>{reg.profiles?.name || 'Jugador'}</Text>
                                            <View style={[styles.paidBadge, reg.is_paid ? styles.paidBadgeActive : styles.unpaidBadge]}>
                                                <Text style={styles.paidBadgeText}>{reg.is_paid ? 'PAGADO' : 'PENDIENTE'}</Text>
                                            </View>
                                        </View>
                                        <TouchableOpacity 
                                            style={[styles.toggleBtn, reg.is_paid ? styles.toggleBtnPaid : styles.toggleBtnUnpaid]}
                                            onPress={() => togglePayment(reg)}
                                            disabled={!!saving}
                                        >
                                            <Text style={styles.toggleBtnText}>
                                                {saving === reg.id ? '...' : (reg.is_paid ? 'Marcar Deuda' : 'Marcar Pagado')}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                    <View style={styles.feeRow}>
                                        <Text style={styles.feeLabel}>Valor Inscripción:</Text>
                                        <View style={styles.feeInputWrapper}>
                                            <Text style={styles.currencySymbol}>$</Text>
                                            <TextInput
                                                style={styles.feeInput}
                                                value={String(reg.fee_amount)}
                                                onChangeText={(val) => handleFeeChange(reg.id, val)}
                                                onBlur={() => saveFeeChange(reg)}
                                                keyboardType="numeric"
                                            />
                                        </View>
                                    </View>
                                </View>
                            ))}

                            {registrations.length === 0 && (
                                <View style={styles.emptyContainer}>
                                    <Ionicons name="people-outline" size={48} color={colors.textTertiary} />
                                    <Text style={styles.emptyText}>No hay jugadores inscritos en este torneo.</Text>
                                </View>
                            )}
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    center: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.xl,
        paddingBottom: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: colors.surface,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.05)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTextContainer: {
        flex: 1,
        paddingHorizontal: spacing.md,
    },
    title: {
        fontSize: 18,
        fontWeight: '900',
        color: '#fff',
    },
    subtitle: {
        fontSize: 12,
        color: colors.primary[500],
        fontWeight: '700',
    },
    content: {
        padding: spacing.xl,
        paddingBottom: 40,
        gap: spacing.xl,
    },
    summaryGrid: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    summaryCard: {
        flex: 1,
        backgroundColor: colors.surface,
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.lg,
        gap: spacing.xs,
    },
    summaryLabel: {
        color: colors.textSecondary,
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    summaryValue: {
        fontSize: 20,
        fontWeight: '900',
    },
    section: {
        gap: spacing.md,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#fff',
    },
    playersList: {
        gap: spacing.md,
    },
    playerCard: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.lg,
        gap: spacing.md,
    },
    playerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    playerInfo: {
        flex: 1,
        gap: spacing.xs,
    },
    playerName: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '800',
    },
    paidBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: borderRadius.sm,
    },
    paidBadgeActive: {
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
    },
    unpaidBadge: {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
    },
    paidBadgeText: {
        fontSize: 10,
        fontWeight: '900',
        color: colors.success,
    },
    toggleBtn: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.lg,
    },
    toggleBtnPaid: {
        backgroundColor: colors.error + '20',
        borderWidth: 1,
        borderColor: colors.error,
    },
    toggleBtnUnpaid: {
        backgroundColor: colors.success + '20',
        borderWidth: 1,
        borderColor: colors.success,
    },
    toggleBtnText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#fff',
    },
    feeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    feeLabel: {
        color: colors.textSecondary,
        fontSize: 14,
        fontWeight: '600',
    },
    feeInputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.background,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: spacing.sm,
    },
    currencySymbol: {
        color: colors.textTertiary,
        fontSize: 14,
        fontWeight: '700',
    },
    feeInput: {
        color: '#fff',
        paddingHorizontal: spacing.xs,
        paddingVertical: 8,
        fontSize: 14,
        fontWeight: '800',
        width: 80,
        textAlign: 'right',
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
        gap: spacing.md,
    },
    emptyText: {
        color: colors.textTertiary,
        textAlign: 'center',
    }
});
