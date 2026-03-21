import { useEffect, useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    RefreshControl, Alert, TextInput, Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format, subMonths, addMonths, isSameMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/services/supabase';
import { useAlertStore } from '@/store/alert.store';
import AdminBottomBar from '@/components/AdminBottomBar';
import TennisLoading from '@/components/common/TennisLoading';
import { colors, spacing, borderRadius } from '@/theme';

export default function AdminReviewsScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [reviews, setReviews] = useState<any[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(new Date());

    // Reply modal
    const [selectedReview, setSelectedReview] = useState<any>(null);
    const [showReplyModal, setShowReplyModal] = useState(false);
    const [replyText, setReplyText] = useState('');
    const [isLoaded, setIsLoaded] = useState(false);

    const load = useCallback(async () => {
        const { data } = await supabase
            .from('reviews')
            .select('*, profiles!reviews_student_id_fkey (full_name, email, avatar_url)')
            .order('created_at', { ascending: false });

        if (data) {
            setReviews(data);
        }
        setIsLoaded(true);
    }, []);

    const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
    const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

    const filteredReviews = reviews.filter(r => isSameMonth(new Date(r.created_at), currentMonth));
    const unread = reviews.filter((r: any) => !r.is_read).length; // Unread across all time or just filtered? Let's keep filtered for consistency with "month" view, or across all time as requested? 
    // Request: "Calculate total overall average, not just month"

    const overallAvg = reviews.length > 0
        ? reviews.reduce((s: number, r: any) => s + (r.rating || 0), 0) / reviews.length
        : 0;

    const monthAvg = filteredReviews.length > 0
        ? filteredReviews.reduce((s: number, r: any) => s + (r.rating || 0), 0) / filteredReviews.length
        : 0;

    const stats = {
        total: reviews.length,
        unread: reviews.filter((r: any) => !r.is_read).length,
        avg: Math.round(overallAvg * 10) / 10
    };

    useEffect(() => { load(); }, [load]);
    const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

    const markAsRead = async (review: any) => {
        if (review.is_read) return;
        await supabase.from('reviews').update({ is_read: true }).eq('id', review.id);
        load();
    };

    const openReply = (review: any) => {
        markAsRead(review);
        setSelectedReview(review);
        setReplyText(review.admin_reply || '');
        setShowReplyModal(true);
    };

    const submitReply = async () => {
        if (!selectedReview) return;
        const { error } = await supabase.from('reviews').update({
            admin_reply: replyText.trim(),
            replied_at: new Date().toISOString(),
            is_read: true,
        }).eq('id', selectedReview.id);

        if (error) useAlertStore.getState().showAlert('Error', error.message);
        else {
            useAlertStore.getState().showAlert('✅ Respuesta enviada');
            setShowReplyModal(false);
            load();
        }
    };

    if (!isLoaded) return <TennisLoading />;

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Opiniones</Text>
                <View style={{ width: 24 }} />
            </View>

            {/* Month Selector */}
            <View style={styles.monthSelector}>
                <TouchableOpacity onPress={prevMonth} style={styles.monthArrow}>
                    <Ionicons name="chevron-back" size={20} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.monthText}>
                    {format(currentMonth, 'MMMM yyyy', { locale: es })}
                </Text>
                <TouchableOpacity onPress={nextMonth} style={styles.monthArrow}>
                    <Ionicons name="chevron-forward" size={20} color={colors.text} />
                </TouchableOpacity>
            </View>

            {/* Stats */}
            <View style={styles.statsRow}>
                <View style={[styles.statCard, { borderLeftColor: colors.primary[500] }]}>
                    <Text style={styles.statValue}>{stats.total}</Text>
                    <Text style={styles.statLabel}>Total</Text>
                </View>
                <View style={[styles.statCard, { borderLeftColor: colors.error }]}>
                    <Text style={[styles.statValue, { color: stats.unread > 0 ? colors.error : colors.text }]}>{stats.unread}</Text>
                    <Text style={styles.statLabel}>Sin leer</Text>
                </View>
                <View style={[styles.statCard, { borderLeftColor: colors.warning }]}>
                    <Text style={styles.statValue}>⭐ {stats.avg}</Text>
                    <Text style={styles.statLabel}>Promedio</Text>
                </View>
            </View>

            <FlatList
                data={filteredReviews}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.list}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary[500]} />}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={[styles.reviewCard, !item.is_read && styles.reviewUnread]}
                        onPress={() => openReply(item)}
                    >
                        <View style={styles.reviewTop}>
                            <View style={styles.reviewUser}>
                                {!item.is_read && <View style={styles.unreadDot} />}
                                <Text style={styles.reviewName}>{item.profiles?.full_name}</Text>
                            </View>
                            <Text style={styles.reviewDate}>
                                {format(new Date(item.created_at), "d MMM, HH:mm", { locale: es })}
                            </Text>
                        </View>
                        <Text style={styles.reviewStars}>{'⭐'.repeat(item.rating || 0)}</Text>
                        <Text style={styles.reviewMessage} numberOfLines={3}>{item.message}</Text>
                        {item.admin_reply && (
                            <View style={styles.replyIndicator}>
                                <Ionicons name="chatbubble" size={12} color={colors.primary[400]} />
                                <Text style={styles.replyIndicatorText}>Respondido</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                )}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <Ionicons name="chatbubbles-outline" size={48} color={colors.textTertiary} />
                        <Text style={styles.emptyText}>No hay opiniones</Text>
                    </View>
                }
            />

            {/* Reply modal */}
            <Modal visible={showReplyModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Opinión</Text>
                            <TouchableOpacity onPress={() => setShowReplyModal(false)}>
                                <Ionicons name="close" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>

                        {selectedReview && (
                            <>
                                <Text style={styles.authorName}>{selectedReview.profiles?.full_name}</Text>
                                <Text style={styles.authorEmail}>{selectedReview.profiles?.email}</Text>
                                <Text style={styles.reviewStarsLg}>{'⭐'.repeat(selectedReview.rating || 0)}</Text>
                                <View style={styles.messageBubble}>
                                    <Text style={styles.messageText}>{selectedReview.message}</Text>
                                </View>

                                <Text style={styles.replyLabel}>Tu respuesta</Text>
                                <TextInput
                                    style={styles.replyInput}
                                    placeholder="Escribe tu respuesta..."
                                    placeholderTextColor={colors.textTertiary}
                                    multiline
                                    value={replyText}
                                    onChangeText={setReplyText}
                                />
                                <TouchableOpacity style={styles.sendBtn} onPress={submitReply}>
                                    <Ionicons name="send" size={18} color={colors.white} />
                                    <Text style={styles.sendText}>Enviar respuesta</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </View>
            </Modal>
            <AdminBottomBar />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
    },
    title: { fontSize: 20, fontWeight: '700', color: colors.text },

    monthSelector: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: colors.surface, borderRadius: borderRadius.md,
        paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
        marginHorizontal: spacing.xl, marginBottom: spacing.md,
    },
    monthArrow: { padding: 4 },
    monthText: { fontSize: 15, fontWeight: '600', color: colors.text, textTransform: 'capitalize' },

    statsRow: {
        flexDirection: 'row', gap: spacing.sm,
        paddingHorizontal: spacing.xl, marginBottom: spacing.lg,
    },
    statCard: {
        flex: 1, backgroundColor: colors.surface, borderRadius: borderRadius.md,
        padding: spacing.md, borderLeftWidth: 3, alignItems: 'center',
    },
    statValue: { fontSize: 20, fontWeight: '700', color: colors.text },
    statLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },

    list: { paddingHorizontal: spacing.xl, paddingBottom: spacing['4xl'] },

    reviewCard: {
        backgroundColor: colors.surface, borderRadius: borderRadius.md,
        padding: spacing.lg, marginBottom: spacing.sm,
    },
    reviewUnread: { borderLeftWidth: 3, borderLeftColor: colors.primary[500] },
    reviewTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
    reviewUser: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary[500] },
    reviewName: { fontSize: 14, fontWeight: '600', color: colors.text },
    reviewDate: { fontSize: 11, color: colors.textTertiary },
    reviewStars: { fontSize: 12, marginBottom: spacing.xs },
    reviewMessage: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
    replyIndicator: {
        flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
        marginTop: spacing.sm,
    },
    replyIndicatorText: { fontSize: 11, color: colors.primary[400], fontWeight: '600' },

    empty: { alignItems: 'center', paddingVertical: spacing['6xl'], gap: spacing.md },
    emptyText: { fontSize: 15, color: colors.textTertiary },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
    modalContent: {
        backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
        padding: spacing['2xl'], paddingBottom: spacing['4xl'], maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: spacing.lg,
    },
    modalTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
    authorName: { fontSize: 16, fontWeight: '600', color: colors.text },
    authorEmail: { fontSize: 13, color: colors.textSecondary, marginBottom: spacing.sm },
    reviewStarsLg: { fontSize: 16, marginBottom: spacing.md },
    messageBubble: {
        backgroundColor: colors.background, borderRadius: borderRadius.md,
        padding: spacing.lg, marginBottom: spacing.xl,
    },
    messageText: { fontSize: 15, color: colors.text, lineHeight: 22 },
    replyLabel: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
    replyInput: {
        backgroundColor: colors.background, borderRadius: borderRadius.md,
        padding: spacing.lg, fontSize: 15, color: colors.text,
        minHeight: 80, textAlignVertical: 'top', marginBottom: spacing.lg,
    },
    sendBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        backgroundColor: colors.primary[500], height: 52,
        borderRadius: borderRadius.lg, gap: spacing.sm,
    },
    sendText: { fontSize: 16, fontWeight: '700', color: colors.white },
});
