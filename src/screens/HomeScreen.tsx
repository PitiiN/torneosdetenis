import React, { useEffect, useState } from "react";
import { Button, StyleSheet, Text, View } from "react-native";
import { supabase } from "../lib/supabase";
import { ProfileScreen } from "./ProfileScreen";

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
      <Text style={styles.title}>✅ Sesión activa</Text>
      <Text style={styles.subtitle}>{email}</Text>

      <View style={{ height: 12 }} />
      <Button title="Cerrar sesión" onPress={signOut} />

      <View style={{ height: 24 }} />
      <ProfileScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 22, fontWeight: "600", marginTop: 30, textAlign: "center" },
  subtitle: { fontSize: 14, color: "#666", marginBottom: 10, textAlign: "center" },
});