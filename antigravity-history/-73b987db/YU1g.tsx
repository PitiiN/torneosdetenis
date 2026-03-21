import React, { useEffect, useMemo, useState } from "react";
import { Alert, Button, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { supabase } from "../lib/supabase";
import { isAdminLike, normalizeRole } from "../lib/profiles";
import {
  DrawMatch,
  DrawParticipant,
  advanceWinnerToNextMatch,
  generateCuadro,
  generateSingleElimMatches,
} from "../domain/draws";
import {
  RrGroup,
  computeGroupStandings,
  createRoundRobinGroups,
  generateRoundRobinFixtures,
} from "../domain/roundRobin";
import { SetInput, validateAndBuildScoreJson } from "../domain/scoring";
import {
  AppButton,
  AppInput,
  AppText,
  Badge,
  Card,
  EmptyState,
  MatchEditModal,
  PlayerAssignModal,
  Screen,
  TournamentWizard,
} from "../ui/components";

import {
  Category,
  Court,
  CourtBlock,
  Draw,
  Group,
  GroupMember,
  Match,
  MatchSet,
  Profile,
  Registration,
  Schedule,
  Tournament,
} from "../types/admin";

type WizardStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

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
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
  const [scheduleTargetMatch, setScheduleTargetMatch] = useState<Match | null>(null);

  const [notifyCategoryId, setNotifyCategoryId] = useState("");
  const [notifyType, setNotifyType] = useState("MASS_NOTICE");
  const [notifyMessage, setNotifyMessage] = useState("");
  const [wizardVisible, setWizardVisible] = useState(false);
  const [wizardStep, setWizardStep] = useState<WizardStep>(1);
  const [wizardTournamentType, setWizardTournamentType] = useState<"single" | "with_categories">("single");
  const [wizardTournamentName, setWizardTournamentName] = useState("");
  const [wizardCategoryType, setWizardCategoryType] = useState<"singles" | "doubles">("singles");
  const [wizardCategoryLevel, setWizardCategoryLevel] = useState("Escalafon");
  const [wizardFormat, setWizardFormat] = useState<"RR" | "ELIM">("RR");
  const [wizardGroupCount, setWizardGroupCount] = useState("2");
  const [wizardPlayersPerGroup, setWizardPlayersPerGroup] = useState("4");
  const [wizardTopK, setWizardTopK] = useState("2");
  const [wizardDrawSize, setWizardDrawSize] = useState("16");
  const [wizardSeedCount, setWizardSeedCount] = useState("4");
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null);
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [assignTarget, setAssignTarget] = useState<{ mode: "MATCH"; matchId: string; playerNum: 1 | 2 } | { mode: "GROUP"; memberId: string } | null>(null);
  const [assignCategoryId, setAssignCategoryId] = useState<string | null>(null);
  const [assignSearch, setAssignSearch] = useState("");
  const [assignSearchDebounced, setAssignSearchDebounced] = useState("");

  async function loadData() {
    setLoading(true);
    const me = await supabase.auth.getUser();
    if (!me.data.user) return setLoading(false);

    const roleRes = await supabase.from("profiles").select("role").eq("id", me.data.user.id).single();
    if (roleRes.error) {
      setLoading(false);
      return Alert.alert("Error", roleRes.error.message);
    }
    setRole(normalizeRole(roleRes.data?.role));
    const orgRes = await supabase.from("profiles").select("org_id").eq("id", me.data.user.id).single();
    const orgErrorText = `${orgRes.error?.message ?? ""} ${orgRes.error?.code ?? ""}`.toLowerCase();
    const orgId =
      orgRes.error && (orgErrorText.includes("org_id") || orgErrorText.includes("schema cache") || orgErrorText.includes("42703"))
        ? null
        : orgRes.data?.org_id ?? null;

    const tournamentsQuery = supabase
      .from("tournaments")
      .select("id,name")
      .order("created_at", { ascending: false });
    const tRes = orgId ? await tournamentsQuery.eq("org_id", orgId) : await tournamentsQuery;
    if (tRes.error) return Alert.alert("Error", tRes.error.message);
    const tournamentIds = ((tRes.data as Tournament[]) ?? []).map((t) => t.id);

    const [cRes, dRes, mRes, rRes, gRes, gmRes, pRes, courtsRes, blocksRes, schedRes] =
      await Promise.all([
        supabase
          .from("categories")
          .select("id,tournament_id,name,type,level,third_set_super_tiebreak")
          .in("tournament_id", tournamentIds.length > 0 ? tournamentIds : ["00000000-0000-0000-0000-000000000000"])
          .order("created_at", { ascending: false }),
        supabase.from("draws").select("id,category_id,type,status,rr_top_k"),
        supabase
          .from("matches")
          .select(
            "id,draw_id,round,match_number,player1_id,player2_id,player1_manual_name,player2_manual_name,winner_id,status,score_json,phase,group_id",
          )
          .order("round", { ascending: true })
          .order("match_number", { ascending: true }),
        supabase.from("registrations").select("id,category_id,user_id,status,created_at"),
        supabase.from("rr_groups").select("id,draw_id,name"),
        supabase.from("rr_group_members").select("id,group_id,user_id,manual_name,seed,sort_order"),
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

    if (!selectedCategoryForRr && cRes.data?.[0]) setSelectedCategoryForRr(cRes.data[0].id);
    if (!notifyCategoryId && cRes.data?.[0]) setNotifyCategoryId(cRes.data[0].id);
    if (!selectedCourtForBlock && courtsRes.data?.[0]) setSelectedCourtForBlock(courtsRes.data[0].id);
    if (!selectedCourtForSchedule && courtsRes.data?.[0]) setSelectedCourtForSchedule(courtsRes.data[0].id);
    if (!selectedMatchForSchedule && mRes.data?.[0]) setSelectedMatchForSchedule(mRes.data[0].id);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setAssignSearchDebounced(assignSearch.trim().toLowerCase()), 250);
    return () => clearTimeout(timer);
  }, [assignSearch]);

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
  const assignablePlayers = useMemo(() => {
    if (!assignCategoryId) return [];
    const rows = registrations
      .filter((r) => r.category_id === assignCategoryId && r.status === "ACTIVE")
      .map((reg) => ({
        userId: reg.user_id,
        label: profileNameById.get(reg.user_id) ?? reg.user_id,
      }));
    if (!assignSearchDebounced) return rows;
    return rows.filter((r) => r.label.toLowerCase().includes(assignSearchDebounced));
  }, [registrations, assignCategoryId, profileNameById, assignSearchDebounced]);

  function groupNameByIndex(index: number) {
    return `Grupo ${String.fromCharCode(65 + index)}`;
  }

  function nextPowerOfTwo(n: number) {
    let p = 1;
    while (p < n) p *= 2;
    return p;
  }

  function buildElimMatchesFromSlots(slots: string[]): DrawMatch[] {
    const bracketSize = slots.length;
    const rounds = Math.log2(bracketSize);
    const round1: DrawMatch[] = [];
    for (let i = 0; i < bracketSize; i += 2) {
      const p1 = slots[i] || null;
      const p2 = slots[i + 1] || null;
      const byeWinner = p1 && !p2 ? p1 : !p1 && p2 ? p2 : null;
      round1.push({
        round: 1,
        matchNumber: i / 2 + 1,
        player1Id: p1,
        player2Id: p2,
        winnerId: byeWinner,
        status: byeWinner ? "COMPLETED" : p1 && p2 ? "READY" : "PENDING",
        scoreJson: null,
      });
    }
    const all: DrawMatch[] = [...round1];
    let size = round1.length;
    for (let round = 2; round <= rounds; round += 1) {
      for (let n = 1; n <= size / 2; n += 1) {
        all.push({
          round,
          matchNumber: n,
          player1Id: null,
          player2Id: null,
          winnerId: null,
          status: "PENDING",
          scoreJson: null,
        });
      }
      size /= 2;
    }

    const queue = all.filter((m) => m.round === 1 && m.winnerId).map((m) => ({ r: m.round, n: m.matchNumber, w: m.winnerId! }));
    let current = [...all];
    while (queue.length > 0) {
      const item = queue.shift()!;
      const next = advanceWinnerToNextMatch(current, item.r, item.n, item.w);
      current = next;
      const nextRound = item.r + 1;
      const nextNum = Math.ceil(item.n / 2);
      const nextMatch = current.find((m) => m.round === nextRound && m.matchNumber === nextNum);
      if (nextMatch?.winnerId) queue.push({ r: nextRound, n: nextNum, w: nextMatch.winnerId });
    }

    return current;
  }

  function participantRanking(userId: string) {
    const profile = profileById.get(userId);
    const value = profile?.ranking ?? profile?.ranking_points ?? profile?.points ?? null;
    return typeof value === "number" ? value : null;
  }

  const categoryLevelOptions = [
    "Escalafon",
    "Honor",
    "Primera",
    "Segunda",
    "Tercera",
    "Cuarta",
    "Inicial",
  ];

  function startTournamentWizard() {
    setWizardStep(1);
    setWizardTournamentType("single");
    setWizardTournamentName("");
    setWizardCategoryType("singles");
    setWizardCategoryLevel("Escalafon");
    setWizardFormat("RR");
    setWizardGroupCount("2");
    setWizardPlayersPerGroup("4");
    setWizardTopK("2");
    setWizardDrawSize("16");
    setWizardSeedCount("4");
    setWizardVisible(true);
  }

  function cancelTournamentWizard() {
    setWizardVisible(false);
    setWizardStep(1);
  }

  function moveWizardBack() {
    setWizardStep((prev) => (prev > 1 ? ((prev - 1) as WizardStep) : prev));
  }

  function moveWizardNext() {
    if (wizardStep === 2 && !wizardTournamentName.trim()) {
      Alert.alert("Error", "Nombre del campeonato obligatorio.");
      return;
    }
    setWizardStep((prev) => (prev < 7 ? ((prev + 1) as WizardStep) : prev));
  }

  async function finishTournamentWizard() {
    const me = await supabase.auth.getUser();
    if (!me.data.user) return Alert.alert("Error", "Sesion requerida.");
    if (!wizardTournamentName.trim()) return Alert.alert("Error", "Nombre del campeonato obligatorio.");
    const profileRes = await supabase.from("profiles").select("org_id").eq("id", me.data.user.id).single();
    if (profileRes.error) return Alert.alert("Error", profileRes.error.message);

    const today = new Date().toISOString().slice(0, 10);
    const tournamentIns = await supabase
      .from("tournaments")
      .insert({
        name: wizardTournamentName.trim(),
        start_date: today,
        end_date: today,
        status: "DRAFT",
        created_by: me.data.user.id,
        org_id: profileRes.data?.org_id ?? null,
      })
      .select("id")
      .single();
    if (tournamentIns.error || !tournamentIns.data) {
      return Alert.alert("Error", tournamentIns.error?.message ?? "No se pudo crear el torneo.");
    }

    const categoryLabel = wizardCategoryType === "singles" ? "Singles" : "Dobles";
    const categoryIns = await supabase
      .from("categories")
      .insert({
        tournament_id: tournamentIns.data.id,
        name: `${wizardCategoryLevel} ${categoryLabel}`,
        type: wizardCategoryType,
        level: wizardCategoryLevel,
        third_set_super_tiebreak: false,
        currency: "clp",
      })
      .select("id")
      .single();
    if (categoryIns.error || !categoryIns.data) {
      return Alert.alert("Error", categoryIns.error?.message ?? "No se pudo crear la categoria.");
    }

    const createdCategoryId = categoryIns.data.id;
    const regsRes = await supabase
      .from("registrations")
      .select("user_id,created_at,status")
      .eq("category_id", createdCategoryId)
      .eq("status", "ACTIVE")
      .order("created_at", { ascending: true });
    if (regsRes.error) {
      return Alert.alert("Error", regsRes.error.message);
    }

    const participants: DrawParticipant[] = (regsRes.data ?? []).map((reg, idx) => ({
      userId: reg.user_id,
      seedRank: participantRanking(reg.user_id),
      registrationOrder: idx + 1,
    }));

    if (wizardFormat === "RR") {
      const groupCount = Number(wizardGroupCount);
      if (!Number.isInteger(groupCount) || groupCount < 1) {
        return Alert.alert("Error", "Cantidad de grupos invalida.");
      }
      const drawIns = await supabase
        .from("draws")
        .insert({
          category_id: createdCategoryId,
          type: "rr_to_elim",
          status: "IN_PROGRESS",
          created_by: me.data.user.id,
          rr_top_k: Number(wizardTopK) > 0 ? Number(wizardTopK) : 2,
        })
        .select("id")
        .single();
      if (drawIns.error || !drawIns.data) {
        return Alert.alert("Error", drawIns.error?.message ?? "No se pudo crear draw RR.");
      }

      // ONLY create the empty groups. No players, no fixtures.
      const groupsToInsert = Array.from({ length: groupCount }, (_, idx) => ({
        draw_id: drawIns.data.id,
        name: groupNameByIndex(idx),
      }));
      const groupsIns = await supabase.from("rr_groups").insert(groupsToInsert).select("id");
      if (groupsIns.error) return Alert.alert("Error", groupsIns.error.message);

      // Create empty placeholders for RR group members
      const emptyMembers = [];
      const ppG = Math.max(1, Number(wizardPlayersPerGroup) || 4);
      for (const group of groupsIns.data) {
        for (let i = 0; i < ppG; i++) {
          emptyMembers.push({ group_id: group.id, user_id: null as any, sort_order: i + 1 });
        }
      }
      if (emptyMembers.length > 0) {
        const memIns = await supabase.from("rr_group_members").insert(emptyMembers);
        if (memIns.error) return Alert.alert("Error", memIns.error.message);
      }


    } else {
      const drawIns = await supabase
        .from("draws")
        .insert({
          category_id: createdCategoryId,
          type: "single_elim",
          status: "IN_PROGRESS",
          created_by: me.data.user.id,
          rr_top_k: 2,
        })
        .select("id")
        .single();
      if (drawIns.error || !drawIns.data) {
        return Alert.alert("Error", drawIns.error?.message ?? "No se pudo crear draw ELIM.");
      }

      // ONLY create empty fixture tree
      const requestedSize = Number(wizardDrawSize);
      const size = Number.isInteger(requestedSize) && requestedSize > 1 ? requestedSize : 16;
      const slots = new Array<string>(size).fill("");
      const elim = buildElimMatchesFromSlots(slots);

      const elimRows = elim.map((m) => ({
        draw_id: drawIns.data.id,
        round: m.round,
        match_number: m.matchNumber,
        player1_id: m.player1Id,
        player2_id: m.player2Id,
        winner_id: m.winnerId,
        status: m.winnerId ? "FINAL" : "PENDING",
        score_json: null,
        phase: "ELIM",
        group_id: null,
      }));

      if (elimRows.length > 0) {
        const elimIns = await supabase.from("matches").insert(elimRows);
        if (elimIns.error) return Alert.alert("Error", elimIns.error.message);
      }
    }
    setWizardVisible(false);
    await loadData();
    Alert.alert("Listo", "Campeonato creado con estructura inicial.");
    setSelectedTournamentId(tournamentIns.data.id);
  }

  async function runSorteo(categoryId: string) {
    const draw = drawByCategory.get(categoryId);
    if (!draw) return Alert.alert("Error", "No hay draw");

    const activeRegs = registrations
      .filter((r) => r.category_id === categoryId && r.status === "ACTIVE")
      .sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""));
    if (activeRegs.length === 0) return Alert.alert("Error", "No hay jugadores ACTIVE en esta categoria.");

    const participants: DrawParticipant[] = activeRegs.map((reg, idx) => ({
      userId: reg.user_id,
      seedRank: participantRanking(reg.user_id),
      registrationOrder: idx + 1,
    }));

    if (draw.type === "rr_to_elim") {
      const groups = groupsByDraw.get(draw.id) ?? [];
      const groupCount = groups.length;
      if (groupCount === 0) return Alert.alert("Error", "No hay grupos creados, recrea el torneo.");

      const rrGroups = createRoundRobinGroups(participants, groupCount);
      const groupIdByName = new Map(groups.map((g) => [g.name, g.id]));

      await supabase.from("matches").delete().eq("draw_id", draw.id).eq("phase", "RR");
      await supabase.from("rr_group_members").delete().in("group_id", groups.map(g => g.id));

      const memberRows = rrGroups.flatMap(g =>
        g.members.map((m, idx) => ({
          group_id: groupIdByName.get(g.name),
          user_id: m.userId,
          seed: m.seedRank ?? null,
          sort_order: idx + 1,
        }))
      );
      if (memberRows.length > 0) {
        const ins = await supabase.from("rr_group_members").insert(memberRows);
        if (ins.error) return Alert.alert("Error", ins.error.message);
      }

      const fixtures = generateRoundRobinFixtures(rrGroups);
      const rrMatchesRows = fixtures.map((f, index) => ({
        draw_id: draw.id,
        round: f.round,
        match_number: index + 1,
        player1_id: f.player1Id,
        player2_id: f.player2Id,
        winner_id: null,
        status: "READY",
        score_json: null,
        phase: "RR",
        group_id: groupIdByName.get(f.groupName),
      }));
      if (rrMatchesRows.length > 0) {
        const rrIns = await supabase.from("matches").insert(rrMatchesRows);
        if (rrIns.error) return Alert.alert("Error", rrIns.error.message);
      }
      Alert.alert("Listo", "Sorteo RR completado.");
    } else {
      const existingMatches = (matchesByDraw.get(draw.id) ?? []).filter(m => m.phase === "ELIM");
      const r1Size = existingMatches.filter(m => m.round === 1).length;
      const bracketSize = Math.max(r1Size * 2, nextPowerOfTwo(participants.length));
      const seedCount = participants.length >= 8 ? 4 : 0;

      const generated = generateCuadro(participants, seedCount, bracketSize);
      const slots = generated.slots.map((value) => (value === "BYE" ? "" : value));
      const elim = buildElimMatchesFromSlots(slots);

      await supabase.from("matches").delete().eq("draw_id", draw.id).eq("phase", "ELIM");
      const elimRows = elim.map((m) => ({
        draw_id: draw.id,
        round: m.round,
        match_number: m.matchNumber,
        player1_id: m.player1Id,
        player2_id: m.player2Id,
        winner_id: m.winnerId,
        status: m.winnerId ? "COMPLETED" : m.status === "READY" ? "READY" : "PENDING",
        score_json: null,
        phase: "ELIM",
        group_id: null,
      }));
      if (elimRows.length > 0) {
        const ins = await supabase.from("matches").insert(elimRows);
        if (ins.error) return Alert.alert("Error", ins.error.message);
      }
      Alert.alert("Listo", "Sorteo ELIM completado.");
    }
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
          userId: m.user_id || m.manual_name || m.id,
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

  async function generateManualRrMatches(categoryId: string) {
    const draw = drawByCategory.get(categoryId);
    if (!draw || draw.type !== "rr_to_elim") return;

    const groups = groupsByDraw.get(draw.id) ?? [];
    if (groups.length === 0) return Alert.alert("Error", "No hay grupos.");

    const existingRr = (matchesByDraw.get(draw.id) ?? []).filter((m) => m.phase === "RR");
    if (existingRr.length > 0) return Alert.alert("Error", "Ya existen enfrentamientos RR.");

    const rrGroupsInput = groups.map((g) => {
      const gMembers = (membersByGroup.get(g.id) ?? [])
        .filter((m) => m.user_id || m.manual_name)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((m) => ({
          userId: m.id, // We use the member's ID as the temporary userId for the generator
          seedRank: m.seed,
          registrationOrder: m.sort_order,
        }));
      return { name: g.name, members: gMembers };
    });

    const fixtures = generateRoundRobinFixtures(rrGroupsInput);
    if (fixtures.length === 0) return Alert.alert("Error", "No hay suficientes jugadores para generar enfrentamientos.");

    const memberById = new Map<string, GroupMember>();
    for (const g of groups) {
      for (const m of membersByGroup.get(g.id) ?? []) {
        memberById.set(m.id, m);
      }
    }
    const groupIdByName = new Map(groups.map((g) => [g.name, g.id]));

    const rrMatchesRows = fixtures.map((f, index) => {
      const m1 = memberById.get(f.player1Id ?? "");
      const m2 = memberById.get(f.player2Id ?? "");
      return {
        draw_id: draw.id,
        round: f.round,
        match_number: index + 1,
        player1_id: m1?.user_id ?? null,
        player2_id: m2?.user_id ?? null,
        player1_manual_name: m1?.manual_name ?? null,
        player2_manual_name: m2?.manual_name ?? null,
        winner_id: null,
        status: "READY",
        score_json: null,
        phase: "RR",
        group_id: groupIdByName.get(f.groupName) ?? null,
      };
    });

    const ins = await supabase.from("matches").insert(rrMatchesRows);
    if (ins.error) return Alert.alert("Error", ins.error.message);
    Alert.alert("Listo", "Enfrentamientos RR generados.");
    loadData();
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

  function openMatchAssignModal(match: Match, playerNum: 1 | 2) {
    const draw = draws.find(d => d.id === match.draw_id);
    setAssignTarget({ mode: "MATCH", matchId: match.id, playerNum });
    setAssignCategoryId(draw?.category_id ?? null);
    setAssignSearch("");
    setAssignSearchDebounced("");
    setAssignModalVisible(true);
  }

  function openGroupAssignModal(memberId: string, categoryId: string) {
    setAssignTarget({ mode: "GROUP", memberId });
    setAssignCategoryId(categoryId);
    setAssignSearch("");
    setAssignSearchDebounced("");
    setAssignModalVisible(true);
  }

  async function assignPlayerToSlot({ userId, manualName }: { userId: string | null; manualName: string | null }) {
    if (!assignTarget) return;

    // A BYE explicitly has both userId and manualName as null.
    // Ensure we handle empty strings as nulls just in case.
    const cleanUserId = userId === "" ? null : userId;
    const cleanManualName = manualName === "" ? null : manualName;

    if (assignTarget.mode === "MATCH") {
      const field = `player${assignTarget.playerNum}_id`;
      const nameField = `player${assignTarget.playerNum}_manual_name`;
      const u = await supabase.from("matches").update({ [field]: cleanUserId, [nameField]: cleanManualName }).eq("id", assignTarget.matchId);
      if (u.error) Alert.alert("Error", u.error.message);
    } else if (assignTarget.mode === "GROUP") {
      const u = await supabase.from("rr_group_members").update({ user_id: cleanUserId, manual_name: cleanManualName }).eq("id", assignTarget.memberId);
      if (u.error) Alert.alert("Error", u.error.message);

      let groupId = "";
      for (const [gId, members] of membersByGroup.entries()) {
        if (members.some(m => m.id === assignTarget.memberId)) {
          groupId = gId; break;
        }
      }

      if (groupId) {
        const { data: currentMembers } = await supabase.from("rr_group_members").select("*").eq("group_id", groupId).order("sort_order", { ascending: true });
        if (currentMembers) {
          const { data: currentMatches } = await supabase.from("matches").select("id").eq("group_id", groupId).eq("phase", "RR").order("match_number", { ascending: true });
          if (currentMatches && currentMatches.length > 0) {
            const gMembersInput = currentMembers.map(m => ({
              userId: m.id,
              seedRank: m.seed,
              registrationOrder: m.sort_order,
            }));
            const fixtures = generateRoundRobinFixtures([{ name: "Group", members: gMembersInput }]);
            for (let i = 0; i < currentMatches.length; i++) {
              if (i >= fixtures.length) break;
              const fix = fixtures[i];
              const p1 = currentMembers.find(gm => gm.id === fix.player1Id);
              const p2 = currentMembers.find(gm => gm.id === fix.player2Id);
              if (p1 && p2) {
                await supabase.from("matches").update({
                  player1_id: p1.user_id,
                  player1_manual_name: p1.manual_name,
                  player2_id: p2.user_id,
                  player2_manual_name: p2.manual_name,
                }).eq("id", currentMatches[i].id);
              }
            }
          }
        }
      }
    }
    setAssignTarget(null);
    setAssignModalVisible(false);
    loadData();
  }

  if (loading) return <View style={styles.center}><Text style={styles.text}>Cargando...</Text></View>;
  if (!isAdminLike(role)) return <View style={styles.center}><Text style={styles.text}>Sin permisos</Text></View>;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.content}>
        {!selectedTournamentId ? (
          <>
            <Text style={styles.title}>Gestión de Torneos</Text>
            <View style={styles.block}>
              <Text style={styles.blockTitle}>Flujo de campeonato</Text>
              <Button color="#B8E600" title="Nuevo campeonato" onPress={startTournamentWizard} />
              <View style={{ height: 8 }} />
              <Text style={styles.text}>La creacion ahora se hace solo con el wizard.</Text>
            </View>

            <View style={styles.block}>
              <Text style={styles.blockTitle}>Torneos creados</Text>
              {tournaments.length === 0 ? <Text style={styles.text}>Sin torneos aun.</Text> : null}
              {tournaments.map((t) => (
                <View key={t.id} style={styles.card}>
                  <Text style={styles.subtitle}>{t.name}</Text>
                  <View style={{ marginTop: 8 }}>
                    <Button color="#0B00FF" title="Ver Detalles y Sorteos" onPress={() => setSelectedTournamentId(t.id)} />
                  </View>
                </View>
              ))}
            </View>
          </>
        ) : (
          <>
            <View style={styles.quickNavRow}>
              <Button color="#FF3B30" title="Volver a Torneos" onPress={() => setSelectedTournamentId(null)} />
            </View>
            <Text style={styles.title}>{tournaments.find(t => t.id === selectedTournamentId)?.name}</Text>

            <View style={styles.block}>
              <Text style={styles.blockTitle}>Gestión de Cuadros y Grupos</Text>
              {categories.filter(c => c.tournament_id === selectedTournamentId).map((c) => {
                const draw = drawByCategory.get(c.id);
                if (!draw) return <Text key={c.id} style={styles.text}>{c.name} - Sin estructura generada</Text>;

                const drawMatches = (matchesByDraw.get(draw.id) ?? []).sort((a, b) => {
                  const gA = groupsByDraw.get(draw.id)?.find(g => g.id === a.group_id)?.name ?? "";
                  const gB = groupsByDraw.get(draw.id)?.find(g => g.id === b.group_id)?.name ?? "";
                  if (gA !== gB) return gA.localeCompare(gB);
                  return a.round - b.round || a.match_number - b.match_number;
                });
                const isRoundRobin = draw.type === "rr_to_elim";

                const groups = groupsByDraw.get(draw.id) ?? [];

                let hasPlayers = false;
                if (isRoundRobin) {
                  hasPlayers = groups.some(g => (membersByGroup.get(g.id) ?? []).some(m => m.user_id != null || m.manual_name != null));
                } else {
                  hasPlayers = drawMatches.some(m => m.player1_id || m.player2_id || m.player1_manual_name || m.player2_manual_name);
                }

                return (
                  <View key={c.id} style={styles.card}>
                    <Text style={styles.subtitle}>{c.name} ({draw.type === "rr_to_elim" ? "Round Robin" : "Eliminación"})</Text>

                    {!hasPlayers && (
                      <View style={{ marginBottom: 12 }}>
                        <Button color="#B8E600" title="Sortear Jugadores Activos" onPress={() => runSorteo(c.id)} />
                      </View>
                    )}

                    {isRoundRobin ? (
                      <View style={{ marginTop: 8 }}>
                        {drawMatches.filter(m => m.phase === "RR").length === 0 && hasPlayers ? (
                          <View style={{ marginBottom: 12 }}>
                            <Button color="#0B00FF" title="Generar Encuentros RR" onPress={() => generateManualRrMatches(c.id)} />
                          </View>
                        ) : null}
                        <Button color="#0B00FF" title="Cerrar fase RR y crear Llave" onPress={() => closeRrPhase(c.id)} />
                        {groups.map((g) => {
                          const members = (membersByGroup.get(g.id) ?? []).sort((a, b) => a.sort_order - b.sort_order);
                          return (
                            <View key={g.id} style={styles.card}>
                              <Text style={styles.subtitle}>{g.name}</Text>
                              {members.map(m => (
                                <Text key={m.id} style={styles.text}>
                                  {m.sort_order}.
                                  <Text style={{ color: '#B8E600' }} onPress={() => openGroupAssignModal(m.id, c.id)}>
                                    {` ${m.user_id ? profileNameById.get(m.user_id) : m.manual_name || "BYE"}`}
                                  </Text>
                                </Text>
                              ))}
                            </View>
                          );
                        })}
                      </View>
                    ) : null}

                    <View style={{ marginTop: 8 }}>
                      <Text style={styles.subtitle}>Enfrentamientos Oficiales</Text>
                      {drawMatches.length === 0 && <Text style={styles.text}>Aún no hay encuentros.</Text>}
                      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
                        {drawMatches.map(m => {
                          const groupName = groupsByDraw.get(draw.id)?.find(g => g.id === m.group_id)?.name;
                          return (
                            <View key={m.id} style={[styles.matchCard, { width: "48%", minHeight: 140, justifyContent: "space-between" }]}>
                              <View>
                                {groupName && <Text style={{ color: "#B6C0D4", fontSize: 12, marginBottom: 4 }}>{groupName}</Text>}
                                <Text style={[styles.text, { fontSize: 13 }]}>
                                  {m.phase} R{m.round}M{m.match_number}:
                                </Text>
                                <Text style={[styles.text, { fontSize: 13, marginVertical: 4 }]}>
                                  <Text style={{ color: '#B8E600' }} onPress={() => openMatchAssignModal(m, 1)}>
                                    {` ${m.player1_id ? profileNameById.get(m.player1_id) : m.player1_manual_name || "BYE"} `}
                                  </Text>
                                  vs
                                  <Text style={{ color: '#B8E600' }} onPress={() => openMatchAssignModal(m, 2)}>
                                    {` ${m.player2_id ? profileNameById.get(m.player2_id) : m.player2_manual_name || "BYE"} `}
                                  </Text>
                                </Text>
                                <Text style={[styles.text, { fontSize: 12, color: m.status === 'FINAL' ? '#B8E600' : '#FFF' }]}>{m.status}</Text>

                                {schedulesByMatch.get(m.id) && (
                                  <Text style={{ color: '#00FFFF', fontSize: 11, marginTop: 4 }}>
                                    🗓 {courtNameById.get(schedulesByMatch.get(m.id)?.court_id ?? "")} | {schedulesByMatch.get(m.id)?.start_at}
                                  </Text>
                                )}
                              </View>
                              <View style={{ marginTop: 8 }}>
                                <Button color="#0B00FF" title="Editar" onPress={() => openMatchEditor(m)} />
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>


          </>
        )}
      </ScrollView>

      <TournamentWizard
        visible={wizardVisible}
        step={wizardStep}
        tournamentType={wizardTournamentType}
        tournamentName={wizardTournamentName}
        categoryType={wizardCategoryType}
        categoryLevel={wizardCategoryLevel}
        format={wizardFormat}
        groupCount={wizardGroupCount}
        playersPerGroup={wizardPlayersPerGroup}
        topK={wizardTopK}
        drawSize={wizardDrawSize}
        seedCount={wizardSeedCount}
        setTournamentType={setWizardTournamentType}
        setTournamentName={setWizardTournamentName}
        setCategoryType={setWizardCategoryType}
        setCategoryLevel={setWizardCategoryLevel}
        setFormat={setWizardFormat}
        setGroupCount={setWizardGroupCount}
        setPlayersPerGroup={setWizardPlayersPerGroup}
        setTopK={setWizardTopK}
        setDrawSize={setWizardDrawSize}
        setSeedCount={setWizardSeedCount}
        onCancel={cancelTournamentWizard}
        onBack={moveWizardBack}
        onNext={moveWizardNext}
        onFinish={finishTournamentWizard}
      />

      <PlayerAssignModal
        visible={assignModalVisible}
        search={assignSearch}
        setSearch={setAssignSearch}
        assignablePlayers={assignablePlayers}
        onAssignPlayer={assignPlayerToSlot}
        onClose={() => {
          setAssignTarget(null);
          setAssignModalVisible(false);
        }}
      />

      <MatchEditModal
        visible={!!editingMatch}
        match={editingMatch}
        profileNameById={profileNameById}
        editingWinnerId={editingWinnerId}
        setEditingWinnerId={setEditingWinnerId}
        editingSets={editingSets}
        setEditingSets={setEditingSets}
        courts={courts}
        scheduleCourtId={editingCourtId}
        setScheduleCourtId={setEditingCourtId}
        scheduleStartAt={editingStartAt}
        setScheduleStartAt={setEditingStartAt}
        scheduleStatus={editingStatus}
        setScheduleStatus={setEditingStatus}
        onSave={saveMatchResult}
        onClose={() => setEditingMatch(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#050B2A" },
  content: { padding: 16, paddingBottom: 140, backgroundColor: "#050B2A" },
  title: { fontSize: 24, fontWeight: "700", textAlign: "center", marginBottom: 14, color: "#FFFFFF" },
  quickNavRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8, gap: 6 },
  block: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    backgroundColor: "#0F173A",
  },
  blockTitle: { fontSize: 18, fontWeight: "700", marginBottom: 8, color: "#FFFFFF" },
  subtitle: { fontSize: 15, fontWeight: "700", marginBottom: 6, color: "#FFFFFF" },
  text: { fontSize: 13, color: "#98A2B3", marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: 14,
    padding: 10,
    marginBottom: 8,
    color: "#FFFFFF",
    backgroundColor: "#050B2A",
  },
  picker: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: 14,
    marginBottom: 8,
    overflow: "hidden",
    backgroundColor: "#050B2A",
  },
  pickerText: { color: "#FFFFFF" },
  card: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: 14,
    padding: 10,
    marginBottom: 8,
    backgroundColor: "#050B2A",
  },
  matchCard: { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.10)", marginTop: 6, paddingTop: 6 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: 16 },
  modalCard: { backgroundColor: "#0F173A", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.10)" },
  assignCell: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "#050B2A",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginTop: 6,
  },
  assignCellText: { color: "#FFFFFF", fontSize: 13, fontWeight: "600" },
  assignOption: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: 10,
    backgroundColor: "#050B2A",
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  assignOptionText: { color: "#FFFFFF", fontSize: 14 },
  setRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 6 },
  setInput: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 4,
    width: 56,
    color: "#FFFFFF",
    backgroundColor: "#050B2A",
  },
});
