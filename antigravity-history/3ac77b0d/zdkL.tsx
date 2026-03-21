import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '@/theme';

export default function AdminStudentsScreen() {
    const router = useRouter();
    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Alumnos</Text>
                <View style={{ width: 24 }} />
            </View>
            <View style={styles.placeholder}>
                <Ionicons name="construct-outline" size={48} color={colors.textTertiary} />
                <Text style={styles.placeholderText}>Gestión de alumnos — próximamente</Text>
            </View>
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
    placeholder: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
    placeholderText: { fontSize: 15, color: colors.textTertiary },
});
