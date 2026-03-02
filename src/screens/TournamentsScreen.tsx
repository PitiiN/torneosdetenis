import React from "react";
import { StyleSheet, Text, View } from "react-native";

export function TournamentsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Torneos</Text>
      <Text style={styles.subtitle}>Listado de torneos disponibles e inscritos (MVP).</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 22, fontWeight: "600", marginBottom: 8 },
  subtitle: { fontSize: 14, color: "#666", textAlign: "center" },
});
