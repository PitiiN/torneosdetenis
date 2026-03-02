import React from "react";
import { StyleSheet, Text, View } from "react-native";

export function AdminScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Admin</Text>
      <Text style={styles.subtitle}>Gestion de torneos, pagos y operacion en vivo (MVP).</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 22, fontWeight: "600", marginBottom: 8 },
  subtitle: { fontSize: 14, color: "#666", textAlign: "center" },
});
