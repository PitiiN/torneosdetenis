import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Dimensions, Image, Modal, Alert, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, borderRadius } from '@/theme';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/services/supabase';
import * as SecureStore from 'expo-secure-store';
import { getCurrentUserAccessContext } from '@/services/accessControl';
import { TennisSpinner } from '@/components/TennisSpinner';
import { resolveChampionFromMatches } from '@/services/tournamentChampion';
import { getCachedValue, setCachedValue } from '@/services/runtimeCache';
import { getEffectiveTournamentStatus, normalizeTournamentStatus } from '@/services/tournamentStatus';
import { formatDateDDMMYYYY } from '@/utils/datetime';

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
    end_date?: string | null;
    organization_id?: string;
    registration_fee?: number;
    address?: string;
    comuna?: string;
    modality?: 'singles' | 'dobles' | string | null;
    is_tournament_master?: boolean;
    parent_tournament_id?: string | null;
    registration_close_at?: string | null;
    registration_close_time?: string | null;
}

type OrganizationInfo = {
    name: string;
    contact_email: string | null;
    contact_whatsapp: string | null;
    social_links: string | null;
    photos_drive_url: string | null;
};

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
    'in_progress': 'EN PROGRESO',
    'finished': 'FINALIZADO',
    'pending': 'PENDIENTE',
    'draft': 'BORRADOR',
    'cancelled': 'CANCELADO'
};

const decodeEscapedUnicode = (value: unknown) =>
    String(value ?? '').replace(/\\u([0-9a-fA-F]{4})/g, (_match, hex) =>
        String.fromCharCode(parseInt(hex, 16))
    );

const formatRegistrationDeadline = (dateValue?: string | null, timeValue?: string | null) => {
    if (!dateValue) return null;
    const dateLabel = formatDateDDMMYYYY(dateValue);
    const timeLabel = String(timeValue || '').slice(0, 5) || '23:59';
    return `${dateLabel} ${timeLabel}`;
};

const getTournamentReferenceDate = (tournament: Tournament) => {
    const rawDate = String(tournament.end_date || tournament.start_date || '').trim();
    if (!rawDate) return null;
    const parsedDate = new Date(`${rawDate}T00:00:00`);
    if (Number.isNaN(parsedDate.getTime())) return null;
    return parsedDate;
};

const getEffectiveStatus = (tournament: Tournament) =>
    getEffectiveTournamentStatus({
        status: tournament.status,
        startDate: tournament.start_date,
        endDate: tournament.end_date || null
    });

function ChampionName({ tournament }: { tournament: Tournament }) {
    const [resolvedName, setResolvedName] = useState<string | null>(null);
    const tagManager = (tournament.description || '').match(/\[CHAMPION:(.+?)\]/)?.[1];

    useEffect(() => {
        if (tagManager || (tournament.status !== 'finished' && normalizeTournamentStatus(tournament.status) !== 'finished')) return;

        const resolve = async () => {
            try {
                const [matchesRes, participantsRes] = await Promise.all([
                    supabase.from('matches').select('*').eq('tournament_id', tournament.id),
                    supabase.from('tournament_participants').select('player_id, profiles(name)').eq('tournament_id', tournament.id)
                ]);

                if (matchesRes.data) {
                    const name = resolveChampionFromMatches(matchesRes.data, participantsRes.data || [], tournament.description);
                    if (name) setResolvedName(name);
                }
            } catch (e) {
                console.error('Error resolving champion:', e);
            }
        };
        resolve();
    }, [tournament.id, tournament.status, tournament.description, tagManager]);

    const displayName = tagManager || resolvedName || 'Finalizado';

    return (
        <Text style={{ fontSize: 14, color: '#333', fontWeight: '800' }}>
            {displayName}
        </Text>
    );
}

