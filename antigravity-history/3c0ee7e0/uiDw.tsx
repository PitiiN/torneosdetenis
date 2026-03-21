import { StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

// Map product names to football-themed emojis
const productIcons: Record<string, string> = {
  'Father & Mother Cup': '🏆',
  'Copa F2 Kids': '⚽',
  'Americanos de Pádel': '🎾',
  'Liga Verbo Divino': '🥅',
  'Liga Ex Tabancura': '🏟️',
  'Liga El Polo': '🏅',
  'Liga Everest': '⛰️',
};

function getIcon(name: string): string {
  return productIcons[name] || '⚽';
}

export default function HubScreen() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState('');
  const router = useRouter();

  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/auth');
      } else {
        setUserEmail(session.user?.email || '');
        fetchProducts(session.user.id);
      }
    }
    checkAuth();
  }, []);

  async function fetchProducts(userId: string) {
    // Query memberships first (RLS: user_id = auth.uid()), then get product info via join
    const { data, error } = await supabase
      .from('product_memberships')
      .select('role, product:products(id, name, description, key)')
      .eq('user_id', userId)
      .eq('status', 'active');

    if (error) {
      console.error('Error fetching products:', error.message);
    }
    if (data) {
      // Flatten: extract the product object from each membership
      const prods = data
        .filter((m: any) => m.product)
        .map((m: any) => ({ ...m.product, userRole: m.role }));
      setProducts(prods);
    }
    setLoading(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace('/auth');
  }

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#00A3E0" /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={{ flex: 1, backgroundColor: 'transparent' }}>
          <Text style={styles.header}>Mis Productos</Text>
          <Text style={styles.subheader}>Selecciona un producto para administrar</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Salir</Text>
        </TouchableOpacity>
      </View>
      {userEmail ? <Text style={styles.emailLabel}>👤 {userEmail}</Text> : null}
      {products.length === 0 ? (
        <Text style={styles.emptyText}>No tienes acceso a ningún producto aún.</Text>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.85}
              onPress={() => router.push(`/(product)/${item.id}`)}
            >
              <Text style={styles.icon}>{getIcon(item.name)}</Text>
              <Text style={styles.title} numberOfLines={2}>{item.name}</Text>
              <Text style={styles.roleBadge}>{item.userRole?.toUpperCase()}</Text>
            </TouchableOpacity>
          )}
          contentContainerStyle={{ paddingBottom: 30 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F7FA' },
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 10, backgroundColor: '#F5F7FA' },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4, backgroundColor: 'transparent' },
  header: { fontSize: 26, fontWeight: '800', color: '#1A1A2E' },
  subheader: { fontSize: 14, color: '#6B7280', marginBottom: 8 },
  emailLabel: { fontSize: 13, color: '#6B7280', marginBottom: 16 },
  logoutBtn: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    marginTop: 4,
  },
  logoutText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  row: { justifyContent: 'space-between', marginBottom: 14 },
  card: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00A3E0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#E8F4FD',
  },
  icon: { fontSize: 40, marginBottom: 10 },
  title: { fontSize: 14, fontWeight: '700', color: '#1A1A2E', textAlign: 'center' },
  roleBadge: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
    backgroundColor: '#00A3E0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 8,
    overflow: 'hidden',
  },
  emptyText: { textAlign: 'center', marginTop: 50, fontSize: 16, color: '#6B7280' },
});
