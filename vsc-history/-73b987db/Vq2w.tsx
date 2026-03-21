import React, { useEffect, useMemo, useState } from "react";
import { Alert, Button, Modal, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { supabase } from "../lib/supabase";
import {
  DrawMatch,
  DrawParticipant,
  advanceWinnerToNextMatch,
  generateSingleElimMatches,
} from "../domain/draws";
import {
  RrGroup,
  computeGroupStandings,
  createRoundRobinGroups,
  generateRoundRobinFixtures,
} from "../domain/roundRobin";
import { SetInput, validateAndBuildScoreJson } from "../domain/scoring";

type Tournament = { id: string; name: string };
type Category = {
  id: string;
  tournament_id: string;
  name: string;
  type: "singles" | "doubles";
  level: "Cuarta" | "Tercera" | "Honor";
  third_set_super_tiebreak?: boolean;
};
type Draw = {
  id: string;
  category_id: string;
  type: "single_elim" | "round_robin" | "rr_to_elim";
  status: "DRAFT" | "IN_PROGRESS" | "COMPLETED";
  rr_top_k: number;
};
type Match = {
  id: string;
  draw_id: string;
  round: number;
  match_number: number;
  player1_id: string | null;
  player2_id: string | null;
  winner_id: string | null;
  status: "PENDING" | "READY" | "IN_PLAY" | "FINAL" | "COMPLETED";
  score_json: any;
  phase: "RR" | "ELIM";
  group_id: string | null;
};
type Registration = {
  id: string;
  category_id: string;
  user_id: string;
  status: "PENDING_PAYMENT" | "ACTIVE" | "CANCELLED";
  created_at?: string;
};
type Profile = {
  id: string;
  full_name: string | null;
  role?: string | null;
  ranking?: number | null;
  ranking_points?: number | null;
  points?: number | null;
};
type Group = { id: string; draw_id: string; name: string };
type GroupMember = { id: string; group_id: string; user_id: string; seed: number | null; sort_order: number };
type Court = { id: string; name: string; is_active: boolean };
type CourtBlock = { id: string; court_id: string; start_at: string; end_at: string; reason: string | null };
type Schedule = {
  id: string;
  match_id: string;
  court_id: string;
  start_at: string;
  status: "SCHEDULED" | "IN_PLAY" | "DELAYED" | "DONE";
};

const EMPTY_SETS: SetInput[] = [
  { p1Games: null, p2Games: null, tbP1: null, tbP2: null },
  { p1Games: null, p2Games: null, tbP1: null, tbP2: null },
  { p1Games: null, p2Games: null, tbP1: null, tbP2: null },
];

export function AdminScreen() {
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [draws, setDraws] = useState<Draw[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);
  const [courtBlocks, setCourtBlocks] = useState<CourtBlock[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);

  const [tournamentName, setTournamentName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [categoryTournamentId, setCategoryTournamentId] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [categoryType, setCategoryType] = useState<"singles" | "doubles">("singles");
  const [categoryLevel, setCategoryLevel] = useState<"Cuarta" | "Tercera" | "Honor">("Cuarta");
  const [categorySuperTb, setCategorySuperTb] = useState<"false" | "true">("false");

  const [selectedCategoryForRr, setSelectedCategoryForRr] = useState("");
  const [rrGroupCount, setRrGroupCount] = useState("2");
  const [rrTopK, setRrTopK] = useState("2");

  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [editingWinnerId, setEditingWinnerId] = useState("");
  const [editingSets, setEditingSets] = useState<SetInput[]>(EMPTY_SETS);

  const [courtName, setCourtName] = useState("");
  const [selectedCourtForBlock, setSelectedCourtForBlock] = useState("");
  const [blockStartAt, setBlockStartAt] = useState("");
  const [blockEndAt, setBlockEndAt] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [selectedMatchForSchedule, setSelectedMatchForSchedule] = useState("");
  const [selectedCourtForSchedule, setSelectedCourtForSchedule] = useState("");
  const [scheduleStartAt, setScheduleStartAt] = useState("");
  const [scheduleStatus, setScheduleStatus] = useState<Schedule["status"]>("SCHEDULED");

  const [notifyCategoryId, setNotifyCategoryId] = useState("");
  const [notifyType, setNotifyType] = useState("MASS_NOTICE");
  const [notifyMessage, setNotifyMessage] = useState("");
  const [qaCategoryId, setQaCategoryId] = useState("");
  const [qaCount, setQaCount] = useState("8");
  const [qaTag, setQaTag] = useState("rrtest");
  const [qaSeedCountOk, setQaSeedCountOk] = useState<number | null>(null);
  const [qaSeedEmails, setQaSeedEmails] = useState<string[]>([]);
  const [qaCleanupCountDeleted, setQaCleanupCountDeleted] = useState<number | null>(null);

  async function loadData() {
    setLoading(true);
    const me = await supabase.auth.getUser();
    if (!me.data.user) return setLoading(false);

    const roleRes = await supabase.from("profiles").select("role").eq("id", me.data.user.id).single();
    if (roleRes.error) return Alert.alert("Error", roleRes.error.message);
    setRole(roleRes.data?.role ?? null);

    const [tRes, cRes, dRes, mRes, rRes, gRes, gmRes, pRes, courtsRes, blocksRes, schedRes] =
      await Promise.all([
        supabase.from("tournaments").select("id,name").order("created_at", { ascending: false }),
        supabase
          .from("categories")
          .select("id,tournament_id,name,type,level,third_set_super_tiebreak")
          .order("created_at", { ascending: false }),
        supabase.from("draws").select("id,category_id,type,status,rr_top_k"),
        supabase
          .from("matches")
          .select(
            "id,draw_id,round,match_number,player1_id,player2_id,winner_id,status,score_json,phase,group_id",
          )
          .order("round", { ascending: true })
          .order("match_number", { ascending: true }),
        supabase.from("registrations").select("id,category_id,user_id,status,created_at"),
        supabase.from("rr_groups").select("id,draw_id,name"),
        supabase.from("rr_group_members").select("id,group_id,user_id,seed,sort_order"),
        supabase.from("profiles").select("*"),
        supabase.from("courts").select("id,name,is_active"),
        supabase.from("court_blocks").select("id,court_id,start_at,end_at,reason"),
        supabase.from("schedules").select("id,match_id,court_id,start_at,status"),
      ]);

    const err =
      tRes.error ||
      cRes.error ||
      dRes.error ||
      mRes.error ||
      rRes.error ||
      gRes.error ||
      gmRes.error ||
      pRes.error ||
      courtsRes.error ||
      blocksRes.error ||
      schedRes.error;
    if (err) return Alert.alert("Error", err.message);

    setTournaments((tRes.data as Tournament[]) ?? []);
    setCategories((cRes.data as Category[]) ?? []);
    setDraws((dRes.data as Draw[]) ?? []);
    setMatches((mRes.data as Match[]) ?? []);
    setRegistrations((rRes.data as Registration[]) ?? []);
    setGroups((gRes.data as Group[]) ?? []);
    setGroupMembers((gmRes.data as GroupMember[]) ?? []);
    setProfiles((pRes.data as Profile[]) ?? []);
    setCourts((courtsRes.data as Court[]) ?? []);
    setCourtBlocks((blocksRes.data as CourtBlock[]) ?? []);
    setSchedules((schedRes.data as Schedule[]) ?? []);

    if (!categoryTournamentId && tRes.data?.[0]) setCategoryTournamentId(tRes.data[0].id);
    if (!selectedCategoryForRr && cRes.data?.[0]) setSelectedCategoryForRr(cRes.data[0].id);
    if (!notifyCategoryId && cRes.data?.[0]) setNotifyCategoryId(cRes.data[0].id);
    if (!qaCategoryId && cRes.data?.[0]) setQaCategoryId(cRes.data[0].id);
    if (!selectedCourtForBlock && courtsRes.data?.[0]) setSelectedCourtForBlock(courtsRes.data[0].id);
    if (!selectedCourtForSchedule && courtsRes.data?.[0]) setSelectedCourtForSchedule(courtsRes.data[0].id);
    if (!selectedMatchForSchedule && mRes.data?.[0]) setSelectedMatchForSchedule(mRes.data[0].id);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  const profileNameById = useMemo(
    () => new Map(profiles.map((p) => [p.id, p.full_name ?? p.id.slice(0, 8)])),
    [profiles],
  );
  const profileById = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);
  const drawByCategory = useMemo(() => new Map(draws.map((d) => [d.category_id, d])), [draws]);
  const matchesByDraw = useMemo(() => {
    const map = new Map<string, Match[]>();
    matches.forEach((m) => map.set(m.draw_id, [...(map.get(m.draw_id) ?? []), m]));
    return map;
  }, [matches]);
  const groupsByDraw = useMemo(() => {
    const map = new Map<string, Group[]>();
    groups.forEach((g) => map.set(g.draw_id, [...(map.get(g.draw_id) ?? []), g]));
    return map;
  }, [groups]);
  const membersByGroup = useMemo(() => {
    const map = new Map<string, GroupMember[]>();
    groupMembers.forEach((m) => map.set(m.group_id, [...(map.get(m.group_id) ?? []), m]));
    return map;
  }, [groupMembers]);
  const schedulesByMatch = useMemo(() => new Map(schedules.map((s) => [s.match_id, s])), [schedules]);
  const courtNameById = useMemo(() => new Map(courts.map((c) => [c.id, c.name])), [courts]);

  function participantRanking(userId: string) {
    const profile = profileById.get(userId);
    const value = profile?.ranking ?? profile?.ranking_points ?? profile?.points ?? null;
    return typeof value === "number" ? value : null;
  }

  async function createTournament() {
    const me = await supabase.auth.getUser();
    if (!me.data.user) return;
    const { error } = await supabase.from("tournaments").insert({
      name: tournamentName,
      start_date: startDate,
      end_date: endDate,
      status: "DRAFT",
      created_by: me.data.user.id,
    });
    if (error) return Alert.alert("Error", error.message);
    setTournamentName("");
    setStartDate("");
    setEndDate("");
    loadData();
  }

  async function createCategory() {
    const { error } = await supabase.from("categories").insert({
      tournament_id: categoryTournamentId,
      name: categoryName,
      type: categoryType,
      level: categoryLevel,
      third_set_super_tiebreak: categorySuperTb === "true",
      currency: "clp",
    });
    if (error) return Alert.alert("Error", error.message);
    setCategoryName("");
    loadData();
  }

  async function generateRoundRobin(categoryId: string) {
    const groupCount = Number(rrGroupCount);
    const topK = Number(rrTopK);
    if (!Number.isInteger(groupCount) || groupCount < 1) return Alert.alert("Error", "groupCount invalido");
    if (!Number.isInteger(topK) || topK < 1) return Alert.alert("Error", "topK invalido");

    const activeRegs = registrations
      .filter((r) => r.category_id === categoryId && r.status === "ACTIVE")
      .sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""));
    if (activeRegs.length < 2) return Alert.alert("Error", "Se requieren 2+ ACTIVE");

    const participants: DrawParticipant[] = activeRegs.map((reg, idx) => ({
      userId: reg.user_id,
      seedRank: participantRanking(reg.user_id),
      registrationOrder: idx + 1,
    }));

    const rrGroups = createRoundRobinGroups(participants, groupCount);
    const fixtures = generateRoundRobinFixtures(rrGroups);
    const me = await supabase.auth.getUser();
    if (!me.data.user) return;

    let draw = drawByCategory.get(categoryId);
    if (!draw) {
      const drawInsert = await supabase
        .from("draws")
        .insert({
          category_id: categoryId,
          type: "rr_to_elim",
          status: "IN_PROGRESS",
          created_by: me.data.user.id,
          rr_top_k: topK,
        })
        .select("id,category_id,type,status,rr_top_k")
        .single();
      if (drawInsert.error || !drawInsert.data) {
        return Alert.alert("Error", drawInsert.error?.message ?? "No se pudo crear draw");
      }
      draw = drawInsert.data as Draw;
    } else {
      const u = await supabase.from("draws").update({ type: "rr_to_elim", rr_top_k: topK }).eq("id", draw.id);
      if (u.error) return Alert.alert("Error", u.error.message);
    }

    const oldGroups = groupsByDraw.get(draw.id) ?? [];
    if (oldGroups.length > 0) {
      await supabase.from("matches").delete().eq("draw_id", draw.id).eq("phase", "RR");
      await supabase.from("rr_groups").delete().eq("draw_id", draw.id);
    }

    const groupsIns = await supabase
      .from("rr_groups")
      .insert(rrGroups.map((g) => ({ draw_id: draw.id, name: g.name })))
      .select("id,draw_id,name");
    if (groupsIns.error) return Alert.alert("Error", groupsIns.error.message);
    const insertedGroups = (groupsIns.data as Group[]) ?? [];
    const groupIdByName = new Map(insertedGroups.map((g) => [g.name, g.id]));

    const membersRows = rrGroups.flatMap((g: RrGroup) =>
      g.members.map((m, idx) => ({
        group_id: groupIdByName.get(g.name),
        user_id: m.userId,
        seed: m.seedRank ?? null,
        sort_order: idx + 1,
      })),
    );
    const mIns = await supabase.from("rr_group_members").insert(membersRows);
    if (mIns.error) return Alert.alert("Error", mIns.error.message);

    const rrMatchesRows = fixtures.map((f) => ({
      draw_id: draw?.id,
      round: f.round,
      match_number: f.matchNumber,
      player1_id: f.player1Id,
      player2_id: f.player2Id,
      winner_id: null,
      status: "READY",
      score_json: null,
      phase: "RR",
      group_id: groupIdByName.get(f.groupName),
    }));
    const rrIns = await supabase.from("matches").insert(rrMatchesRows);
    if (rrIns.error) return Alert.alert("Error", rrIns.error.message);

    Alert.alert("Listo", "Fase de grupos generada.");
    loadData();
  }

  function buildStandingsForCategory(categoryId: string) {
    const draw = drawByCategory.get(categoryId);
    if (!draw) return [];
    const rrGroups = groupsByDraw.get(draw.id) ?? [];
    const drawMatches = matchesByDraw.get(draw.id) ?? [];
    return rrGroups.map((g) => {
      const members = (membersByGroup.get(g.id) ?? [])
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((m) => ({
          userId: m.user_id,
          seedRank: m.seed,
          registrationOrder: m.sort_order,
        }));
      const standings = computeGroupStandings(
        { name: g.name, members },
        drawMatches
          .filter((m) => m.phase === "RR" && m.group_id === g.id)
          .map((m) => ({
            groupName: g.name,
            player1Id: m.player1_id,
            player2Id: m.player2_id,
            winnerId: m.winner_id,
            scoreJson: m.score_json,
            status: m.status,
          })),
      );
      return { group: g, standings };
    });
  }

  async function closeRrPhase(categoryId: string) {
    const draw = drawByCategory.get(categoryId);
    if (!draw) return Alert.alert("Error", "No existe draw.");
    const all = (matchesByDraw.get(draw.id) ?? []).filter((m) => m.phase === "RR");
    if (all.length === 0) return Alert.alert("Error", "No hay matches RR.");
    const notFinal = all.filter((m) => m.status !== "FINAL" && m.status !== "COMPLETED");
    if (notFinal.length > 0) return Alert.alert("Error", "Todos los matches RR deben estar FINAL.");

    const standingsByGroup = buildStandingsForCategory(categoryId);
    const topK = draw.rr_top_k ?? 2;
    const qualifiers = standingsByGroup.flatMap(({ standings }) => standings.slice(0, topK));
    if (qualifiers.length < 2) return Alert.alert("Error", "No hay clasificados suficientes.");

    const existingElim = (matchesByDraw.get(draw.id) ?? []).filter((m) => m.phase === "ELIM");
    if (existingElim.length > 0) return Alert.alert("Info", "La llave ELIM ya fue creada.");

    const participants: DrawParticipant[] = qualifiers.map((q, idx) => ({
      userId: q.userId,
      seedRank: idx + 1,
      registrationOrder: idx + 1,
    }));
    const elim = generateSingleElimMatches(participants);
    const ins = await supabase.from("matches").insert(
      elim.map((m) => ({
        draw_id: draw.id,
        round: m.round,
        match_number: m.matchNumber,
        player1_id: m.player1Id,
        player2_id: m.player2Id,
        winner_id: m.winnerId,
        status: m.winnerId ? "FINAL" : m.status === "READY" ? "READY" : "PENDING",
        score_json: null,
        phase: "ELIM",
        group_id: null,
      })),
    );
    if (ins.error) return Alert.alert("Error", ins.error.message);
    await supabase.from("draws").update({ status: "IN_PROGRESS", type: "rr_to_elim" }).eq("id", draw.id);
    Alert.alert("Listo", "Fase RR cerrada y llave ELIM generada.");
    loadData();
  }

  function openMatchEditor(match: Match) {
    setEditingMatch(match);
    setEditingWinnerId(match.winner_id ?? "");
    const setsFromScore = Array.isArray(match.score_json?.sets) ? match.score_json.sets : [];
    setEditingSets(
      [0, 1, 2].map((idx) => ({
        p1Games: setsFromScore[idx]?.p1_games ?? null,
        p2Games: setsFromScore[idx]?.p2_games ?? null,
        tbP1: setsFromScore[idx]?.tiebreak?.p1 ?? setsFromScore[idx]?.super_tiebreak?.p1 ?? null,
        tbP2: setsFromScore[idx]?.tiebreak?.p2 ?? setsFromScore[idx]?.super_tiebreak?.p2 ?? null,
      })),
    );
  }

  async function saveMatchResult() {
    if (!editingMatch) return;
    const draw = draws.find((d) => d.id === editingMatch.draw_id);
    const category = categories.find((c) => c.id === draw?.category_id);
    const result = validateAndBuildScoreJson(editingSets, {
      thirdSetSuperTiebreak: !!category?.third_set_super_tiebreak,
      winnerId: editingWinnerId,
      player1Id: editingMatch.player1_id,
      player2Id: editingMatch.player2_id,
    });
    if (!result.ok) return Alert.alert("Score invalido", result.error);

    const me = await supabase.auth.getUser();
    if (!me.data.user) return;

    const update = await supabase
      .from("matches")
      .update({
        winner_id: editingWinnerId,
        status: "FINAL",
        score_json: result.score,
      })
      .eq("id", editingMatch.id);
    if (update.error) return Alert.alert("Error", update.error.message);

    await supabase.from("match_events").insert({
      match_id: editingMatch.id,
      actor_user_id: me.data.user.id,
      event_type: "RESULT_EDITED",
      payload_json: { winner_id: editingWinnerId, score_json: result.score },
    });

    if (editingMatch.phase === "ELIM") {
      const sameDraw: DrawMatch[] = (matchesByDraw.get(editingMatch.draw_id) ?? []).map((m) => ({
        round: m.round,
        matchNumber: m.match_number,
        player1Id: m.player1_id,
        player2Id: m.player2_id,
        winnerId: m.winner_id,
        status:
          m.status === "FINAL" || m.status === "COMPLETED"
            ? "COMPLETED"
              : m.status === "READY"
                ? ("READY" as const)
                : ("PENDING" as const),
        scoreJson: m.score_json,
      }));
      const advanced = advanceWinnerToNextMatch(
        sameDraw,
        editingMatch.round,
        editingMatch.match_number,
        editingWinnerId,
      );
      const nextRound = editingMatch.round + 1;
      const nextNumber = Math.ceil(editingMatch.match_number / 2);
      const nextMatchData = advanced.find(
        (m) => m.round === nextRound && m.matchNumber === nextNumber,
      );
      const nextDb = (matchesByDraw.get(editingMatch.draw_id) ?? []).find(
        (m) => m.round === nextRound && m.match_number === nextNumber && m.phase === "ELIM",
      );
      if (nextMatchData && nextDb) {
        const nextU = await supabase
          .from("matches")
          .update({
            player1_id: nextMatchData.player1Id,
            player2_id: nextMatchData.player2Id,
            status: nextMatchData.winnerId
              ? "FINAL"
              : nextMatchData.status === "READY"
                ? "READY"
                : "PENDING",
          })
          .eq("id", nextDb.id);
        if (nextU.error) return Alert.alert("Error", nextU.error.message);
        await supabase.from("match_events").insert({
          match_id: nextDb.id,
          actor_user_id: me.data.user.id,
          event_type: "WINNER_ADVANCED",
          payload_json: { from_match_id: editingMatch.id, winner_id: editingWinnerId },
        });
      }
    }

    setEditingMatch(null);
    Alert.alert("Listo", "Resultado guardado.");
    loadData();
  }

  async function createCourt() {
    const { error } = await supabase.from("courts").insert({ name: courtName, is_active: true });
    if (error) return Alert.alert("Error", error.message);
    setCourtName("");
    loadData();
  }

  async function createCourtBlock() {
    const { error } = await supabase.from("court_blocks").insert({
      court_id: selectedCourtForBlock,
      start_at: blockStartAt,
      end_at: blockEndAt,
      reason: blockReason || null,
    });
    if (error) return Alert.alert("Error", error.message);
    setBlockStartAt("");
    setBlockEndAt("");
    setBlockReason("");
    loadData();
  }

  async function upsertSchedule() {
    const existing = schedulesByMatch.get(selectedMatchForSchedule);
    if (existing) {
      const u = await supabase
        .from("schedules")
        .update({
          court_id: selectedCourtForSchedule,
          start_at: scheduleStartAt,
          status: scheduleStatus,
        })
        .eq("id", existing.id);
      if (u.error) return Alert.alert("Error", u.error.message);
    } else {
      const i = await supabase.from("schedules").insert({
        match_id: selectedMatchForSchedule,
        court_id: selectedCourtForSchedule,
        start_at: scheduleStartAt,
        status: scheduleStatus,
      });
      if (i.error) return Alert.alert("Error", i.error.message);
    }
    Alert.alert("Listo", "Schedule guardado.");
    loadData();
  }

  async function sendMassNotice() {
    const regs = registrations.filter(
      (r) => r.category_id === notifyCategoryId && r.status !== "CANCELLED",
    );
    const userIds = [...new Set(regs.map((r) => r.user_id))];
    if (userIds.length === 0) return Alert.alert("Info", "No hay inscritos en categoria.");
    const ins = await supabase.from("notifications_outbox").insert(
      userIds.map((userId) => ({
        user_id: userId,
        type: notifyType,
        payload: { message: notifyMessage, category_id: notifyCategoryId },
        status: "PENDING",
      })),
    );
    if (ins.error) return Alert.alert("Error", ins.error.message);
    Alert.alert("Listo", `Aviso encolado para ${userIds.length} usuarios.`);
    setNotifyMessage("");
  }

  async function runQaSeedUsers() {
    const count = Number(qaCount);
    if (!Number.isInteger(count) || count < 1) {
      return Alert.alert("Error", "count debe ser un entero >= 1");
    }
    if (!qaCategoryId.trim()) return Alert.alert("Error", "category_id es obligatorio");
    if (!qaTag.trim()) return Alert.alert("Error", "tag es obligatorio");

const { data: s } = await supabase.auth.getSession();
const accessToken = s.session?.access_token;

if (!accessToken) {
  return Alert.alert("Error", "No hay sesión activa (access token vacío).");
}

const response = await supabase.functions.invoke("seed-users", {
  body: {
    count,
    category_id: qaCategoryId.trim(),
    password: "Test123456!",
    tag: qaTag.trim(),
  },
  headers: {
    Authorization: `Bearer ${accessToken}`,
  },
});

console.log("seed-users full response:", response);

if (response.error) {
  // Mucho más detalle:
  const status = (response.error as any).context?.status;
  const body = (response.error as any).context?.body;

  console.log("seed-users error status:", status);
  console.log("seed-users error body:", body);

  return Alert.alert(
    "Seed error",
    `status=${status ?? "?"}\n` +
      `message=${response.error.message ?? "?"}\n` +
      `body=${typeof body === "string" ? body : JSON.stringify(body)}`
  );
}

    const data = response.data ?? {};
    setQaSeedCountOk(Number(data.count_ok ?? 0));
    setQaSeedEmails(Array.isArray(data.users) ? data.users.map((u: any) => String(u.email)) : []);
    setQaCleanupCountDeleted(null);
    Alert.alert("Listo", `Seed completado. count_ok=${data.count_ok ?? 0}`);
    loadData();
  }

  async function runQaCleanupUsers() {
    if (!qaTag.trim()) return Alert.alert("Error", "tag es obligatorio");

    const response = await supabase.functions.invoke("cleanup-seed-users", {
      body: { tag: qaTag.trim() },
    });

    if (response.error) {
      console.log("cleanup-seed-users error", response.error);
      return Alert.alert("Error", response.error.message ?? "No se pudo ejecutar cleanup-seed-users");
    }

    const data = response.data ?? {};
    setQaCleanupCountDeleted(Number(data.count_deleted ?? 0));
    setQaSeedCountOk(null);
    setQaSeedEmails([]);
    Alert.alert("Listo", `Cleanup completado. count_deleted=${data.count_deleted ?? 0}`);
    loadData();
  }

  if (loading) return <View style={styles.center}><Text>Cargando...</Text></View>;
  if (role !== "admin" && role !== "organizer") return <View style={styles.center}><Text>Sin permisos</Text></View>;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Admin</Text>

        <View style={styles.block}>
          <Text style={styles.blockTitle}>Torneos y categorias</Text>
          <TextInput style={styles.input} value={tournamentName} onChangeText={setTournamentName} placeholder="Nombre torneo" />
          <TextInput style={styles.input} value={startDate} onChangeText={setStartDate} placeholder="Inicio YYYY-MM-DD" />
          <TextInput style={styles.input} value={endDate} onChangeText={setEndDate} placeholder="Fin YYYY-MM-DD" />
          <Button title="Crear torneo" onPress={createTournament} />
          <View style={{ height: 10 }} />
          <View style={styles.picker}><Picker selectedValue={categoryTournamentId} onValueChange={(v) => setCategoryTournamentId(v)}>{tournaments.map((t) => <Picker.Item key={t.id} label={t.name} value={t.id} />)}</Picker></View>
          <TextInput style={styles.input} value={categoryName} onChangeText={setCategoryName} placeholder="Nombre categoria" />
          <View style={styles.picker}><Picker selectedValue={categoryType} onValueChange={(v) => setCategoryType(v)}><Picker.Item label="singles" value="singles" /><Picker.Item label="doubles" value="doubles" /></Picker></View>
          <View style={styles.picker}><Picker selectedValue={categoryLevel} onValueChange={(v) => setCategoryLevel(v)}><Picker.Item label="Cuarta" value="Cuarta" /><Picker.Item label="Tercera" value="Tercera" /><Picker.Item label="Honor" value="Honor" /></Picker></View>
          <View style={styles.picker}><Picker selectedValue={categorySuperTb} onValueChange={(v) => setCategorySuperTb(v)}><Picker.Item label="3er set normal" value="false" /><Picker.Item label="3er set super TB" value="true" /></Picker></View>
          <Button title="Crear categoria" onPress={createCategory} />
        </View>

        <View style={styles.block}>
          <Text style={styles.blockTitle}>Round Robin</Text>
          <View style={styles.picker}><Picker selectedValue={selectedCategoryForRr} onValueChange={(v) => setSelectedCategoryForRr(v)}>{categories.map((c) => <Picker.Item key={c.id} label={`${c.name}`} value={c.id} />)}</Picker></View>
          <TextInput style={styles.input} value={rrGroupCount} onChangeText={setRrGroupCount} keyboardType="numeric" placeholder="Cantidad grupos" />
          <TextInput style={styles.input} value={rrTopK} onChangeText={setRrTopK} keyboardType="numeric" placeholder="Top K clasificados" />
          <Button title="Generar RR" onPress={() => generateRoundRobin(selectedCategoryForRr)} />
          <View style={{ height: 8 }} />
          <Button title="Cerrar fase de grupos" onPress={() => closeRrPhase(selectedCategoryForRr)} />
          <View style={{ height: 8 }} />
          {buildStandingsForCategory(selectedCategoryForRr).map(({ group, standings }) => (
            <View key={group.id} style={styles.card}>
              <Text style={styles.subtitle}>{group.name}</Text>
              {standings.map((s, idx) => (
                <Text key={s.userId} style={styles.text}>
                  {idx + 1}. {profileNameById.get(s.userId) ?? s.userId} | W:{s.wins} SD:{s.setDiff} GD:{s.gameDiff}
                </Text>
              ))}
            </View>
          ))}
        </View>

        <View style={styles.block}>
          <Text style={styles.blockTitle}>Partidos (RR + ELIM)</Text>
          {categories.map((c) => {
            const draw = drawByCategory.get(c.id);
            if (!draw) return null;
            const drawMatches = (matchesByDraw.get(draw.id) ?? []).sort(
              (a, b) => a.round - b.round || a.match_number - b.match_number,
            );
            const grouped = new Map<string, Match[]>();
            drawMatches.forEach((m) => grouped.set(`${m.phase}-${m.round}`, [...(grouped.get(`${m.phase}-${m.round}`) ?? []), m]));
            return (
              <View key={c.id} style={styles.card}>
                <Text style={styles.subtitle}>{c.name} ({draw.type})</Text>
                {Array.from(grouped.entries()).map(([key, ms]) => (
                  <View key={key} style={{ marginTop: 6 }}>
                    <Text style={styles.text}>{key}</Text>
                    {ms.map((m) => (
                      <View key={m.id} style={styles.matchCard}>
                        <Text style={styles.text}>
                          M{m.match_number}: {profileNameById.get(m.player1_id ?? "") ?? "TBD"} vs{" "}
                          {profileNameById.get(m.player2_id ?? "") ?? "TBD"} | {m.status}
                        </Text>
                        <Button title="Editar match" onPress={() => openMatchEditor(m)} />
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            );
          })}
        </View>

        <View style={styles.block}>
          <Text style={styles.blockTitle}>Canchas y Scheduling</Text>
          <TextInput style={styles.input} value={courtName} onChangeText={setCourtName} placeholder="Nombre cancha" />
          <Button title="Crear cancha" onPress={createCourt} />
          <View style={{ height: 8 }} />
          <View style={styles.picker}><Picker selectedValue={selectedCourtForBlock} onValueChange={(v) => setSelectedCourtForBlock(v)}>{courts.map((c) => <Picker.Item key={c.id} label={c.name} value={c.id} />)}</Picker></View>
          <TextInput style={styles.input} value={blockStartAt} onChangeText={setBlockStartAt} placeholder="Block start ISO" />
          <TextInput style={styles.input} value={blockEndAt} onChangeText={setBlockEndAt} placeholder="Block end ISO" />
          <TextInput style={styles.input} value={blockReason} onChangeText={setBlockReason} placeholder="Motivo" />
          <Button title="Crear bloqueo" onPress={createCourtBlock} />
          <View style={{ height: 8 }} />
          <View style={styles.picker}><Picker selectedValue={selectedMatchForSchedule} onValueChange={(v) => setSelectedMatchForSchedule(v)}>{matches.map((m) => <Picker.Item key={m.id} label={`${m.id.slice(0, 8)} ${m.phase} R${m.round}M${m.match_number}`} value={m.id} />)}</Picker></View>
          <View style={styles.picker}><Picker selectedValue={selectedCourtForSchedule} onValueChange={(v) => setSelectedCourtForSchedule(v)}>{courts.map((c) => <Picker.Item key={c.id} label={c.name} value={c.id} />)}</Picker></View>
          <TextInput style={styles.input} value={scheduleStartAt} onChangeText={setScheduleStartAt} placeholder="Start ISO" />
          <View style={styles.picker}><Picker selectedValue={scheduleStatus} onValueChange={(v) => setScheduleStatus(v)}><Picker.Item label="SCHEDULED" value="SCHEDULED" /><Picker.Item label="IN_PLAY" value="IN_PLAY" /><Picker.Item label="DELAYED" value="DELAYED" /><Picker.Item label="DONE" value="DONE" /></Picker></View>
          <Button title="Guardar schedule" onPress={upsertSchedule} />
          {schedules.map((s) => (
            <Text key={s.id} style={styles.text}>
              {s.match_id.slice(0, 8)} | {courtNameById.get(s.court_id)} | {s.start_at} | {s.status}
            </Text>
          ))}
          {courtBlocks.map((b) => (
            <Text key={b.id} style={styles.text}>
              Block {courtNameById.get(b.court_id)} {b.start_at} - {b.end_at} ({b.reason ?? "-"})
            </Text>
          ))}
        </View>

        <View style={styles.block}>
          <Text style={styles.blockTitle}>Aviso masivo (Outbox)</Text>
          <View style={styles.picker}><Picker selectedValue={notifyCategoryId} onValueChange={(v) => setNotifyCategoryId(v)}>{categories.map((c) => <Picker.Item key={c.id} label={c.name} value={c.id} />)}</Picker></View>
          <TextInput style={styles.input} value={notifyType} onChangeText={setNotifyType} placeholder="Tipo" />
          <TextInput style={styles.input} value={notifyMessage} onChangeText={setNotifyMessage} placeholder="Mensaje" />
          <Button title="Enviar aviso masivo" onPress={sendMassNotice} />
        </View>

        <View style={styles.block}>
          <Text style={styles.blockTitle}>QA Tools</Text>
          <Text style={styles.text}>Solo para QA, borra con Cleanup.</Text>
          <TextInput
            style={styles.input}
            value={qaCategoryId}
            onChangeText={setQaCategoryId}
            placeholder="category_id"
          />
          <TextInput
            style={styles.input}
            value={qaCount}
            onChangeText={setQaCount}
            placeholder="count"
            keyboardType="numeric"
          />
          <TextInput style={styles.input} value={qaTag} onChangeText={setQaTag} placeholder="tag" />
          <Button title="Seed users" onPress={runQaSeedUsers} />
          <View style={{ height: 8 }} />
          <Button title="Cleanup users" onPress={runQaCleanupUsers} />
          {qaSeedCountOk !== null ? (
            <Text style={styles.text}>count_ok: {qaSeedCountOk}</Text>
          ) : null}
          {qaSeedEmails.map((email) => (
            <Text key={email} style={styles.text}>{email}</Text>
          ))}
          {qaCleanupCountDeleted !== null ? (
            <Text style={styles.text}>count_deleted: {qaCleanupCountDeleted}</Text>
          ) : null}
        </View>
      </ScrollView>

      <Modal visible={!!editingMatch} transparent animationType="slide" onRequestClose={() => setEditingMatch(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.blockTitle}>Editar match</Text>
            <Text style={styles.text}>
              {profileNameById.get(editingMatch?.player1_id ?? "") ?? "TBD"} vs{" "}
              {profileNameById.get(editingMatch?.player2_id ?? "") ?? "TBD"}
            </Text>
            <View style={styles.picker}>
              <Picker selectedValue={editingWinnerId} onValueChange={(v) => setEditingWinnerId(v)}>
                <Picker.Item label="Selecciona ganador" value="" />
                {editingMatch?.player1_id ? <Picker.Item label={profileNameById.get(editingMatch.player1_id) ?? editingMatch.player1_id} value={editingMatch.player1_id} /> : null}
                {editingMatch?.player2_id ? <Picker.Item label={profileNameById.get(editingMatch.player2_id) ?? editingMatch.player2_id} value={editingMatch.player2_id} /> : null}
              </Picker>
            </View>
            {editingSets.map((set, idx) => (
              <View key={`set-${idx}`} style={styles.setRow}>
                <Text style={styles.text}>Set {idx + 1}</Text>
                <TextInput
                  style={styles.setInput}
                  keyboardType="numeric"
                  placeholder="P1"
                  value={set.p1Games === null ? "" : String(set.p1Games)}
                  onChangeText={(v) =>
                    setEditingSets((prev) =>
                      prev.map((s, i) => (i === idx ? { ...s, p1Games: v === "" ? null : Number(v) } : s)),
                    )
                  }
                />
                <TextInput
                  style={styles.setInput}
                  keyboardType="numeric"
                  placeholder="P2"
                  value={set.p2Games === null ? "" : String(set.p2Games)}
                  onChangeText={(v) =>
                    setEditingSets((prev) =>
                      prev.map((s, i) => (i === idx ? { ...s, p2Games: v === "" ? null : Number(v) } : s)),
                    )
                  }
                />
                <TextInput
                  style={styles.setInput}
                  keyboardType="numeric"
                  placeholder="TB1"
                  value={set.tbP1 === null || set.tbP1 === undefined ? "" : String(set.tbP1)}
                  onChangeText={(v) =>
                    setEditingSets((prev) =>
                      prev.map((s, i) => (i === idx ? { ...s, tbP1: v === "" ? null : Number(v) } : s)),
                    )
                  }
                />
                <TextInput
                  style={styles.setInput}
                  keyboardType="numeric"
                  placeholder="TB2"
                  value={set.tbP2 === null || set.tbP2 === undefined ? "" : String(set.tbP2)}
                  onChangeText={(v) =>
                    setEditingSets((prev) =>
                      prev.map((s, i) => (i === idx ? { ...s, tbP2: v === "" ? null : Number(v) } : s)),
                    )
                  }
                />
              </View>
            ))}
            <Button title="Guardar resultado" onPress={saveMatchResult} />
            <View style={{ height: 8 }} />
            <Button title="Cerrar" onPress={() => setEditingMatch(null)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  content: { padding: 16, paddingBottom: 30 },
  title: { fontSize: 22, fontWeight: "600", textAlign: "center", marginBottom: 12 },
  block: { borderWidth: 1, borderColor: "#ddd", borderRadius: 10, padding: 12, marginBottom: 12, backgroundColor: "#fff" },
  blockTitle: { fontSize: 18, fontWeight: "600", marginBottom: 8 },
  subtitle: { fontSize: 15, fontWeight: "600", marginBottom: 6 },
  text: { fontSize: 13, color: "#555", marginBottom: 4 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 10, marginBottom: 8 },
  picker: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, marginBottom: 8, overflow: "hidden" },
  card: { borderWidth: 1, borderColor: "#eee", borderRadius: 8, padding: 8, marginBottom: 8, backgroundColor: "#fafafa" },
  matchCard: { borderTopWidth: 1, borderTopColor: "#eee", marginTop: 6, paddingTop: 6 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: 16 },
  modalCard: { backgroundColor: "#fff", borderRadius: 12, padding: 14 },
  setRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 6 },
  setInput: { borderWidth: 1, borderColor: "#ccc", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 4, width: 56 },
});
