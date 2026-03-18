import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Dimensions, Alert, ActivityIndicator, TextInput, Modal, BackHandler, Platform, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, borderRadius } from '@/theme';
import { supabase } from '@/services/supabase';
import { useRouter, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { getTournamentPlacements } from '@/services/ranking';
import { adminModeService } from '@/services/adminMode';
import { notificationService } from '@/services/notificationService';

const { width } = Dimensions.get('window');
const GLOBAL_ADMIN_EMAIL = 'javier.aravena25@gmail.com';

export default function ProfileScreen() {
    const insets = useSafeAreaInsets();
    const { colors, toggleTheme, isDark } = useTheme();
    const styles = getStyles(colors);
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [updating, setUpdating] = useState(false);
    const [user, setUser] = useState<any>(null);
    const [stats, setStats] = useState({
        rank: '-',
        trophies: 0,
        wins: 0,
        winRate: '0%',
        totalMatches: 0,
        setsWon: 0,
        setsLost: 0,
        gamesWon: 0,
        gamesLost: 0
    });
    const [modality, setModality] = useState<'singles' | 'dobles'>('singles');
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

    useEffect(() => {
        const backAction = () => {
            if (showContextModal) {
                setShowContextModal(false);
                return true;
            }
            if (showOrgSearchModal) {
                setShowOrgSearchModal(false);
                return true;
            }
            return false;
        };

        const backHandler = BackHandler.addEventListener(
            'hardwareBackPress',
            backAction
        );

        return () => backHandler.remove();
    }, [showContextModal, showOrgSearchModal]);

    useFocusEffect(
        useCallback(() => {
            loadProfileData();
        }, [])
    );

    useEffect(() => {
        if (selectedContext) {
            calculateStats();
        }
    }, [selectedContext, user?.id, modality]);

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
                        id, name, level, status, end_date, format, start_date, modality
                    )
                `)
                .eq('player_id', session.user.id)
                .order('registered_at', { ascending: false })
                .limit(3);

            if (!recentErr && recent) {
                const tourData = await Promise.all(recent.map(async (r: any) => {
                    const t = r.tournaments;
                    if (t.status === 'completed' || t.status === 'finalized' || t.status === 'finished') {
                        const { data: tMatches } = await supabase.from('matches').select('*').eq('tournament_id', t.id);
                        const placements = getTournamentPlacements(t, tMatches || []);
                        const myPlacement = placements.find(p => p.playerId === session.user.id || p.playerId2 === session.user.id);
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
            .select('*')
            .order('name');
        if (data && !error) {
            setAllOrganizations(data);
        }
    };

    const calculateStats = async () => {
        if (!selectedContext || !user) return;

        try {
            const { data: matches, error: matchErr } = await supabase
                .from('matches')
                .select('*, tournaments!inner(organization_id, level, status, modality)')
                .eq('tournaments.organization_id', selectedContext.org_id)
                .eq('tournaments.level', selectedContext.level)
                .eq('tournaments.modality', modality)
                .or(`player_a_id.eq.${user.id},player_a2_id.eq.${user.id},player_b_id.eq.${user.id},player_b2_id.eq.${user.id}`);

            if (matchErr) throw matchErr;

            const totalMatches = matches?.length || 0;
            const wins = matches?.filter(m => m.winner_id === user.id || m.winner_2_id === user.id).length || 0;
            const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;

            let setsWon = 0;
            let setsLost = 0;
            let gamesWon = 0;
            let gamesLost = 0;

            matches?.forEach(m => {
                const isPlayerA = m.player_a_id === user.id || m.player_a2_id === user.id;
                if (m.score) {
                    const sets = m.score.split(/\s*,\s*/);
                    sets.forEach((s: string) => {
                        const parts = s.trim().split(/[- ]+/).map(Number);
                        if (parts.length >= 2) {
                            const [s1, s2] = parts;
                            if (!isNaN(s1) && !isNaN(s2)) {
                                if (isPlayerA) {
                                    gamesWon += s1;
                                    gamesLost += s2;
                                    if (s1 > s2) setsWon++;
                                    else if (s2 > s1) setsLost++;
                                } else {
                                    gamesWon += s2;
                                    gamesLost += s1;
                                    if (s2 > s1) setsWon++;
                                    else if (s1 > s2) setsLost++;
                                }
                            }
                        }
                    });
                }
            });

            const { data: tournaments, error: tourErr } = await supabase
                .from('tournaments')
                .select('*')
                .eq('organization_id', selectedContext.org_id)
                .eq('level', selectedContext.level)
                .eq('modality', modality)
                .in('status', ['completed', 'finalized', 'finished']);

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
                        if ((p.playerId === user.id || p.playerId2 === user.id) && p.place === '1') trophies++;
                        if (p.playerId) allPlayersPoints[p.playerId] = (allPlayersPoints[p.playerId] || 0) + p.points;
                        if (p.playerId2) allPlayersPoints[p.playerId2] = (allPlayersPoints[p.playerId2] || 0) + p.points;
                    });
                });
            }

            const sortedRanking = Object.entries(allPlayersPoints).sort((a, b) => b[1] - a[1]);
            const userRankIndex = sortedRanking.findIndex(([id]) => id === user.id);
            const rank = userRankIndex !== -1 ? `#${userRankIndex + 1}` : '-';

            setStats({
                rank,
                trophies,
                wins,
                winRate: `${winRate}%`,
                totalMatches,
                setsWon,
                setsLost,
                gamesWon,
                gamesLost
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

    const handleUpdateBackhand = (val: string) => {
        setUser({ ...user, revés: val });
    };

    const handleUpdateDominantHand = (val: string) => {
        setUser({ ...user, mano_dominante: val });
    };

    const handleToggleNotifications = async () => {
        if (!user) return;
        const newValue = !user.notifications_enabled;
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
            Alert.alert('Error', 'No se pudo actualizar la configuración de notificaciones.');
        } finally {
            setUpdating(false);
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
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
                                    <Text style={styles.extraFieldLabel}>Revés:</Text>
                                    {isEditingBackhand ? (
                                        <TextInput
                                            style={styles.extraFieldInput}
                                            value={user.revés || ''}
                                            onChangeText={handleUpdateBackhand}
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

                    {/* Modality Selector */}
                    <View style={styles.modalitySelector}>
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

                {/* Stats Bento */}
                <View style={styles.statsGrid}>
                    <View style={styles.mainRankCard}>
                        <Text style={styles.statLabel} numberOfLines={1}>POSICIÓN RANKING</Text>
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
                                <Text style={styles.miniStatLabel} numberOfLines={1}>TROFEOS</Text>
                            </View>
                            <View style={styles.miniStatCard}>
                                <Ionicons name="medal" size={24} color={colors.textSecondary} />
                                <Text style={styles.miniStatValue}>{stats.wins}</Text>
                                <Text style={styles.miniStatLabel} numberOfLines={1}>VICTORIAS</Text>
                            </View>
                        </View>
                        <View style={styles.statsMiniRow}>
                            <View style={styles.miniStatCard}>
                                <Ionicons name="analytics" size={24} color={colors.textSecondary} />
                                <Text style={stats.winRate === '0%' ? styles.miniStatValueDim : styles.miniStatValue}>
                                    {stats.winRate}
                                </Text>
                                <Text style={styles.miniStatLabel} numberOfLines={1}>WIN RATE</Text>
                            </View>
                            <View style={styles.miniStatCard}>
                                <Ionicons name="tennisball" size={24} color={colors.textSecondary} />
                                <Text style={styles.miniStatValue}>{stats.totalMatches}</Text>
                                <Text style={styles.miniStatLabel} numberOfLines={1}>PARTIDOS</Text>
                            </View>
                        </View>
                        
                        <View style={styles.setsFullCard}>
                             <View style={styles.setStatItem}>
                                <Text style={[styles.setStatValue, { color: colors.success }]}>{stats.setsWon}</Text>
                                <Text style={styles.setStatLabel}>TOTAL SETS GANADOS</Text>
                             </View>
                             <View style={styles.setStatDivider} />
                             <View style={styles.setStatItem}>
                                <Text style={[styles.setStatValue, { color: colors.error }]}>{stats.setsLost}</Text>
                                <Text style={styles.setStatLabel}>TOTAL SETS PERDIDOS</Text>
                             </View>
                        </View>

                        <View style={[styles.setsFullCard, { marginTop: spacing.md }]}>
                             <View style={styles.setStatItem}>
                                <Text style={[styles.setStatValue, { color: colors.success }]}>{stats.gamesWon}</Text>
                                <Text style={styles.setStatLabel}>TOTAL GAMES GANADOS</Text>
                             </View>
                             <View style={styles.setStatDivider} />
                             <View style={styles.setStatItem}>
                                <Text style={[styles.setStatValue, { color: colors.error }]}>{stats.gamesLost}</Text>
                                <Text style={styles.setStatLabel}>TOTAL GAMES PERDIDOS</Text>
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
                                <Text style={styles.historyMeta}>{t.level} · {t.format} · {t.modality === 'dobles' ? 'Dobles' : 'Singles'}</Text>
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
                                <Ionicons name="moon-outline" size={20} color={isDark ? colors.primary[500] : colors.textSecondary} />
                            </View>
                            <View style={styles.settingText}>
                                <Text style={styles.settingLabel}>Modo Oscuro</Text>
                                <Text style={styles.settingDesc}>Cambiar el tema de la aplicación</Text>
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
                                        <View style={styles.levelChips}>
                                            {['Primera', 'Segunda', 'Tercera', 'Cuarta', 'Quinta', 'Honor', 'Escalafón'].map(lvl => (
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
    miniSaveBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

    modalitySelector: { flexDirection: 'row', backgroundColor: colors.surfaceSecondary, borderRadius: borderRadius.lg, padding: 4, marginTop: spacing.md },
    modalityBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: borderRadius.md },
    modalityBtnActive: { backgroundColor: colors.surface, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
    modalityBtnText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
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
        backgroundColor: colors.surfaceSecondary + '1A',
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
    setsFullCard: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius['2xl'],
        padding: spacing.lg,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        borderWidth: 1,
        borderColor: colors.border,
        minHeight: 80,
    },
    setStatItem: {
        alignItems: 'center',
        flex: 1,
        paddingHorizontal: spacing.xs,
    },
    setStatValue: {
        fontSize: 22,
        fontWeight: '900',
    },
    setStatLabel: {
        fontSize: 9,
        fontWeight: '800',
        color: colors.textTertiary,
        marginTop: 4,
        textAlign: 'center',
    },
    setStatDivider: {
        width: 1,
        height: '60%',
        backgroundColor: colors.border,
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
