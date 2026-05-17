import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Dimensions, Alert, TextInput, Modal, BackHandler, Platform, RefreshControl, Linking, KeyboardAvoidingView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme, spacing, borderRadius } from '@/theme';
import { supabase } from '@/services/supabase';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { getTournamentPlacements } from '@/services/ranking';
import { adminModeService } from '@/services/adminMode';
import { notificationService } from '@/services/notificationService';
import { resolveStorageAssetUrlWithRetry } from '@/services/storage';
import { getCurrentUserAccessContext } from '@/services/accessControl';
import { TennisSpinner } from '@/components/TennisSpinner';
import { PlayerAchievement, loadPlayerAchievements, loadProfileStatsBundle } from '@/services/playerProfileStats';
import { PlayerProfileModal } from '@/components/players/PlayerProfileModal';

const { width } = Dimensions.get('window');

const formatDate = (dateString?: string) => {
    if (!dateString) return 'Fecha no disponible';
    try {
        const cleanDate = dateString.split('T')[0];
        const parts = cleanDate.split('-');
        if (parts.length === 3) {
            const year = parts[0];
            const month = parts[1];
            const day = parts[2];
            return `${day}/${month}/${year}`;
        }
        
        const d = new Date(dateString);
        if (isNaN(d.getTime())) {
            return dateString;
        }
        
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    } catch (e) {
        return dateString || 'Fecha no disponible';
    }
};

