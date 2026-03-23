import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, Image, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, spacing, borderRadius } from '@/theme';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/services/supabase';
import * as ImagePicker from 'expo-image-picker';
import { getCurrentUserAccessContext } from '@/services/accessControl';
import { resolveStorageAssetUrlWithRetry } from '@/services/storage';
import * as SecureStore from 'expo-secure-store';
import { TennisSpinner } from '@/components/TennisSpinner';

const ROLE_OPTIONS = ['player', 'admin'] as const;
const PROTECTED_SUPER_ADMIN_ROLE = 'super_admin';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp']);
const IMAGE_MIME_BY_EXTENSION: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
};

const normalizeAssignableRole = (role: string | null | undefined): (typeof ROLE_OPTIONS)[number] =>
    role === 'admin' || role === 'organizer' ? 'admin' : 'player';

const isProtectedSuperAdmin = (user: any) =>
    user?.is_super_admin === true || user?.role === PROTECTED_SUPER_ADMIN_ROLE;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const WHATSAPP_PATTERN = /^[0-9+\s()-]{0,30}$/;
const URL_PATTERN = /^https?:\/\/.+/i;

const getExtensionFromUri = (uri: string) => {
    const sanitized = uri.split('?')[0].trim();
    const dotIndex = sanitized.lastIndexOf('.');
    if (dotIndex < 0 || dotIndex === sanitized.length - 1) return '';
    return sanitized.slice(dotIndex + 1).toLowerCase();
};

