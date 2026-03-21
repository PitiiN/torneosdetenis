import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';
import { notificationsService } from '@/services/notifications.service';
import { colors, spacing, borderRadius } from '@/theme';

export default function NotificationsScreen() {
    const router = useRouter();
    const { profile } = useAuth();
    const [notifications, setNotifications] = useState<any[]>([]);
    const [refreshing, setRefreshing] = useState(false);

    const load = async () => {
        if (!profile) return;
        const { data } = await notificationsService.getUserNotifications(profile.id);
        if (data) setNotifications(data);
    };

    useEffect(() => { load(); }, [profile]);

    const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

    const handleMarkAllRead = async () => {
        if (!profile) return;
        await notificationsService.markAllRead(profile.id);
        load();
    };

    const typeIcons: Record<string, string> = {
        class_reminder: 'alarm',
        payment_due: 'card',
        class_cancelled: 'close-circle',
        enrollment_confirmed: 'checkmark-circle',
        class_updated: 'refresh',
        general: 'megaphone',
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Notificaciones</Text>
                <TouchableOpacity onPress={handleMarkAllRead}>
                    <Ionicons name="checkmark-done" size={24} color={colors.primary[400]} />
                </TouchableOpacity>
            </View>

            <FlatList
                data={notifications}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary[500]} />}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={[styles.notifCard, !item.is_read && styles.notifUnread]}
                        onPress={async () => {
                            if (!item.is_read) {
                                await notificationsService.markAsRead(item.id);
                                load();
                            }
                        }}
                    >
                        <View style={styles.notifIcon}>
                            <Ionicons name={typeIcons[item.type] as any || 'notifications'} size={20} color={colors.primary[400]} />
                        </View>
                        <View style={styles.notifContent}>
                            <Text style={styles.notifTitle}>{item.title}</Text>
                            <Text style={styles.notifBody}>{item.body}</Text>
                            <Text style={styles.notifTime}>
                                {format(new Date(item.created_at), "d MMM, HH:mm", { locale: es })}
                            </Text>
                        </View>
                        {!item.is_read && <View style={styles.unreadDot} />}
                    </TouchableOpacity>
                )}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Ionicons name="notifications-off-outline" size={48} color={colors.textTertiary} />
                        <Text style={styles.emptyText}>Sin notificaciones</Text>
                    </View>
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: spacing.xl, paddingTop: 60, paddingBottom: spacing.lg,
    },
    title: { fontSize: 22, fontWeight: '700', color: colors.text },
    listContent: { paddingHorizontal: spacing.xl, paddingBottom: spacing['4xl'] },
    notifCard: {
        flexDirection: 'row', alignItems: 'flex-start',
        backgroundColor: colors.surface, borderRadius: borderRadius.lg,
        padding: spacing.lg, marginBottom: spacing.sm, gap: spacing.md,
    },
    notifUnread: { borderLeftWidth: 3, borderLeftColor: colors.primary[500] },
    notifIcon: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: colors.primary[500] + '15',
        justifyContent: 'center', alignItems: 'center',
    },
    notifContent: { flex: 1 },
    notifTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
    notifBody: { fontSize: 13, color: colors.textSecondary, marginTop: 2, lineHeight: 18 },
    notifTime: { fontSize: 11, color: colors.textTertiary, marginTop: 4 },
    unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary[500], marginTop: 4 },
    emptyState: { alignItems: 'center', paddingVertical: spacing['5xl'], gap: spacing.md },
    emptyText: { fontSize: 15, color: colors.textTertiary },
});
