import React, { useEffect, useState } from "react";
import { Alert, Button, StyleSheet, Text, TextInput, View } from "react-native";
import { supabase } from "../lib/supabase";

type ProfileRole = "player" | "admin" | "organizer" | "referee" | null;

type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  club_name: string | null;
  level: "Cuarta" | "Tercera" | "Honor" | null;
  role: ProfileRole;
};

export function ProfileScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [profile, setProfile] = useState<Profile | null>(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [clubName, setClubName] = useState("");
  const [level, setLevel] = useState<Profile["level"]>(null);

  async function loadProfile() {
    setLoading(true);

    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes.user;
    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, phone, club_name, level, role")
      .eq("id", user.id)
      .single();

    if (error) {
      setLoading(false);
      return Alert.alert("Error", error.message);
    }

    setProfile(data as Profile);
    setFullName(data?.full_name ?? "");
    setPhone(data?.phone ?? "");
    setClubName(data?.club_name ?? "");
    setLevel((data?.level as Profile["level"]) ?? null);

    setLoading(false);
  }

  async function saveProfile() {
    if (!profile) return;

    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName || null,
        phone: phone || null,
        club_name: clubName || null,
        level: level || null,
      })
      .eq("id", profile.id);

    setSaving(false);

    if (error) return Alert.alert("Error", error.message);
    Alert.alert("Listo", "Perfil actualizado.");
    loadProfile();
  }

  useEffect(() => {
    loadProfile();
  }, []);

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Cargando perfil...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Perfil</Text>
      <Text style={styles.roleText}>Rol: {profile?.role ?? "player"}</Text>

      <Text style={styles.label}>Nombre</Text>
      <TextInput style={styles.input} value={fullName} onChangeText={setFullName} />

      <Text style={styles.label}>Telefono</Text>
      <TextInput style={styles.input} value={phone} onChangeText={setPhone} />

      <Text style={styles.label}>Club</Text>
      <TextInput style={styles.input} value={clubName} onChangeText={setClubName} />

      <Text style={styles.label}>Nivel (Cuarta / Tercera / Honor)</Text>
      <TextInput
        style={styles.input}
        value={level ?? ""}
        onChangeText={(v) => setLevel((v as Profile["level"]) || null)}
        placeholder="Cuarta"
      />

      <View style={{ height: 12 }} />
      <Button title={saving ? "Guardando..." : "Guardar"} onPress={saveProfile} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: "center" },
  title: { fontSize: 22, fontWeight: "600", marginBottom: 8, textAlign: "center" },
  roleText: { fontSize: 14, color: "#555", marginBottom: 12, textAlign: "center" },
  label: { marginTop: 10, marginBottom: 6, color: "#444" },
  input: { borderWidth: 1, borderColor: "#ccc", padding: 12, borderRadius: 8 },
});
