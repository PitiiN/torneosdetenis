import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';

export default function App() {
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.card}>
        <Text style={styles.emoji}>🏘️</Text>
        <Text style={styles.title}>JJVV Mobile</Text>
        <Text style={styles.subtitle}>Junta de Vecinos</Text>
        <Text style={styles.info}>¡La app está funcionando correctamente!</Text>
        <Text style={styles.version}>v1.0.0 - Test de conexión</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1E3A5F',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 40,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    width: '100%',
  },
  emoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1E3A5F',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 18,
    color: '#64748B',
    marginBottom: 24,
  },
  info: {
    fontSize: 16,
    color: '#22C55E',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
  },
  version: {
    fontSize: 12,
    color: '#94A3B8',
  },
});
