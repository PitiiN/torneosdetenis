import { StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Text, View } from '@/components/Themed';
import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const colorScheme = useColorScheme();

  useEffect(() => {
    fetchNotifications();
  }, []);

  async function fetchNotifications() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });
    if (data) setNotifications(data);
  }

  async function markAsRead(id: string) {
    await supabase.from('notifications').update({ status: 'read' }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, status: 'read' } : n));
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Notificaciones</Text>
      <View style={styles.separator} lightColor="#eee" darkColor="rgba(255,255,255,0.1)" />

      {notifications.length === 0 ? (
        <Text style={{ textAlign: 'center', marginTop: 20 }}>No tienes notificaciones</Text>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.notificationCard, { backgroundColor: item.status === 'unread' ? 'rgba(0,163,224,0.1)' : Colors[colorScheme ?? 'light'].card }]}
              onPress={() => markAsRead(item.id)}
            >
              <Text style={styles.notificationTitle}>{item.title}</Text>
              <Text style={styles.notificationMessage}>{item.message}</Text>
              <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString()}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 20, fontWeight: 'bold' },
  separator: { marginVertical: 15, height: 1, width: '100%' },
  notificationCard: { padding: 15, marginBottom: 10, borderRadius: 8, borderWidth: 1, borderColor: '#e0e0e0' },
  notificationTitle: { fontWeight: 'bold', fontSize: 16 },
  notificationMessage: { fontSize: 14, color: '#666', marginTop: 5 },
  date: { fontSize: 12, color: '#999', marginTop: 10, textAlign: 'right' }
});