const MONTH_NAMES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function RankingEvolutionChart({
    rankingHistory,
    modality,
    colors,
}: {
    rankingHistory: any[];
    modality: 'singles' | 'dobles';
    colors: any;
}) {
    const validPoints = (rankingHistory || [])
        .map((p) => {
            const rank = modality === 'singles' ? p.singlesRank : p.doblesRank;
            return { month: p.month, rank };
        })
        .filter((p) => p.rank !== null && p.rank !== undefined && p.rank > 0) as { month: number; rank: number }[];

    if (validPoints.length === 0) {
        return (
            <View style={{
                backgroundColor: colors.surface,
                borderRadius: 24,
                padding: 20,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: colors.border,
                minHeight: 140,
                marginTop: 20,
                marginBottom: 10,
            }}>
                <Ionicons name="analytics" size={32} color={colors.textTertiary} />
                <Text style={{
                    color: colors.text,
                    fontSize: 15,
                    fontWeight: '800',
                    textAlign: 'center',
                    marginTop: 8,
                }}>
                    Evolución de Ranking
                </Text>
                


                <Text style={{
                    color: colors.textTertiary,
                    fontSize: 11,
                    textAlign: 'center',
                    marginTop: 8,
                }}>
                    No hay datos de ranking registrados para graficar este año.
                </Text>
            </View>
        );
    }

    const chartHeight = 160;
    const paddingLeft = 40;
    const paddingRight = 20;
    const paddingTop = 20;
    const paddingBottom = 30;

    const ranks = validPoints.map(p => p.rank);
    let minRank = Math.min(...ranks);
    let maxRank = Math.max(...ranks);

    if (minRank === maxRank) {
        minRank = Math.max(1, minRank - 1);
        maxRank = maxRank + 1;
    }

    const getCoordinate = (month: number, rank: number, containerWidth: number) => {
        const x = paddingLeft + (month / 11) * (containerWidth - paddingLeft - paddingRight);
        const y = paddingTop + ((rank - minRank) / (maxRank - minRank)) * (chartHeight - paddingTop - paddingBottom);
        return { x, y };
    };

    const containerWidth = width - 48; // spacing.xl is 24 on each side

    const coords = validPoints.map(p => ({
        ...getCoordinate(p.month, p.rank, containerWidth),
        month: p.month,
        rank: p.rank
    }));

    return (
        <View style={{
            backgroundColor: colors.surface,
            borderRadius: 24,
            padding: 16,
            borderWidth: 1,
            borderColor: colors.border,
            marginTop: 20,
            marginBottom: 10,
            width: '100%',
        }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={{
                    color: colors.text,
                    fontSize: 16,
                    fontWeight: '800',
                }}>
                    {`Evolución de Ranking (${modality === 'singles' ? 'Singles' : 'Dobles'})`}
                </Text>
            </View>



            <View style={{ height: chartHeight, width: '100%', position: 'relative' }}>
                {/* Grid Lines & Y Axis Labels */}
                {Array.from({ length: 4 }).map((_, index) => {
                    const ratio = index / 3;
                    const rankVal = Math.round(minRank + ratio * (maxRank - minRank));
                    const y = paddingTop + ratio * (chartHeight - paddingTop - paddingBottom);
                    return (
                        <React.Fragment key={index}>
                            <Text style={{
                                position: 'absolute',
                                left: 0,
                                top: y - 7,
                                width: paddingLeft - 8,
                                textAlign: 'right',
                                fontSize: 10,
                                fontWeight: '700',
                                color: colors.textTertiary,
                            }}>
                                #{rankVal}
                            </Text>
                            <View style={{
                                position: 'absolute',
                                left: paddingLeft,
                                right: paddingRight,
                                top: y,
                                height: 1,
                                backgroundColor: colors.border,
                                opacity: 0.5,
                            }} />
                        </React.Fragment>
                    );
                })}

                {/* Connecting Lines */}
                {coords.map((curr, idx) => {
                    if (idx === 0) return null;
                    const prev = coords[idx - 1];
                    
                    const dx = curr.x - prev.x;
                    const dy = curr.y - prev.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    const angle = Math.atan2(dy, dx);

                    return (
                        <View
                            key={`line-${idx}`}
                            style={{
                                position: 'absolute',
                                left: prev.x + dx / 2 - distance / 2,
                                top: prev.y + dy / 2,
                                width: distance,
                                height: 3,
                                backgroundColor: colors.primary[500],
                                borderRadius: 1.5,
                                transform: [{ rotate: `${angle}rad` }],
                            }}
                        />
                    );
                })}

                {/* Data Dots */}
                {coords.map((pt, idx) => (
                    <View
                        key={`dot-${idx}`}
                        style={{
                            position: 'absolute',
                            left: pt.x - 5,
                            top: pt.y - 5,
                            width: 10,
                            height: 10,
                            borderRadius: 5,
                            backgroundColor: '#fff',
                            borderWidth: 3,
                            borderColor: colors.primary[500],
                            justifyContent: 'center',
                            alignItems: 'center',
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.15,
                            shadowRadius: 3,
                            elevation: 2,
                        }}
                    >
                        <View style={{
                            position: 'absolute',
                            top: -22,
                            backgroundColor: colors.surfaceSecondary,
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                            borderRadius: 4,
                            borderWidth: 0.5,
                            borderColor: colors.border,
                        }}>
                            <Text style={{ fontSize: 8, fontWeight: '800', color: colors.text }}>
                                #{pt.rank}
                            </Text>
                        </View>
                    </View>
                ))}

                {/* X Axis Labels (Ene - Dic) */}
                {MONTH_NAMES.map((name, index) => {
                    const x = paddingLeft + (index / 11) * (containerWidth - paddingLeft - paddingRight);
                    return (
                        <Text
                            key={`month-label-${index}`}
                            style={{
                                position: 'absolute',
                                left: x - 15,
                                width: 30,
                                top: chartHeight - 20,
                                textAlign: 'center',
                                fontSize: 9,
                                fontWeight: '700',
                                color: colors.textSecondary,
                            }}
                        >
                            {name}
                        </Text>
                    );
                })}
            </View>
        </View>
    );
}
const BACKHAND_FIELD = 'rev\u00E9s';
const VIEW_TOGGLE_BLOCKED_EMAILS = new Set(['javier.aravena25@gmail.com']);
const PRIVACY_POLICY_URL = 'https://pitiin.github.io/torneosdetenis/privacy.html';

const getScoreText = (scoreValue: any): string => {
    if (scoreValue === null || scoreValue === undefined) return '';
    if (typeof scoreValue === 'string') return scoreValue.trim();

    if (typeof scoreValue === 'object') {
        if (scoreValue?.wo) return 'W.O.';
        if (typeof scoreValue?.text === 'string') return scoreValue.text.trim();
        if (typeof scoreValue?.score === 'string') return scoreValue.score.trim();
        if (Array.isArray(scoreValue?.sets)) {
            const setsAsText = scoreValue.sets
                .map((setScore: any) => String(setScore || '').trim())
                .filter(Boolean)
                .join(', ');
            if (setsAsText) return setsAsText;
        }
        return '';
    }

    const fallback = String(scoreValue || '').trim();
    return fallback === '[object Object]' ? '' : fallback;
};

const getAchievementColor = (tone: string) => {
    switch (tone) {
        case 'gold': return '#FFD700';
        case 'silver': return '#C0C0C0';
        case 'bronze': return '#CD7F32';
        case 'special': return '#12b981'; // default primary
        default: return '#888';
    }
};

export default function ProfileScreen() {
    const insets = useSafeAreaInsets();
    const { colors, toggleTheme, isDark } = useTheme();
    const styles = getStyles(colors);
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [updating, setUpdating] = useState(false);
    const [user, setUser] = useState<any>(null);
    const [profileAvatarUrl, setProfileAvatarUrl] = useState<string>('');
    const [stats, setStats] = useState({
        rank: '-',
        trophies: 0,
        wins: 0,
        winRate: '0%',
        totalMatches: 0,
        setsWon: 0,
        setsLost: 0,
        gamesWon: 0,
        gamesLost: 0,
        finalsPlayed: 0,
        currentStreak: 0,
        bestStreak: 0,
        debutYear: '-',
        bestRanking: '-',
        worstRanking: '-',
        mostFacedRivalName: '-',
        mostFacedRivalMatches: 0,
        mostFacedRivalId: null as string | null,
    });
    const [modality, setModality] = useState<'singles' | 'dobles'>('singles');
    const [recentTournaments, setRecentTournaments] = useState<any[]>([]);
    const [achievements, setAchievements] = useState<PlayerAchievement[]>([]);
    const [selectedAchievement, setSelectedAchievement] = useState<PlayerAchievement | null>(null);
    const [rankingHistory, setRankingHistory] = useState<any[]>([]);
    const [availableYears, setAvailableYears] = useState<number[]>([]);
    const [selectedYear, setSelectedYear] = useState<number | null>(null);
    const [showRivalProfile, setShowRivalProfile] = useState(false);

    // Profile Fields
    const [isEditingBackhand, setIsEditingBackhand] = useState(false);
    const [isEditingDominantHand, setIsEditingDominantHand] = useState(false);

    // Filters
    const [userContexts, setUserContexts] = useState<any[]>([]); // { org_id, org_name, level }
    const [selectedContext, setSelectedContext] = useState<any>(null);
    const [showContextModal, setShowContextModal] = useState(false);

    // Super Admin States
    const [isGlobalAdmin, setIsGlobalAdmin] = useState(false);
    const [currentUserEmail, setCurrentUserEmail] = useState('');
    const [viewMode, setViewMode] = useState(adminModeService.getMode());
    const [allOrganizations, setAllOrganizations] = useState<any[]>([]);
    const [orgSearch, setOrgSearch] = useState('');
    const [showOrgSearchModal, setShowOrgSearchModal] = useState(false);
    const [showPrivacyModal, setShowPrivacyModal] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');
    const [updatingPassword, setUpdatingPassword] = useState(false);
    const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
    const [deleteAccountPassword, setDeleteAccountPassword] = useState('');
    const [deletingAccount, setDeletingAccount] = useState(false);

    useEffect(() => {
        const backAction = () => {
            if (showDeleteConfirmModal && !deletingAccount) {
                setShowDeleteConfirmModal(false);
                setDeleteAccountPassword('');
                return true;
            }
            if (showRivalProfile) {
                setShowRivalProfile(false);
                return true;
            }
            if (selectedAchievement) {
                setSelectedAchievement(null);
                return true;
            }
            if (showContextModal) {
                setShowContextModal(false);
                return true;
            }
            if (showOrgSearchModal) {
                setShowOrgSearchModal(false);
                return true;
            }
            if (showPrivacyModal) {
                setShowPrivacyModal(false);
                return true;
            }
            return false;
        };

        const backHandler = BackHandler.addEventListener(
            'hardwareBackPress',
            backAction
        );

        return () => backHandler.remove();
    }, [showContextModal, showOrgSearchModal, showPrivacyModal, showDeleteConfirmModal, deletingAccount, showRivalProfile]);

    useEffect(() => {
        loadProfileData();
    }, []);

    useEffect(() => {
        if (selectedContext) {
            calculateStats();
        }
    }, [selectedContext, user?.id, modality, selectedYear]);

    useEffect(() => {
        const unsubscribe = adminModeService.subscribe((m) => {
            setViewMode(m);
        });
        return unsubscribe;
    }, []);

    useEffect(() => {
        if (user?.id && user.notifications_enabled) {
            notificationService.registerForPushNotifications(user.id);
        }
    }, [user?.id, user?.notifications_enabled]);

    useEffect(() => {
        const fetchAchievements = async () => {
            if (user?.id) {
                try {
                    const data = await loadPlayerAchievements(user.id);
                    setAchievements(data);
                } catch (error) {
                    console.error('Error loading achievements:', error);
                }
            } else {
                setAchievements([]);
            }
        };
        fetchAchievements();
    }, [user?.id]);

    const handleToggleMode = () => {
        const next = viewMode === 'admin' ? 'user' : 'admin';
        adminModeService.setMode(next);
    };

    const loadProfileData = async () => {
        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            const normalizedSessionEmail = String(session.user.email || '').trim().toLowerCase();
            setCurrentUserEmail(normalizedSessionEmail);

            // Fetch Profile
            const { data: profile, error: profErr } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .single();

            if (profErr) throw profErr;
            setUser(profile);
            const signedAvatar = await resolveStorageAssetUrlWithRetry(profile?.avatar_url, { attempts: 4, baseDelayMs: 350 });
            setProfileAvatarUrl(signedAvatar || '');

            const accessContext = await getCurrentUserAccessContext();
            const isGlobal = Boolean(accessContext?.isSuperAdmin);
            setIsGlobalAdmin(isGlobal);

            if (isGlobal) {
                fetchAllOrganizations();
            } else {
                setAllOrganizations([]);
            }

            // Avoid ambiguous registrations->tournaments embeds by loading in two steps.
            const { data: registrationRows, error: registrationError } = await supabase
                .from('registrations')
                .select('tournament_id, registered_at')
                .eq('player_id', session.user.id)
                .order('registered_at', { ascending: false });
            if (registrationError) throw registrationError;

            const tournamentIds = [...new Set(
                (registrationRows || [])
                    .map((row: any) => row?.tournament_id)
                    .filter(Boolean)
            )] as string[];

            if (tournamentIds.length === 0) {
                setUserContexts([]);
                setRecentTournaments([]);
            } else {
                const { data: tournamentsRows, error: tournamentsError } = await supabase
                    .from('tournaments')
                    .select('id, name, organization_id, level, status, end_date, format, start_date, modality')
                    .in('id', tournamentIds);
                if (tournamentsError) throw tournamentsError;

                const tournamentsById = (tournamentsRows || []).reduce((acc: Record<string, any>, tournament: any) => {
                    if (tournament?.id) acc[tournament.id] = tournament;
                    return acc;
                }, {});

                const orgIds = [...new Set(
                    (tournamentsRows || [])
                        .map((tournament: any) => tournament?.organization_id)
                        .filter(Boolean)
                )] as string[];

                const orgNameById: Record<string, string> = {};
                if (orgIds.length > 0) {
                    const { data: orgRows } = await supabase
                        .from('organizations_public')
                        .select('id, name')
                        .in('id', orgIds);

                    (orgRows || []).forEach((orgRow: any) => {
                        orgNameById[orgRow.id] = orgRow.name || 'Organizaci\u00F3n';
                    });
                }

                const uniqueContexts: any[] = [];
                const seen = new Set<string>();
                (tournamentsRows || []).forEach((tournament: any) => {
                    if (!tournament?.organization_id || !tournament?.level) return;
                    const key = `${tournament.organization_id}|${tournament.level}`;
                    if (seen.has(key)) return;
                    seen.add(key);
                    uniqueContexts.push({
                        org_id: tournament.organization_id,
                        org_name: orgNameById[tournament.organization_id] || 'Organizaci\u00F3n',
                        level: tournament.level,
                    });
                });

                setUserContexts(uniqueContexts);
                if (uniqueContexts.length > 0 && !selectedContext) {
                    setSelectedContext(uniqueContexts[0]);
                }

                const recentTournamentIds = [...new Set(
                    (registrationRows || [])
                        .map((row: any) => row?.tournament_id)
                        .filter(Boolean)
                )].slice(0, 3) as string[];

                const recentTournamentsBase = recentTournamentIds
                    .map((tournamentId) => tournamentsById[tournamentId])
                    .filter(Boolean);

                const tourData = await Promise.all(recentTournamentsBase.map(async (tournament: any) => {
                    if (tournament.status === 'completed' || tournament.status === 'finalized' || tournament.status === 'finished') {
                        const { data: tMatches } = await supabase.from('matches').select('*').eq('tournament_id', tournament.id);
                        const placements = getTournamentPlacements(tournament, tMatches || []);
                        const myPlacement = placements.find((placement: any) => placement.playerId === session.user.id || placement.playerId2 === session.user.id);
                        return { ...tournament, place: myPlacement ? `${myPlacement.place}\u00B0 LUGAR` : 'FINALIZADO' };
                    }
                    return { ...tournament, place: 'EN CURSO' };
                }));
                setRecentTournaments(tourData);
            }

        } catch (error) {
            console.error('Error loading profile:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        loadProfileData();
    }, []);

    const fetchAllOrganizations = async () => {
        const { data, error } = await supabase
            .from('organizations')
            .select('id, name')
            .order('name');
        if (data && !error) {
            setAllOrganizations(data);
        }
    };

    const calculateStats = async () => {
        if (!selectedContext || !user) return;

        try {
            const bundle = await loadProfileStatsBundle({
                playerId: user.id,
                context: {
                    org_id: selectedContext.org_id,
                    level: selectedContext.level,
                },
                modality: modality,
                selectedYear: selectedYear,
            });

            setStats({
                rank: bundle.stats.rank,
                trophies: bundle.stats.trophies,
                wins: bundle.stats.wins,
                winRate: bundle.stats.winRate,
                totalMatches: bundle.stats.totalMatches,
                setsWon: bundle.stats.setsWon,
                setsLost: bundle.stats.setsLost,
                gamesWon: bundle.stats.gamesWon,
                gamesLost: bundle.stats.gamesLost,
                finalsPlayed: bundle.stats.finalsPlayed,
                currentStreak: bundle.stats.currentStreak,
                bestStreak: bundle.stats.bestStreak,
                debutYear: bundle.stats.debutYear,
                bestRanking: bundle.stats.bestRanking,
                worstRanking: bundle.stats.worstRanking,
                mostFacedRivalName: bundle.stats.mostFacedRivalName,
                mostFacedRivalMatches: bundle.stats.mostFacedRivalMatches,
                mostFacedRivalId: bundle.stats.mostFacedRivalId,
            });

            setRankingHistory(bundle.rankingHistory || []);
            setAvailableYears(bundle.availableYears || []);
            if (selectedYear === null && bundle.effectiveYear) {
                setSelectedYear(bundle.effectiveYear);
            }
        } catch (error) {
            console.error('Error loading profile stats bundle:', error);
            setStats({
                rank: '-',
                trophies: 0,
                wins: 0,
                winRate: '0%',
                totalMatches: 0,
                setsWon: 0,
                setsLost: 0,
                gamesWon: 0,
                gamesLost: 0,
                finalsPlayed: 0,
                currentStreak: 0,
                bestStreak: 0,
                debutYear: '-',
                bestRanking: '-',
                worstRanking: '-',
                mostFacedRivalName: '-',
                mostFacedRivalMatches: 0,
                mostFacedRivalId: null,
            });
        }
    };

    const handleUpdateLocation = async (newLocation: string) => {
        if (!user) return;
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ location: newLocation })
                .eq('id', user.id);
            if (error) throw error;
            setUser({ ...user, location: newLocation });
        } catch (error) {
            Alert.alert('Error', 'No se pudo actualizar la ubicaci\u00f3n.');
        }
    };

    const handleUpdatePhone = async (newPhone: string) => {
        if (!user) return;
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ phone: newPhone.trim() })
                .eq('id', user.id);
            if (error) throw error;
            setUser({ ...user, phone: newPhone.trim() });
        } catch (error) {
            Alert.alert('Error', 'No se pudo actualizar el tel\u00e9fono.');
        }
    };

    const handleUpdateBackhand = (val: string) => {
        setUser({ ...user, [BACKHAND_FIELD]: val });
    };

    const handleUpdateDominantHand = (val: string) => {
        setUser({ ...user, mano_dominante: val });
    };

    const handleToggleNotifications = async () => {
        if (!user) return;
        const newValue = !user.notifications_enabled;
        if (newValue) {
            Alert.alert(
                'Activar notificaciones',
                'SweetSpot te enviar\u00e1 notificaciones sobre cambios relevantes en tus torneos, partidos y eventos.',
                [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Activar', onPress: () => updateNotificationsPreference(true) },
                ],
            );
            return;
        }

        updateNotificationsPreference(false);
    };

    const updateNotificationsPreference = async (newValue: boolean) => {
        if (!user) return;
        setUpdating(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ notifications_enabled: newValue })
                .eq('id', user.id);
            if (error) throw error;
            
            if (newValue) {
                await notificationService.registerForPushNotifications(user.id);
            }
            
            setUser({ ...user, notifications_enabled: newValue });
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'No se pudo actualizar la configuraci\u00f3n de notificaciones.');
        } finally {
            setUpdating(false);
        }
    };

    const handleOpenPrivacyPolicy = async () => {
        try {
            const canOpen = await Linking.canOpenURL(PRIVACY_POLICY_URL);
            if (!canOpen) {
                Alert.alert('Aviso', 'No se pudo abrir el enlace de privacidad.');
                return;
            }
            await Linking.openURL(PRIVACY_POLICY_URL);
        } catch {
            Alert.alert('Aviso', 'No se pudo abrir el enlace de privacidad.');
        }
    };

    const handleUpdatePassword = async () => {
        const trimmedCurrentPassword = currentPassword.trim();
        const trimmedNewPassword = newPassword.trim();
        const trimmedConfirmPassword = confirmNewPassword.trim();

        if (!trimmedCurrentPassword) {
            Alert.alert('Error', 'Debes ingresar tu contrase\u00f1a actual.');
            return;
        }

        if (!trimmedNewPassword) {
            Alert.alert('Error', 'Debes ingresar una nueva contrase\u00f1a.');
            return;
        }

        if (trimmedNewPassword.length < 8) {
            Alert.alert('Error', 'La nueva contrase\u00f1a debe tener al menos 8 caracteres.');
            return;
        }

        if (trimmedConfirmPassword !== trimmedNewPassword) {
            Alert.alert('Error', 'La confirmaci\u00f3n no coincide con la nueva contrase\u00f1a.');
            return;
        }

        const email = String(currentUserEmail || '').trim().toLowerCase();
        if (!email) {
            Alert.alert('Error', 'No pudimos validar tu correo para cambiar la contrase\u00f1a.');
            return;
        }

        setUpdatingPassword(true);
        try {
            const { error: reauthError } = await supabase.auth.signInWithPassword({
                email,
                password: trimmedCurrentPassword,
            });
            if (reauthError) {
                Alert.alert('Error', 'La contrase\u00f1a actual no es correcta.');
                return;
            }

            const { error: updatePasswordError } = await supabase.auth.updateUser({
                password: trimmedNewPassword,
            });
            if (updatePasswordError) {
                throw updatePasswordError;
            }

            setCurrentPassword('');
            setNewPassword('');
            setConfirmNewPassword('');
            setShowPrivacyModal(false);
            Alert.alert('\u00c9xito', 'Tu contrase\u00f1a se actualiz\u00f3 correctamente.');
        } catch (error: any) {
            Alert.alert('Error', error?.message || 'No se pudo actualizar la contrase\u00f1a.');
        } finally {
            setUpdatingPassword(false);
        }
    };

    const handleDeleteAccount = () => {
        Alert.alert(
            'Eliminar Cuenta',
            '\u00bfEst\u00e1s seguro de que deseas eliminar tu cuenta?\n\nEsta acci\u00f3n es IRREVERSIBLE. Se eliminar\u00e1n todos tus datos, registros en torneos, estad\u00edsticas e historial de partidos de forma permanente.',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Continuar',
                    style: 'destructive',
                    onPress: () => {
                        Alert.alert(
                            '\u00daltima Advertencia',
                            'NO PODR\u00c1S RECUPERAR TU CUENTA.\n\nTodos tus datos ser\u00e1n eliminados permanentemente. Si fuiste campe\u00f3n en alg\u00fan torneo, el t\u00edtulo pasar\u00e1 al otro finalista.\n\n\u00bfDeseas continuar?',
                            [
                                { text: 'Cancelar', style: 'cancel' },
                                {
                                    text: 'S\u00ed, eliminar mi cuenta',
                                    style: 'destructive',
                                    onPress: () => {
                                        setShowDeleteConfirmModal(true);
                                    },
                                },
                            ]
                        );
                    },
                },
            ]
        );
    };

    const executeAccountDeletion = async () => {
        const trimmedPassword = deleteAccountPassword.trim();
        if (!trimmedPassword) {
            Alert.alert('Error', 'Debes ingresar tu contrase\u00f1a para confirmar la eliminaci\u00f3n.');
            return;
        }

        const email = String(currentUserEmail || '').trim().toLowerCase();
        if (!email) {
            Alert.alert('Error', 'No pudimos validar tu correo.');
            return;
        }

        setDeletingAccount(true);
        try {
            // Verify password
            const { error: reauthError } = await supabase.auth.signInWithPassword({
                email,
                password: trimmedPassword,
            });
            if (reauthError) {
                Alert.alert('Contrase\u00f1a Incorrecta', 'La contrase\u00f1a ingresada no es correcta. Int\u00e9ntalo nuevamente.');
                return;
            }

            // Call the RPC to delete the account
            const { error: deleteError } = await supabase.rpc('delete_own_account');
            if (deleteError) {
                throw deleteError;
            }

            // Sign out locally and redirect
            setShowDeleteConfirmModal(false);
            setShowPrivacyModal(false);
            setDeleteAccountPassword('');
            await supabase.auth.signOut();
            router.replace('/(auth)/login');
        } catch (error: any) {
            console.error('Error deleting account:', error);
            Alert.alert('Error', error?.message || 'No se pudo eliminar la cuenta. Int\u00e9ntalo m\u00e1s tarde.');
        } finally {
            setDeletingAccount(false);
        }
    };

    const handleSaveAll = async () => {
        setUpdating(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    name: user.name,
                    phone: user.phone,
                    location: user.location,
                    [BACKHAND_FIELD]: user[BACKHAND_FIELD],
                    mano_dominante: user.mano_dominante
                })
                .eq('id', user.id);
            if (error) throw error;
            Alert.alert('\u00c9xito', 'Cambios guardados correctamente.');
            setIsEditingBackhand(false);
            setIsEditingDominantHand(false);
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'No se pudieron guardar los cambios.');
        } finally {
            setUpdating(false);
        }
    };

    const handlePickImage = async () => {
        launchImagePicker();
    };

    const launchImagePicker = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert(
                'Permiso denegado',
                'SweetSpot necesita acceso a tu galer\u00eda para que puedas seleccionar una foto de perfil.',
            );
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
        });

        if (!result.canceled) {
            uploadAvatar(result.assets[0].uri);
        }
    };

    const uploadAvatar = async (uri: string) => {
        if (!user) return;
        setUpdating(true);
        try {
            const response = await fetch(uri);
            const fileBytes = typeof response.arrayBuffer === 'function'
                ? await response.arrayBuffer()
                : await (await response.blob()).arrayBuffer();
            const fileExt = uri.split('.').pop() || 'png';
            const fileName = `${user.id}-${Date.now()}.${fileExt}`;
            const filePath = `avatars/${user.id}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('organizations')
                .upload(filePath, fileBytes, {
                    contentType: `image/${fileExt}`,
                    upsert: false,
                });

            if (uploadError) throw uploadError;

            const { error: updateError } = await supabase
                .from('profiles')
                .update({ avatar_url: filePath })
                .eq('id', user.id);

            if (updateError) throw updateError;
            const signedAvatar = await resolveStorageAssetUrlWithRetry(filePath, { attempts: 4, baseDelayMs: 350 });
            setProfileAvatarUrl(signedAvatar || '');
            setUser({ ...user, avatar_url: filePath });
            Alert.alert('\u00c9xito', 'Foto de perfil actualizada.');
        } catch (error) {
            console.error('Error uploading avatar:', error);
            Alert.alert('Error', 'No se pudo subir la imagen.');
        } finally {
            setUpdating(false);
        }
    };

    async function handleSignOut() {
        const { error } = await supabase.auth.signOut();
        if (error) {
            Alert.alert('Error', error.message);
        } else {
            router.replace('/(auth)/login');
        }
    }

    if (loading || !user) {
        return (
            <View style={[styles.container, styles.center]}>
                <TennisSpinner size={34} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={[styles.header, { paddingTop: Math.max(insets.top, spacing.md) }]}>
                <View style={styles.headerContent}>
                    <View style={styles.logoRow}>
                        <Image
                            source={require('../../assets/Logos/LogoAplicación.png')}
                            style={{ width: 24, height: 24 }}
                            resizeMode="contain"
                        />
                        <Text style={styles.logoText}>SweetSpot</Text>
                    </View>

                    {isGlobalAdmin && !VIEW_TOGGLE_BLOCKED_EMAILS.has(currentUserEmail) && (
                        <TouchableOpacity
                            style={[styles.viewToggle, viewMode === 'user' && styles.viewToggleUser]}
                            onPress={handleToggleMode}
                        >
                            <Ionicons
                                name={viewMode === 'admin' ? 'eye-outline' : 'settings-outline'}
                                size={14}
                                color="#fff"
                            />
                            <Text style={styles.viewToggleText}>
                                {viewMode === 'admin' ? 'VISTA USUARIO' : 'VISTA ADMIN'}
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            <ScrollView 
                contentContainerStyle={styles.scrollContent} 
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary[500]} />}
            >
                {/* Profile Brief */}
                <View style={styles.profileSection}>
                    <View style={styles.profileMain}>
                        <TouchableOpacity style={styles.avatarContainer} onPress={handlePickImage} disabled={updating}>
                            <Image
                                source={profileAvatarUrl ? { uri: profileAvatarUrl } : require('../../assets/images/placeholder.png')}
                                style={styles.avatar}
                            />
                            <View style={styles.avatarEditBtn}>
                                {updating ? <TennisSpinner size={14} color="#fff" /> : <Ionicons name="camera" size={14} color="#fff" />}
                            </View>
                        </TouchableOpacity>
                        <View style={styles.profileInfo}>
                            <View style={styles.badgeRow}>
                                <View style={styles.metaRow}>
                                    <View style={styles.locationRow}>
                                        <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
                                        <TextInput
                                            style={styles.metaInput}
                                            value={user.location || ''}
                                            onChangeText={(val) => setUser({ ...user, location: val })}
                                            onBlur={() => handleUpdateLocation(user.location)}
                                            placeholder="Ciudad..."
                                            placeholderTextColor={colors.textTertiary}
                                        />
                                    </View>
                                    <View style={styles.phoneRow}>
                                        <Ionicons name="call-outline" size={14} color={colors.textSecondary} />
                                        <TextInput
                                            style={styles.metaInput}
                                            value={user.phone || ''}
                                            onChangeText={(val) => setUser({ ...user, phone: val })}
                                            onBlur={() => handleUpdatePhone(user.phone)}
                                            placeholder={'Tel\u00e9fono...'}
                                            placeholderTextColor={colors.textTertiary}
                                            keyboardType="phone-pad"
                                        />
                                    </View>
                                </View>
                            </View>
                            <View>
                                {(isGlobalAdmin && viewMode === 'admin') ? (
                                    <TextInput
                                        style={styles.userNameInput}
                                        value={user.name}
                                        onChangeText={(val) => setUser({ ...user, name: val })}
                                        placeholder="Tu nombre completo..."
                                        placeholderTextColor={colors.textTertiary}
                                        multiline={false}
                                    />
                                ) : (
                                    <Text style={styles.userName}>{user.name}</Text>
                                )}
                            </View>

                            <View style={styles.extraFields}>
                                <TouchableOpacity style={styles.extraField} onPress={() => setIsEditingBackhand(true)}>
                                    <Text style={styles.extraFieldLabel}>{'Rev\u00e9s:'}</Text>
                                    {isEditingBackhand ? (
                                        <TextInput
                                            style={styles.extraFieldInput}
                                            value={user[BACKHAND_FIELD] || ''}
                                            onChangeText={handleUpdateBackhand}
                                            placeholder="una mano/2 manos"
                                            placeholderTextColor={colors.textTertiary}
                                            autoFocus
                                        />
                                    ) : (
                                        <Text style={styles.extraFieldText}>{user[BACKHAND_FIELD] || 'una mano/2 manos'}</Text>
                                    )}
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.extraField} onPress={() => setIsEditingDominantHand(true)}>
                                    <Text style={styles.extraFieldLabel}>Mano dominante:</Text>
                                    {isEditingDominantHand ? (
                                        <TextInput
                                            style={styles.extraFieldInput}
                                            value={user.mano_dominante || ''}
                                            onChangeText={handleUpdateDominantHand}
                                            placeholder="Diestro/Zurdo"
                                            placeholderTextColor={colors.textTertiary}
                                            autoFocus
                                        />
                                    ) : (
                                        <Text style={styles.extraFieldText}>{user.mano_dominante || 'Diestro/Zurdo'}</Text>
                                    )}
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.miniSaveBtn}
                                    onPress={handleSaveAll}
                                    disabled={updating}
                                >
                                    {updating ? (
                                        <TennisSpinner size={16} color="#fff" />
                                    ) : (
                                        <Text style={styles.miniSaveBtnText}>Guardar cambios</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>

                    {/* Wrapper para agrupar los filtros y reducir el espaciado */}
                    <View style={{ gap: 12 }}>
                        {/* Context Selector */}
                        {(userContexts.length > 0 || isGlobalAdmin) && (
                            <TouchableOpacity
                                style={styles.contextSelector}
                                onPress={() => (isGlobalAdmin && viewMode === 'admin') ? setShowOrgSearchModal(true) : setShowContextModal(true)}
                            >
                                <View style={styles.contextInfo}>
                                    <Ionicons name="filter-outline" size={16} color={colors.primary[500]} />
                                    <Text style={styles.contextText}>
                                        {selectedContext ? `${selectedContext.org_name} \u00b7 ${selectedContext.level}` : 'Filtrar por Organizaci\u00f3n/Nivel'}
                                    </Text>
                                </View>
                                <Ionicons name="chevron-forward" size={16} color={colors.primary[500]} />
                            </TouchableOpacity>
                        )}

                        {/* Year Filter Global (Aplica a todas las estadísticas) */}
                        {availableYears.length > 0 && (
                            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center', paddingHorizontal: 24 }}>
                                {availableYears.map((year) => (
                                    <TouchableOpacity
                                        key={year}
                                        style={{
                                            paddingHorizontal: 16,
                                            paddingVertical: 8,
                                            borderRadius: 20,
                                            backgroundColor: selectedYear === year ? colors.primary[500] : colors.surfaceSecondary + '1A',
                                            borderWidth: 1,
                                            borderColor: selectedYear === year ? colors.primary[500] : colors.border,
                                        }}
                                        onPress={() => setSelectedYear(year)}
                                    >
                                        <Text style={{
                                            fontSize: 12,
                                            fontWeight: '700',
                                            color: selectedYear === year ? '#fff' : colors.textSecondary,
                                        }}>
                                            {year}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}

                        {/* Modality Selector */}
                        <View style={[styles.modalitySelector, { marginTop: 0 }]}>
                            <TouchableOpacity 
                                style={[styles.modalityBtn, modality === 'singles' && styles.modalityBtnActive]}
                                onPress={() => setModality('singles')}
                            >
                                <Text style={[styles.modalityBtnText, modality === 'singles' && styles.modalityBtnTextActive]}>Singles</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.modalityBtn, modality === 'dobles' && styles.modalityBtnActive]}
                                onPress={() => setModality('dobles')}
                            >
                                <Text style={[styles.modalityBtnText, modality === 'dobles' && styles.modalityBtnTextActive]}>Dobles</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                {/* Stats Bento */}
                <View style={[styles.bentoContainer, { marginTop: -20 }]}>
                    {/* Top Section: Left Main Rank Card + Right Column */}
                    <View style={styles.bentoTopSection}>
                        {/* Left Column: Huge Main Rank Card */}
                        <View style={styles.mainRankCard}>
                            {/* Glowing green indicator bar on the left edge inside the card */}
                            <View style={styles.rankLeftIndicator} />
                            <View style={styles.rankCardContent}>
                                <Text style={styles.statLabel}>POSICIÓN RANKING</Text>
                                <Text style={styles.rankValue}>{stats.rank}</Text>
                                <Text style={styles.rankStatusText}>
                                    {selectedContext ? `${selectedContext.level.toUpperCase()} \u2022 ${selectedYear || '2026'}` : `GENERAL \u2022 ${selectedYear || '2026'}`}
                                </Text>
                            </View>
                        </View>
                        
                        {/* Right Column */}
                        <View style={styles.bentoRightColumn}>
                            {/* Row 1: Trofeos & Victorias */}
                            <View style={styles.miniStatsRow}>
                                <View style={styles.miniStatCard}>
                                    <Ionicons name="trophy" size={20} color="#10b981" />
                                    <Text style={styles.miniStatValue}>{stats.trophies}</Text>
                                    <Text style={styles.miniStatLabel}>TROFEOS</Text>
                                </View>
                                <View style={styles.miniStatCard}>
                                    <Ionicons name="ribbon" size={20} color="#10b981" />
                                    <Text style={styles.miniStatValue}>{stats.wins}</Text>
                                    <Text style={styles.miniStatLabel}>VICTORIAS</Text>
                                </View>
                            </View>

                            {/* Row 2: Win Rate & Partidos */}
                            <View style={styles.miniStatsRow}>
                                <View style={styles.miniStatCard}>
                                    <FontAwesome5 name="fist-raised" size={18} color="#10b981" />
                                    <Text style={styles.miniStatValue}>{stats.winRate}</Text>
                                    <Text style={styles.miniStatLabel}>WIN RATE</Text>
                                </View>
                                <View style={styles.miniStatCard}>
                                    <Ionicons name="tennisball" size={20} color="#10b981" />
                                    <Text style={styles.miniStatValue}>{stats.totalMatches}</Text>
                                    <Text style={styles.miniStatLabel}>PARTIDOS</Text>
                                </View>
                            </View>

                            {/* Row 3: Total Sets */}
                            <View style={styles.splitStatCard}>
                                <View style={styles.splitStatItem}>
                                    <Text style={[styles.splitStatValue, { color: colors.success }]}>{stats.setsWon}</Text>
                                    <Text style={styles.splitStatLabel}>TOTAL SETS GANADOS</Text>
                                </View>
                                <View style={styles.splitStatDivider} />
                                <View style={styles.splitStatItem}>
                                    <Text style={[styles.splitStatValue, { color: colors.error }]}>{stats.setsLost}</Text>
                                    <Text style={styles.splitStatLabel}>TOTAL SETS PERDIDOS</Text>
                                </View>
                            </View>

                            {/* Row 4: Total Games */}
                            <View style={styles.splitStatCard}>
                                <View style={styles.splitStatItem}>
                                    <Text style={[styles.splitStatValue, { color: colors.success }]}>{stats.gamesWon}</Text>
                                    <Text style={styles.splitStatLabel}>TOTAL GAMES GANADOS</Text>
                                </View>
                                <View style={styles.splitStatDivider} />
                                <View style={styles.splitStatItem}>
                                    <Text style={[styles.splitStatValue, { color: colors.error }]}>{stats.gamesLost}</Text>
                                    <Text style={styles.splitStatLabel}>TOTAL GAMES PERDIDOS</Text>
                                </View>
                            </View>
                        </View>
                    </View>

                    {/* Bottom Section: Rows of 2 columns spanning full screen width */}
                    <View style={styles.bentoBottomSection}>
                        {/* Row 1: Año Debut & Finales Jugadas */}
                        <View style={styles.bottomRow}>
                            <View style={styles.bottomHalfCard}>
                                <Ionicons name="calendar" size={20} color="#3b82f6" />
                                <Text style={styles.bottomCardValue}>{stats.debutYear}</Text>
                                <Text style={styles.bottomCardLabel}>AÑO DEBUT</Text>
                            </View>
                            <View style={styles.bottomHalfCard}>
                                <Ionicons name="flag" size={20} color="#10b981" />
                                <Text style={styles.bottomCardValue}>{stats.finalsPlayed}</Text>
                                <Text style={styles.bottomCardLabel}>FINALES JUGADAS</Text>
                            </View>
                        </View>

                        {/* Row 2: Racha Actual & Mejor Racha */}
                        <View style={styles.bottomRow}>
                            <View style={styles.bottomHalfCard}>
                                <Ionicons name="flame" size={20} color="#f97316" />
                                <Text style={styles.bottomCardValue}>{stats.currentStreak}</Text>
                                <Text style={styles.bottomCardLabel}>RACHA ACTUAL</Text>
                            </View>
                            <View style={styles.bottomHalfCard}>
                                <View style={{ flexDirection: 'row', gap: 2, alignItems: 'center', marginBottom: 4 }}>
                                    <Ionicons name="flame" size={16} color="#f97316" />
                                    <Ionicons name="flame" size={16} color="#f97316" />
                                    <Ionicons name="flame" size={16} color="#f97316" />
                                </View>
                                <Text style={styles.bottomCardValue}>{stats.bestStreak}</Text>
                                <Text style={styles.bottomCardLabel}>MEJOR RACHA</Text>
                            </View>
                        </View>

                        {/* Row 3: Mejor Ranking & Peor Ranking */}
                        <View style={styles.bottomRow}>
                            <View style={styles.bottomHalfCard}>
                                <Ionicons name="trending-up" size={20} color="#10b981" />
                                <Text style={styles.bottomCardValue}>{stats.bestRanking}</Text>
                                <Text style={styles.bottomCardLabel}>MEJOR RANKING</Text>
                            </View>
                            <View style={styles.bottomHalfCard}>
                                <Ionicons name="trending-down" size={20} color={colors.error} />
                                <Text style={styles.bottomCardValue}>{stats.worstRanking}</Text>
                                <Text style={styles.bottomCardLabel}>PEOR RANKING</Text>
                            </View>
                        </View>

                        {/* Row 4: Rival más enfrentado (Full Width) */}
                        <TouchableOpacity
                            style={styles.bottomFullCard}
                            activeOpacity={stats.mostFacedRivalId && stats.mostFacedRivalMatches > 0 ? 0.7 : 1}
                            onPress={() => {
                                if (stats.mostFacedRivalId && stats.mostFacedRivalMatches > 0) {
                                    setShowRivalProfile(true);
                                }
                            }}
                        >
                            <View style={styles.rivalLeftSection}>
                                <MaterialCommunityIcons name="tennis" size={22} color={colors.primary[500]} />
                                <Text style={styles.rivalLabel}>RIVAL MÁS ENFRENTADO</Text>
                            </View>
                            <View style={styles.rivalRightSection}>
                                <Text style={styles.rivalNameText} numberOfLines={1}>
                                    {stats.mostFacedRivalName || '-'}
                                </Text>
                                <Text style={styles.rivalDetailText}>
                                    {stats.mostFacedRivalMatches > 0 ? `${stats.mostFacedRivalMatches} partidos` : 'Sin partidos'}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Evolution Chart */}
                <RankingEvolutionChart
                    rankingHistory={rankingHistory}
                    modality={modality}
                    colors={colors}
                />

                {/* Achievements section */}
                {achievements && achievements.length > 0 && (
                    <View style={{ marginTop: 24 }}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Logros</Text>
                        </View>
                        <View style={styles.achievementsList}>
                            {achievements.map((achievement) => {
                                const achievementColor = getAchievementColor(achievement.tone || 'special');
                                return (
                                    <TouchableOpacity
                                        key={achievement.id}
                                        style={styles.achievementMedalButton}
                                        activeOpacity={0.82}
                                        onPress={() => setSelectedAchievement(achievement)}
                                    >
                                        <View style={[
                                            styles.achievementMedal, 
                                            !achievement.imageSource && { backgroundColor: achievementColor + '20', borderColor: achievementColor + '55' },
                                            achievement.imageSource && { borderWidth: 0 }
                                        ]}>
                                            {achievement.imageSource ? (
                                                <Image 
                                                    source={achievement.imageSource} 
                                                    style={styles.achievementMedalImage}
                                                    resizeMode="contain"
                                                />
                                            ) : (
                                                <Ionicons name={achievement.icon as any} size={28} color={achievementColor} />
                                            )}
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>
                )}

                {/* Account Settings */}
                <View style={styles.settingsSection}>
                    <Text style={styles.settingsTitle}>{'Configuraci\u00f3n de Cuenta'}</Text>

                    <View style={styles.settingsGrid}>
                        <TouchableOpacity style={styles.settingItem} onPress={handleToggleNotifications}>
                            <View style={styles.settingIcon}>
                                <Ionicons 
                                    name={user.notifications_enabled ? "notifications" : "notifications-off-outline"} 
                                    size={20} 
                                    color={user.notifications_enabled ? colors.primary[500] : colors.textSecondary} 
                                />
                            </View>
                            <View style={styles.settingText}>
                                <Text style={styles.settingLabel}>Notificaciones</Text>
                                <Text style={styles.settingDesc}>Alertas de partidos y eventos</Text>
                            </View>
                            <View style={[styles.themeToggle, { backgroundColor: user.notifications_enabled ? colors.primary[500] : colors.surfaceSecondary }]}>
                                <View style={[styles.themeToggleCircle, { alignSelf: user.notifications_enabled ? 'flex-end' : 'flex-start' }]} />
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.settingItem} onPress={() => setShowPrivacyModal(true)}>
                            <View style={styles.settingIcon}>
                                <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} />
                            </View>
                            <View style={styles.settingText}>
                                <Text style={styles.settingLabel}>Privacidad y Seguridad</Text>
                                <Text style={styles.settingDesc}>{'Contrase\u00f1a, visibilidad y cuenta'}</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={colors.border} />
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.settingItem} onPress={toggleTheme}>
                            <View style={styles.settingIcon}>
                                <Ionicons name="moon-outline" size={20} color={isDark ? colors.primary[500] : colors.textSecondary} />
                            </View>
                            <View style={styles.settingText}>
                                <Text style={styles.settingLabel}>Modo Oscuro</Text>
                                <Text style={styles.settingDesc}>{'Cambiar el tema de la aplicaci\u00f3n'}</Text>
                            </View>
                            <View style={[styles.themeToggle, { backgroundColor: isDark ? colors.primary[500] : colors.surfaceSecondary }]}>
                                <View style={[styles.themeToggleCircle, { alignSelf: isDark ? 'flex-end' : 'flex-start' }]} />
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.settingItem} onPress={handleSignOut}>
                            <View style={styles.settingIcon}>
                                <Ionicons name="log-out-outline" size={20} color={colors.error} />
                            </View>
                            <View style={styles.settingText}>
                                <Text style={[styles.settingLabel, { color: colors.error }]}>{'Cerrar Sesi\u00f3n'}</Text>
                                <Text style={styles.settingDesc}>Salir de tu cuenta</Text>
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>

            {/* Context Selector Modal */}
            <Modal visible={showContextModal} transparent animationType="slide" onRequestClose={() => setShowContextModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{'Ver Estad\u00edsticas en:'}</Text>
                            <TouchableOpacity onPress={() => setShowContextModal(false)}>
                                <Ionicons name="close" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={{ maxHeight: 300, marginVertical: spacing.md }}>
                            {userContexts.map((ctx, idx) => (
                                <TouchableOpacity
                                    key={idx}
                                    style={[styles.ctxItem, selectedContext?.org_id === ctx.org_id && selectedContext.level === ctx.level && styles.ctxItemActive]}
                                    onPress={() => {
                                        setSelectedContext(ctx);
                                        setShowContextModal(false);
                                    }}
                                >
                                    <Text style={[styles.ctxItemText, selectedContext?.org_id === ctx.org_id && selectedContext.level === ctx.level && styles.ctxItemTextActive]}>
                                        {ctx.org_name} {'\u00b7'} {ctx.level}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Global Admin: Organization Search Modal */}
            <Modal visible={showOrgSearchModal} transparent animationType="slide" onRequestClose={() => setShowOrgSearchModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Contexto Global</Text>
                            <TouchableOpacity onPress={() => setShowOrgSearchModal(false)}>
                                <Ionicons name="close" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>
                        <TextInput
                            style={styles.modalSearchInput}
                            placeholder={'Buscar organizaci\u00f3n...'}
                            placeholderTextColor={colors.textTertiary}
                            value={orgSearch}
                            onChangeText={setOrgSearch}
                        />
                        <ScrollView style={{ maxHeight: 400 }}>
                            {allOrganizations
                                .filter(o => o.name.toLowerCase().includes(orgSearch.toLowerCase()))
                                .map(org => (
                                    <View key={org.id} style={styles.orgGroup}>
                                        <Text style={styles.orgGroupName}>{org.name}</Text>
                                        <View style={styles.levelChips}>
                                            {['Primera', 'Segunda', 'Tercera', 'Cuarta', 'Quinta', 'Honor', 'Escalaf\u00f3n'].map(lvl => (
                                                <TouchableOpacity
                                                    key={lvl}
                                                    style={[styles.levelChip, selectedContext?.org_id === org.id && selectedContext.level === lvl && styles.levelChipActive]}
                                                    onPress={() => {
                                                        setSelectedContext({ org_id: org.id, org_name: org.name, level: lvl });
                                                        setShowOrgSearchModal(false);
                                                    }}
                                                >
                                                    <Text style={[styles.levelChipText, selectedContext?.org_id === org.id && selectedContext.level === lvl && styles.levelChipTextActive]}>{lvl}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </View>
                                ))
                            }
                        </ScrollView>
                    </View>
                </View>
            </Modal>

                        <Modal
                visible={showPrivacyModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowPrivacyModal(false)}
            >
                <KeyboardAvoidingView
                    style={styles.modalOverlay}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                >
                    <View style={[styles.modalContent, styles.privacyModalContent]}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Privacidad y Seguridad</Text>
                            <TouchableOpacity onPress={() => setShowPrivacyModal(false)}>
                                <Ionicons name="close" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            style={styles.privacyScrollView}
                            contentContainerStyle={styles.privacyModalBody}
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator={false}
                        >
                            <TouchableOpacity style={styles.privacyLinkButton} onPress={handleOpenPrivacyPolicy}>
                                <Ionicons name="document-text-outline" size={18} color={colors.primary[500]} />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.privacyLinkTitle}>{'Pol\u00edtica de Privacidad'}</Text>
                                    <Text style={styles.privacyLinkDesc}>Abrir documento publicado en GitHub Pages</Text>
                                </View>
                                <Ionicons name="open-outline" size={18} color={colors.textSecondary} />
                            </TouchableOpacity>

                            <View style={styles.privacyFormCard}>
                                <Text style={styles.privacySectionTitle}>{'Cambiar contrase\u00f1a'}</Text>
                                <TextInput
                                    style={styles.privacyInput}
                                    placeholder={'Contrase\u00f1a actual'}
                                    placeholderTextColor={colors.textTertiary}
                                    secureTextEntry
                                    value={currentPassword}
                                    onChangeText={setCurrentPassword}
                                    autoCapitalize="none"
                                />
                                <TextInput
                                    style={styles.privacyInput}
                                    placeholder={'Nueva contrase\u00f1a'}
                                    placeholderTextColor={colors.textTertiary}
                                    secureTextEntry
                                    value={newPassword}
                                    onChangeText={setNewPassword}
                                    autoCapitalize="none"
                                />
                                <TextInput
                                    style={styles.privacyInput}
                                    placeholder={'Confirmar nueva contrase\u00f1a'}
                                    placeholderTextColor={colors.textTertiary}
                                    secureTextEntry
                                    value={confirmNewPassword}
                                    onChangeText={setConfirmNewPassword}
                                    autoCapitalize="none"
                                />
                                <TouchableOpacity
                                    style={[styles.privacySaveButton, updatingPassword && styles.privacySaveButtonDisabled]}
                                    onPress={handleUpdatePassword}
                                    disabled={updatingPassword}
                                >
                                    {updatingPassword ? (
                                        <TennisSpinner size={16} color="#fff" />
                                    ) : (
                                        <>
                                            <Ionicons name="shield-checkmark-outline" size={16} color="#fff" />
                                            <Text style={styles.privacySaveButtonText}>{'Actualizar contrase\u00f1a'}</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>

                            <View style={styles.dangerZoneCard}>
                                <View style={styles.dangerZoneHeader}>
                                    <Ionicons name="warning-outline" size={18} color={colors.error} />
                                    <Text style={styles.dangerZoneTitle}>Zona de Peligro</Text>
                                </View>
                                <Text style={styles.dangerZoneDesc}>
                                    {'Eliminar tu cuenta es una acci\u00f3n permanente e irreversible. Se borrar\u00e1n todos tus datos, registros, estad\u00edsticas e historial.'}
                                </Text>
                                <TouchableOpacity
                                    style={styles.deleteAccountButton}
                                    onPress={handleDeleteAccount}
                                >
                                    <Ionicons name="trash-outline" size={16} color="#fff" />
                                    <Text style={styles.deleteAccountButtonText}>Eliminar Cuenta</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                        
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* Delete Account Password Confirmation Modal */}
            <Modal
                visible={showDeleteConfirmModal}
                transparent
                animationType="fade"
                onRequestClose={() => { if (!deletingAccount) { setShowDeleteConfirmModal(false); setDeleteAccountPassword(''); } }}
            >
                <KeyboardAvoidingView
                    style={styles.deleteModalOverlay}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                >
                    <View style={styles.deleteModalContent}>
                        <View style={styles.deleteModalIconContainer}>
                            <Ionicons name="shield-outline" size={32} color={colors.error} />
                        </View>
                        <Text style={styles.deleteModalTitle}>{'Confirmar Eliminaci\u00f3n'}</Text>
                        <Text style={styles.deleteModalDesc}>
                            {'Ingresa tu contrase\u00f1a actual para confirmar que deseas eliminar tu cuenta de forma permanente.'}
                        </Text>
                        <TextInput
                            style={styles.deleteModalInput}
                            placeholder={'Contrase\u00f1a actual'}
                            placeholderTextColor={colors.textTertiary}
                            secureTextEntry
                            value={deleteAccountPassword}
                            onChangeText={setDeleteAccountPassword}
                            autoCapitalize="none"
                            editable={!deletingAccount}
                        />
                        <View style={styles.deleteModalButtons}>
                            <TouchableOpacity
                                style={styles.deleteModalCancelButton}
                                onPress={() => { setShowDeleteConfirmModal(false); setDeleteAccountPassword(''); }}
                                disabled={deletingAccount}
                            >
                                <Text style={styles.deleteModalCancelText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.deleteModalConfirmButton, deletingAccount && styles.deleteModalConfirmDisabled]}
                                onPress={executeAccountDeletion}
                                disabled={deletingAccount}
                            >
                                {deletingAccount ? (
                                    <TennisSpinner size={16} color="#fff" />
                                ) : (
                                    <Text style={styles.deleteModalConfirmText}>Eliminar</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* Achievement Detail Modal */}
            <Modal
                visible={!!selectedAchievement}
                transparent
                animationType="fade"
                onRequestClose={() => setSelectedAchievement(null)}
            >
                <View style={styles.achievementModalOverlay}>
                    <View style={styles.achievementModalContent}>
                        {selectedAchievement && (
                            <>
                                <View style={styles.achievementModalHeader}>
                                    <View style={[
                                        styles.achievementModalIconWrapper,
                                        !selectedAchievement.imageSource && { backgroundColor: getAchievementColor(selectedAchievement.tone || 'special') + '20', borderColor: getAchievementColor(selectedAchievement.tone || 'special') + '55' },
                                        selectedAchievement.imageSource && { borderWidth: 0 }
                                    ]}>
                                        {selectedAchievement.imageSource ? (
                                            <Image 
                                                source={selectedAchievement.imageSource} 
                                                style={{ width: 120, height: 120, borderRadius: 60 }} 
                                                resizeMode="contain"
                                            />
                                        ) : (
                                            <Ionicons 
                                                name={selectedAchievement.icon as any} 
                                                size={70} 
                                                color={getAchievementColor(selectedAchievement.tone || 'special')} 
                                            />
                                        )}
                                    </View>
                                </View>
                                <Text style={styles.achievementModalTitle}>{selectedAchievement.title}</Text>
                                <Text style={styles.achievementModalDesc}>{selectedAchievement.detail}</Text>
                                <Text style={styles.achievementModalDate}>
                                    Obtenido: {formatDate(selectedAchievement.dateEarned)}
                                </Text>
                                <TouchableOpacity style={styles.achievementModalCloseBtn} onPress={() => setSelectedAchievement(null)}>
                                    <Text style={styles.achievementModalCloseText}>Cerrar</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </View>
            </Modal>

            {/* Player Profile Modal for Most Faced Rival */}
            <PlayerProfileModal
                visible={showRivalProfile}
                playerId={stats.mostFacedRivalId}
                tournamentOrgId={selectedContext?.org_id}
                tournamentLevel={selectedContext?.level}
                initialPage="headToHead"
                onClose={() => setShowRivalProfile(false)}
            />
        </View>
    );
}

const getStyles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    center: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        backgroundColor: colors.background,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    headerContent: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: spacing.xl,
        paddingBottom: spacing.md,
        height: 60,
    },
    logoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    logoText: {
        fontSize: 18,
        fontWeight: '900',
        color: colors.primary[600],
        fontStyle: 'italic',
    },
    scrollContent: {
        padding: spacing.xl,
        paddingBottom: 120,
        gap: spacing['3xl'],
    },
    profileSection: {
        gap: spacing.xl,
    },
    profileMain: {
        flexDirection: 'row',
        gap: spacing.xl,
        alignItems: 'center',
    },
    avatarContainer: {
        width: 100,
        height: 100,
        borderRadius: borderRadius['3xl'],
        backgroundColor: colors.surfaceSecondary,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 15,
        position: 'relative',
    },
    avatar: {
        width: '100%',
        height: '100%',
        borderRadius: borderRadius['3xl'],
    },
    avatarEditBtn: {
        position: 'absolute',
        bottom: -5,
        right: -5,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.primary[500],
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: colors.background,
    },
    profileInfo: {
        flex: 1,
        gap: 4,
    },
    badgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        flexWrap: 'wrap',
    },
    locationRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    phoneRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    metaInput: {
        fontSize: 11,
        color: colors.textSecondary,
        fontWeight: '600',
        padding: 0,
        minWidth: 80,
    },
    userName: {
        fontSize: 26,
        fontWeight: '900',
        color: colors.text,
        letterSpacing: -0.5,
        marginTop: 4,
    },
    userNameInput: {
        fontSize: 26,
        fontWeight: '900',
        color: colors.text,
        letterSpacing: -0.5,
        padding: 0,
        margin: 0,
        marginTop: 4,
    },
    extraFields: {
        marginTop: 8,
        gap: 6,
    },
    extraField: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    extraFieldLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: colors.textSecondary,
    },
    extraFieldText: {
        fontSize: 12,
        color: colors.text,
        flex: 1,
    },
    extraFieldInput: {
        fontSize: 12,
        color: colors.text,
        flex: 1,
        padding: 0,
        borderBottomWidth: 1,
        borderBottomColor: colors.primary[500] + '40',
    },
    miniSaveBtn: { marginTop: spacing.md, backgroundColor: colors.primary[500], paddingVertical: 8, paddingHorizontal: spacing.md, borderRadius: borderRadius.md, alignSelf: 'flex-start' },
    miniSaveBtnText: { color: '#fff', fontSize: 13, fontWeight: '700', textAlign: 'center' },

    modalitySelector: { flexDirection: 'row', backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.lg, padding: 4, marginTop: spacing.md },
    modalityBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: borderRadius.md },
    modalityBtnActive: { backgroundColor: colors.surface, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
    modalityBtnText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, textAlign: 'center' },
    modalityBtnTextActive: { color: colors.primary[500], fontWeight: '700' },

    contextSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.surface,
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.border,
    },
    contextInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    contextText: {
        color: colors.textSecondary,
        fontSize: 12,
        fontWeight: '700',
    },
    bentoContainer: {
        gap: spacing.md,
        width: '100%',
        marginTop: spacing.md,
    },
    bentoTopSection: {
        flexDirection: 'row',
        gap: spacing.md,
        width: '100%',
    },
    mainRankCard: {
        flex: 1, // left side
        backgroundColor: colors.surface,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
        position: 'relative',
        justifyContent: 'center',
        paddingVertical: spacing.lg,
    },
    rankLeftIndicator: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 6,
        backgroundColor: '#10b981', // bright neon green accent
    },
    rankCardContent: {
        paddingHorizontal: spacing.lg,
        alignItems: 'flex-start',
    },
    statLabel: {
        fontSize: 9,
        fontWeight: '900',
        color: colors.textTertiary,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    rankValue: {
        fontSize: 54,
        fontWeight: '900',
        color: colors.text,
        fontStyle: 'italic',
        marginVertical: spacing.xs,
        lineHeight: 58,
    },
    rankStatusText: {
        fontSize: 11,
        fontWeight: '900',
        color: '#10b981',
    },
    bentoRightColumn: {
        flex: 1.3, // right side is wider to accommodate two columns of mini cards comfortably
        gap: spacing.md,
    },
    miniStatsRow: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    miniStatCard: {
        flex: 1,
        backgroundColor: colors.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.sm,
        alignItems: 'center',
        justifyContent: 'center',
    },
    miniStatValue: {
        fontSize: 18,
        fontWeight: '900',
        color: colors.text,
        marginTop: 4,
    },
    miniStatLabel: {
        fontSize: 8,
        fontWeight: '800',
        color: colors.textTertiary,
        marginTop: 2,
        letterSpacing: 0.2,
        textAlign: 'center',
    },
    splitStatCard: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
    },
    splitStatItem: {
        flex: 1,
        alignItems: 'center',
    },
    splitStatValue: {
        fontSize: 18,
        fontWeight: '900',
    },
    splitStatLabel: {
        fontSize: 7.5,
        fontWeight: '800',
        color: colors.textTertiary,
        marginTop: 2,
        textAlign: 'center',
    },
    splitStatDivider: {
        width: 1,
        height: '60%',
        backgroundColor: colors.border,
    },
    bentoBottomSection: {
        gap: spacing.md,
        width: '100%',
    },
    bottomRow: {
        flexDirection: 'row',
        gap: spacing.md,
        width: '100%',
    },
    bottomHalfCard: {
        flex: 1,
        backgroundColor: colors.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.sm,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 80,
    },
    bottomCardValue: {
        fontSize: 18,
        fontWeight: '900',
        color: colors.text,
        marginTop: 4,
    },
    bottomCardLabel: {
        fontSize: 8,
        fontWeight: '800',
        color: colors.textTertiary,
        marginTop: 2,
        letterSpacing: 0.2,
        textAlign: 'center',
    },
    bottomFullCard: {
        width: '100%',
        backgroundColor: colors.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: 64,
    },
    rivalLeftSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        flex: 1.1,
    },
    rivalRightSection: {
        alignItems: 'flex-end',
        flex: 0.9,
    },
    rivalNameText: {
        fontSize: 14,
        fontWeight: '800',
        color: colors.text,
        textAlign: 'right',
    },
    rivalDetailText: {
        fontSize: 11,
        color: colors.textSecondary,
        marginTop: 2,
        textAlign: 'right',
    },
    rivalLabel: {
        fontSize: 9,
        fontWeight: '900',
        color: colors.textTertiary,
        textTransform: 'uppercase',
    },
    sectionHeader: {
        marginBottom: spacing.md,
    },
    sectionTitle: {
        fontSize: 22,
        fontWeight: '900',
        color: colors.text,
    },
    tournamentList: {
        gap: spacing.md,
    },
    historyCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
        gap: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border,
    },
    historyIcon: {
        width: 44,
        height: 44,
        borderRadius: borderRadius.lg,
        backgroundColor: colors.surfaceSecondary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    historyInfo: {
        flex: 1,
    },
    historyName: {
        fontSize: 15,
        fontWeight: '700',
        color: colors.text,
    },
    historyMeta: {
        fontSize: 11,
        color: colors.textSecondary,
        marginTop: 2,
    },
    historyResult: {
        alignItems: 'flex-end',
    },
    winnerBadge: {
        backgroundColor: colors.success + '26',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: borderRadius.full,
    },
    winnerBadgeText: {
        fontSize: 8,
        fontWeight: '900',
        color: colors.success,
    },
    resultBadge: {
        backgroundColor: colors.textSecondary + '0D',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: borderRadius.full,
    },
    resultBadgeText: {
        fontSize: 8,
        fontWeight: '900',
        color: colors.textSecondary,
    },
    historyDate: {
        fontSize: 9,
        color: colors.textTertiary,
        marginTop: 4,
    },

    emptyCard: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.xl,
        padding: spacing.xl,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
        borderStyle: 'dashed',
    },
    emptyText: {
        color: colors.textTertiary,
        fontSize: 13,
    },
    settingsSection: {
        backgroundColor: colors.surface + '05',
        borderRadius: borderRadius['3xl'],
        padding: spacing.xl,
        gap: spacing.xl,
    },
    settingsTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: colors.text,
    },
    settingsGrid: {
        gap: spacing.md,
    },
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        padding: spacing.md,
        borderRadius: borderRadius.xl,
        gap: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
    },
    settingIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: colors.surfaceSecondary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    settingText: {
        flex: 1,
    },
    settingLabel: {
        fontSize: 14,
        fontWeight: '700',
        color: colors.text,
    },
    settingDesc: {
        fontSize: 11,
        color: colors.textSecondary,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: colors.surface,
        padding: spacing.xl,
        borderTopLeftRadius: borderRadius['3xl'],
        borderTopRightRadius: borderRadius['3xl'],
    },
    privacyModalContent: {
        height: '88%',
        maxHeight: '90%',
        minHeight: 0,
        overflow: 'hidden',
    },
    privacyScrollView: {
        flex: 1,
        minHeight: 0,
    },
    privacyModalBody: {
        paddingBottom: spacing.xl * 2,
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
        fontWeight: '800',
    },
    ctxItem: {
        padding: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    ctxItemActive: {
        backgroundColor: colors.primary[500] + '20',
        borderRadius: borderRadius.md,
    },
    ctxItemText: {
        color: colors.textSecondary,
        fontSize: 14,
        fontWeight: '600',
    },
    ctxItemTextActive: {
        color: colors.primary[500],
        fontWeight: '800',
    },
    modalSearchInput: {
        backgroundColor: colors.background,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        color: colors.text,
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: spacing.md,
    },
    privacyLinkButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        backgroundColor: colors.background,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
        marginBottom: spacing.lg,
    },
    privacyLinkTitle: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '700',
    },
    privacyLinkDesc: {
        color: colors.textSecondary,
        fontSize: 11,
    },
    privacyFormCard: {
        backgroundColor: colors.background,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
        gap: spacing.sm,
    },
    privacySectionTitle: {
        color: colors.text,
        fontSize: 14,
        fontWeight: '800',
        marginBottom: 2,
    },
    privacyInput: {
        height: 46,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        color: colors.text,
        paddingHorizontal: spacing.md,
        fontSize: 13,
        fontWeight: '600',
    },
    privacySaveButton: {
        marginTop: spacing.xs,
        height: 44,
        borderRadius: borderRadius.md,
        backgroundColor: colors.primary[500],
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
    },
    privacySaveButtonDisabled: {
        opacity: 0.6,
    },
    privacySaveButtonText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '800',
    },
    dangerZoneCard: {
        backgroundColor: colors.error + '0D',
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.error + '33',
        padding: spacing.md,
        marginTop: spacing.lg,
        gap: spacing.sm,
    },
    dangerZoneHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
    },
    dangerZoneTitle: {
        color: colors.error,
        fontSize: 14,
        fontWeight: '800',
    },
    dangerZoneDesc: {
        color: colors.textSecondary,
        fontSize: 12,
        lineHeight: 18,
    },
    deleteAccountButton: {
        marginTop: spacing.xs,
        height: 44,
        borderRadius: borderRadius.md,
        backgroundColor: colors.error,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
    },
    deleteAccountButtonText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '800',
        textAlign: 'center',
    },
    deleteModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xl,
    },
    deleteModalContent: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius['2xl'],
        padding: spacing.xl,
        width: '100%',
        maxWidth: 360,
        alignItems: 'center',
        gap: spacing.sm,
    },
    deleteModalIconContainer: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: colors.error + '1A',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.xs,
    },
    deleteModalTitle: {
        color: colors.text,
        fontSize: 18,
        fontWeight: '800',
        textAlign: 'center',
    },
    deleteModalDesc: {
        color: colors.textSecondary,
        fontSize: 13,
        lineHeight: 19,
        textAlign: 'center',
    },
    deleteModalInput: {
        width: '100%',
        height: 46,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.error + '55',
        backgroundColor: colors.background,
        color: colors.text,
        paddingHorizontal: spacing.md,
        fontSize: 13,
        fontWeight: '600',
        marginTop: spacing.xs,
    },
    deleteModalButtons: {
        flexDirection: 'row',
        gap: spacing.sm,
        marginTop: spacing.sm,
        width: '100%',
    },
    deleteModalCancelButton: {
        flex: 1,
        height: 44,
        borderRadius: borderRadius.md,
        backgroundColor: colors.surfaceSecondary,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    deleteModalCancelText: {
        color: colors.text,
        fontSize: 13,
        fontWeight: '700',
        textAlign: 'center',
    },
    deleteModalConfirmButton: {
        flex: 1,
        height: 44,
        borderRadius: borderRadius.md,
        backgroundColor: colors.error,
        justifyContent: 'center',
        alignItems: 'center',
    },
    deleteModalConfirmDisabled: {
        opacity: 0.6,
    },
    deleteModalConfirmText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '800',
        textAlign: 'center',
    },
    orgGroup: {
        marginBottom: spacing.xl,
        gap: spacing.md,
    },
    orgGroupName: {
        color: colors.text,
        fontSize: 16,
        fontWeight: '800',
        borderLeftWidth: 3,
        borderLeftColor: colors.primary[500],
        paddingLeft: spacing.md,
    },
    levelChips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    levelChip: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.full,
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.border,
    },
    levelChipActive: {
        backgroundColor: colors.primary[500],
        borderColor: colors.primary[500],
    },
    levelChipText: {
        color: colors.textSecondary,
        fontSize: 12,
        fontWeight: '700',
        textAlign: 'center',
    },
    levelChipTextActive: {
        color: '#fff',
    },
    viewToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.primary[500],
        paddingHorizontal: spacing.md,
        paddingVertical: 6,
        borderRadius: borderRadius.full,
        gap: 6,
    },
    viewToggleUser: {
        backgroundColor: colors.textSecondary,
    },
    viewToggleText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '900',
    },
    themeToggle: {
        width: 36,
        height: 20,
        borderRadius: 10,
        padding: 2,
    },
    themeToggleCircle: {
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: '#fff',
    },
    paymentFilters: {
        gap: spacing.md,
    },
    filterScroll: {
        gap: spacing.sm,
        paddingRight: spacing.xl,
    },
    filterChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: borderRadius.full,
        backgroundColor: colors.surfaceSecondary,
        borderWidth: 1,
        borderColor: colors.border,
    },
    filterChipActive: {
        backgroundColor: colors.primary[500],
        borderColor: colors.primary[500],
    },
    filterChipText: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.textSecondary,
    },
    filterChipTextActive: {
        color: '#fff',
    },
    yearRow: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    yearChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: borderRadius.lg,
        backgroundColor: colors.surfaceSecondary,
        borderWidth: 1,
        borderColor: colors.border,
    },
    yearChipActive: {
        backgroundColor: colors.primary[500],
        borderColor: colors.primary[500],
    },
    yearChipText: {
        fontSize: 11,
        fontWeight: '700',
        color: colors.textSecondary,
    },
    yearChipTextActive: {
        color: '#fff',
    },
    paymentList: {
        gap: spacing.md,
        marginTop: spacing.sm,
    },
    paymentSummaryCard: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.border,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    paymentInfoMain: {
        flex: 1,
        marginRight: spacing.md,
    },
    paymentName: {
        fontSize: 15,
        fontWeight: '700',
        color: colors.text,
        marginBottom: 2,
    },
    paymentDate: {
        fontSize: 11,
        color: colors.textTertiary,
    },
    paymentStatusRow: {
        alignItems: 'flex-end',
        gap: 4,
    },
    paymentAmount: {
        fontSize: 15,
        fontWeight: '800',
        color: colors.text,
    },
    statusTag: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: borderRadius.sm,
    },
    statusTagPaid: {
        backgroundColor: colors.success + '1A',
    },
    statusTagUnpaid: {
        backgroundColor: colors.error + '1A',
    },
    statusTagText: {
        fontSize: 9,
        fontWeight: '900',
    },
    statusTagTextPaid: {
        color: colors.success,
    },
    statusTagTextUnpaid: {
        color: colors.error,
    },
    achievementMedalButton: {
        marginRight: spacing.md,
        alignItems: 'center',
    },
    achievementMedal: {
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
    },
    achievementModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xl,
    },
    achievementModalContent: {
        backgroundColor: colors.surface,
        borderRadius: 24,
        padding: spacing.xl,
        width: '100%',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
        elevation: 10,
    },
    achievementModalHeader: {
        marginBottom: spacing.xl,
        alignItems: 'center',
    },
    achievementModalIconWrapper: {
        width: 120,
        height: 120,
        borderRadius: 60,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
    },
    achievementModalTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: colors.text,
        textAlign: 'center',
        marginBottom: spacing.sm,
    },
    achievementModalDesc: {
        fontSize: 15,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: spacing.xl,
        lineHeight: 22,
    },
    achievementModalDate: {
        fontSize: 12,
        color: colors.textTertiary,
        fontWeight: '600',
        marginBottom: spacing.xl,
    },
    achievementModalCloseBtn: {
        backgroundColor: colors.primary[500],
        paddingVertical: spacing.md,
        paddingHorizontal: 32,
        borderRadius: borderRadius.full,
        width: '100%',
        alignItems: 'center',
    },
    achievementModalCloseText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 16,
    },
    streakValue: {
        fontSize: 18,
        fontWeight: '900',
        color: colors.text,
    },
    streakLabel: {
        fontSize: 8,
        fontWeight: '700',
        color: colors.textTertiary,
    },
    rivalName: {
        fontSize: 14,
        fontWeight: '800',
        color: colors.text,
        marginTop: 6,
        textAlign: 'center',
        paddingHorizontal: 4,
    },
    rivalMatches: {
        fontSize: 10,
        color: colors.textSecondary,
        marginTop: 2,
    },
    achievementsList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.md,
        justifyContent: 'flex-start',
        marginBottom: spacing.xl,
    },
    achievementRowCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: borderRadius.xl,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.border,
        gap: spacing.md,
    },
    achievementMedalImage: {
        width: 60,
        height: 60,
        borderRadius: 30,
    },
    achievementRowInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    achievementRowTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: colors.text,
        marginBottom: 2,
    },
    achievementRowDesc: {
        fontSize: 12,
        color: colors.textSecondary,
        lineHeight: 16,
    },
});
