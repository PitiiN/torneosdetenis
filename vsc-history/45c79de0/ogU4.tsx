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
      <Text style={styles.title}>✅ Sesión activa</Text>
      <Text style={styles.subtitle}>{email}</Text>
      <Button title="Cerrar sesión" onPress={signOut} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  title: { fontSize: 22, fontWeight: "600", marginBottom: 8 },
  subtitle: { fontSize: 14, color: "#666", marginBottom: 20 },
});