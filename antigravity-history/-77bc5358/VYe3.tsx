import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, ActivityIndicator } from 'react-native';
import { Text, View } from '@/components/Themed';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';

export default function ProductScreen() {
    const { id } = useLocalSearchParams();
    const [product, setProduct] = useState<any>(null);
    const [role, setRole] = useState<string>('user');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadProductData() {
            // Load Product details
            const { data: prodData } = await supabase.from('products').select('*').eq('id', id).single();
            if (prodData) setProduct(prodData);

            // Load Role
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                const { data: memData } = await supabase
                    .from('product_memberships')
                    .select('role')
                    .eq('product_id', id)
                    .eq('user_id', session.user.id)
                    .single();
                if (memData) setRole(memData.role);
            }
            setLoading(false);
        }
        loadProductData();
    }, [id]);

    if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#00A3E0" /></View>;
    if (!product) return <View style={styles.centered}><Text>Producto no encontrado</Text></View>;

    return (
        <View style={styles.container}>
            <Text style={[styles.header, { color: product.branding?.primaryColor || '#00A3E0' }]}>{product.name}</Text>
            <Text style={styles.roleBadge}>Tu Rol: {role.toUpperCase()}</Text>

            <View style={styles.menuContainer}>
                {/* Placeholder Options based on Role */}
                {role === 'admin' && (
                    <View style={styles.adminSection}>
                        <Text style={styles.sectionTitle}>Panel de Administrador</Text>
                        <Text style={styles.menuItem}>• Configuración</Text>
                        <Text style={styles.menuItem}>• Gestión de Usuarios</Text>
                        <Text style={styles.menuItem}>• Reportes</Text>
                    </View>
                )}

                {(role === 'admin' || role === 'staff') && (
                    <View style={styles.staffSection}>
                        <Text style={styles.sectionTitle}>Operación</Text>
                        <Text style={styles.menuItem}>• Check-in de jugadores</Text>
                        <Text style={styles.menuItem}>• Registrar resultados</Text>
                    </View>
                )}

                <View style={styles.userSection}>
                    <Text style={styles.sectionTitle}>Participación</Text>
                    <Text style={styles.menuItem}>• Mi estado (Definir en PRD)</Text>
                    <Text style={styles.menuItem}>• Resultados y Calendario (Definir en PRD)</Text>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    container: { flex: 1, padding: 20 },
    header: { fontSize: 24, fontWeight: 'bold', marginBottom: 5 },
    roleBadge: { backgroundColor: '#e0e0e0', padding: 5, borderRadius: 5, alignSelf: 'flex-start', overflow: 'hidden', marginBottom: 20 },
    menuContainer: { flex: 1 },
    adminSection: { marginVertical: 10, padding: 15, backgroundColor: 'rgba(255,0,0,0.1)', borderRadius: 8 },
    staffSection: { marginVertical: 10, padding: 15, backgroundColor: 'rgba(0,0,255,0.1)', borderRadius: 8 },
    userSection: { marginVertical: 10, padding: 15, backgroundColor: 'rgba(0,255,0,0.1)', borderRadius: 8 },
    sectionTitle: { fontWeight: 'bold', marginBottom: 5, fontSize: 16 },
    menuItem: { paddingVertical: 2, color: '#333' }
});
