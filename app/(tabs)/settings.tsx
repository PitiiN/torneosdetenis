import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert, Image, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius } from '@/theme';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/services/supabase';
import * as ImagePicker from 'expo-image-picker';

const GLOBAL_ADMIN_EMAIL = 'javier.aravena25@gmail.com';

const ROLE_OPTIONS = ['player', 'admin'];

export default function SettingsScreen() {
    const insets = useSafeAreaInsets();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savingLogo, setSavingLogo] = useState(false);
    const [organization, setOrganization] = useState<any>(null);
    const [orgName, setOrgName] = useState('');
    const [logoUrl, setLogoUrl] = useState('');
    const [isAdmin, setIsAdmin] = useState(false);
    const [isGlobalAdmin, setIsGlobalAdmin] = useState(false);
    const [userEmail, setUserEmail] = useState('');

    // Global Admin States
    const [allOrganizations, setAllOrganizations] = useState<any[]>([]);
    const [orgSearch, setOrgSearch] = useState('');
    const [userSearch, setUserSearch] = useState('');
    const [userSearchResults, setUserSearchResults] = useState<any[]>([]);
    const [isSearchingUsers, setIsSearchingUsers] = useState(false);
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [showUserModal, setShowUserModal] = useState(false);

    useEffect(() => {
        loadInitialData();
    }, []);

    const loadInitialData = async () => {
        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            setUserEmail(session.user.email || '');
            const isGlobal = session.user.email === GLOBAL_ADMIN_EMAIL;
            setIsGlobalAdmin(isGlobal);

            // Get user profile
            const { data: profile, error: profErr } = await supabase
                .from('profiles')
                .select('role, org_id')
                .eq('id', session.user.id)
                .single();

            if (profErr) throw profErr;

            if (profile.role !== 'admin' && !isGlobal) {
                setIsAdmin(false);
                setLoading(false);
                return;
            }

            setIsAdmin(true);

            if (profile.org_id) {
                fetchOrgDetails(profile.org_id);
            }

            if (isGlobal) {
                fetchAllOrganizations();
            }
        } catch (error) {
            console.error('Error loading settings:', error);
            Alert.alert('Error', 'No se pudo cargar la configuración.');
        } finally {
            setLoading(false);
        }
    };

    const fetchOrgDetails = async (orgId: string) => {
        const { data: org, error: orgErr } = await supabase
            .from('organizations')
            .select('*')
            .eq('id', orgId)
            .single();

        if (org && !orgErr) {
            setOrganization(org);
            setOrgName(org.name || '');
            setLogoUrl(org.logo_url || '');
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

    const handlePickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permiso denegado', 'Necesitamos permiso para acceder a tu galería.');
            return;
        }

        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: 'images',
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
        });

        if (!result.canceled) {
            uploadImage(result.assets[0].uri);
        }
    };

    const uploadImage = async (uri: string) => {
        if (!organization) return;
        setSavingLogo(true);
        try {
            const fileExt = uri.split('.').pop() || 'png';
            const fileName = `${organization.id}-${Date.now()}.${fileExt}`;
            const filePath = `logos/${fileName}`;

            // React Native File-like object for Supabase Storage
            const file = {
                uri: uri,
                name: fileName,
                type: `image/${fileExt}`
            } as any;

            const { data, error } = await supabase.storage
                .from('organizations')
                .upload(filePath, file, {
                    upsert: true
                });

            if (error) throw error;

            const { data: { publicUrl } } = supabase.storage
                .from('organizations')
                .getPublicUrl(filePath);

            setLogoUrl(publicUrl);
        } catch (error) {
            console.error('Error uploading image:', error);
            Alert.alert('Error', 'No se pudo subir la imagen.');
        } finally {
            setSavingLogo(false);
        }
    };

    const handleSaveGeneral = async () => {
        if (!organization) return;
        setSaving(true);
        try {
            const { error } = await supabase
                .from('organizations')
                .update({ 
                    name: orgName,
                    logo_url: logoUrl 
                })
                .eq('id', organization.id);

            if (error) throw error;
            Alert.alert('Éxito', 'Configuración guardada.');
        } catch (error) {
            console.error('Error saving settings:', error);
            Alert.alert('Error', 'No se pudo guardar la configuración.');
        } finally {
            setSaving(false);
        }
    };

    // Global Admin Handlers
    const handleSearchUsers = async (query: string) => {
        setUserSearch(query);
        if (query.length < 3) {
            setUserSearchResults([]);
            return;
        }

        setIsSearchingUsers(true);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .ilike('name', `%${query}%`)
                .limit(10);
            
            if (data) setUserSearchResults(data);
        } catch (error) {
            console.error('Error searching users:', error);
        } finally {
            setIsSearchingUsers(false);
        }
    };

    const handleUpdateUser = async () => {
        if (!selectedUser) return;
        setSaving(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    role: selectedUser.role,
                    org_id: selectedUser.org_id
                })
                .eq('id', selectedUser.id);
            
            if (error) throw error;
            Alert.alert('Éxito', 'Usuario actualizado correctamente.');
            setShowUserModal(false);
            handleSearchUsers(userSearch); // Refresh list
        } catch (error) {
            console.error('Error updating user:', error);
            Alert.alert('Error', 'No se pudo actualizar el usuario.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
                <ActivityIndicator size="large" color={colors.primary[500]} />
            </View>
        );
    }

    if (!isAdmin) {
        return (
            <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
                <Ionicons name="lock-closed-outline" size={64} color={colors.textTertiary} />
                <Text style={styles.emptyText}>Solo administradores pueden acceder a esta sección.</Text>
            </View>
        );
    }

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <Text style={styles.title}>Configuración</Text>
                <Text style={styles.subtitle}>{isGlobalAdmin ? 'Panel de Super Admin' : 'Gestiona tu organización'}</Text>
            </View>
            
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                
                {/* GLOBAL ADMIN SECTION: Organization Selector */}
                {isGlobalAdmin && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Contexto de Organización</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Buscar organización..."
                            placeholderTextColor={colors.textTertiary}
                            value={orgSearch}
                            onChangeText={setOrgSearch}
                        />
                        <View style={styles.orgList}>
                            {allOrganizations
                                .filter(o => o.name.toLowerCase().includes(orgSearch.toLowerCase()))
                                .slice(0, 5)
                                .map(org => (
                                    <TouchableOpacity 
                                        key={org.id} 
                                        style={[styles.orgItem, organization?.id === org.id && styles.orgItemActive]}
                                        onPress={() => fetchOrgDetails(org.id)}
                                    >
                                        <Text style={[styles.orgItemText, organization?.id === org.id && styles.orgItemTextActive]}>{org.name}</Text>
                                        {organization?.id === org.id && <Ionicons name="checkmark-circle" size={18} color={colors.primary[500]} />}
                                    </TouchableOpacity>
                                ))
                            }
                        </View>
                    </View>
                )}

                {/* GENERAL SETTINGS SECTION */}
                {organization ? (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Perfil de Organización</Text>
                        
                        {/* Interactive Card Preview */}
                        <View style={styles.cardPreviewContainer}>
                            <TouchableOpacity 
                                style={styles.logoUploadZone} 
                                onPress={handlePickImage} 
                                disabled={savingLogo}
                            >
                                {savingLogo ? (
                                    <ActivityIndicator color={colors.primary[500]} />
                                ) : logoUrl ? (
                                    <Image source={{ uri: logoUrl }} style={styles.logoImage} resizeMode="contain" />
                                ) : (
                                    <Ionicons name="business" size={40} color={colors.primary[500]} />
                                )}
                                <View style={styles.cameraIconBadge}>
                                    <Ionicons name="camera" size={14} color="#fff" />
                                </View>
                            </TouchableOpacity>
                            <Text style={styles.cardPreviewName}>{orgName || organization.name}</Text>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Nombre de la Organización</Text>
                            <TextInput
                                style={styles.input}
                                value={orgName}
                                onChangeText={setOrgName}
                                placeholder="Nombre de la organización"
                                placeholderTextColor={colors.textTertiary}
                            />
                        </View>

                        <TouchableOpacity 
                            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                            onPress={handleSaveGeneral}
                            disabled={saving}
                        >
                            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Guardar Cambios</Text>}
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.section}>
                        <Text style={styles.emptyText}>Selecciona una organización para editar su perfil.</Text>
                    </View>
                )}

                {/* GLOBAL ADMIN SECTION: User Management */}
                {isGlobalAdmin && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Gestión de Usuarios</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Buscar usuario por nombre..."
                            placeholderTextColor={colors.textTertiary}
                            value={userSearch}
                            onChangeText={handleSearchUsers}
                        />
                        {isSearchingUsers && <ActivityIndicator style={{ marginTop: 10 }} color={colors.primary[500]} />}
                        <View style={[styles.userList, { marginTop: spacing.md }]}>
                            {userSearchResults.map(user => (
                                <TouchableOpacity 
                                    key={user.id} 
                                    style={styles.userCard}
                                    onPress={() => {
                                        setSelectedUser(user);
                                        setShowUserModal(true);
                                    }}
                                >
                                    <View>
                                        <Text style={styles.userNameText}>{user.name || 'Sin nombre'}</Text>
                                        <Text style={styles.userRoleText}>{user.role.toUpperCase()}</Text>
                                    </View>
                                    <Ionicons name="create-outline" size={20} color={colors.textSecondary} />
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                )}
            </ScrollView>

            {/* User Edit Modal */}
            <Modal visible={showUserModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Editar Usuario</Text>
                            <TouchableOpacity onPress={() => setShowUserModal(false)}>
                                <Ionicons name="close" size={24} color="#fff" />
                            </TouchableOpacity>
                        </View>

                        {selectedUser && (
                            <ScrollView>
                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>Rol</Text>
                                    <View style={styles.optionsGrid}>
                                        {ROLE_OPTIONS.map(role => (
                                            <TouchableOpacity 
                                                key={role} 
                                                style={[styles.optionChip, selectedUser.role === role && styles.optionChipActive]}
                                                onPress={() => setSelectedUser({...selectedUser, role})}
                                            >
                                                <Text style={[styles.optionChipText, selectedUser.role === role && styles.optionChipTextActive]}>{role}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>

                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>Organización Asignada</Text>
                                    <ScrollView style={styles.orgSmallList}>
                                        <TouchableOpacity 
                                            style={[styles.orgItem, !selectedUser.org_id && styles.orgItemActive]}
                                            onPress={() => setSelectedUser({...selectedUser, org_id: null})}
                                        >
                                            <Text style={[styles.orgItemText, !selectedUser.org_id && styles.orgItemTextActive]}>Ninguna</Text>
                                        </TouchableOpacity>
                                        {allOrganizations.map(org => (
                                            <TouchableOpacity 
                                                key={org.id} 
                                                style={[styles.orgItem, selectedUser.org_id === org.id && styles.orgItemActive]}
                                                onPress={() => setSelectedUser({...selectedUser, org_id: org.id})}
                                            >
                                                <Text style={[styles.orgItemText, selectedUser.org_id === org.id && styles.orgItemTextActive]}>{org.name}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>

                                <TouchableOpacity 
                                    style={[styles.saveButton, { marginTop: spacing.xl }]} 
                                    onPress={handleUpdateUser}
                                    disabled={saving}
                                >
                                    {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Actualizar Usuario</Text>}
                                </TouchableOpacity>
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>
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
        padding: spacing.xl,
    },
    header: {
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: colors.surface,
    },
    title: {
        fontSize: 28,
        fontWeight: '900',
        color: '#fff',
    },
    subtitle: {
        fontSize: 14,
        color: colors.primary[500],
        fontWeight: '600',
    },
    content: {
        padding: spacing.xl,
        gap: spacing['2xl'],
    },
    section: {
        gap: spacing.md,
        backgroundColor: colors.surface,
        padding: spacing.xl,
        borderRadius: borderRadius['2xl'],
        borderWidth: 1,
        borderColor: colors.border,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#fff',
        marginBottom: spacing.xs,
    },
    inputGroup: {
        gap: spacing.sm,
        marginTop: spacing.sm,
    },
    label: {
        fontSize: 14,
        fontWeight: '700',
        color: colors.textSecondary,
    },
    input: {
        backgroundColor: colors.background,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
        color: '#fff',
        fontSize: 16,
    },
    cardPreviewContainer: {
        alignItems: 'center',
        paddingVertical: spacing.xl,
        gap: spacing.md,
    },
    logoUploadZone: {
        width: 100,
        height: 100,
        borderRadius: borderRadius.xl,
        backgroundColor: colors.surfaceSecondary,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: colors.border,
        overflow: 'visible', // To show badge
    },
    logoImage: {
        width: '100%',
        height: '100%',
        borderRadius: borderRadius.xl,
    },
    cameraIconBadge: {
        position: 'absolute',
        bottom: -5,
        right: -5,
        backgroundColor: colors.primary[500],
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: colors.surface,
    },
    cardPreviewName: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '800',
    },
    saveButton: {
        backgroundColor: colors.primary[500],
        paddingVertical: spacing.lg,
        borderRadius: borderRadius.xl,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: colors.primary[500],
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 5,
    },
    saveButtonDisabled: {
        opacity: 0.6,
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '800',
    },
    emptyText: {
        color: colors.textTertiary,
        fontSize: 14,
        textAlign: 'center',
    },
    orgList: {
        gap: 8,
        marginTop: 8,
    },
    orgItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: spacing.md,
        backgroundColor: colors.background,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
    },
    orgItemActive: {
        borderColor: colors.primary[500],
        backgroundColor: colors.primary[500] + '10',
    },
    orgItemText: {
        color: colors.textSecondary,
        fontWeight: '600',
    },
    orgItemTextActive: {
        color: colors.primary[500],
        fontWeight: '800',
    },
    userList: {
        gap: 10,
    },
    userCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: colors.background,
        padding: spacing.lg,
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: colors.border,
    },
    userNameText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 15,
    },
    userRoleText: {
        color: colors.textTertiary,
        fontSize: 11,
        fontWeight: '800',
        marginTop: 2,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: colors.surface,
        borderTopLeftRadius: borderRadius['3xl'],
        borderTopRightRadius: borderRadius['3xl'],
        padding: spacing.xl,
        maxHeight: '85%',
        gap: spacing.xl,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: '900',
        color: '#fff',
    },
    optionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    optionChip: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        borderRadius: borderRadius.full,
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.border,
    },
    optionChipActive: {
        backgroundColor: colors.primary[500],
        borderColor: colors.primary[500],
    },
    optionChipText: {
        color: colors.textSecondary,
        fontWeight: '700',
    },
    optionChipTextActive: {
        color: '#fff',
    },
    orgSmallList: {
        maxHeight: 200,
        gap: 5,
    }
});
