import React, { useEffect, useState } from "react";
import { Button, StyleSheet, Text, View } from "react-native";
import { supabase } from "../lib/supabase";

export function HomeScreen() {
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Dashboard</Text>
      <Text style={styles.subtitle}>{email}</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Estado de la cuenta</Text>
        <Text style={styles.cardText}>Sesion iniciada correctamente.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Resumen rapido</Text>
        <Text style={styles.cardText}>Proximos partidos y alertas apareceran aqui.</Text>
      </View>

      <View style={{ height: 12 }} />
      <Button title="Cerrar sesion" onPress={signOut} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 22, fontWeight: "600", marginTop: 30, textAlign: "center" },
  subtitle: { fontSize: 14, color: "#666", marginBottom: 18, textAlign: "center" },
  card: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    backgroundColor: "#fafafa",
  },
  cardTitle: { fontSize: 16, fontWeight: "600", marginBottom: 4 },
  cardText: { fontSize: 14, color: "#444" },
});
