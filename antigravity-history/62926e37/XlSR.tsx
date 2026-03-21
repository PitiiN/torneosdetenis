import { useEffect, useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView,
    Modal, TextInput, FlatList, ActivityIndicator, Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/services/supabase';
import AdminBottomBar from '@/components/AdminBottomBar';
import { useAlertStore } from '@/store/alert.store';
import { colors, spacing, borderRadius } from '@/theme';

export default function AdminConfigScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { profile } = useAuth();

    // Role Management State
    const [showRoleModal, setShowRoleModal] = useState(false);
    const [userSearch, setUserSearch] = useState('');
    const [users, setUsers] = useState<any[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [showRolePicker, setShowRolePicker] = useState(false);

    // Price Settings State
    const [showPriceModal, setShowPriceModal] = useState(false);
    const [prices, setPrices] = useState({ pack1: '56000', pack2: '96000', pack3: '132000' });
    const [savingPrices, setSavingPrices] = useState(false);

    const loadUsers = async () => {
        if (!userSearch) return;
        setLoadingUsers(true);
        const { data } = await supabase
            .from('profiles')
            .select('id, full_name, email, role')
            .or(`full_name.ilike.%${userSearch}%,email.ilike.%${userSearch}%`)
            .limit(10);
        if (data) setUsers(data);
        setLoadingUsers(false);
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            if (userSearch) loadUsers();
        }, 500);
        return () => clearTimeout(timer);
    }, [userSearch]);

    const handleUpdateRole = async (role: string) => {
        if (!selectedUser) return;
        const { error } = await supabase
            .from('profiles')
            .update({ role })
            .eq('id', selectedUser.id);

        if (error) {
            useAlertStore.getState().showAlert('Error', error.message);
        } else {
            useAlertStore.getState().showAlert('✅ Rol actualizado', `Rol de ${selectedUser.full_name} cambiado a ${role}`);
            setShowRolePicker(false);
            setSelectedUser(null);
            setUserSearch('');
            setUsers([]);
        }
    };

    const loadPrices = async () => {
        const { data } = await supabase.from('app_settings').select('*').eq('key', 'pack_prices').maybeSingle();
        if (data && data.value) {
            setPrices(data.value);
        }
    };

    useEffect(() => { loadPrices(); }, []);

    const handleSavePrices = async () => {
        try {
            setSavingPrices(true);
            const { error } = await supabase.from('app_settings').upsert({
                key: 'pack_prices',
                value: prices
            });
            if (error) {
                useAlertStore.getState().showAlert('Error', error.message);
            } else {
                useAlertStore.getState().showAlert('✅ Precios guardados', 'Los valores han sido actualizados.');
                setShowPriceModal(false);
            }
        } catch (err: any) {
            useAlertStore.getState().showAlert('Error', err.message || 'Error al guardar precios');
        } finally {
            setSavingPrices(false);
        }
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <Text style={styles.title}>Configuración</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.profileSection}>
                    <View style={styles.avatarCircle}>
                        <Text style={styles.avatarText}>
                            {profile?.full_name?.charAt(0).toUpperCase() || 'A'}
                        </Text>
                    </View>
                    <Text style={styles.name}>{profile?.full_name}</Text>
                    <Text style={styles.email}>{profile?.email}</Text>
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>ADMINISTRADOR</Text>
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>Administración</Text>

                    <TouchableOpacity style={styles.actionRow} onPress={() => setShowRoleModal(true)}>
                        <View style={[styles.iconBox, { backgroundColor: colors.secondary[500] + '20' }]}>
                            <Ionicons name="people" size={20} color={colors.secondary[500]} />
                        </View>
                        <Text style={styles.actionText}>Asignar Roles</Text>
                        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionRow} onPress={() => setShowPriceModal(true)}>
                        <View style={[styles.iconBox, { backgroundColor: colors.accent[500] + '20' }]}>
                            <Ionicons name="pricetags" size={20} color={colors.accent[500]} />
                        </View>
                        <Text style={styles.actionText}>Configuración valores de clases</Text>
                        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                    </TouchableOpacity>
                </View>

                <View style={[styles.section, { marginTop: spacing.xl }]}>
                    <Text style={styles.sectionLabel}>Accesos</Text>
                    <TouchableOpacity
                        style={styles.actionRow}
                        onPress={() => router.replace('/(tabs)')}
                    >
                        <View style={[styles.iconBox, { backgroundColor: colors.primary[500] + '20' }]}>
                            <Ionicons name="eye" size={20} color={colors.primary[500]} />
                        </View>
                        <Text style={styles.actionText}>Cambiar a vista Usuario</Text>
                        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                    </TouchableOpacity>
                </View>
            </ScrollView>

            {/* Role Management Modal */}
            <Modal visible={showRoleModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Asignar Roles</Text>
                            <TouchableOpacity onPress={() => setShowRoleModal(false)}>
                                <Ionicons name="close" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Buscar usuario..."
                            placeholderTextColor={colors.textTertiary}
                            value={userSearch}
                            onChangeText={setUserSearch}
                        />
                        {loadingUsers ? <ActivityIndicator color={colors.primary[500]} /> : (
                            <FlatList
                                data={users}
                                keyExtractor={item => item.id}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={styles.userItem}
                                        onPress={() => { setSelectedUser(item); setShowRolePicker(true); }}
                                    >
                                        <View>
                                            <Text style={styles.userName}>{item.full_name}</Text>
                                            <Text style={styles.userEmail}>{item.email} · <Text style={{ color: colors.primary[400] }}>{item.role}</Text></Text>
                                        </View>
                                        <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                                    </TouchableOpacity>
                                )}
                            />
                        )}
                    </View>
                </View>
            </Modal>

            {/* Role Picker Modal */}
            <Modal visible={showRolePicker} transparent animationType="fade">
                <View style={styles.modalOverlaySmall}>
                    <View style={styles.pickerBox}>
                        <Text style={styles.pickerTitle}>Rol para {selectedUser?.full_name}</Text>
                        {['student', 'coach', 'admin'].map((r) => (
                            <TouchableOpacity
                                key={r}
                                style={styles.pickerItem}
                                onPress={() => handleUpdateRole(r)}
                            >
                                <Text style={styles.pickerItemText}>{r.toUpperCase()}</Text>
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity style={[styles.pickerItem, { borderBottomWidth: 0 }]} onPress={() => setShowRolePicker(false)}>
                            <Text style={[styles.pickerItemText, { color: colors.error }]}>CANCELAR</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Price Modal */}
            <Modal visible={showPriceModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Valores de Packs</Text>
                            <TouchableOpacity onPress={() => setShowPriceModal(false)}>
                                <Ionicons name="close" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.priceForm}>
                            <Text style={styles.priceLabel}>Pack 4 clases ($)</Text>
                            <TextInput
                                style={styles.priceInput}
                                value={prices.pack1}
                                onChangeText={(v) => setPrices({ ...prices, pack1: v })}
                                keyboardType="number-pad"
                            />
                            <Text style={styles.priceLabel}>Pack 8 clases ($)</Text>
                            <TextInput
                                style={styles.priceInput}
                                value={prices.pack2}
                                onChangeText={(v) => setPrices({ ...prices, pack2: v })}
                                keyboardType="number-pad"
                            />
                            <Text style={styles.priceLabel}>Pack 12 clases ($)</Text>
                            <TextInput
                                style={styles.priceInput}
                                value={prices.pack3}
                                onChangeText={(v) => setPrices({ ...prices, pack3: v })}
                                keyboardType="number-pad"
                            />

                            <TouchableOpacity
                                style={[styles.saveBtn, savingPrices && { opacity: 0.6 }]}
                                onPress={handleSavePrices}
                                disabled={savingPrices}
                            >
                                {savingPrices ? <ActivityIndicator color={colors.white} /> : (
                                    <Text style={styles.saveBtnText}>Guardar Cambios</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <AdminBottomBar />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
    title: { fontSize: 24, fontWeight: '700', color: colors.text },
    content: { flex: 1, paddingHorizontal: spacing.xl, paddingBottom: 100 },

    profileSection: {
        alignItems: 'center',
        paddingVertical: spacing['2xl'],
        backgroundColor: colors.surface,
        borderRadius: borderRadius.xl,
        marginBottom: spacing.xl,
    },
    avatarCircle: {
        width: 80, height: 80, borderRadius: 40,
        backgroundColor: colors.primary[500] + '20',
        justifyContent: 'center', alignItems: 'center',
        marginBottom: spacing.md,
    },
    avatarText: { fontSize: 32, fontWeight: '700', color: colors.primary[500] },
    name: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 4 },
    email: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing.md },
    badge: {
        backgroundColor: colors.primary[500],
        paddingHorizontal: 12, paddingVertical: 4,
        borderRadius: 12
    },
    badgeText: { fontSize: 10, fontWeight: '800', color: colors.white },

    section: { gap: spacing.sm },
    sectionLabel: {
        fontSize: 13, fontWeight: '600', color: colors.textTertiary,
        marginLeft: spacing.xs, marginBottom: spacing.xs, textTransform: 'uppercase'
    },
    actionRow: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.md,
        backgroundColor: colors.surface, padding: spacing.md,
        borderRadius: borderRadius.lg,
    },
    iconBox: {
        width: 40, height: 40, borderRadius: 20,
        justifyContent: 'center', alignItems: 'center',
    },
    actionText: { flex: 1, fontSize: 16, color: colors.text, fontWeight: '500' },

    // Modals
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
    modalOverlaySmall: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: spacing.xl },
    modalContent: {
        backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28,
        padding: spacing.xl, maxHeight: '80%', paddingBottom: spacing['4xl']
    },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xl },
    modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
    searchInput: {
        backgroundColor: colors.background, borderRadius: borderRadius.md,
        padding: spacing.md, color: colors.text, marginBottom: spacing.lg,
        borderWidth: 1, borderColor: colors.border
    },
    userItem: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border
    },
    userName: { fontSize: 15, fontWeight: '600', color: colors.text },
    userEmail: { fontSize: 13, color: colors.textSecondary },

    pickerBox: { backgroundColor: colors.surface, borderRadius: borderRadius.xl, padding: spacing.lg, overflow: 'hidden' },
    pickerTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: spacing.lg, textAlign: 'center' },
    pickerItem: { paddingVertical: spacing.lg, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border },
    pickerItemText: { fontSize: 15, fontWeight: '600', color: colors.text },

    priceForm: { gap: spacing.md },
    priceLabel: { fontSize: 14, color: colors.textSecondary },
    priceInput: {
        backgroundColor: colors.background, borderRadius: borderRadius.md,
        padding: spacing.md, color: colors.text, borderWidth: 1, borderColor: colors.border
    },
    saveBtn: {
        backgroundColor: colors.primary[500], height: 52, borderRadius: borderRadius.lg,
        alignItems: 'center', justifyContent: 'center', marginTop: spacing.md
    },
    saveBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
});
