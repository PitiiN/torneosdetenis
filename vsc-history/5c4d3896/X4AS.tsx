import React, { useState } from "react";
import { Alert, Button, StyleSheet, Text, TextInput, View } from "react-native";
import { supabase } from "../lib/supabase";

export function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function signUp() {
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);

    if (error) return Alert.alert("Sign up error", error.message);
    Alert.alert("Listo", "Usuario creado. Ahora inicia sesión.");
  }

  async function signIn() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) return Alert.alert("Login error", error.message);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Torneos de Tenis</Text>

      <TextInput
        style={styles.input}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
      />

      <TextInput
        style={styles.input}
        secureTextEntry
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
      />

      <View style={styles.actions}>
        <Button title={loading ? "..." : "Iniciar sesión"} onPress={signIn} />
      </View>

      <View style={styles.actions}>
        <Button title={loading ? "..." : "Crear cuenta"} onPress={signUp} />
      </View>

      <Text style={styles.hint}>MVP: email + password</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: "center" },
  title: { fontSize: 24, fontWeight: "600", marginBottom: 16, textAlign: "center" },
  input: { borderWidth: 1, borderColor: "#ccc", padding: 12, borderRadius: 8, marginBottom: 12 },
  actions: { marginVertical: 6 },
  hint: { marginTop: 14, color: "#666", textAlign: "center" },
});