import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Dimensions, Image, ActivityIndicator, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, borderRadius } from '@/theme';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/services/supabase';
import { useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import { adminModeService } from '@/services/adminMode';

const { width } = Dimensions.get('window');

const YEARS = [2026, 2027, 2028, 2029, 2030];
const MONTHS = [
    'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 
    'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
];

interface Tournament {
    id: string;
    name: string;
    description: string | null;
    status: string;
    surface: string;
    format: string;
    start_date: string;
    organization_id?: string;
    registration_fee?: number;
    address?: string;
    comuna?: string;
}

const SURFACE_MAP: { [key: string]: string } = {
    'clay': 'Arcilla',
    'grass': 'Césped',
    'hard': 'Dura',
    'carpet': 'Carpeta',
    'Arcilla': 'Arcilla',
    'Césped': 'Césped',
    'Dura': 'Dura',
    'Carpeta': 'Carpeta'
};

const STATUS_DISPLAY: { [key: string]: string } = {
    'open': 'PUBLICADO',
    'ongoing': 'EN PROGRESO',
    'in_progress': 'EN PROGRESO',
    'completed': 'FINALIZADO',
    'finalized': 'FINALIZADO',
    'pending': 'PENDIENTE',
    'draft': 'BORRADOR'
};

export default function TorneosScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { colors } = useTheme();
    const styles = getStyles(colors);
    const { orgId } = useLocalSearchParams<{ orgId: string }>();
    
    const [activeFilter, setActiveFilter] = useState('Próximos');
    const [role, setRole] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const [orgName, setOrgName] = useState<string>('Torneos');

    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
    const [userOrgId, setUserOrgId] = useState<string | null>(null);
    const [notifications, setNotifications] = useState<Array<{ id: string; title: string; body: string }>>([]);
    const [viewMode, setViewMode] = useState(adminModeService.getMode());
    const [isNotificationsVisible, setIsNotificationsVisible] = useState(false);

    const filters = ['Próximos', 'En Curso', 'Finalizados'];

    useFocusEffect(
        useCallback(() => {
            fetchUserData();
            if (orgId) {
                fetchOrgDetails();
                fetchTournaments();
            }
        }, [orgId])
    );

    useEffect(() => {
        const unsubscribe = adminModeService.subscribe((m) => {
            setViewMode(m);
        });
        return unsubscribe;
    }, []);

    useEffect(() => {
        if (orgId) {
            fetchOrgDetails();
            fetchTournaments();
        }
    }, [orgId]);

    async function fetchOrgDetails() {
        const { data } = await supabase
            .from('organizations')
            .select('name')
            .eq('id', orgId)
            .single();
        if (data) {
            setOrgName(data.name);
            if (orgId) {
                await SecureStore.setItemAsync('selected_org_id', String(orgId));
                await SecureStore.setItemAsync('selected_org_name', data.name);
            }
        }
    }

    async function fetchUserData() {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            setUserEmail(session.user.email || null);
            setUserId(session.user.id);
            const { data: profile } = await supabase
                .from('profiles')
                .select('role, org_id')
                .eq('id', session.user.id)
                .single();
            setRole(profile?.role || 'player');
            setUserOrgId(profile?.org_id || null);
            fetchNotifications(session.user.id);
        }
    }

    async function fetchNotifications(currentUserId: string) {
        try {
            const items: Array<{ id: string; title: string; body: string }> = [];

            const { data: publishedTournaments } = await supabase
                .from('tournaments')
                .select('id, name')
                .eq('organization_id', orgId)
                .in('status', ['open', 'ongoing', 'in_progress'])
                .order('start_date', { ascending: true })
                .limit(5);

            (publishedTournaments || []).forEach((tournament: any) => {
                items.push({
                    id: `pub-${tournament.id}`,
                    title: 'Nuevo torneo disponible',
                    body: `${tournament.name} ya fue publicado para inscripción.`,
                });
            });

            const { data: registrations } = await supabase
                .from('registrations')
                .select('tournament_id')
                .eq('player_id', currentUserId);

            const tournamentIds = [...new Set((registrations || []).map((registration: any) => registration.tournament_id).filter(Boolean))];
            if (tournamentIds.length > 0) {
                const { data: userMatches } = await supabase
                    .from('matches')
                    .select('id, round, score, status')
                    .in('tournament_id', tournamentIds)
                    .or(`player_a_id.eq.${currentUserId},player_b_id.eq.${currentUserId}`)
                    .order('match_order', { ascending: true })
                    .limit(6);

                (userMatches || []).forEach((match: any) => {
                    items.push({
                        id: `match-${match.id}`,
                        title: match.status === 'finished' ? 'Resultado registrado' : 'Tu siguiente partido',
                        body: match.status === 'finished'
                            ? `${match.round}: resultado ${match.score || 'pendiente'}.`
                            : `${match.round}: tu próximo partido ya fue publicado.`,
                    });
                });
            }

            setNotifications(items);
        } catch (error) {
            console.error('Error fetching notifications:', error);
        }
    }

    async function fetchTournaments() {
        setLoading(true);
        try {
            let query = supabase
                .from('tournaments')
                .select('*')
                .eq('organization_id', orgId)
                .order('start_date', { ascending: false });
            
            const { data, error } = await query;
            if (error) throw error;
            setTournaments(data || []);
        } catch (error) {
            console.error('Error fetching tournaments:', error);
        } finally {
            setLoading(false);
        }
    }

    const isGlobalAdmin = userEmail === 'javier.aravena25@gmail.com';
    // Admin can create only if it's their organization AND they are in admin view mode
    const canManage = (isGlobalAdmin || (role === 'admin' && userOrgId === orgId)) && viewMode === 'admin';

    const filteredTournaments = tournaments.filter(t => {
        // Determine if tournament should be visible based on role and filter
        const isVisibleToPlayer = ['open', 'ongoing', 'in_progress', 'completed', 'finalized', 'finished'].includes(t.status);
        
        // If not admin and not a visible status, hide
        if (!canManage && !isVisibleToPlayer) return false;

        if (activeFilter === 'Próximos') return t.status === 'open' || t.status === 'pending';
        if (activeFilter === 'En Curso') return t.status === 'ongoing' || t.status === 'in_progress';
        if (activeFilter === 'Finalizados') {
            const isFinalized = t.status === 'completed' || t.status === 'finalized' || t.status === 'finished';
            if (!isFinalized) return false;

            const tDate = new Date(t.start_date || '');
            const yearMatch = tDate.getFullYear() === selectedYear;
            const monthMatch = selectedMonth === null || tDate.getMonth() === selectedMonth;
            return yearMatch && monthMatch;
        }
        return true;
    });

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={[styles.header, { paddingTop: Math.max(insets.top, spacing.md) }]}>
                <View style={styles.headerContent}>
                    <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
                        <Ionicons name="chevron-back" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle} numberOfLines={1}>{orgName}</Text>
                    <TouchableOpacity style={styles.iconButton} onPress={() => setIsNotificationsVisible(true)}>
                        <Ionicons name="notifications-outline" size={24} color={colors.text} />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Manager Actions */}
                {canManage && (
                    <View style={styles.actionsGrid}>
                        <TouchableOpacity 
                            style={[styles.actionCard, { backgroundColor: colors.primary[500] }]}
                            onPress={() => router.push({
                                pathname: '/(admin)/tournaments/create',
                                params: { orgId }
                            })}
                        >
                            <Ionicons name="trophy" size={40} color="#fff" />
                            <View>
                                <Text style={styles.actionTitle}>Crear Torneo</Text>
                                <Text style={styles.actionSubtitle}>Gestiona {orgName}</Text>
                            </View>
                        </TouchableOpacity>
                    </View>
                )}

                <View style={styles.filterSection}>
                    <View style={styles.filterContainer}>
                        {filters.map((filter) => (
                            <TouchableOpacity 
                                key={filter}
                                style={[
                                    styles.filterButton, 
                                    activeFilter === filter && styles.filterButtonActive
                                ]}
                                onPress={() => setActiveFilter(filter)}
                            >
                                <Text style={[
                                    styles.filterButtonText,
                                    activeFilter === filter && styles.filterButtonTextActive
                                ]} numberOfLines={1}>
                                    {filter}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {activeFilter === 'Finalizados' && (
                    <View style={styles.carouselContainer}>
                        <ScrollView 
                            horizontal 
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.carouselScroll}
                        >
                            {YEARS.map(year => (
                                <TouchableOpacity 
                                    key={year} 
                                    style={[styles.carouselItem, selectedYear === year && styles.carouselItemActive]}
                                    onPress={() => setSelectedYear(year)}
                                >
                                    <Text style={[styles.carouselText, selectedYear === year && styles.carouselTextActive]}>{year}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                        
                        <ScrollView 
                            horizontal 
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.carouselScroll}
                            style={{ marginTop: spacing.xs }}
                        >
                            <TouchableOpacity 
                                style={[styles.carouselItem, selectedMonth === null && styles.carouselItemActive]}
                                onPress={() => setSelectedMonth(null)}
                            >
                                <Text style={[styles.carouselText, selectedMonth === null && styles.carouselTextActive]}>Todos</Text>
                            </TouchableOpacity>
                            {MONTHS.map((month, idx) => (
                                <TouchableOpacity 
                                    key={month} 
                                    style={[styles.carouselItem, selectedMonth === idx && styles.carouselItemActive]}
                                    onPress={() => setSelectedMonth(idx)}
                                >
                                    <Text style={[styles.carouselText, selectedMonth === idx && styles.carouselTextActive]}>{month}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}

                {!orgId ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="business-outline" size={64} color={colors.textTertiary} />
                        <Text style={styles.emptyText}>Por favor, selecciona una organización en la pestaña de Inicio para ver sus torneos.</Text>
                        <TouchableOpacity 
                            style={styles.backToHomeButton}
                            onPress={() => router.replace('/(tabs)' as any)}
                        >
                            <Text style={styles.backToHomeText}>Ir a Inicio</Text>
                        </TouchableOpacity>
                    </View>
                ) : loading ? (
                    <ActivityIndicator size="large" color={colors.primary[500]} style={{ marginTop: 40 }} />
                ) : (
                    <View style={styles.tournamentList}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Torneos {activeFilter}</Text>
                            <Text style={styles.resultsCount}>{filteredTournaments.length} resultados</Text>
                        </View>
                        {filteredTournaments.map((tournament) => (
                            <TouchableOpacity 
                                key={tournament.id} 
                                style={styles.tournamentCard}
                                onPress={() => {
                                    if (canManage) {
                                        router.push({
                                            pathname: '/(admin)/tournaments/[id]',
                                            params: { id: tournament.id }
                                        });
                                    } else {
                                        router.push(`/(tabs)/tournaments/${tournament.id}`);
                                    }
                                }}
                            >
                                <View style={styles.cardHeader}>
                                    <View style={styles.typeBadge}>
                                        <Text style={styles.typeText}>{SURFACE_MAP[tournament.surface]?.toUpperCase() || tournament.surface.toUpperCase()}</Text>
                                    </View>
                                    <View style={[styles.statusBadge, { 
                                        backgroundColor: tournament.status === 'open' ? colors.success + '1A' : colors.surfaceSecondary 
                                    }]}>
                                        <Text style={[styles.statusText, { 
                                            color: tournament.status === 'open' ? colors.success : colors.textSecondary 
                                        }]}>
                                            {STATUS_DISPLAY[tournament.status] || tournament.status.toUpperCase()}
                                        </Text>
                                    </View>
                                </View>
                                <View style={styles.cardBody}>
                                    <View style={styles.iconContainer}>
                                        <Ionicons name="trophy-outline" size={24} color={colors.primary[500]} />
                                    </View>
                                    <View style={styles.tournamentInfo}>
                                        <Text style={styles.tournamentName} numberOfLines={1} ellipsizeMode="tail">{tournament.name}</Text>
                                        <View style={styles.metaRow}>
                                            <View style={styles.metaItem}>
                                                <Ionicons name="calendar-outline" size={12} color={colors.textTertiary} />
                                                <Text style={styles.metaText} numberOfLines={1}>{new Date(tournament.start_date).toLocaleDateString('es-ES')}</Text>
                                            </View>
                                            <View style={styles.metaItem}>
                                                <Ionicons name="ribbon-outline" size={12} color={colors.textTertiary} />
                                                <Text style={styles.metaText}>{tournament.format}</Text>
                                            </View>
                                            <View style={styles.metaItem}>
                                                <Ionicons name="cash-outline" size={12} color={colors.primary[500]} />
                                                <Text style={[styles.metaText, { color: colors.primary[500], fontWeight: '700' }]}>
                                                    ${tournament.registration_fee || 0}
                                                </Text>
                                            </View>
                                            {(tournament.address || tournament.comuna) && (
                                                <View style={styles.metaItem}>
                                                    <Ionicons name="location-outline" size={12} color={colors.textTertiary} />
                                                    <Text style={styles.metaText} numberOfLines={1}>
                                                        {tournament.address}{tournament.address && tournament.comuna ? ', ' : ''}{tournament.comuna}
                                                    </Text>
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                </View>
                                <View style={styles.cardFooter}>
                                    <View style={styles.detailsButton}>
                                        <Text style={styles.detailsButtonText}>Ver detalles e inscribirse</Text>
                                        <Ionicons name="chevron-forward" size={16} color={colors.primary[500]} />
                                    </View>
                                </View>
                            </TouchableOpacity>
                        ))}

                        {filteredTournaments.length === 0 && (
                            <View style={styles.emptyState}>
                                <Ionicons name="tennisball-outline" size={64} color={colors.textTertiary} />
                                <Text style={styles.emptyText}>
                                    {tournaments.length === 0 
                                        ? "No hay torneos disponibles para este club en este momento."
                                        : `No hay torneos "${activeFilter.toLowerCase()}" en este momento.`
                                    }
                                </Text>
                            </View>
                        )}
                    </View>
                )}
            </ScrollView>

            <Modal visible={isNotificationsVisible} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Notificaciones</Text>
                            <TouchableOpacity onPress={() => setIsNotificationsVisible(false)}>
                                <Ionicons name="close" size={22} color={colors.text} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            {notifications.length > 0 ? notifications.map((item) => (
                                <View key={item.id} style={styles.notificationRow}>
                                    <Text style={styles.notificationTitle}>{item.title}</Text>
                                    <Text style={styles.notificationBody}>{item.body}</Text>
                                </View>
                            )) : (
                                <Text style={styles.notificationEmpty}>No hay notificaciones por ahora.</Text>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const getStyles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        backgroundColor: colors.background,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    headerContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.xl,
        paddingBottom: spacing.md,
        height: 60,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: colors.text,
        maxWidth: '70%',
    },
    iconButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollContent: {
        padding: spacing.xl,
        paddingBottom: 120, // Extra space for FAB and navigation
    },
    actionsGrid: {
        gap: spacing.md,
        marginBottom: spacing.xl,
    },
    actionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.xl,
        borderRadius: borderRadius['2xl'],
        gap: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border,
    },
    actionTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: '#fff',
    },
    actionSubtitle: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.7)',
        marginTop: 2,
    },
    filterSection: {
        marginBottom: spacing['2xl'],
        gap: spacing.md,
    },
    filterContainer: {
        flexDirection: 'row',
        gap: spacing.xs,
        justifyContent: 'space-between',
    },
    filterButton: {
        flex: 1,
        backgroundColor: colors.surface,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    filterButtonActive: {
        backgroundColor: colors.primary[500],
        borderColor: colors.primary[500],
    },
    filterButtonText: {
        color: colors.textSecondary,
        fontSize: 12,
        fontWeight: '700',
    },
    filterButtonTextActive: {
        color: '#fff',
    },
    carouselContainer: {
        marginBottom: spacing.lg,
        gap: spacing.sm,
    },
    carouselScroll: {
        paddingRight: spacing.xl,
        gap: spacing.xs,
    },
    carouselItem: {
        paddingHorizontal: spacing.md,
        paddingVertical: 8,
        borderRadius: borderRadius.lg,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        minWidth: 70,
        alignItems: 'center',
    },
    carouselItemActive: {
        backgroundColor: colors.primary[500] + '20',
        borderColor: colors.primary[500],
    },
    carouselText: {
        fontSize: 13,
        fontWeight: '700',
        color: colors.textSecondary,
    },
    carouselTextActive: {
        color: colors.primary[500],
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    sectionTitle: {
        fontSize: 22,
        fontWeight: '900',
        color: colors.text,
    },
    resultsCount: {
        fontSize: 12,
        color: colors.textTertiary,
        fontWeight: '600',
    },
    tournamentList: {
        gap: spacing.lg,
    },
    tournamentCard: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius['2xl'],
        padding: spacing.xl,
        borderWidth: 1,
        borderColor: colors.border,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: spacing.md,
    },
    typeBadge: {
        backgroundColor: colors.surfaceSecondary,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    typeText: {
        fontSize: 10,
        fontWeight: '900',
        color: colors.textSecondary,
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: borderRadius.full,
    },
    statusText: {
        fontSize: 9,
        fontWeight: '900',
    },
    cardBody: {
        flexDirection: 'row',
        gap: spacing.md,
        alignItems: 'center',
        minWidth: 0,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: borderRadius.xl,
        backgroundColor: colors.surfaceSecondary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    tournamentInfo: {
        flex: 1,
        minWidth: 0,
    },
    tournamentName: {
        fontSize: 18,
        fontWeight: '800',
        color: colors.text,
        marginBottom: 4,
    },
    metaRow: {
        flexDirection: 'column',
        alignItems: 'flex-start',
        flexWrap: 'nowrap',
        minWidth: 0,
        gap: 4,
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        flexShrink: 1,
        minWidth: 0,
    },
    metaText: {
        fontSize: 12,
        color: colors.textTertiary,
        fontWeight: '500',
        flexShrink: 1,
    },
    metaDivider: {
        color: colors.textTertiary,
        marginHorizontal: 6,
        opacity: 0.5,
    },
    cardFooter: {
        marginTop: spacing.xl,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingTop: spacing.md,
        alignItems: 'flex-end',
    },
    detailsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    detailsButtonText: {
        color: colors.primary[500],
        fontSize: 14,
        fontWeight: '700',
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        color: colors.textTertiary,
        fontSize: 14,
        textAlign: 'center',
        marginTop: spacing.md,
    },
    backToHomeButton: {
        marginTop: spacing.xl,
        backgroundColor: colors.surfaceSecondary,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.border,
    },
    backToHomeText: {
        color: colors.primary[500],
        fontWeight: '700',
        fontSize: 14,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        padding: spacing.xl,
    },
    modalCard: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
        maxHeight: '70%',
        borderWidth: 1,
        borderColor: colors.border,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    modalTitle: {
        color: colors.text,
        fontSize: 18,
        fontWeight: '700',
    },
    notificationRow: {
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        gap: spacing.xs,
    },
    notificationTitle: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '700',
    },
    notificationBody: {
        color: colors.textSecondary,
        fontSize: 13,
        lineHeight: 18,
    },
    notificationEmpty: {
        color: colors.textSecondary,
        textAlign: 'center',
        paddingVertical: spacing.xl,
    },
    fab: {
        position: 'absolute',
        right: spacing.xl,
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: colors.primary[500],
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: colors.primary[500],
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
        elevation: 8,
    }
});

