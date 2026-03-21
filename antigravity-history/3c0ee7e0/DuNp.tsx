import { StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

export default function HubScreen() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const colorScheme = useColorScheme();

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
    // Due to RLS, this will only return products the user has access to
    const { data, error } = await supabase.from('products').select('*');
    if (!error && data) {
      setProducts(data);
    }
    setLoading(false);
  }

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#00A3E0" /></View>;

  return (
    <View style={styles.container}>
      {products.length === 0 ? (
        <Text style={styles.emptyText}>No tienes acceso a ningún producto aún.</Text>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.card, { backgroundColor: Colors[colorScheme ?? 'light'].card }]}
              onPress={() => router.push(`/(product)/${item.id}`)}
            >
              <Text style={styles.title}>{item.name}</Text>
              <Text style={styles.desc}>{item.description}</Text>
            </TouchableOpacity>
          )}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, padding: 20 },
  card: {
    padding: 20,
    marginBottom: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: { fontSize: 18, fontWeight: 'bold', color: '#00A3E0' },
  desc: { fontSize: 14, color: '#66', marginTop: 5 },
  emptyText: { textAlign: 'center', marginTop: 50, fontSize: 16 }
});
