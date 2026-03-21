import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius } from '@/theme';
import { useAuthStore } from '@/store/auth.store';

export default function SelectionScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { profile } = useAuthStore();

    const handleArriendo = () => {
        Alert.alert('Próximamente... 😉', 'El módulo de arriendo de canchas estará disponible muy pronto.');
    };

    const handleEscuela = () => {
        router.replace('/(tabs)');
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            <View style={styles.header}>
                <Text style={styles.greeting}>Hola, {profile?.full_name?.split(' ')[0] || 'Jugador'} 👋</Text>
                <Text style={styles.title}>¿A dónde quieres ir?</Text>
                <Text style={styles.subtitle}>Selecciona el módulo al que deseas ingresar</Text>
            </View>

            <View style={styles.cardsContainer}>
                <TouchableOpacity style={styles.card} onPress={handleEscuela} activeOpacity={0.8}>
                    <View style={[styles.iconCircle, { backgroundColor: colors.primary[500] + '20' }]}>
                        <Ionicons name="tennisball" size={48} color={colors.primary[500]} />
                    </View>
                    <Text style={styles.cardTitle}>Escuela de Tenis</Text>
                    <Text style={styles.cardDescription}>Reserva clases, revisa pagos y torneos</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.card} onPress={handleArriendo} activeOpacity={0.8}>
                    <View style={[styles.iconCircle, { backgroundColor: colors.secondary[500] + '20' }]}>
                        <Ionicons name="calendar-outline" size={48} color={colors.secondary[500]} />
                    </View>
                    <Text style={styles.cardTitle}>Arriendo de Canchas</Text>
                    <Text style={styles.cardDescription}>Reserva de canchas para jugar libremente</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        paddingHorizontal: spacing['2xl'],
        paddingTop: spacing['3xl'],
        marginBottom: spacing['2xl'],
    },
    greeting: {
        fontSize: 16,
        color: colors.textSecondary,
        marginBottom: spacing.xs,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: colors.text,
        marginBottom: spacing.xs,
    },
    subtitle: {
        fontSize: 15,
        color: colors.textSecondary,
        lineHeight: 22,
    },
    cardsContainer: {
        flex: 1,
        paddingHorizontal: spacing['2xl'],
        gap: spacing.lg,
    },
    card: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.xl,
        padding: spacing['2xl'],
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    iconCircle: {
        width: 88,
        height: 88,
        borderRadius: 44,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    cardTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: colors.text,
        marginBottom: spacing.sm,
    },
    cardDescription: {
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
    },
});
