import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Dimensions, Alert, ActivityIndicator, TextInput, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, borderRadius } from '@/theme';
import { supabase } from '@/services/supabase';
import { useRouter, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { getTournamentPlacements } from '@/services/ranking';
import { adminModeService } from '@/services/adminMode';

const { width } = Dimensions.get('window');
const GLOBAL_ADMIN_EMAIL = 'javier.aravena25@gmail.com';
const ROLE_OPTIONS = ['player', 'admin'];

export default function ProfileScreen() {
    const insets = useSafeAreaInsets();
    const { colors, toggleTheme, isDark } = useTheme();
    const styles = getStyles(colors);
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [user, setUser] = useState<any>(null);
    const [stats, setStats] = useState({
        rank: '-',
        trophies: 0,
        wins: 0,
        winRate: '0%',
        totalMatches: 0
    });
    const [recentTournaments, setRecentTournaments] = useState<any[]>([]);

    // Profile Fields
    const [isEditingBackhand, setIsEditingBackhand] = useState(false);
    const [isEditingDominantHand, setIsEditingDominantHand] = useState(false);

    // Filters
    const [userContexts, setUserContexts] = useState<any[]>([]); // { org_id, org_name, level }
    const [selectedContext, setSelectedContext] = useState<any>(null);
    const [showContextModal, setShowContextModal] = useState(false);

    // Super Admin States
    const [isGlobalAdmin, setIsGlobalAdmin] = useState(false);
    const [viewMode, setViewMode] = useState(adminModeService.getMode());
    const [allOrganizations, setAllOrganizations] = useState<any[]>([]);
    const [orgSearch, setOrgSearch] = useState('');
    const [showOrgSearchModal, setShowOrgSearchModal] = useState(false);

    useFocusEffect(
        useCallback(() => {
            loadProfileData();
        }, [])
    );

    useEffect(() => {
        if (selectedContext) {
            calculateStats();
        }
    }, [selectedContext, user?.id]);

    useEffect(() => {
        const unsubscribe = adminModeService.subscribe((m) => {
            setViewMode(m);
        });
        return unsubscribe;
    }, []);

    const handleToggleMode = () => {
        const next = viewMode === 'admin' ? 'user' : 'admin';
        adminModeService.setMode(next);
    };

    const loadProfileData = async () => {
        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            // Fetch Profile
            const { data: profile, error: profErr } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .single();

            if (profErr) throw profErr;
            setUser(profile);

            const isGlobal = session.user.email === GLOBAL_ADMIN_EMAIL;
            setIsGlobalAdmin(isGlobal);

            if (isGlobal) {
                fetchAllOrganizations();
            }

            // Fetch User Contexts (Orgs and Levels)
            const { data: contexts, error: ctxErr } = await supabase
                .from('registrations')
                .select(`
                    tournament_id,
                    tournaments:tournaments!inner(
                        organization_id,
                        level,
                        organizations:organizations!inner(name)
                    )
                `)
                .eq('player_id', session.user.id);

            if (!ctxErr && contexts) {
                const uniqueContexts: any[] = [];
                const seen = new Set();

                contexts.forEach((c: any) => {
                    const key = `${c.tournaments.organization_id}|${c.tournaments.level}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        uniqueContexts.push({
                            org_id: c.tournaments.organization_id,
                            org_name: c.tournaments.organizations.name,
                            level: c.tournaments.level
                        });
                    }
                });

                setUserContexts(uniqueContexts);
                if (uniqueContexts.length > 0 && !selectedContext) {
                    setSelectedContext(uniqueContexts[0]);
                }
            }

            // Fetch Recent Tournaments
            const { data: recent, error: recentErr } = await supabase
                .from('registrations')
                .select(`
                    tournament_id,
                    tournaments:tournaments!inner(
                        id, name, level, status, end_date, format, start_date
                    )
                `)
                .eq('player_id', session.user.id)
                .order('created_at', { ascending: false })
                .limit(3);

            if (!recentErr && recent) {
                const tourData = await Promise.all(recent.map(async (r: any) => {
                    const t = r.tournaments;
                    if (t.status === 'completed' || t.status === 'finalized') {
                        const { data: tMatches } = await supabase.from('matches').select('*').eq('tournament_id', t.id);
                        const placements = getTournamentPlacements(t, tMatches || []);
                        const myPlacement = placements.find(p => p.playerId === session.user.id);
                        return { ...t, place: myPlacement ? `${myPlacement.place}° LUGAR` : 'FINALIZADO' };
                    }
                    return { ...t, place: 'EN CURSO' };
                }));
                setRecentTournaments(tourData);
            }

        } catch (error) {
            console.error('Error loading profile:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchAllOrganizations = async () => {
        const { data, error } = await supabase
            .from('organizations')
            .select('*')
            .order('name');
        if (data && !error) {
            setAllOrganizations(data);
        }
    };

    const calculateStats = async () => {
        if (!selectedContext || !user) return;

        try {
            // 1. Get all matches for this context where user participated
            const { data: matches, error: matchErr } = await supabase
                .from('matches')
                .select('*, tournaments!inner(organization_id, level, status)')
                .eq('tournaments.organization_id', selectedContext.org_id)
                .eq('tournaments.level', selectedContext.level)
                .or(`player_a_id.eq.${user.id},player_b_id.eq.${user.id}`);

            if (matchErr) throw matchErr;

            const totalMatches = matches?.length || 0;
            const wins = matches?.filter(m => m.winner_id === user.id).length || 0;
            const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;

            // 2. Calculate Trophies (1st places) and Ranking
            const { data: tournaments, error: tourErr } = await supabase
                .from('tournaments')
                .select('*')
                .eq('organization_id', selectedContext.org_id)
                .eq('level', selectedContext.level)
                .in('status', ['completed', 'finalized']);

            let trophies = 0;
            let allPlayersPoints: Record<string, number> = {};

            if (!tourErr && tournaments) {
                const tournamentIds = tournaments.map(t => t.id);
                const { data: allMatches } = await supabase
                    .from('matches')
                    .select('*')
                    .in('tournament_id', tournamentIds);

                const matchesByTour = (allMatches || []).reduce((acc: any, m: any) => {
                    acc[m.tournament_id] = [...(acc[m.tournament_id] || []), m];
                    return acc;
                }, {});

                tournaments.forEach(t => {
                    const placements = getTournamentPlacements(t, matchesByTour[t.id] || []);
                    placements.forEach(p => {
                        if (p.playerId === user.id && p.place === '1') trophies++;
                        allPlayersPoints[p.playerId] = (allPlayersPoints[p.playerId] || 0) + p.points;
                    });
                });
            }

            // 3. Calculate Rank
            const sortedRanking = Object.entries(allPlayersPoints).sort((a, b) => b[1] - a[1]);
            const userRankIndex = sortedRanking.findIndex(([id]) => id === user.id);
            const rank = userRankIndex !== -1 ? `#${userRankIndex + 1}` : '-';

            setStats({
                rank,
                trophies,
                wins,
                winRate: `${winRate}%`,
                totalMatches
            });

        } catch (error) {
            console.error('Error calculating stats:', error);
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
            Alert.alert('Error', 'No se pudo actualizar la ubicación.');
        }
    };

    const handleUpdateName = async (newName: string) => {
        if (!user || !newName.trim()) return;
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ name: newName.trim() })
                .eq('id', user.id);
            if (error) throw error;
            setUser({ ...user, name: newName.trim() });
        } catch (error) {
            Alert.alert('Error', 'No se pudo actualizar el nombre.');
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
            Alert.alert('Error', 'No se pudo actualizar el teléfono.');
        }
    };

    const handleUpdateBio = async (newBio: string) => {
        if (!user) return;
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ bio: newBio.trim() })
                .eq('id', user.id);
            if (error) throw error;
            setUser({ ...user, bio: newBio.trim() });
            setIsEditingBio(false);
        } catch (error) {
            Alert.alert('Error', 'No se pudo actualizar la bio.');
        }
    };

    const handleUpdateBackhand = async (newBackhand: string) => {
        if (!user) return;
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ revés: newBackhand.trim() })
                .eq('id', user.id);
            if (error) throw error;
            setUser({ ...user, revés: newBackhand.trim() });
            setIsEditingBackhand(false);
        } catch (error) {
            setUser({ ...user, revés: newBackhand.trim() });
            setIsEditingBackhand(false);
        }
    };

    const handleUpdateDominantHand = async (newHand: string) => {
        if (!user) return;
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ mano_dominante: newHand.trim() })
                .eq('id', user.id);
            if (error) throw error;
            setUser({ ...user, mano_dominante: newHand.trim() });
            setIsEditingDominantHand(false);
        } catch (error) {
            setUser({ ...user, mano_dominante: newHand.trim() });
            setIsEditingDominantHand(false);
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
                    revés: user.revés,
                    mano_dominante: user.mano_dominante
                })
                .eq('id', user.id);
            if (error) throw error;
            Alert.alert('Éxito', 'Cambios guardados correctamente.');
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'No se pudieron guardar los cambios.');
        } finally {
            setUpdating(false);
        }
    };

    const handlePickImage = async () => {
        Alert.alert(
            'Editar Foto',
            'Selecciona una opción',
            [
                { text: 'Cámara', onPress: () => launchImagePicker(true) },
                { text: 'Galería', onPress: () => launchImagePicker(false) },
                { text: 'Cancelar', style: 'cancel' }
            ]
        );
    };

    const launchImagePicker = async (useCamera: boolean) => {
        let result;
        if (useCamera) {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permiso denegado', 'Necesitamos acceso a la cámara.');
                return;
            }
            result = await ImagePicker.launchCameraAsync({
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.5,
            });
        } else {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permiso denegado', 'Necesitamos acceso a la galería.');
                return;
            }
            result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: 'images',
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.5,
            });
        }

        if (!result.canceled) {
            uploadAvatar(result.assets[0].uri);
        }
    };

    const uploadAvatar = async (uri: string) => {
        if (!user) return;
        setUpdating(true);
        try {
            const fileExt = uri.split('.').pop() || 'png';
            const fileName = `${user.id}-${Date.now()}.${fileExt}`;
            const filePath = `avatars/${fileName}`;

            const formData = new FormData();
            formData.append('file', {
                uri,
                name: fileName,
                type: `image/${fileExt}`,
            } as any);

            const { error: uploadError } = await supabase.storage
                .from('organizations')
                .upload(filePath, formData);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('organizations')
                .getPublicUrl(filePath);

            const { error: updateError } = await supabase
                .from('profiles')
                .update({ avatar_url: publicUrl })
                .eq('id', user.id);

            if (updateError) throw updateError;
            setUser({ ...user, avatar_url: publicUrl });
            Alert.alert('Éxito', 'Foto de perfil actualizada.');
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
                <ActivityIndicator size="large" color={colors.primary[500]} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={[styles.header, { paddingTop: Math.max(insets.top, spacing.md) }]}>
                <View style={styles.headerContent}>
                    <View style={styles.logoRow}>
                        <Ionicons name="tennisball" size={24} color={colors.primary[500]} />
                        <Text style={styles.logoText}>SweetSpot</Text>
                    </View>

                    {isGlobalAdmin && (
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

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Profile Brief */}
                <View style={styles.profileSection}>
                    <View style={styles.profileMain}>
                        <TouchableOpacity style={styles.avatarContainer} onPress={handlePickImage} disabled={updating}>
                            <Image
                                source={user.avatar_url ? { uri: user.avatar_url } : require('../../assets/images/placeholder.png')}
                                style={styles.avatar}
                            />
                            <View style={styles.avatarEditBtn}>
                                {updating ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="camera" size={14} color="#fff" />}
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
                                            placeholder="Teléfono..."
                                            placeholderTextColor={colors.textTertiary}
                                            keyboardType="phone-pad"
                                        />
                                    </View>
                                </View>
                            </View>
                            <View>
                                {(user.role === 'admin' && viewMode === 'admin') ? (
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
                                    <Text style={styles.extraFieldLabel}>Revés:</Text>
                                    {isEditingBackhand ? (
                                        <TextInput
                                            style={styles.extraFieldInput}
                                            value={user.revés || ''}
                                            onChangeText={(val) => setUser({ ...user, revés: val })}
                                            onBlur={() => handleUpdateBackhand(user.revés)}
                                            placeholder="una mano/2 manos"
                                            placeholderTextColor={colors.textTertiary}
                                            autoFocus
                                        />
                                    ) : (
                                        <Text style={styles.extraFieldText}>{user.revés || 'una mano/2 manos'}</Text>
                                    )}
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.extraField} onPress={() => setIsEditingDominantHand(true)}>
                                    <Text style={styles.extraFieldLabel}>Mano dominante:</Text>
                                    {isEditingDominantHand ? (
                                        <TextInput
                                            style={styles.extraFieldInput}
                                            value={user.mano_dominante || ''}
                                            onChangeText={(val) => setUser({ ...user, mano_dominante: val })}
                                            onBlur={() => handleUpdateDominantHand(user.mano_dominante)}
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
                                        <ActivityIndicator size="small" color="#fff" />
                                    ) : (
                                        <Text style={styles.miniSaveBtnText}>Guardar cambios</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>

                    {/* Context Selector */}
                    {(userContexts.length > 0 || isGlobalAdmin) && (
                        <TouchableOpacity
                            style={styles.contextSelector}
                            onPress={() => (isGlobalAdmin && viewMode === 'admin') ? setShowOrgSearchModal(true) : setShowContextModal(true)}
                        >
                            <View style={styles.contextInfo}>
                                <Ionicons name="filter-outline" size={16} color={colors.primary[500]} />
                                <Text style={styles.contextText}>
                                    {selectedContext ? `${selectedContext.org_name} · ${selectedContext.level}` : 'Filtrar por Organización/Nivel'}
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={16} color={colors.primary[500]} />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Stats Bento */}
                <View style={styles.statsGrid}>
                    <View style={styles.mainRankCard}>
                        <Text style={styles.statLabel}>POSICIÓN RANKING</Text>
                        <View>
                            <Text style={styles.rankValue}>{stats.rank}</Text>
                            <View style={styles.rankStatus}>
                                <Text style={styles.rankStatusText}>{selectedContext?.level.toUpperCase() || 'GENERAL'}</Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.statsRightColumn}>
                        <View style={styles.statsMiniRow}>
                            <View style={styles.miniStatCard}>
                                <Ionicons name="trophy" size={24} color={colors.primary[500]} />
                                <Text style={styles.miniStatValue}>{stats.trophies}</Text>
                                <Text style={styles.miniStatLabel}>TROFEOS</Text>
                            </View>
                            <View style={styles.miniStatCard}>
                                <Ionicons name="medal" size={24} color={colors.textSecondary} />
                                <Text style={styles.miniStatValue}>{stats.wins}</Text>
                                <Text style={styles.miniStatLabel}>VICTORIAS</Text>
                            </View>
                        </View>
                        <View style={styles.statsMiniRow}>
                            <View style={styles.miniStatCard}>
                                <Ionicons name="analytics" size={24} color={colors.textSecondary} />
                                <Text style={stats.winRate === '0%' ? styles.miniStatValueDim : styles.miniStatValue}>
                                    {stats.winRate}
                                </Text>
                                <Text style={styles.miniStatLabel}>WIN RATE</Text>
                            </View>
                            <View style={styles.miniStatCard}>
                                <Ionicons name="tennisball" size={24} color={colors.textSecondary} />
                                <Text style={styles.miniStatValue}>{stats.totalMatches}</Text>
                                <Text style={styles.miniStatLabel}>PARTIDOS</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Recent Tournaments */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Torneos Recientes</Text>
                </View>

                <View style={styles.tournamentList}>
                    {recentTournaments.length > 0 ? recentTournaments.map((t) => (
                        <View key={t.id} style={styles.historyCard}>
                            <View style={styles.historyIcon}>
                                <Ionicons name="shield-checkmark" size={28} color={colors.primary[500]} />
                            </View>
                            <View style={styles.historyInfo}>
                                <Text style={styles.historyName}>{t.name}</Text>
                                <Text style={styles.historyMeta}>{t.level} · {t.format}</Text>
                            </View>
                            <View style={styles.historyResult}>
                                <View style={t.place.includes('1°') ? styles.winnerBadge : styles.resultBadge}>
                                    <Text style={t.place.includes('1°') ? styles.winnerBadgeText : styles.resultBadgeText}>
                                        {t.place}
                                    </Text>
                                </View>
                                <Text style={styles.historyDate}>{new Date(t.end_date || t.start_date || Date.now()).toLocaleDateString()}</Text>
                            </View>
                        </View>
                    )) : (
                        <View style={styles.emptyCard}>
                            <Text style={styles.emptyText}>No has participado en torneos aún.</Text>
                        </View>
                    )}
                </View>

                {/* Account Settings */}
                <View style={styles.settingsSection}>
                    <Text style={styles.settingsTitle}>Configuración de Cuenta</Text>

                    <View style={styles.settingsGrid}>
                        <TouchableOpacity style={styles.settingItem}>
                            <View style={styles.settingIcon}>
                                <Ionicons name="notifications-outline" size={20} color={colors.textSecondary} />
                            </View>
                            <View style={styles.settingText}>
                                <Text style={styles.settingLabel}>Notificaciones</Text>
                                <Text style={styles.settingDesc}>Alertas de partidos y eventos</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={colors.border} />
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.settingItem}>
                            <View style={styles.settingIcon}>
                                <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} />
                            </View>
                            <View style={styles.settingText}>
                                <Text style={styles.settingLabel}>Privacidad</Text>
                                <Text style={styles.settingDesc}>Contraseña y visibilidad</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={colors.border} />
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.settingItem} onPress={toggleTheme}>
                            <View style={styles.settingIcon}>
                                <Ionicons name={isDark ? "sunny-outline" : "moon-outline"} size={20} color={colors.textSecondary} />
                            </View>
                            <View style={styles.settingText}>
                                <Text style={styles.settingLabel}>{isDark ? "Modo Claro" : "Modo Oscuro"}</Text>
                                <Text style={styles.settingDesc}>Cambiar el tema de la aplicación</Text>
                            </View>
                            <View style={[styles.themeToggle, { backgroundColor: isDark ? colors.surfaceSecondary : colors.primary[500] }]}>
                                <View style={[styles.themeToggleCircle, { alignSelf: isDark ? 'flex-start' : 'flex-end' }]} />
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.settingItem} onPress={handleSignOut}>
                            <View style={styles.settingIcon}>
                                <Ionicons name="log-out-outline" size={20} color={colors.error} />
                            </View>
                            <View style={styles.settingText}>
                                <Text style={[styles.settingLabel, { color: colors.error }]}>Cerrar Sesión</Text>
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
                            <Text style={styles.modalTitle}>Ver Estadísticas en:</Text>
                            <TouchableOpacity onPress={() => setShowContextModal(false)}>
                                <Ionicons name="close" size={24} color="#fff" />
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
                                        {ctx.org_name} · {ctx.level}
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
                                <Ionicons name="close" size={24} color="#fff" />
                            </TouchableOpacity>
                        </View>
                        <TextInput
                            style={styles.modalSearchInput}
                            placeholder="Buscar organización..."
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
                                        {/* Levels usually fixed or fetched from registrations. Here we can offer standard ones or fetch unique levels for this org */}
                                        <View style={styles.levelChips}>
                                            {['Primera', 'Segunda', 'Tercera', 'Cuarta', 'Quinta', 'Honor'].map(lvl => (
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
    userBio: {
        fontSize: 13,
        color: colors.textSecondary,
        lineHeight: 18,
        marginTop: 4,
    },
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
    statsGrid: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    mainRankCard: {
        flex: 1,
        backgroundColor: colors.surface,
        borderRadius: borderRadius['3xl'],
        padding: spacing.lg,
        borderLeftWidth: 8,
        borderLeftColor: colors.primary[500],
        justifyContent: 'center',
        minHeight: 140,
    },
    statLabel: {
        fontSize: 8,
        fontWeight: '800',
        color: colors.textTertiary,
        letterSpacing: 1,
        marginBottom: 8,
    },
    rankValue: {
        fontSize: 48,
        fontWeight: '900',
        color: colors.text,
        fontStyle: 'italic',
        lineHeight: 48,
    },
    rankStatus: {
        marginTop: 4,
    },
    rankStatusText: {
        color: colors.primary[300],
        fontSize: 10,
        fontWeight: '700',
    },
    statsRightColumn: {
        flex: 1.5,
        gap: spacing.lg,
    },
    statsMiniRow: {
        flexDirection: 'row',
        gap: spacing.md,
        flex: 1,
    },
    miniStatCard: {
        flex: 1,
        backgroundColor: colors.surfaceSecondary + '1A', // Using very light transparency
        borderRadius: borderRadius['2xl'],
        padding: spacing.sm,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    miniStatValue: {
        fontSize: 20,
        fontWeight: '900',
        color: colors.text,
        marginTop: 6,
    },
    miniStatValueDim: {
        fontSize: 20,
        fontWeight: '900',
        color: colors.textTertiary,
        marginTop: 6,
    },
    miniStatLabel: {
        fontSize: 8,
        fontWeight: '800',
        color: colors.textTertiary,
        marginTop: 4,
        letterSpacing: 0.2,
        textAlign: 'center',
    },
    bioInput: {
        fontSize: 13,
        color: colors.text,
        lineHeight: 18,
        marginTop: 4,
        padding: 0,
        backgroundColor: colors.surfaceSecondary + '10',
        borderRadius: 4,
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
    prominentFilters: {
        flexDirection: 'row',
        gap: spacing.md,
        marginTop: spacing.sm,
    },
    prominentFilter: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        padding: spacing.md,
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: colors.border,
        gap: 8,
    },
    prominentFilterIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.primary[500] + '10',
        justifyContent: 'center',
        alignItems: 'center',
    },
    prominentFilterTextContainer: {
        flex: 1,
    },
    prominentFilterLabel: {
        fontSize: 8,
        fontWeight: '800',
        color: colors.textTertiary,
        letterSpacing: 0.5,
    },
    prominentFilterValue: {
        fontSize: 11,
        fontWeight: '700',
        color: colors.textSecondary,
    },
    miniSaveBtn: {
        backgroundColor: colors.primary[500],
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: borderRadius.md,
        alignSelf: 'flex-start',
        marginTop: 10,
    },
    miniSaveBtnText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '800',
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
    adminManagementCard: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius['2xl'],
        padding: spacing.xl,
        borderWidth: 1,
        borderColor: colors.border,
        gap: spacing.md,
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
    },
    levelChipTextActive: {
        color: '#fff',
    },
    saveButton: {
        backgroundColor: colors.primary[500],
        paddingVertical: spacing.lg,
        borderRadius: borderRadius.xl,
        alignItems: 'center',
        justifyContent: 'center',
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '800',
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
});