export default function TorneosScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { colors } = useTheme();
    const styles = getStyles(colors);
    const { orgId } = useLocalSearchParams<{ orgId: string }>();
    const routeOrgId = Array.isArray(orgId) ? orgId[0] : orgId;
    const normalizedRouteOrgId =
        routeOrgId && routeOrgId !== 'undefined' && routeOrgId !== 'null'
            ? routeOrgId
            : null;
    
    const [activeFilter, setActiveFilter] = useState('Pr\u00F3ximos');
    const [role, setRole] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const [registeredTournamentIds, setRegisteredTournamentIds] = useState<Set<string>>(new Set());
    const [orgName, setOrgName] = useState<string>('Torneos');
    const [organizationInfo, setOrganizationInfo] = useState<OrganizationInfo | null>(null);

    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
    const [userOrgId, setUserOrgId] = useState<string | null>(null);
    const [activeOrgId, setActiveOrgId] = useState<string | null>(normalizedRouteOrgId || null);
    const [notifications, setNotifications] = useState<Array<{ id: string; title: string; body: string }>>([]);
    const [isNotificationsVisible, setIsNotificationsVisible] = useState(false);

    const filters = ['Pr\u00F3ximos', 'En Curso', 'Finalizados'];

    useFocusEffect(
        useCallback(() => {
            bootstrapScreen();
        }, [normalizedRouteOrgId])
    );

    async function bootstrapScreen() {
        setOrgName('');
        setTournaments([]);
        setOrganizationInfo(null);
        const access = await fetchUserData();
        if (!access) {
            setActiveOrgId(normalizedRouteOrgId || null);
            setTournaments([]);
            setRegisteredTournamentIds(new Set());
            setOrgName('Torneos');
            setOrganizationInfo(null);
            return;
        }

        const storedOrgId = await SecureStore.getItemAsync('selected_org_id');
        let nextOrgId: string | null = null;

        if (access.isSuperAdmin) {
            nextOrgId = normalizedRouteOrgId || storedOrgId || null;
        } else {
            nextOrgId = normalizedRouteOrgId || storedOrgId || access.profile.org_id || null;
        }

        if (!nextOrgId && access.isSuperAdmin) {
            const { data: privateOrganizations } = await supabase
                .from('organizations')
                .select('id')
                .order('created_at', { ascending: true })
                .limit(1);

            nextOrgId = privateOrganizations?.[0]?.id || null;

            if (!nextOrgId) {
                const { data: publicOrganizations } = await supabase
                    .from('organizations_public')
                    .select('id')
                    .order('created_at', { ascending: true })
                    .limit(1);
                nextOrgId = publicOrganizations?.[0]?.id || null;
            }
        }

        if (!nextOrgId) {
            const { data: publishedMasterTournament } = await supabase
                .from('tournaments')
                .select('organization_id')
                .is('parent_tournament_id', null)
                .in('status', ['open', 'ongoing', 'in_progress'])
                .order('start_date', { ascending: false })
                .limit(1)
                .maybeSingle();

            nextOrgId = publishedMasterTournament?.organization_id || null;
        }

        if (nextOrgId) {
            await SecureStore.setItemAsync('selected_org_id', String(nextOrgId));
        }

        setActiveOrgId(nextOrgId);

        if (!nextOrgId) {
            setTournaments([]);
            setRegisteredTournamentIds(new Set());
            setOrgName('Torneos');
            setOrganizationInfo(null);
            return;
        }

        const hasAdminRole = access.profile.role === 'admin' || access.profile.role === 'organizer';
        const canManageOrg = access.isSuperAdmin || Boolean(
            hasAdminRole &&
            access.profile.org_id &&
            access.profile.org_id === nextOrgId
        );

        await fetchOrgDetails(nextOrgId);
        await fetchTournaments(nextOrgId, canManageOrg);
        await fetchRegistrations(access.session.user.id, nextOrgId);
        await fetchNotifications(access.session.user.id, nextOrgId);
    }

    async function fetchOrgDetails(targetOrgId: string) {
        const orgCacheKey = `org:details:${targetOrgId}`;
        const cachedInfo = getCachedValue<OrganizationInfo>(orgCacheKey);
        if (cachedInfo) {
            const normalizedOrgName = cachedInfo.name || 'Torneos';
            setOrgName(normalizedOrgName);
            setOrganizationInfo(cachedInfo);
            await SecureStore.setItemAsync('selected_org_id', String(targetOrgId));
            await SecureStore.setItemAsync('selected_org_name', normalizedOrgName || '');
            return;
        }

        let info: OrganizationInfo | null = null;

        const { data: organizationData } = await supabase
            .from('organizations')
            .select('name, contact_email, contact_whatsapp, social_links, photos_drive_url')
            .eq('id', targetOrgId)
            .maybeSingle();

        if (organizationData) {
            info = {
                name: decodeEscapedUnicode(organizationData.name || ''),
                contact_email: decodeEscapedUnicode(organizationData.contact_email || '') || null,
                contact_whatsapp: decodeEscapedUnicode(organizationData.contact_whatsapp || '') || null,
                social_links: decodeEscapedUnicode(organizationData.social_links || '') || null,
                photos_drive_url: decodeEscapedUnicode(organizationData.photos_drive_url || '') || null,
            };
        } else {
            const { data: publicDataWithContact, error: publicDataWithContactError } = await supabase
                .from('organizations_public')
                .select('name, contact_email, contact_whatsapp, social_links, photos_drive_url')
                .eq('id', targetOrgId)
                .single();

            const publicData = publicDataWithContactError
                ? (await supabase
                    .from('organizations_public')
                    .select('name')
                    .eq('id', targetOrgId)
                    .single()).data
                : publicDataWithContact;

            if (publicData) {
                info = {
                    name: decodeEscapedUnicode(publicData.name || ''),
                    contact_email: decodeEscapedUnicode((publicData as any).contact_email || '') || null,
                    contact_whatsapp: decodeEscapedUnicode((publicData as any).contact_whatsapp || '') || null,
                    social_links: decodeEscapedUnicode((publicData as any).social_links || '') || null,
                    photos_drive_url: decodeEscapedUnicode((publicData as any).photos_drive_url || '') || null,
                };
            }
        }

        if (!info) return;

        const normalizedOrgName = info.name || 'Torneos';
        setOrgName(normalizedOrgName);
        setOrganizationInfo(info);
        setCachedValue(orgCacheKey, info, 60_000);
        await SecureStore.setItemAsync('selected_org_id', String(targetOrgId));
        await SecureStore.setItemAsync('selected_org_name', normalizedOrgName || '');
    }
    async function fetchUserData() {
        const access = await getCurrentUserAccessContext();
        if (!access) return null;

        setRole(access.profile.role || 'player');
        setUserOrgId(access.profile.org_id || null);
        setIsSuperAdmin(access.isSuperAdmin);
        return access;
    }
    async function fetchNotifications(currentUserId: string, targetOrgId: string) {
        try {
            const items: Array<{ id: string; title: string; body: string }> = [];

            const { data: publishedTournaments } = await supabase
                .from('tournaments')
                .select('id, name')
                .eq('organization_id', targetOrgId)
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

            const { data: requestUpdates } = await supabase
                .from('tournament_registration_requests')
                .select('id, tournament_id, status, rejection_reason, updated_at')
                .eq('player_id', currentUserId)
                .in('status', ['approved', 'rejected'])
                .order('updated_at', { ascending: false })
                .limit(8);

            const requestTournamentIds = [...new Set(
                (requestUpdates || [])
                    .map((request: any) => String(request?.tournament_id || ''))
                    .filter(Boolean)
            )];

            let requestTournamentNameById: Record<string, string> = {};
            if (requestTournamentIds.length > 0) {
                const { data: requestTournaments } = await supabase
                    .from('tournaments')
                    .select('id, name, organization_id')
                    .in('id', requestTournamentIds);

                requestTournamentNameById = (requestTournaments || [])
                    .filter((tournament: any) => tournament.organization_id === targetOrgId)
                    .reduce((acc: Record<string, string>, tournament: any) => {
                        acc[tournament.id] = decodeEscapedUnicode(tournament.name || 'Torneo');
                        return acc;
                    }, {});
            }

            (requestUpdates || []).forEach((request: any) => {
                const tournamentName = requestTournamentNameById[request.tournament_id];
                if (!tournamentName) return;

                if (request.status === 'approved') {
                    items.push({
                        id: `req-ok-${request.id}`,
                        title: 'Inscripcion aprobada',
                        body: `Tu comprobante de ${tournamentName} fue aprobado.`,
                    });
                    return;
                }

                items.push({
                    id: `req-no-${request.id}`,
                    title: 'Inscripcion rechazada',
                    body: `Tu comprobante de ${tournamentName} fue rechazado: ${request.rejection_reason || 'sin motivo indicado'}.`,
                });
            });

            setNotifications(items);
        } catch (error) {
            setNotifications([]);
        }
    }

    async function fetchRegistrations(currentUserId: string, targetOrgId: string) {
        try {
            const registrationCacheKey = `registrations:${currentUserId}:${targetOrgId}`;
            const cachedRegistrationIds = getCachedValue<string[]>(registrationCacheKey);
            if (cachedRegistrationIds) {
                setRegisteredTournamentIds(new Set(cachedRegistrationIds));
            }

            const { data: registrations, error } = await supabase
                .from('registrations')
                .select('tournament_id')
                .eq('player_id', currentUserId);

            if (error) throw error;

            const registrationTournamentIds = [...new Set(
                (registrations || [])
                    .map((row: any) => String(row?.tournament_id || ''))
                    .filter(Boolean)
            )];

            if (registrationTournamentIds.length === 0) {
                setRegisteredTournamentIds(new Set());
                return;
            }

            const { data: tournamentsInOrg, error: tournamentsError } = await supabase
                .from('tournaments')
                .select('id')
                .eq('organization_id', targetOrgId)
                .in('id', registrationTournamentIds);

            if (tournamentsError) throw tournamentsError;

            const nextIds = new Set<string>();
            (tournamentsInOrg || []).forEach((tournamentRow: any) => {
                const tournamentId = String(tournamentRow?.id || '');
                if (tournamentId) {
                    nextIds.add(tournamentId);
                }
            });
            setRegisteredTournamentIds(nextIds);
            setCachedValue(registrationCacheKey, [...nextIds], 60_000);
        } catch (error) {
            setRegisteredTournamentIds(new Set());
        }
    }
    async function fetchTournaments(targetOrgId: string, canManageOrg: boolean) {
        setLoading(true);
        try {
            const tournamentsCacheKey = `tournaments:${targetOrgId}:${canManageOrg ? 'manage' : 'player'}`;
            const cachedTournaments = getCachedValue<Tournament[]>(tournamentsCacheKey);
            if (cachedTournaments) {
                setTournaments(cachedTournaments);
                setLoading(false);
            }

            let query = supabase
                .from('tournaments')
                .select('id, name, description, status, surface, format, start_date, end_date, organization_id, registration_fee, address, comuna, modality, is_tournament_master, parent_tournament_id, registration_close_at, registration_close_time')
                .eq('organization_id', targetOrgId)
                .is('parent_tournament_id', null)
                .order('start_date', { ascending: false });

            if (!canManageOrg) {
                query = query.in('status', ['open', 'ongoing', 'in_progress', 'completed', 'finalized', 'finished']);
            }
            
            const { data, error } = await query;
            if (error) throw error;
            setTournaments(
                (data || []).map((tournament: any) => ({
                    ...tournament,
                    status: getEffectiveTournamentStatus({
                        status: normalizeTournamentStatus(tournament.status),
                        startDate: tournament.start_date,
                        endDate: tournament.end_date || null
                    }),
                    name: decodeEscapedUnicode(tournament.name || ''),
                    description: decodeEscapedUnicode(tournament.description || ''),
                    format: decodeEscapedUnicode(tournament.format || ''),
                    surface: decodeEscapedUnicode(tournament.surface || ''),
                    address: decodeEscapedUnicode(tournament.address || ''),
                    comuna: decodeEscapedUnicode(tournament.comuna || ''),
                }))
            );
            setCachedValue(
                tournamentsCacheKey,
                (data || []).map((tournament: any) => ({
                    ...tournament,
                    status: getEffectiveTournamentStatus({
                        status: normalizeTournamentStatus(tournament.status),
                        startDate: tournament.start_date,
                        endDate: tournament.end_date || null
                    }),
                    name: decodeEscapedUnicode(tournament.name || ''),
                    description: decodeEscapedUnicode(tournament.description || ''),
                    format: decodeEscapedUnicode(tournament.format || ''),
                    surface: decodeEscapedUnicode(tournament.surface || ''),
                    address: decodeEscapedUnicode(tournament.address || ''),
                    comuna: decodeEscapedUnicode(tournament.comuna || ''),
                })),
                60_000
            );
        } catch (error) {
        } finally {
            setLoading(false);
        }
    }

    const handleDeleteMasterTournament = (tournamentId: string, tournamentName: string) => {
        Alert.alert(
            'Confirmar eliminación',
            `Vas a eliminar el torneo completo "${tournamentName}". Esto eliminará también todos sus campeonatos, cuadros, partidos e inscripciones asociadas.`,
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Continuar',
                    style: 'destructive',
                    onPress: () => {
                        Alert.alert(
                            'Confirmación final',
                            'Esta acción es irreversible. ¿Deseas eliminar definitivamente este torneo completo y todos sus torneos hijos?',
                            [
                                { text: 'Cancelar', style: 'cancel' },
                                {
                                    text: 'Eliminar todo',
                                    style: 'destructive',
                                    onPress: async () => {
                                        try {
                                            const { error } = await supabase
                                                .from('tournaments')
                                                .delete()
                                                .eq('id', tournamentId);

                                            if (error) throw error;
                                            await bootstrapScreen();
                                        } catch (error) {
                                            Alert.alert('Error', 'No se pudo eliminar el torneo completo.');
                                        }
                                    }
                                }
                            ]
                        );
                    }
                }
            ]
        );
    };

    const canManage = isSuperAdmin || ((role === 'admin' || role === 'organizer') && userOrgId === activeOrgId);
    const hasOrganizationInfoDetails = Boolean(
        organizationInfo?.contact_email ||
        organizationInfo?.contact_whatsapp ||
        organizationInfo?.social_links ||
        organizationInfo?.photos_drive_url
    );
    const shouldShowOrganizationInfo = Boolean(activeOrgId && organizationInfo);

    const visibleFinalizedTournaments = tournaments.filter((tournament) => {
        const normalizedStatus = getEffectiveStatus(tournament);
        const isVisibleToPlayer = ['open', 'in_progress', 'finished'].includes(normalizedStatus);
        if (!canManage && !isVisibleToPlayer) return false;
        return normalizedStatus === 'finished';
    });

    const hasSelectedPeriodFinalizedTournaments = visibleFinalizedTournaments.some((tournament) => {
        const referenceDate = getTournamentReferenceDate(tournament);
        if (!referenceDate) return false;
        return referenceDate.getFullYear() === selectedYear && referenceDate.getMonth() === selectedMonth;
    });

    const filteredTournaments = tournaments.filter(t => {
        // Determine if tournament should be visible based on role and filter
        const normalizedStatus = getEffectiveStatus(t);
        const isVisibleToPlayer = ['open', 'in_progress', 'finished'].includes(normalizedStatus);
        
        // If not admin and not a visible status, hide
        if (!canManage && !isVisibleToPlayer) return false;

        if (activeFilter === 'Pr\u00F3ximos') {
            if (canManage) {
                return normalizedStatus === 'open' || normalizedStatus === 'pending' || normalizedStatus === 'draft';
            }
            return normalizedStatus === 'open' || normalizedStatus === 'pending';
        }
        if (activeFilter === 'En Curso') return normalizedStatus === 'in_progress';
        if (activeFilter === 'Finalizados') {
            const isFinalized = normalizedStatus === 'finished';
            if (!isFinalized) return false;

            const referenceDate = getTournamentReferenceDate(t);
            if (!referenceDate) return true;
            if (!hasSelectedPeriodFinalizedTournaments) return true;
            return referenceDate.getFullYear() === selectedYear && referenceDate.getMonth() === selectedMonth;
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
                {shouldShowOrganizationInfo && organizationInfo && (
                    <View style={styles.organizationInfoCard}>
                        <Text style={styles.organizationInfoTitle}>Información de la organización</Text>
                        <View style={styles.organizationInfoRow}>
                            <Ionicons name="business-outline" size={14} color={colors.textSecondary} />
                            <Text style={styles.organizationInfoText}>{organizationInfo.name || orgName || 'Organización'}</Text>
                        </View>
                        
                        {(organizationInfo.contact_whatsapp || organizationInfo.social_links || organizationInfo.photos_drive_url) && (
                            <View style={styles.orgButtonsContainer}>
                                {organizationInfo.contact_whatsapp && (
                                    <TouchableOpacity 
                                        style={[styles.orgButton, { backgroundColor: '#25D366' }]} 
                                        onPress={() => {
                                            const cleanNumber = organizationInfo.contact_whatsapp?.replace(/\D/g, '');
                                            Linking.openURL(`https://wa.me/${cleanNumber}`);
                                        }}
                                    >
                                        <Ionicons name="logo-whatsapp" size={18} color="#fff" />
                                        <Text style={styles.orgButtonText}>WhatsApp</Text>
                                    </TouchableOpacity>
                                )}
                                {organizationInfo.social_links && (
                                    <TouchableOpacity 
                                        style={[styles.orgButton, { backgroundColor: '#E4405F' }]} 
                                        onPress={() => {
                                            let url = organizationInfo.social_links?.trim() || '';
                                            if (url.startsWith('@')) {
                                                url = `https://instagram.com/${url.slice(1)}`;
                                            } else if (!url.startsWith('http')) {
                                                url = `https://instagram.com/${url}`;
                                            }
                                            Linking.openURL(url);
                                        }}
                                    >
                                        <Ionicons name="logo-instagram" size={18} color="#fff" />
                                        <Text style={styles.orgButtonText}>Instagram</Text>
                                    </TouchableOpacity>
                                )}
                                {organizationInfo.photos_drive_url && (
                                    <TouchableOpacity 
                                        style={[styles.orgButton, { backgroundColor: '#4285F4' }]} 
                                        onPress={() => Linking.openURL(organizationInfo.photos_drive_url!)}
                                    >
                                        <Ionicons name="images-outline" size={18} color="#fff" />
                                        <Text style={styles.orgButtonText}>Fotos</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}

                        {!hasOrganizationInfoDetails && (
                            <Text style={styles.organizationInfoText}>
                                Esta organización aún no ha publicado información de contacto.
                            </Text>
                        )}
                    </View>
                )}

                {canManage && (
                    <View style={styles.actionsGrid}>
                        <TouchableOpacity 
                            style={[styles.actionCard, { backgroundColor: colors.primary[500] }]}
                            onPress={() => router.push({
                                pathname: '/(admin)/tournaments/create',
                                params: { orgId: activeOrgId || '' }
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

                {!activeOrgId ? (
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
                    <View style={styles.loadingState}>
                        <TennisSpinner size={36} />
                    </View>
                ) : (
                    <View style={styles.tournamentList}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Torneos {activeFilter}</Text>
                            <Text style={styles.resultsCount}>{filteredTournaments.length} resultados</Text>
                        </View>
                        {filteredTournaments.map((tournament) => {
                            const isMasterTournament = Boolean(tournament.is_tournament_master);
                            const isRegistered = !isMasterTournament && registeredTournamentIds.has(tournament.id);
                            return (
                            <TouchableOpacity 
                                key={tournament.id} 
                                style={styles.tournamentCard}
                                onPress={() => {
                                    if (canManage) {
                                        if (isMasterTournament) {
                                            router.push(`/(admin)/tournaments/master/${tournament.id}`);
                                        } else {
                                            router.push({
                                                pathname: '/(admin)/tournaments/[id]',
                                                params: { id: tournament.id }
                                            });
                                        }
                                    } else {
                                        if (isMasterTournament) {
                                            router.push(`/(tabs)/tournaments/master/${tournament.id}`);
                                        } else {
                                            router.push(`/(tabs)/tournaments/${tournament.id}`);
                                        }
                                    }
                                }}
                            >
                                <View style={styles.cardHeader}>
                                    <View style={styles.typeBadge}>
                                        <Text style={styles.typeText}>{SURFACE_MAP[tournament.surface]?.toUpperCase() || tournament.surface.toUpperCase()}</Text>
                                    </View>
                                    <View style={[styles.statusBadge, {
                                        backgroundColor: getEffectiveStatus(tournament) === 'open'
                                            ? colors.success + '1A'
                                            : colors.surfaceSecondary
                                    }]}>
                                        <Text style={[styles.statusText, {
                                            color: getEffectiveStatus(tournament) === 'open'
                                                ? colors.success
                                                : colors.textSecondary
                                        }]}>
                                            {STATUS_DISPLAY[getEffectiveStatus(tournament)] || tournament.status.toUpperCase()}
                                        </Text>
                                    </View>
                                </View>
                                <View style={styles.cardBody}>
                                    <View style={styles.iconContainer}>
                                        <Ionicons name="trophy-outline" size={24} color={colors.primary[500]} />
                                    </View>
                                    <View style={styles.tournamentInfo}>
                                        <Text 
                                            style={styles.tournamentName} 
                                            numberOfLines={2} 
                                            adjustsFontSizeToFit 
                                            minimumFontScale={0.8}
                                        >
                                            {tournament.name}
                                        </Text>
                                        <View style={styles.metaRow}>
                                            <View style={styles.metaItem}>
                                                <Ionicons name="calendar-outline" size={12} color={colors.textTertiary} />
                                                <Text style={styles.metaText} numberOfLines={1}>
                                                    {`Fecha de inicio: ${formatDateDDMMYYYY(tournament.start_date)}`}
                                                </Text>
                                            </View>
                                            {!isMasterTournament && (
                                                <View style={styles.metaItem}>
                                                    <Ionicons name="ribbon-outline" size={12} color={colors.textTertiary} />
                                                    <Text style={styles.metaText}>{tournament.format}</Text>
                                                </View>
                                            )}
                                            {isMasterTournament && formatRegistrationDeadline(tournament.registration_close_at, tournament.registration_close_time) && (
                                                <View style={styles.metaItem}>
                                                    <Ionicons name="hourglass-outline" size={12} color={colors.textTertiary} />
                                                    <Text style={styles.metaText}>
                                                        {`Cierre inscripciones: ${formatRegistrationDeadline(tournament.registration_close_at, tournament.registration_close_time)}`}
                                                    </Text>
                                                </View>
                                            )}
                                            {!isMasterTournament && (
                                                <View style={styles.metaItem}>
                                                    <Ionicons name="tennisball-outline" size={12} color={colors.textTertiary} />
                                                    <Text style={styles.metaText}>
                                                        {`Modalidad: ${String(tournament.modality || '').toLowerCase() === 'dobles' ? 'Dobles' : 'Singles'}`}
                                                    </Text>
                                                </View>
                                            )}
                                            {!isMasterTournament && (
                                                <View style={styles.metaItem}>
                                                    <Ionicons name="cash-outline" size={12} color={colors.primary[500]} />
                                                    <Text style={[styles.metaText, { color: colors.primary[500], fontWeight: '700' }]}>
                                                        ${tournament.registration_fee || 0}
                                                    </Text>
                                                </View>
                                            )}
                                            {(tournament.address || tournament.comuna) && (
                                                <View style={styles.metaItem}>
                                                    <Ionicons name="location-outline" size={12} color={colors.textTertiary} />
                                                    <Text style={styles.metaText} numberOfLines={1}>
                                                        {tournament.address}{tournament.address && tournament.comuna ? ', ' : ''}{tournament.comuna}
                                                    </Text>
                                                </View>
                                            )}
                                    </View>
                                    {(() => {
                                        const championName = (tournament.description || '').match(/\[CHAMPION:(.+?)\]/)?.[1];
                                        const isFinished = tournament.status === 'finished' || getEffectiveStatus(tournament) === 'finished';
                                        if (!championName && !isFinished) return null;
                                        
                                        return (
                                            <View style={{ 
                                                marginTop: spacing.sm, 
                                                flexDirection: 'row', 
                                                alignItems: 'center', 
                                                backgroundColor: '#FFD70015', 
                                                padding: 8, 
                                                borderRadius: borderRadius.sm, 
                                                borderWidth: 1, 
                                                borderColor: '#FFD70040' 
                                            }}>
                                                <Ionicons name="trophy" size={18} color="#FFD700" style={{ marginRight: 8 }} />
                                                <View style={{ flex: 1 }}>
                                                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textTertiary, marginBottom: 1 }}>
                                                        Campeón
                                                    </Text>
                                                    <ChampionName tournament={tournament} />
                                                </View>
                                            </View>
                                        );
                                    })()}
                                </View>
                            </View>
                                <View style={styles.cardFooter}>
                                    <View style={styles.footerActions}>
                                        <View style={styles.detailsButton}>
                                            <Text style={styles.detailsButtonText}>
                                                {isMasterTournament
                                                    ? 'Ver campeonatos e inscribirse'
                                                    : (isRegistered ? 'Estas inscrito! Ver detalles' : 'Ver detalles e inscribirse')}
                                            </Text>
                                            <Ionicons name="chevron-forward" size={16} color={colors.primary[500]} />
                                        </View>
                                        {canManage && isMasterTournament && (
                                            <View style={styles.adminActions}>
                                                <TouchableOpacity
                                                    style={styles.adminActionButton}
                                                    onPress={() => router.push(`/(admin)/tournaments/edit/${tournament.id}`)}
                                                >
                                                    <Ionicons name="create-outline" size={15} color={colors.textSecondary} />
                                                    <Text style={styles.adminActionText}>Editar</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={[styles.adminActionButton, styles.adminActionDanger]}
                                                    onPress={() => handleDeleteMasterTournament(tournament.id, tournament.name)}
                                                >
                                                    <Ionicons name="trash-outline" size={15} color={colors.error} />
                                                    <Text style={[styles.adminActionText, { color: colors.error }]}>Eliminar</Text>
                                                </TouchableOpacity>
                                            </View>
                                        )}
                                    </View>
                                </View>
                            </TouchableOpacity>
                            );
                        })}

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
    organizationInfoCard: {
        marginBottom: spacing.xl,
        padding: spacing.lg,
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        gap: spacing.sm,
    },
    organizationInfoTitle: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '800',
        marginBottom: 2,
    },
    organizationInfoRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
    },
    organizationInfoText: {
        flex: 1,
        color: colors.textSecondary,
        fontSize: 12,
        fontWeight: '600',
        lineHeight: 17,
    },
    orgButtonsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
        marginTop: spacing.sm,
    },
    orgButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: 8,
        borderRadius: borderRadius.lg,
        gap: 6,
        minWidth: 100,
        justifyContent: 'center',
    },
    orgButtonText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '700',
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
        gap: spacing.sm,
    },
    footerActions: {
        gap: spacing.sm,
        alignItems: 'flex-end',
    },
    detailsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    adminActions: {
        flexDirection: 'row',
        gap: spacing.xs,
    },
    adminActionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 6,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
    },
    adminActionDanger: {
        borderColor: colors.error + '50',
    },
    adminActionText: {
        color: colors.textSecondary,
        fontSize: 11,
        fontWeight: '700',
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
    loadingState: {
        minHeight: 260,
        alignItems: 'center',
        justifyContent: 'center',
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
        alignItems: 'center',
        justifyContent: 'center',
    },
    backToHomeText: {
        color: colors.primary[500],
        fontWeight: '700',
        fontSize: 14,
        textAlign: 'center',
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
