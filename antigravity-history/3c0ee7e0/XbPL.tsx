import { StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';

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
  const router = useRouter();

  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/auth');
      } else {
        fetchProducts();
      }
    }
    checkAuth();
  }, []);

  async function fetchProducts() {
    const { data, error } = await supabase.from('products').select('*');
    if (!error && data) {
      setProducts(data);
    }
    setLoading(false);
  }

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#00A3E0" /></View>;

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Mis Productos</Text>
      <Text style={styles.subheader}>Selecciona un producto para administrar</Text>
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
            </TouchableOpacity>
          )}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F7FA' },
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 20, backgroundColor: '#F5F7FA' },
  header: { fontSize: 26, fontWeight: '800', color: '#1A1A2E', marginBottom: 4 },
  subheader: { fontSize: 14, color: '#6B7280', marginBottom: 20 },
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
  emptyText: { textAlign: 'center', marginTop: 50, fontSize: 16, color: '#6B7280' },
});
