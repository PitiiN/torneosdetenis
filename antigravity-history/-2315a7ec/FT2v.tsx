import { useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    RefreshControl, FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format, addDays, startOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';
import { classesService } from '@/services/classes.service';
import { colors, spacing, borderRadius } from '@/theme';

export default function HomeScreen() {
    const { profile, isAdmin } = useAuth();
    const router = useRouter();
    const [classes, setClasses] = useState<any[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date());

    const loadClasses = async () => {
        const today = format(new Date(), 'yyyy-MM-dd');
        const nextWeek = format(addDays(new Date(), 7), 'yyyy-MM-dd');
        const { data, error } = await classesService.getClassesInRange(
            today, nextWeek, profile?.id
        );
        if (data) setClasses(data);
    };

    useEffect(() => { loadClasses(); }, []);

    const onRefresh = async () => {
        setRefreshing(true);
        await loadClasses();
        setRefreshing(false);
    };

    const todayClasses = classes.filter(
        (c) => format(new Date(c.start_datetime), 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd')
    );

    // Generate next 7 days for the date strip
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(new Date(), i));

    const renderClassCard = ({ item }: { item: any }) => {
        const spotsColor = item.available_spots > 2
            ? colors.success
            : item.available_spots > 0
                ? colors.warning
                : colors.error;

        return (
            <TouchableOpacity
                style={styles.classCard}
                onPress={() => router.push(`/class/${item.class_id}` as any)}
                activeOpacity={0.7}
            >
                <View style={[styles.categoryStripe, { backgroundColor: item.category_color || colors.primary[500] }]} />
                <View style={styles.classContent}>
                    <View style={styles.classHeader}>
                        <Text style={styles.classTitle}>{item.title}</Text>
                        {item.is_enrolled && (
                            <View style={styles.enrolledBadge}>
                                <Text style={styles.enrolledText}>Inscrito</Text>
                            </View>
                        )}
                    </View>
                    <View style={styles.classInfo}>
                        <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
                        <Text style={styles.classInfoText}>
                            {format(new Date(item.start_datetime), 'HH:mm')} - {format(new Date(item.end_datetime), 'HH:mm')}
                        </Text>
                    </View>
                    <View style={styles.classInfo}>
                        <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
                        <Text style={styles.classInfoText}>{item.court_name}</Text>
                    </View>
                    <View style={styles.classInfo}>
                        <Ionicons name="person-outline" size={14} color={colors.textSecondary} />
                        <Text style={styles.classInfoText}>{item.coach_name}</Text>
                    </View>
                    <View style={styles.classFooter}>
                        <View style={styles.spotsBadge}>
                            <Ionicons name="people" size={14} color={spotsColor} />
                            <Text style={[styles.spotsText, { color: spotsColor }]}>
                                {item.available_spots} cupos
                            </Text>
                        </View>
                        {item.price > 0 && (
                            <Text style={styles.priceText}>
                                ${Number(item.price).toLocaleString('es-CL')}
                            </Text>
                        )}
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.greeting}>
                        ¡Hola, {profile?.full_name?.split(' ')[0]}! 👋
                    </Text>
                    <Text style={styles.subtitle}>
                        {isAdmin ? 'Panel de administración' : 'Encuentra tu próxima clase'}
                    </Text>
                </View>
                <TouchableOpacity
                    style={styles.notifButton}
                    onPress={() => router.push('/notifications' as any)}
                >
                    <Ionicons name="notifications-outline" size={24} color={colors.text} />
                </TouchableOpacity>
            </View>

            {isAdmin && (
                <TouchableOpacity
                    style={styles.adminBanner}
                    onPress={() => router.push('/(admin)/dashboard' as any)}
                >
                    <Ionicons name="shield" size={20} color={colors.primary[400]} />
                    <Text style={styles.adminBannerText}>Ir al Panel Admin</Text>
                    <Ionicons name="chevron-forward" size={20} color={colors.primary[400]} />
                </TouchableOpacity>
            )}

            {/* Date strip */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateStrip}>
                {weekDays.map((day, index) => {
                    const isSelected = format(day, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
                    const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                    return (
                        <TouchableOpacity
                            key={index}
                            style={[styles.dateItem, isSelected && styles.dateItemSelected]}
                            onPress={() => setSelectedDate(day)}
                        >
                            <Text style={[styles.dateDayName, isSelected && styles.dateTextSelected]}>
                                {format(day, 'EEE', { locale: es }).toUpperCase()}
                            </Text>
                            <Text style={[styles.dateDay, isSelected && styles.dateTextSelected]}>
                                {format(day, 'd')}
                            </Text>
                            {isToday && <View style={styles.todayDot} />}
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            <Text style={styles.sectionTitle}>
                Clases del {format(selectedDate, 'EEEE d MMMM', { locale: es })}
            </Text>

            <FlatList
                data={todayClasses}
                renderItem={renderClassCard}
                keyExtractor={(item) => item.class_id}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary[500]} />
                }
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Ionicons name="calendar-outline" size={48} color={colors.textTertiary} />
                        <Text style={styles.emptyText}>No hay clases programadas</Text>
                    </View>
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: spacing.xl, paddingTop: 60, paddingBottom: spacing.lg,
    },
    greeting: { fontSize: 24, fontWeight: '700', color: colors.text },
    subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
    notifButton: {
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center',
    },
    adminBanner: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.surface, marginHorizontal: spacing.xl,
        padding: spacing.lg, borderRadius: borderRadius.lg,
        borderWidth: 1, borderColor: colors.primary[700],
        gap: spacing.sm, marginBottom: spacing.lg,
    },
    adminBannerText: { flex: 1, color: colors.primary[400], fontWeight: '600', fontSize: 15 },
    dateStrip: {
        paddingHorizontal: spacing.xl, marginBottom: spacing.lg,
        maxHeight: 80,
    },
    dateItem: {
        width: 56, height: 72, alignItems: 'center', justifyContent: 'center',
        borderRadius: borderRadius.lg, marginRight: spacing.sm,
        backgroundColor: colors.surface,
    },
    dateItemSelected: { backgroundColor: colors.primary[500] },
    dateDayName: { fontSize: 11, fontWeight: '600', color: colors.textSecondary, marginBottom: 4 },
    dateDay: { fontSize: 20, fontWeight: '700', color: colors.text },
    dateTextSelected: { color: colors.white },
    todayDot: {
        width: 5, height: 5, borderRadius: 2.5,
        backgroundColor: colors.primary[500], marginTop: 3,
    },
    sectionTitle: {
        fontSize: 16, fontWeight: '600', color: colors.text,
        paddingHorizontal: spacing.xl, marginBottom: spacing.md,
        textTransform: 'capitalize',
    },
    listContent: { paddingHorizontal: spacing.xl, paddingBottom: spacing['4xl'] },
    classCard: {
        flexDirection: 'row', backgroundColor: colors.surface,
        borderRadius: borderRadius.lg, marginBottom: spacing.md,
        overflow: 'hidden',
    },
    categoryStripe: { width: 4 },
    classContent: { flex: 1, padding: spacing.lg },
    classHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
    classTitle: { fontSize: 16, fontWeight: '600', color: colors.text, flex: 1 },
    enrolledBadge: {
        backgroundColor: colors.success + '20', paddingHorizontal: spacing.sm, paddingVertical: 2,
        borderRadius: borderRadius.sm,
    },
    enrolledText: { fontSize: 11, fontWeight: '600', color: colors.success },
    classInfo: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: 4 },
    classInfoText: { fontSize: 13, color: colors.textSecondary },
    classFooter: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        marginTop: spacing.sm, paddingTop: spacing.sm,
        borderTopWidth: 1, borderTopColor: colors.border,
    },
    spotsBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    spotsText: { fontSize: 13, fontWeight: '600' },
    priceText: { fontSize: 15, fontWeight: '700', color: colors.primary[400] },
    emptyState: {
        alignItems: 'center', justifyContent: 'center',
        paddingVertical: spacing['5xl'], gap: spacing.md,
    },
    emptyText: { fontSize: 15, color: colors.textTertiary },
});