export default function SettingsScreen() {
    const insets = useSafeAreaInsets();
    const { colors } = useTheme();
    const styles = getStyles(colors);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savingLogo, setSavingLogo] = useState(false);
    const [organization, setOrganization] = useState<any>(null);
    const [orgName, setOrgName] = useState('');
    const [logoPath, setLogoPath] = useState('');
    const [logoUrl, setLogoUrl] = useState('');
    const [contactEmail, setContactEmail] = useState('');
    const [contactWhatsapp, setContactWhatsapp] = useState('');
    const [socialLinks, setSocialLinks] = useState('');
    const [photosDriveUrl, setPhotosDriveUrl] = useState('');
    const [isAdmin, setIsAdmin] = useState(false);
    const [isGlobalAdmin, setIsGlobalAdmin] = useState(false);

    // Global Admin States
    const [allOrganizations, setAllOrganizations] = useState<any[]>([]);
    const [orgSearch, setOrgSearch] = useState('');
    const [userSearch, setUserSearch] = useState('');
    const [userSearchResults, setUserSearchResults] = useState<any[]>([]);
    const [isSearchingUsers, setIsSearchingUsers] = useState(false);
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [showUserModal, setShowUserModal] = useState(false);

    // Create Organization States
    const [showCreateOrgModal, setShowCreateOrgModal] = useState(false);
    const [newOrgName, setNewOrgName] = useState('');
    const [newOrgEmail, setNewOrgEmail] = useState('');
    const [newOrgWhatsapp, setNewOrgWhatsapp] = useState('');
    const [newOrgSocial, setNewOrgSocial] = useState('');
    const [newOrgDrive, setNewOrgDrive] = useState('');

    useEffect(() => {
        loadInitialData();
    }, []);

    const loadInitialData = async () => {
        setLoading(true);
        try {
            const access = await getCurrentUserAccessContext();
            if (!access) return;
            const selectedOrgId = await SecureStore.getItemAsync('selected_org_id');

            setIsGlobalAdmin(access.isSuperAdmin);

            if (!access.isAdmin) {
                setIsAdmin(false);
                setLoading(false);
                return;
            }

            const targetOrgId = access.isSuperAdmin
                ? (selectedOrgId || access.profile.org_id || null)
                : (access.profile.org_id || null);
            const hasAdminRole = access.profile.role === 'admin' || access.profile.role === 'organizer';
            const canManageTargetOrg = access.isSuperAdmin || Boolean(hasAdminRole && access.profile.org_id);

            if (!canManageTargetOrg) {
                setIsAdmin(true);
                setOrganization(null);
                return;
            }

            setIsAdmin(true);

            if (access.isSuperAdmin) {
                await fetchAllOrganizations();
            }

            if (targetOrgId) {
                await fetchOrgDetails(targetOrgId);
                if (!access.isSuperAdmin) {
                    await SecureStore.setItemAsync('selected_org_id', targetOrgId);
                }
            }
        } catch (error) {
            Alert.alert('Error', 'No se pudo cargar la configuración.');
        } finally {
            setLoading(false);
        }
    };

    const fetchOrgDetails = async (orgId: string) => {
        const { data: org, error: orgErr } = await supabase
            .from('organizations')
            .select('id, name, logo_url, contact_email, contact_whatsapp, social_links, photos_drive_url')
            .eq('id', orgId)
            .single();

        let resolvedOrg = org;

        if (!resolvedOrg || orgErr) {
            const { data: publicOrg } = await supabase
                .from('organizations_public')
                .select('id, name, logo_url')
                .eq('id', orgId)
                .single();

            if (!publicOrg) {
                setOrganization(null);
                return;
            }

            resolvedOrg = {
                ...publicOrg,
                contact_email: null,
                contact_whatsapp: null,
                social_links: null,
                photos_drive_url: null,
            };
        }

        const signedLogoUrl = await resolveStorageAssetUrlWithRetry(resolvedOrg.logo_url, { attempts: 4, baseDelayMs: 350 });
        setOrganization(resolvedOrg);
        setOrgName(resolvedOrg.name || '');
        setLogoPath(resolvedOrg.logo_url || '');
        setLogoUrl(signedLogoUrl || '');
        setContactEmail(resolvedOrg.contact_email || '');
        setContactWhatsapp(resolvedOrg.contact_whatsapp || '');
        setSocialLinks(resolvedOrg.social_links || '');
        setPhotosDriveUrl(resolvedOrg.photos_drive_url || '');
        await SecureStore.setItemAsync('selected_org_name', resolvedOrg.name || '');
    };

    const fetchAllOrganizations = async () => {
        const { data, error } = await supabase
            .from('organizations')
            .select('id, name, logo_url')
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
            const response = await fetch(uri);
            const fileBytes = typeof response.arrayBuffer === 'function'
                ? await response.arrayBuffer()
                : await (await response.blob()).arrayBuffer();
            const fileSize = fileBytes.byteLength;
            if (!fileSize || fileSize > MAX_IMAGE_BYTES) {
                Alert.alert('Error', 'La imagen supera el tamaño máximo permitido (5MB).');
                return;
            }

            const headerMimeType = (response.headers.get('content-type') || '')
                .split(';')[0]
                .trim()
                .toLowerCase();
            const extensionFromUri = getExtensionFromUri(uri);
            const extensionFromMime = headerMimeType.startsWith('image/')
                ? headerMimeType.replace('image/', '').toLowerCase()
                : '';
            const fileExt = ALLOWED_IMAGE_EXTENSIONS.has(extensionFromMime)
                ? extensionFromMime
                : (ALLOWED_IMAGE_EXTENSIONS.has(extensionFromUri) ? extensionFromUri : 'jpg');

            if (!ALLOWED_IMAGE_EXTENSIONS.has(fileExt)) {
                Alert.alert('Error', 'Formato de imagen no permitido.');
                return;
            }

            const mimeType = IMAGE_MIME_BY_EXTENSION[fileExt] || 'image/jpeg';
            const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 12)}.${fileExt}`;
            const filePath = `logos/${organization.id}/${fileName}`;

            const { error } = await supabase.storage
                .from('organizations')
                .upload(filePath, fileBytes, {
                    contentType: mimeType,
                    upsert: false,
                });

            if (error) throw error;

            const { error: logoUpdateError } = await supabase
                .from('organizations')
                .update({ logo_url: filePath })
                .eq('id', organization.id);

            if (logoUpdateError) throw logoUpdateError;

            const signedLogoUrl = await resolveStorageAssetUrlWithRetry(filePath, { attempts: 4, baseDelayMs: 350 });
            setLogoPath(filePath);
            setLogoUrl(signedLogoUrl || uri);
            setOrganization((current: any) => current ? { ...current, logo_url: filePath } : current);
        } catch (error) {
            Alert.alert('Error', 'No se pudo subir la imagen.');
        } finally {
            setSavingLogo(false);
        }
    };

    const handleSaveGeneral = async () => {
        if (!organization) return;
        setSaving(true);
        try {
            const normalizedName = orgName.trim().slice(0, 80);
            const normalizedContactEmail = contactEmail.trim().toLowerCase().slice(0, 120);
            const normalizedWhatsapp = contactWhatsapp.trim().slice(0, 30);
            const normalizedSocialLinks = socialLinks.trim().slice(0, 500);
            const normalizedPhotosDriveUrl = photosDriveUrl.trim().slice(0, 500);

            if (normalizedContactEmail && !EMAIL_PATTERN.test(normalizedContactEmail)) {
                Alert.alert('Error', 'El correo de contacto no tiene un formato válido.');
                return;
            }

            if (normalizedWhatsapp && !WHATSAPP_PATTERN.test(normalizedWhatsapp)) {
                Alert.alert('Error', 'El WhatsApp de contacto solo puede incluir números y símbolos básicos.');
                return;
            }

            if (normalizedPhotosDriveUrl && !URL_PATTERN.test(normalizedPhotosDriveUrl)) {
                Alert.alert('Error', 'El enlace de fotos debe comenzar con http:// o https://');
                return;
            }

            const fullPayload = {
                name: normalizedName,
                logo_url: logoPath || null,
                contact_email: normalizedContactEmail || null,
                contact_whatsapp: normalizedWhatsapp || null,
                social_links: normalizedSocialLinks || null,
                photos_drive_url: normalizedPhotosDriveUrl || null,
            };

            const { error: fullUpdateError } = await supabase
                .from('organizations')
                .update(fullPayload)
                .eq('id', organization.id);

            if (fullUpdateError) {
                const { error: fallbackError } = await supabase
                    .from('organizations')
                    .update({
                        name: normalizedName,
                        logo_url: logoPath || null,
                    })
                    .eq('id', organization.id);
                if (fallbackError) throw fallbackError;
            }

            await SecureStore.setItemAsync('selected_org_name', normalizedName);
            setOrganization((current: any) => current ? ({
                ...current,
                name: normalizedName,
                logo_url: logoPath || null,
                contact_email: normalizedContactEmail || null,
                contact_whatsapp: normalizedWhatsapp || null,
                social_links: normalizedSocialLinks || null,
                photos_drive_url: normalizedPhotosDriveUrl || null,
            }) : current);
            Alert.alert('Éxito', 'Configuración guardada.');
        } catch (error) {
            Alert.alert('Error', 'No se pudo guardar la configuración.');
        } finally {
            setSaving(false);
        }
    };

    const handleCreateOrganization = async () => {
        const normalizedName = newOrgName.trim().slice(0, 80);
        const normalizedEmail = newOrgEmail.trim().toLowerCase().slice(0, 120);
        const normalizedWhatsapp = newOrgWhatsapp.trim().slice(0, 30);
        const normalizedSocial = newOrgSocial.trim().slice(0, 500);
        const normalizedDrive = newOrgDrive.trim().slice(0, 500);

        if (!normalizedName) {
            Alert.alert('Error', 'El nombre de la organización es obligatorio.');
            return;
        }
        setSaving(true);
        try {
            const fullPayload = {
                name: normalizedName,
                contact_email: normalizedEmail || null,
                contact_whatsapp: normalizedWhatsapp || null,
                social_links: normalizedSocial || null,
                photos_drive_url: normalizedDrive || null,
            };

            const { error } = await supabase
                .from('organizations')
                .insert([fullPayload]);

            if (error) {
                const { error: fallbackError } = await supabase
                    .from('organizations')
                    .insert([{ name: normalizedName }]);

                if (fallbackError) throw fallbackError;
            }

            Alert.alert('Éxito', 'Organización creada correctamente.');
            setShowCreateOrgModal(false);
            
            // Reset form
            setNewOrgName('');
            setNewOrgEmail('');
            setNewOrgWhatsapp('');
            setNewOrgSocial('');
            setNewOrgDrive('');

            // Refresh list and select the new one
            await fetchAllOrganizations();
        } catch (error) {
            console.error('Error creating organization:', error);
            Alert.alert('Error', 'No se pudo crear la organización.');
        } finally {
            setSaving(false);
        }
    };

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
                .select('id, name, role, org_id, is_super_admin')
                .ilike('name', `%${query}%`)
                .limit(10);

            if (error) throw error;
            if (data) {
                const safeResults = data.map((user: any) => ({
                    ...user,
                    role: isProtectedSuperAdmin(user) ? PROTECTED_SUPER_ADMIN_ROLE : normalizeAssignableRole(user.role),
                }));
                setUserSearchResults(safeResults);
            }
        } catch (error) {
            setUserSearchResults([]);
        } finally {
            setIsSearchingUsers(false);
        }
    };

    const handleUpdateUser = async () => {
        if (!selectedUser || !isGlobalAdmin) return;
        if (isProtectedSuperAdmin(selectedUser)) {
            Alert.alert('Aviso', 'El rol super_admin es protegido y no se puede editar desde esta vista.');
            return;
        }

        setSaving(true);
        try {
            const normalizedRole = normalizeAssignableRole(selectedUser.role);
            const normalizedOrgId = normalizedRole === 'admin' ? selectedUser.org_id || null : null;

            const { error } = await supabase
                .from('profiles')
                .update({
                    role: normalizedRole,
                    org_id: normalizedOrgId
                })
                .eq('id', selectedUser.id);
            
            if (error) throw error;
            Alert.alert('Éxito', 'Usuario actualizado correctamente.');
            setShowUserModal(false);
            handleSearchUsers(userSearch); // Refresh list
        } catch (error) {
            Alert.alert('Error', 'No se pudo actualizar el usuario.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
                <TennisSpinner size={34} />
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
                        <View style={styles.sectionHeaderRow}>
                            <Text style={styles.sectionTitle}>Contexto de Organización</Text>
                            <TouchableOpacity 
                                style={styles.createOrgBtn}
                                onPress={() => setShowCreateOrgModal(true)}
                            >
                                <Ionicons name="add-circle-outline" size={20} color="#fff" />
                                <Text style={styles.createOrgBtnText}>Nueva</Text>
                            </TouchableOpacity>
                        </View>
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
                                    <TennisSpinner size={22} />
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

                        <View style={styles.inputGroup}>
                            <Text style={styles.sectionSubtitle}>Contacto y Enlaces</Text>

                            <Text style={styles.label}>Correo de contacto</Text>
                            <TextInput
                                style={styles.input}
                                value={contactEmail}
                                onChangeText={setContactEmail}
                                placeholder="contacto@tuorganizacion.cl"
                                placeholderTextColor={colors.textTertiary}
                                autoCapitalize="none"
                                keyboardType="email-address"
                            />

                            <Text style={styles.label}>WhatsApp de contacto</Text>
                            <TextInput
                                style={styles.input}
                                value={contactWhatsapp}
                                onChangeText={setContactWhatsapp}
                                placeholder="+56 9 1234 5678"
                                placeholderTextColor={colors.textTertiary}
                                keyboardType="phone-pad"
                            />

                            <Text style={styles.label}>Redes sociales</Text>
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                value={socialLinks}
                                onChangeText={setSocialLinks}
                                placeholder="Ej: Instagram @clubtenis, Facebook /clubtenis"
                                placeholderTextColor={colors.textTertiary}
                                multiline
                            />

                            <Text style={styles.label}>Enlace de fotos (Google Drive)</Text>
                            <TextInput
                                style={styles.input}
                                value={photosDriveUrl}
                                onChangeText={setPhotosDriveUrl}
                                placeholder="https://drive.google.com/..."
                                placeholderTextColor={colors.textTertiary}
                                autoCapitalize="none"
                            />
                        </View>

                        <TouchableOpacity 
                            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                            onPress={handleSaveGeneral}
                            disabled={saving}
                        >
                            {saving ? <TennisSpinner size={18} color="#fff" /> : <Text style={styles.saveButtonText}>Guardar Cambios</Text>}
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
                        {isSearchingUsers && <TennisSpinner size={18} style={{ marginTop: 10 }} />}
                        <View style={[styles.userList, { marginTop: spacing.md }]}>
                            {userSearchResults.map(user => (
                                <TouchableOpacity 
                                    key={user.id} 
                                    style={styles.userCard}
                                    onPress={() => {
                                        setSelectedUser({
                                            ...user,
                                            role: isProtectedSuperAdmin(user)
                                                ? PROTECTED_SUPER_ADMIN_ROLE
                                                : normalizeAssignableRole(user.role),
                                        });
                                        setShowUserModal(true);
                                    }}
                                >
                                    <View>
                                        <Text style={styles.userNameText}>{user.name || 'Sin nombre'}</Text>
                                        <Text style={styles.userRoleText}>{String(user.role || 'player').toUpperCase()}</Text>
                                    </View>
                                    <Ionicons name="create-outline" size={20} color={colors.textSecondary} />
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                )}
            </ScrollView>

            {/* Create Organization Modal */}
            <Modal visible={showCreateOrgModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Nueva Organización</Text>
                            <TouchableOpacity onPress={() => setShowCreateOrgModal(false)}>
                                <Ionicons name="close" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Nombre *</Text>
                                <TextInput
                                    style={styles.input}
                                    value={newOrgName}
                                    onChangeText={setNewOrgName}
                                    placeholder="Nombre de la organización"
                                    placeholderTextColor={colors.textTertiary}
                                />

                                <Text style={styles.label}>Correo de contacto</Text>
                                <TextInput
                                    style={styles.input}
                                    value={newOrgEmail}
                                    onChangeText={setNewOrgEmail}
                                    placeholder="contacto@ejemplo.cl"
                                    placeholderTextColor={colors.textTertiary}
                                    autoCapitalize="none"
                                    keyboardType="email-address"
                                />

                                <Text style={styles.label}>WhatsApp</Text>
                                <TextInput
                                    style={styles.input}
                                    value={newOrgWhatsapp}
                                    onChangeText={setNewOrgWhatsapp}
                                    placeholder="+56 9 ..."
                                    placeholderTextColor={colors.textTertiary}
                                    keyboardType="phone-pad"
                                />

                                <Text style={styles.label}>Redes Sociales</Text>
                                <TextInput
                                    style={styles.input}
                                    value={newOrgSocial}
                                    onChangeText={setNewOrgSocial}
                                    placeholder="Instagram, Facebook, etc."
                                    placeholderTextColor={colors.textTertiary}
                                />

                                <Text style={styles.label}>Google Drive (Fotos)</Text>
                                <TextInput
                                    style={styles.input}
                                    value={newOrgDrive}
                                    onChangeText={setNewOrgDrive}
                                    placeholder="https://drive.google.com/..."
                                    placeholderTextColor={colors.textTertiary}
                                    autoCapitalize="none"
                                />
                            </View>

                            <TouchableOpacity 
                                style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                                onPress={handleCreateOrganization}
                                disabled={saving}
                            >
                                {saving ? <TennisSpinner size={18} color="#fff" /> : <Text style={styles.saveButtonText}>Crear Organización</Text>}
                            </TouchableOpacity>
                            <View style={{ height: 40 }} />
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* User Edit Modal */}
            <Modal visible={showUserModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Editar Usuario</Text>
                            <TouchableOpacity onPress={() => setShowUserModal(false)}>
                                <Ionicons name="close" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>

                        {selectedUser && (
                            <ScrollView>
                                {isProtectedSuperAdmin(selectedUser) ? (
                                    <View style={styles.protectedNotice}>
                                        <Text style={styles.protectedNoticeText}>
                                            Este usuario tiene rol super_admin protegido y no se puede editar desde esta pantalla.
                                        </Text>
                                    </View>
                                ) : (
                                    <>
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
                                    </>
                                )}

                                <TouchableOpacity 
                                    style={[styles.saveButton, { marginTop: spacing.xl }]} 
                                    onPress={handleUpdateUser}
                                    disabled={saving || isProtectedSuperAdmin(selectedUser)}
                                >
                                    {saving ? <TennisSpinner size={18} color="#fff" /> : <Text style={styles.saveButtonText}>Actualizar Usuario</Text>}
                                </TouchableOpacity>
                            </ScrollView>
                        )}
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
        color: colors.text,
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
        color: colors.text,
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
    sectionSubtitle: {
        fontSize: 13,
        fontWeight: '800',
        color: colors.primary[500],
        marginBottom: spacing.xs,
        textTransform: 'uppercase',
    },
    input: {
        backgroundColor: colors.background,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
        color: colors.text,
        fontSize: 16,
    },
    textArea: {
        minHeight: 88,
        textAlignVertical: 'top',
        paddingTop: spacing.md,
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
        overflow: 'visible',
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
        color: colors.text,
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
        color: colors.text,
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
        color: colors.text,
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
    protectedNotice: {
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
    },
    protectedNoticeText: {
        color: colors.textSecondary,
        fontSize: 14,
        lineHeight: 20,
    },
    orgSmallList: {
        maxHeight: 200,
        gap: 5,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    createOrgBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.success,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: borderRadius.md,
        gap: 4,
    },
    createOrgBtnText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '800',
    },
});
