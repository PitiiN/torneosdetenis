import { SetInput } from "../domain/scoring";

export type Tournament = { id: string; name: string };
export type Category = {
    id: string;
    tournament_id: string;
    name: string;
    type: "singles" | "doubles";
    level: string;
    third_set_super_tiebreak?: boolean;
};
export type Draw = {
    id: string;
    category_id: string;
    type: "single_elim" | "round_robin" | "rr_to_elim";
    status: "DRAFT" | "IN_PROGRESS" | "COMPLETED";
    rr_top_k: number;
};
export type Match = {
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
export type Registration = {
    id: string;
    category_id: string;
    user_id: string;
    status: "PENDING_PAYMENT" | "ACTIVE" | "CANCELLED";
    created_at?: string;
};
export type Profile = {
    id: string;
    full_name: string | null;
    role?: string | null;
    ranking?: number | null;
    ranking_points?: number | null;
    points?: number | null;
};
export type Group = { id: string; draw_id: string; name: string };
export type GroupMember = { id: string; group_id: string; user_id: string; seed: number | null; sort_order: number };
export type Court = { id: string; name: string; is_active: boolean };
export type CourtBlock = { id: string; court_id: string; start_at: string; end_at: string; reason: string | null };
export type Schedule = {
    id: string;
    match_id: string;
    court_id: string;
    start_at: string;
    status: "SCHEDULED" | "IN_PLAY" | "DELAYED" | "DONE";
};

// Aliasing SetInput for easier usage in modals
export type MatchSet = SetInput;
