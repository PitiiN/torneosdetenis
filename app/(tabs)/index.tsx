import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, ActivityIndicator, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '@/theme';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '@/services/supabase';
import * as SecureStore from 'expo-secure-store';

const { width } = Dimensions.get('window');

interface Organization {
    id: string;
    name: string;
    slug: string | null;
    created_at: string;
    logo_url: string | null;
}

export default function InicioScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [loading, setLoading] = useState(true);

    useFocusEffect(
        useCallback(() => {
            fetchOrganizations();
        }, [])
    );

    async function fetchOrganizations() {
        try {
            const { data, error } = await supabase
                .from('organizations')
                .select('*')
                .order('name');
            
            if (error) throw error;
            setOrganizations(data || []);
        } catch (error) {
            console.error('Error fetching organizations:', error);
        } finally {
            setLoading(false);
        }
    }

    return (
        <View style={styles.container}>
            {/* Top Bar */}
            <View style={[styles.header, { paddingTop: Math.max(insets.top, spacing.md) }]}>
                <View style={styles.headerLeft}>
                    <Ionicons name="tennisball" size={24} color={colors.primary[500]} />
                    <Text style={styles.logoText}>SweetSpot</Text>
                </View>
                <View style={{ width: 40, height: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Welcome Section */}
                <View style={styles.welcomeSection}>
                    <Text style={styles.welcomeTitle}>Explora Organizaciones</Text>
                    <Text style={styles.welcomeSubtitle}>Encuentra tu próximo club y únete a sus torneos</Text>
                </View>

                {/* Organizations Vitrine */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Clubes y Organizadores</Text>
                </View>

                {loading ? (
                    <ActivityIndicator size="large" color={colors.primary[500]} style={{ marginTop: 40 }} />
                ) : (
                    <View style={styles.orgGrid}>
                        {organizations.map((org) => (
                            <TouchableOpacity 
                                key={org.id} 
                                style={styles.orgCard}
                                onPress={async () => {
                                    await SecureStore.setItemAsync('selected_org_id', org.id);
                                    await SecureStore.setItemAsync('selected_org_name', org.name);
                                    router.push({
                                        pathname: '/(tabs)/tournaments',
                                        params: { orgId: org.id }
                                    });
                                }}
                            >
                                <View style={styles.orgIconContainer}>
                                    {org.logo_url ? (
                                        <Image 
                                            source={{ uri: org.logo_url }} 
                                            style={styles.orgLogo}
                                            resizeMode="contain"
                                        />
                                    ) : (
                                        <Ionicons name="business" size={40} color={colors.primary[500]} />
                                    )}
                                </View>
                                <Text style={styles.orgName}>{org.name}</Text>
                                <View style={styles.orgMeta}>
                                    <Ionicons name="trophy-outline" size={12} color={colors.textTertiary} />
                                    <Text style={styles.orgMetaText}>Ver torneos</Text>
                                </View>
                            </TouchableOpacity>
                        ))}
                        
                        {organizations.length === 0 && (
                            <View style={styles.emptyState}>
                                <Ionicons name="search-outline" size={48} color={colors.textTertiary} />
                                <Text style={styles.emptyText}>No se encontraron organizaciones disponibles.</Text>
                            </View>
                        )}
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.xl,
        paddingBottom: spacing.md,
        backgroundColor: colors.background,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    logoText: {
        fontSize: 18,
        fontWeight: '900',
        color: colors.primary[500],
        fontStyle: 'italic',
    },
    scrollContent: {
        padding: spacing.xl,
        paddingBottom: spacing.xl,
    },
    welcomeSection: {
        marginBottom: spacing['2xl'],
    },
    welcomeTitle: {
        fontSize: 28,
        fontWeight: '900',
        color: '#fff',
        letterSpacing: -0.5,
    },
    welcomeSubtitle: {
        fontSize: 14,
        color: colors.textSecondary,
        marginTop: 4,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#fff',
    },
    orgGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.md,
    },
    orgCard: {
        width: (width - spacing.xl * 2 - spacing.md) / 2,
        backgroundColor: colors.surface,
        borderRadius: borderRadius['2xl'],
        padding: spacing.xl,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        gap: spacing.sm,
    },
    orgIconContainer: {
        width: 80,
        height: 80,
        borderRadius: borderRadius.xl,
        backgroundColor: colors.surfaceSecondary,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.xs,
        overflow: 'hidden',
    },
    orgLogo: {
        width: '100%',
        height: '100%',
    },
    orgName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
        textAlign: 'center',
    },
    orgMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    orgMetaText: {
        fontSize: 12,
        color: colors.textTertiary,
        fontWeight: '500',
    },
    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        width: '100%',
    },
    emptyText: {
        color: colors.textTertiary,
        fontSize: 14,
        textAlign: 'center',
        marginTop: spacing.md,
    }
});
