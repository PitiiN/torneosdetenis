import React, { useEffect, useMemo, useState } from "react";
import { Alert, Button, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { supabase } from "../lib/supabase";

type ProfileRole = "player" | "admin" | "organizer" | "referee" | null;

type TournamentStatus = "DRAFT" | "PUBLISHED" | "IN_PROGRESS" | "FINISHED" | "CANCELLED";
type CategoryType = "singles" | "doubles";
type CategoryLevel = "Cuarta" | "Tercera" | "Honor";

type Tournament = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: TournamentStatus;
};

type Category = {
  id: string;
  tournament_id: string;
  name: string;
  type: CategoryType;
  level: CategoryLevel;
};

type Registration = {
  id: string;
  category_id: string;
  user_id: string;
  status: "PENDING_PAYMENT" | "ACTIVE" | "CANCELLED";
};

type SimpleProfile = {
  id: string;
  full_name: string | null;
};

export function AdminScreen() {
  const [loading, setLoading] = useState(true);
  const [savingTournament, setSavingTournament] = useState(false);
  const [savingCategory, setSavingCategory] = useState(false);
  const [role, setRole] = useState<ProfileRole>(null);

  const [tournamentName, setTournamentName] = useState("");
  const [tournamentStartDate, setTournamentStartDate] = useState("");
  const [tournamentEndDate, setTournamentEndDate] = useState("");
  const [tournamentStatus, setTournamentStatus] = useState<TournamentStatus>("DRAFT");

  const [categoryTournamentId, setCategoryTournamentId] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [categoryType, setCategoryType] = useState<CategoryType>("singles");
  const [categoryLevel, setCategoryLevel] = useState<CategoryLevel>("Cuarta");

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [profiles, setProfiles] = useState<SimpleProfile[]>([]);

  async function loadData() {
    setLoading(true);

    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes.user;
    if (!user) {
      setRole(null);
      setLoading(false);
      return;
    }

    const profileRes = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (profileRes.error) {
      setRole(null);
      setLoading(false);
      return Alert.alert("Error", profileRes.error.message);
    }

    const currentRole = (profileRes.data?.role as ProfileRole) ?? null;
    setRole(currentRole);

    if (currentRole !== "admin" && currentRole !== "organizer") {
      setLoading(false);
      return;
    }

    const tournamentsRes = await supabase
      .from("tournaments")
      .select("id, name, start_date, end_date, status")
      .order("created_at", { ascending: false });
    if (tournamentsRes.error) {
      setLoading(false);
      return Alert.alert("Error", tournamentsRes.error.message);
    }

    const categoriesRes = await supabase
      .from("categories")
      .select("id, tournament_id, name, type, level")
      .order("created_at", { ascending: false });
    if (categoriesRes.error) {
      setLoading(false);
      return Alert.alert("Error", categoriesRes.error.message);
    }

    const registrationsRes = await supabase
      .from("registrations")
      .select("id, category_id, user_id, status")
      .order("created_at", { ascending: false });
    if (registrationsRes.error) {
      setLoading(false);
      return Alert.alert("Error", registrationsRes.error.message);
    }

    const registrationsData = (registrationsRes.data as Registration[]) ?? [];
    const uniqueUserIds = [...new Set(registrationsData.map((item) => item.user_id))];
    let profileRows: SimpleProfile[] = [];

    if (uniqueUserIds.length > 0) {
      const profilesRes = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", uniqueUserIds);

      if (profilesRes.error) {
        setLoading(false);
        return Alert.alert("Error", profilesRes.error.message);
      }

      profileRows = (profilesRes.data as SimpleProfile[]) ?? [];
    }

    const tournamentsData = (tournamentsRes.data as Tournament[]) ?? [];
    setTournaments(tournamentsData);
    setCategories((categoriesRes.data as Category[]) ?? []);
    setRegistrations(registrationsData);
    setProfiles(profileRows);

    if (!categoryTournamentId && tournamentsData.length > 0) {
      setCategoryTournamentId(tournamentsData[0].id);
    }

    setLoading(false);
  }

  async function createTournament() {
    if (!tournamentName || !tournamentStartDate || !tournamentEndDate) {
      return Alert.alert("Validacion", "Completa nombre, fecha inicio y fecha termino.");
    }

    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes.user;
    if (!user) {
      return Alert.alert("Error", "Sesion no valida.");
    }

    setSavingTournament(true);
    const { error } = await supabase.from("tournaments").insert({
      name: tournamentName,
      start_date: tournamentStartDate,
      end_date: tournamentEndDate,
      status: tournamentStatus,
      created_by: user.id,
    });
    setSavingTournament(false);

    if (error) {
      return Alert.alert("Error", error.message);
    }

    setTournamentName("");
    setTournamentStartDate("");
    setTournamentEndDate("");
    setTournamentStatus("DRAFT");
    Alert.alert("Listo", "Torneo creado.");
    loadData();
  }

  async function createCategory() {
    if (!categoryTournamentId || !categoryName) {
      return Alert.alert("Validacion", "Selecciona torneo e ingresa nombre de categoria.");
    }

    setSavingCategory(true);
    const { error } = await supabase.from("categories").insert({
      tournament_id: categoryTournamentId,
      name: categoryName,
      type: categoryType,
      level: categoryLevel,
    });
    setSavingCategory(false);

    if (error) {
      return Alert.alert("Error", error.message);
    }

    setCategoryName("");
    setCategoryType("singles");
    setCategoryLevel("Cuarta");
    Alert.alert("Listo", "Categoria creada.");
    loadData();
  }

  useEffect(() => {
    loadData();
  }, []);

  const profileNameById = useMemo(() => {
    return new Map(profiles.map((profile) => [profile.id, profile.full_name ?? "Sin nombre"]));
  }, [profiles]);

  const categoriesByTournament = useMemo(() => {
    const grouped = new Map<string, Category[]>();
    categories.forEach((category) => {
      const current = grouped.get(category.tournament_id) ?? [];
      grouped.set(category.tournament_id, [...current, category]);
    });
    return grouped;
  }, [categories]);

  const registrationsByCategory = useMemo(() => {
    const grouped = new Map<string, Registration[]>();
    registrations.forEach((registration) => {
      const current = grouped.get(registration.category_id) ?? [];
      grouped.set(registration.category_id, [...current, registration]);
    });
    return grouped;
  }, [registrations]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <Text>Cargando panel admin...</Text>
      </View>
    );
  }

  if (role !== "admin" && role !== "organizer") {
    return (
      <View style={styles.centered}>
        <Text>No tienes permisos para esta pantalla.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>Admin</Text>

      <View style={styles.block}>
        <Text style={styles.blockTitle}>Crear torneo</Text>
        <TextInput
          style={styles.input}
          placeholder="Nombre del torneo"
          value={tournamentName}
          onChangeText={setTournamentName}
        />
        <TextInput
          style={styles.input}
          placeholder="Fecha inicio (YYYY-MM-DD)"
          value={tournamentStartDate}
          onChangeText={setTournamentStartDate}
        />
        <TextInput
          style={styles.input}
          placeholder="Fecha termino (YYYY-MM-DD)"
          value={tournamentEndDate}
          onChangeText={setTournamentEndDate}
        />
        <View style={styles.pickerBox}>
          <Picker selectedValue={tournamentStatus} onValueChange={(value) => setTournamentStatus(value)}>
            <Picker.Item label="DRAFT" value="DRAFT" />
            <Picker.Item label="PUBLISHED" value="PUBLISHED" />
            <Picker.Item label="IN_PROGRESS" value="IN_PROGRESS" />
            <Picker.Item label="FINISHED" value="FINISHED" />
            <Picker.Item label="CANCELLED" value="CANCELLED" />
          </Picker>
        </View>
        <Button
          title={savingTournament ? "Creando..." : "Crear torneo"}
          disabled={savingTournament}
          onPress={createTournament}
        />
      </View>

      <View style={styles.block}>
        <Text style={styles.blockTitle}>Crear categoria</Text>
        <View style={styles.pickerBox}>
          <Picker
            selectedValue={categoryTournamentId}
            onValueChange={(value) => setCategoryTournamentId(value)}
          >
            {tournaments.length === 0 ? (
              <Picker.Item label="No hay torneos" value="" />
            ) : (
              tournaments.map((tournament) => (
                <Picker.Item
                  key={tournament.id}
                  label={`${tournament.name} (${tournament.status})`}
                  value={tournament.id}
                />
              ))
            )}
          </Picker>
        </View>
        <TextInput
          style={styles.input}
          placeholder="Nombre categoria (ej: Singles Honor)"
          value={categoryName}
          onChangeText={setCategoryName}
        />
        <View style={styles.pickerBox}>
          <Picker selectedValue={categoryType} onValueChange={(value) => setCategoryType(value)}>
            <Picker.Item label="singles" value="singles" />
            <Picker.Item label="doubles" value="doubles" />
          </Picker>
        </View>
        <View style={styles.pickerBox}>
          <Picker selectedValue={categoryLevel} onValueChange={(value) => setCategoryLevel(value)}>
            <Picker.Item label="Cuarta" value="Cuarta" />
            <Picker.Item label="Tercera" value="Tercera" />
            <Picker.Item label="Honor" value="Honor" />
          </Picker>
        </View>
        <Button
          title={savingCategory ? "Creando..." : "Crear categoria"}
          disabled={savingCategory || tournaments.length === 0}
          onPress={createCategory}
        />
      </View>

      <View style={styles.block}>
        <Text style={styles.blockTitle}>Inscritos por categoria</Text>
        {tournaments.map((tournament) => {
          const tournamentCategories = categoriesByTournament.get(tournament.id) ?? [];

          return (
            <View key={tournament.id} style={styles.tournamentBox}>
              <Text style={styles.tournamentTitle}>{tournament.name}</Text>
              {tournamentCategories.length === 0 ? (
                <Text style={styles.meta}>Sin categorias.</Text>
              ) : null}

              {tournamentCategories.map((category) => {
                const categoryRegistrations = registrationsByCategory.get(category.id) ?? [];
                return (
                  <View key={category.id} style={styles.categoryBox}>
                    <Text style={styles.categoryTitle}>
                      {category.name} ({category.type} - {category.level})
                    </Text>
                    {categoryRegistrations.length === 0 ? (
                      <Text style={styles.meta}>Sin inscritos.</Text>
                    ) : null}
                    {categoryRegistrations.map((registration) => (
                      <Text key={registration.id} style={styles.meta}>
                        {profileNameById.get(registration.user_id) ?? registration.user_id} -{" "}
                        {registration.status}
                      </Text>
                    ))}
                  </View>
                );
              })}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 16, paddingBottom: 30 },
  title: { fontSize: 22, fontWeight: "600", textAlign: "center", marginBottom: 12 },
  block: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    backgroundColor: "#fff",
  },
  blockTitle: { fontSize: 18, fontWeight: "600", marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  pickerBox: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    marginBottom: 10,
    overflow: "hidden",
  },
  tournamentBox: {
    borderTopWidth: 1,
    borderTopColor: "#eee",
    paddingTop: 10,
    marginTop: 10,
  },
  tournamentTitle: { fontSize: 16, fontWeight: "600", marginBottom: 8 },
  categoryBox: {
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    backgroundColor: "#fafafa",
  },
  categoryTitle: { fontSize: 14, fontWeight: "600", marginBottom: 4 },
  meta: { fontSize: 13, color: "#555" },
});
