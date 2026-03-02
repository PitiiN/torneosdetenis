import React, { useEffect, useMemo, useState } from "react";
import { Alert, Button, ScrollView, StyleSheet, Text, View } from "react-native";
import { supabase } from "../lib/supabase";

type Tournament = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
};

type Category = {
  id: string;
  tournament_id: string;
  name: string;
  type: "singles" | "doubles";
  level: "Cuarta" | "Tercera" | "Honor";
};

type Registration = {
  id: string;
  category_id: string;
  status: "PENDING_PAYMENT" | "ACTIVE" | "CANCELLED";
};

export function TournamentsScreen() {
  const [loading, setLoading] = useState(true);
  const [submittingCategoryId, setSubmittingCategoryId] = useState<string | null>(null);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);

  async function loadData() {
    setLoading(true);

    const { data: userRes } = await supabase.auth.getUser();
    const currentUserId = userRes.user?.id ?? null;
    setUserId(currentUserId);

    const tournamentsRes = await supabase
      .from("tournaments")
      .select("id, name, start_date, end_date, status")
      .order("start_date", { ascending: true });

    if (tournamentsRes.error) {
      setLoading(false);
      return Alert.alert("Error", tournamentsRes.error.message);
    }

    const categoriesRes = await supabase
      .from("categories")
      .select("id, tournament_id, name, type, level")
      .order("created_at", { ascending: true });

    if (categoriesRes.error) {
      setLoading(false);
      return Alert.alert("Error", categoriesRes.error.message);
    }

    let registrationsData: Registration[] = [];
    if (currentUserId) {
      const registrationsRes = await supabase
        .from("registrations")
        .select("id, category_id, status")
        .eq("user_id", currentUserId)
        .order("created_at", { ascending: false });

      if (registrationsRes.error) {
        setLoading(false);
        return Alert.alert("Error", registrationsRes.error.message);
      }

      registrationsData = (registrationsRes.data as Registration[]) ?? [];
    }

    setTournaments((tournamentsRes.data as Tournament[]) ?? []);
    setCategories((categoriesRes.data as Category[]) ?? []);
    setRegistrations(registrationsData);
    setLoading(false);
  }

  async function registerInCategory(categoryId: string) {
    if (!userId) {
      return Alert.alert("Error", "Debes iniciar sesion.");
    }

    setSubmittingCategoryId(categoryId);
    const { error } = await supabase.from("registrations").insert({
      category_id: categoryId,
      user_id: userId,
      status: "PENDING_PAYMENT",
    });
    setSubmittingCategoryId(null);

    if (error) {
      if (error.code === "23505") {
        return Alert.alert("Info", "Ya estabas inscrito en esta categoria.");
      }

      return Alert.alert("Error", error.message);
    }

    Alert.alert("Listo", "Inscripcion creada con estado PENDING_PAYMENT.");
    loadData();
  }

  useEffect(() => {
    loadData();
  }, []);

  const registrationByCategoryId = useMemo(() => {
    return new Map(registrations.map((registration) => [registration.category_id, registration]));
  }, [registrations]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <Text>Cargando torneos...</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>Torneos</Text>

      {tournaments.length === 0 ? (
        <Text style={styles.empty}>No hay torneos disponibles.</Text>
      ) : null}

      {tournaments.map((tournament) => {
        const isOpen = selectedTournamentId === tournament.id;
        const tournamentCategories = categories.filter(
          (category) => category.tournament_id === tournament.id,
        );

        return (
          <View key={tournament.id} style={styles.card}>
            <Text style={styles.cardTitle}>{tournament.name}</Text>
            <Text style={styles.meta}>
              {tournament.start_date} - {tournament.end_date}
            </Text>
            <Text style={styles.meta}>Estado: {tournament.status}</Text>

            <View style={{ height: 10 }} />
            <Button
              title={isOpen ? "Ocultar categorias" : "Ver categorias"}
              onPress={() => setSelectedTournamentId(isOpen ? null : tournament.id)}
            />

            {isOpen ? (
              <View style={styles.categoriesBox}>
                {tournamentCategories.length === 0 ? (
                  <Text style={styles.empty}>Sin categorias aun.</Text>
                ) : null}

                {tournamentCategories.map((category) => {
                  const myRegistration = registrationByCategoryId.get(category.id);
                  const canRegister = !myRegistration;

                  return (
                    <View key={category.id} style={styles.categoryCard}>
                      <Text style={styles.categoryName}>{category.name}</Text>
                      <Text style={styles.meta}>
                        {category.type} - {category.level}
                      </Text>
                      <Text style={styles.meta}>
                        Estado inscripcion: {myRegistration?.status ?? "NO_INSCRITO"}
                      </Text>
                      <View style={{ height: 8 }} />
                      <Button
                        title={
                          canRegister
                            ? submittingCategoryId === category.id
                              ? "Inscribiendo..."
                              : "Inscribirme"
                            : "Ya inscrito"
                        }
                        disabled={!canRegister || submittingCategoryId === category.id}
                        onPress={() => registerInCategory(category.id)}
                      />
                    </View>
                  );
                })}
              </View>
            ) : null}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 16, paddingBottom: 24 },
  title: { fontSize: 22, fontWeight: "600", textAlign: "center", marginBottom: 12 },
  card: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    backgroundColor: "#fff",
  },
  cardTitle: { fontSize: 17, fontWeight: "600", marginBottom: 4 },
  meta: { fontSize: 13, color: "#555" },
  categoriesBox: { marginTop: 12, borderTopWidth: 1, borderTopColor: "#eee", paddingTop: 10 },
  categoryCard: {
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    backgroundColor: "#fafafa",
  },
  categoryName: { fontSize: 15, fontWeight: "600", marginBottom: 4 },
  empty: { color: "#666" },
});
