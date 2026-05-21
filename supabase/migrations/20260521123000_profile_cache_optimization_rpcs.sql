-- Create indexes to optimize queries on hot tables
CREATE INDEX IF NOT EXISTS idx_matches_tournament_id ON matches(tournament_id);
CREATE INDEX IF NOT EXISTS idx_matches_players ON matches(player_a_id, player_b_id, player_a2_id, player_b2_id);
CREATE INDEX IF NOT EXISTS idx_tournaments_parent_org ON tournaments(parent_tournament_id, organization_id) WHERE parent_tournament_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tournaments_org_level ON tournaments(organization_id, level);
CREATE INDEX IF NOT EXISTS idx_registrations_tournament_player ON registrations(tournament_id, player_id);

-- Helper 1: Resolve match winner side ('A' or 'B')
CREATE OR REPLACE FUNCTION resolve_match_winner_side(p_match matches)
RETURNS TEXT AS $$
DECLARE
    score_text TEXT;
    sets TEXT[];
    set_score TEXT;
    p_a_sets INT := 0;
    p_b_sets INT := 0;
    parts TEXT[];
    left_val INT;
    right_val INT;
BEGIN
    IF p_match.winner_id IS NOT NULL THEN
        IF p_match.winner_id = p_match.player_a_id OR p_match.winner_id = p_match.player_a2_id THEN
            RETURN 'A';
        ELSIF p_match.winner_id = p_match.player_b_id OR p_match.winner_id = p_match.player_b2_id THEN
            RETURN 'B';
        END IF;
    END IF;
    IF p_match.winner_2_id IS NOT NULL THEN
        IF p_match.winner_2_id = p_match.player_a_id OR p_match.winner_2_id = p_match.player_a2_id THEN
            RETURN 'A';
        ELSIF p_match.winner_2_id = p_match.player_b_id OR p_match.winner_2_id = p_match.player_b2_id THEN
            RETURN 'B';
        END IF;
    END IF;

    score_text := TRIM(p_match.score);
    IF score_text IS NULL OR score_text = '' OR score_text ILIKE 'W.O.' THEN
        RETURN NULL;
    END IF;

    sets := string_to_array(score_text, ',');
    FOREACH set_score IN ARRAY sets LOOP
        set_score := REGEXP_REPLACE(set_score, '[^\d-]', '', 'g');
        parts := string_to_array(TRIM(set_score), '-');
        IF array_length(parts, 1) = 2 THEN
            BEGIN
                left_val := parts[1]::INT;
                right_val := parts[2]::INT;
                IF left_val > right_val THEN
                    p_a_sets := p_a_sets + 1;
                ELSIF right_val > left_val THEN
                    p_b_sets := p_b_sets + 1;
                END IF;
            EXCEPTION WHEN OTHERS THEN
                -- Ignore parsing exceptions
            END;
        END IF;
    END LOOP;

    IF p_a_sets > p_b_sets THEN
        RETURN 'A';
    ELSIF p_b_sets > p_a_sets THEN
        RETURN 'B';
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Helper 2: Calculate match stats for a player
CREATE OR REPLACE FUNCTION get_player_match_stats(p_match matches, p_player_id UUID)
RETURNS TABLE(sets_won INT, sets_lost INT, games_won INT, games_lost INT, is_winner BOOLEAN) AS $$
DECLARE
    player_side TEXT := NULL;
    winner_side TEXT := NULL;
    score_text TEXT;
    sets TEXT[];
    set_score TEXT;
    parts TEXT[];
    left_val INT;
    right_val INT;
    s_won INT := 0;
    s_lost INT := 0;
    g_won INT := 0;
    g_lost INT := 0;
BEGIN
    IF p_match.player_a_id = p_player_id OR p_match.player_a2_id = p_player_id THEN
        player_side := 'A';
    ELSIF p_match.player_b_id = p_player_id OR p_match.player_b2_id = p_player_id THEN
        player_side := 'B';
    END IF;

    IF player_side IS NULL THEN
        RETURN QUERY SELECT 0, 0, 0, 0, FALSE;
        RETURN;
    END IF;

    winner_side := resolve_match_winner_side(p_match);

    score_text := TRIM(p_match.score);
    IF score_text IS NOT NULL AND score_text <> '' AND NOT (score_text ILIKE 'W.O.') THEN
        sets := string_to_array(score_text, ',');
        FOREACH set_score IN ARRAY sets LOOP
            set_score := REGEXP_REPLACE(set_score, '[^\d-]', '', 'g');
            parts := string_to_array(TRIM(set_score), '-');
            IF array_length(parts, 1) = 2 THEN
                BEGIN
                    left_val := parts[1]::INT;
                    right_val := parts[2]::INT;
                    IF player_side = 'A' THEN
                        g_won := g_won + left_val;
                        g_lost := g_lost + right_val;
                        IF left_val > right_val THEN
                            s_won := s_won + 1;
                        ELSIF right_val > left_val THEN
                            s_lost := s_lost + 1;
                        END IF;
                    ELSE
                        g_won := g_won + right_val;
                        g_lost := g_lost + left_val;
                        IF right_val > left_val THEN
                            s_won := s_won + 1;
                        ELSIF left_val > right_val THEN
                            s_lost := s_lost + 1;
                        END IF;
                    END IF;
                EXCEPTION WHEN OTHERS THEN
                    -- Ignore malformed set
                END;
            END IF;
        END LOOP;
    END IF;

    RETURN QUERY SELECT s_won, s_lost, g_won, g_lost, COALESCE(winner_side = player_side, FALSE);
END;
$$ LANGUAGE plpgsql STABLE;

-- Helper 3: Get placements for a tournament
CREATE OR REPLACE FUNCTION get_tournament_placements(p_tournament_id UUID)
RETURNS TABLE(player_id UUID, place INT, points INT) AS $$
DECLARE
    v_max_round INT;
    v_points_1 INT := 100;
    v_points_2 INT := 60;
    v_points_3 INT := 40;
    v_points_4 INT := 20;
    v_desc TEXT;
BEGIN
    SELECT description INTO v_desc FROM tournaments WHERE id = p_tournament_id;

    SELECT COALESCE(MAX(round_number), 0) INTO v_max_round
    FROM matches
    WHERE tournament_id = p_tournament_id;

    IF v_max_round = 0 THEN
        RETURN;
    END IF;

    -- Champion (1st) and Finalist (2nd) from final match
    RETURN QUERY
    WITH final_match AS (
        SELECT m.id, m.player_a_id, m.player_a2_id, m.player_b_id, m.player_b2_id,
               resolve_match_winner_side(m) AS winner_side
        FROM matches m
        WHERE m.tournament_id = p_tournament_id AND m.round_number = v_max_round
        LIMIT 1
    ),
    final_placements AS (
        SELECT
            CASE WHEN winner_side = 'A' THEN player_a_id ELSE player_b_id END AS champ_id,
            CASE WHEN winner_side = 'A' THEN player_a2_id ELSE player_b2_id END AS champ_2_id,
            CASE WHEN winner_side = 'A' THEN player_b_id ELSE player_a_id END AS finalist_id,
            CASE WHEN winner_side = 'A' THEN player_b2_id ELSE player_a2_id END AS finalist_2_id
        FROM final_match
    )
    SELECT pid, 1 AS place, v_points_1 AS points
    FROM final_placements, UNNEST(ARRAY[champ_id, champ_2_id]) pid
    WHERE pid IS NOT NULL AND pid::TEXT <> 'BYE'
    UNION ALL
    SELECT pid, 2 AS place, v_points_2 AS points
    FROM final_placements, UNNEST(ARRAY[finalist_id, finalist_2_id]) pid
    WHERE pid IS NOT NULL AND pid::TEXT <> 'BYE';

    -- Semi-finalists (3rd place) from semi-final matches
    IF v_max_round > 1 THEN
        RETURN QUERY
        WITH semi_matches AS (
            SELECT m.id, m.player_a_id, m.player_a2_id, m.player_b_id, m.player_b2_id,
                   resolve_match_winner_side(m) AS winner_side
            FROM matches m
            WHERE m.tournament_id = p_tournament_id AND m.round_number = v_max_round - 1
        ),
        semi_losers AS (
            SELECT
                CASE WHEN winner_side = 'A' THEN player_b_id ELSE player_a_id END AS loser_id,
                CASE WHEN winner_side = 'A' THEN player_b2_id ELSE player_a2_id END AS loser_2_id
            FROM semi_matches
        )
        SELECT pid, 3 AS place, v_points_3 AS points
        FROM semi_losers, UNNEST(ARRAY[loser_id, loser_2_id]) pid
        WHERE pid IS NOT NULL AND pid::TEXT <> 'BYE';
    END IF;

    -- Quarter-finalists (4th place) from quarter-final matches
    IF v_max_round > 2 THEN
        RETURN QUERY
        WITH quarter_matches AS (
            SELECT m.id, m.player_a_id, m.player_a2_id, m.player_b_id, m.player_b2_id,
                   resolve_match_winner_side(m) AS winner_side
            FROM matches m
            WHERE m.tournament_id = p_tournament_id AND m.round_number = v_max_round - 2
        ),
        quarter_losers AS (
            SELECT
                CASE WHEN winner_side = 'A' THEN player_b_id ELSE player_a_id END AS loser_id,
                CASE WHEN winner_side = 'A' THEN player_b2_id ELSE player_a2_id END AS loser_2_id
            FROM quarter_matches
        )
        SELECT pid, 4 AS place, v_points_4 AS points
        FROM quarter_losers, UNNEST(ARRAY[loser_id, loser_2_id]) pid
        WHERE pid IS NOT NULL AND pid::TEXT <> 'BYE';
    END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- Helper 4: Build ranking table for a pool of tournaments
CREATE OR REPLACE FUNCTION build_ranking(p_tournament_ids UUID[])
RETURNS TABLE(
    player_id UUID,
    points INT,
    trophies INT,
    matches_played INT,
    matches_won INT,
    sets_won INT,
    games_won INT,
    rank INT
) AS $$
BEGIN
    RETURN QUERY
    WITH tournament_placements AS (
        SELECT tp.player_id, tp.place, tp.points
        FROM UNNEST(p_tournament_ids) tid
        CROSS JOIN LATERAL get_tournament_placements(tid) tp
    ),
    match_stats AS (
        SELECT
            pid AS p_id,
            1 AS played,
            CASE WHEN stats.is_winner THEN 1 ELSE 0 END AS won,
            stats.sets_won AS s_won,
            stats.games_won AS g_won
        FROM matches m
        CROSS JOIN LATERAL get_player_match_stats(m, m.player_a_id) stats
        CROSS JOIN LATERAL UNNEST(ARRAY[m.player_a_id, m.player_a2_id]) pid
        WHERE m.tournament_id = ANY(p_tournament_ids) AND m.status = 'finished' AND pid IS NOT NULL AND pid::TEXT <> 'BYE'
        UNION ALL
        SELECT
            pid AS p_id,
            1 AS played,
            CASE WHEN stats.is_winner THEN 1 ELSE 0 END AS won,
            stats.sets_won AS s_won,
            stats.games_won AS g_won
        FROM matches m
        CROSS JOIN LATERAL get_player_match_stats(m, m.player_b_id) stats
        CROSS JOIN LATERAL UNNEST(ARRAY[m.player_b_id, m.player_b2_id]) pid
        WHERE m.tournament_id = ANY(p_tournament_ids) AND m.status = 'finished' AND pid IS NOT NULL AND pid::TEXT <> 'BYE'
    ),
    registrations_pool AS (
        SELECT r.player_id AS p_id
        FROM registrations r
        WHERE r.tournament_id = ANY(p_tournament_ids) AND r.status = 'confirmed' AND r.player_id IS NOT NULL
    ),
    all_players AS (
        SELECT tournament_placements.player_id AS p_id FROM tournament_placements
        UNION
        SELECT p_id FROM match_stats
        UNION
        SELECT p_id FROM registrations_pool
    ),
    player_aggregates AS (
        SELECT
            ap.p_id AS p_id,
            COALESCE((SELECT SUM(tp.points) FROM tournament_placements tp WHERE tp.player_id = ap.p_id), 0)::INT AS total_points,
            COALESCE((SELECT COUNT(*) FROM tournament_placements tp WHERE tp.player_id = ap.p_id AND tp.place = 1), 0)::INT AS total_trophies,
            COALESCE((SELECT SUM(ms.played) FROM match_stats ms WHERE ms.p_id = ap.p_id), 0)::INT AS total_played,
            COALESCE((SELECT SUM(ms.won) FROM match_stats ms WHERE ms.p_id = ap.p_id), 0)::INT AS total_won,
            COALESCE((SELECT SUM(ms.s_won) FROM match_stats ms WHERE ms.p_id = ap.p_id), 0)::INT AS total_sets_won,
            COALESCE((SELECT SUM(ms.g_won) FROM match_stats ms WHERE ms.p_id = ap.p_id), 0)::INT AS total_games_won
        FROM all_players ap
    ),
    ranked_players AS (
        SELECT
            pa.p_id,
            pa.total_points,
            pa.total_trophies,
            pa.total_played,
            pa.total_won,
            pa.total_sets_won,
            pa.total_games_won,
            DENSE_RANK() OVER (
                ORDER BY
                    pa.total_points DESC,
                    pa.total_trophies DESC,
                    CASE WHEN pa.total_played > 0 THEN (pa.total_won::FLOAT / pa.total_played) ELSE 0 END DESC,
                    pa.total_sets_won DESC,
                    pa.total_games_won DESC
            )::INT AS computed_rank
        FROM player_aggregates pa
    )
    SELECT
        rp.p_id,
        rp.total_points,
        rp.total_trophies,
        rp.total_played,
        rp.total_won,
        rp.total_sets_won,
        rp.total_games_won,
        rp.computed_rank
    FROM ranked_players rp;
END;
$$ LANGUAGE plpgsql STABLE;

-- Main RPC 1: Get player profile stats bundle
CREATE OR REPLACE FUNCTION get_player_profile_stats(
    p_player_id UUID,
    p_org_id UUID,
    p_level TEXT,
    p_modality TEXT,
    p_selected_year INT
) RETURNS JSONB AS $$
DECLARE
    context_tournament_ids UUID[];
    available_years INT[];
    effective_year INT;
    selected_tournament_ids UUID[];
    
    -- Stat aggregates
    total_matches INT := 0;
    wins INT := 0;
    sets_won INT := 0;
    sets_lost INT := 0;
    games_won INT := 0;
    games_lost INT := 0;
    win_rate TEXT := '0%';
    finals_played INT := 0;
    
    -- Streaks
    best_streak INT := 0;
    current_streak INT := 0;
    temp_streak INT := 0;
    
    -- Debut Year
    debut_year_val TEXT := '-';
    debut_year_int INT;
    
    -- Rankings
    curr_rank_val TEXT := '-';
    best_rank_val TEXT := '-';
    worst_rank_val TEXT := '-';
    best_rank_int INT := 999999;
    worst_rank_int INT := 0;
    
    -- Rivals
    most_faced_rival_id UUID := NULL;
    most_faced_rival_matches INT := 0;
    most_faced_rival_name TEXT := '-';
    
    -- Return JSON elements
    ranking_history JSONB := '[]'::JSONB;
    stats_obj JSONB;
    match_rec RECORD;
    m INT;
    month_tournament_ids UUID[];
    month_rank INT;
    
    -- General variables
    curr_rank_int INT;
    trophies INT := 0;
BEGIN
    -- 1. Scoped Tournaments
    SELECT COALESCE(ARRAY_AGG(id), '{}'::UUID[]) INTO context_tournament_ids
    FROM tournaments
    WHERE organization_id = p_org_id AND level = p_level AND is_tournament_master = FALSE;

    IF array_length(context_tournament_ids, 1) IS NULL THEN
        RETURN jsonb_build_object(
            'stats', jsonb_build_object(
                'rank', '-',
                'trophies', 0,
                'wins', 0,
                'winRate', '0%',
                'totalMatches', 0,
                'setsWon', 0,
                'setsLost', 0,
                'gamesWon', 0,
                'gamesLost', 0,
                'finalsPlayed', 0,
                'currentStreak', 0,
                'bestStreak', 0,
                'debutYear', '-',
                'bestRanking', '-',
                'worstRanking', '-',
                'mostFacedRivalName', '-',
                'mostFacedRivalMatches', 0,
                'mostFacedRivalId', NULL
            ),
            'rankingHistory', '[]'::JSONB,
            'availableYears', '[]'::JSONB,
            'effectiveYear', NULL
        );
    END IF;

    -- 2. Available Years
    SELECT ARRAY(
        SELECT DISTINCT EXTRACT(YEAR FROM COALESCE(start_date, created_at))::INT AS yr
        FROM tournaments t
        LEFT JOIN registrations r ON r.tournament_id = t.id
        LEFT JOIN matches m ON m.tournament_id = t.id
        WHERE t.organization_id = p_org_id AND t.level = p_level AND t.is_tournament_master = FALSE
          AND (r.player_id = p_player_id OR m.player_a_id = p_player_id OR m.player_a2_id = p_player_id OR m.player_b_id = p_player_id OR m.player_b2_id = p_player_id)
        ORDER BY yr DESC
    ) INTO available_years;

    -- 3. Effective Year
    IF p_selected_year = ANY(available_years) THEN
        effective_year := p_selected_year;
    ELSIF array_length(available_years, 1) > 0 THEN
        effective_year := available_years[1];
    ELSE
        effective_year := NULL;
    END IF;

    -- 4. Filter to Selected Tournaments (Year and Modality)
    SELECT COALESCE(ARRAY_AGG(id), '{}'::UUID[]) INTO selected_tournament_ids
    FROM tournaments
    WHERE organization_id = p_org_id
      AND level = p_level
      AND modality = p_modality
      AND is_tournament_master = FALSE
      AND (effective_year IS NULL OR EXTRACT(YEAR FROM COALESCE(start_date, created_at))::INT = effective_year);

    -- 5. Calculate Basic Stats
    IF array_length(selected_tournament_ids, 1) > 0 THEN
        SELECT
            COALESCE(COUNT(*), 0)::INT,
            COALESCE(SUM(CASE WHEN stats.is_winner THEN 1 ELSE 0 END), 0)::INT,
            COALESCE(SUM(stats.sets_won), 0)::INT,
            COALESCE(SUM(stats.sets_lost), 0)::INT,
            COALESCE(SUM(stats.games_won), 0)::INT,
            COALESCE(SUM(stats.games_lost), 0)::INT
        INTO total_matches, wins, sets_won, sets_lost, games_won, games_lost
        FROM matches m
        CROSS JOIN LATERAL get_player_match_stats(m, p_player_id) stats
        WHERE m.tournament_id = ANY(selected_tournament_ids)
          AND m.status = 'finished'
          AND (m.player_a_id = p_player_id OR m.player_a2_id = p_player_id OR m.player_b_id = p_player_id OR m.player_b2_id = p_player_id);

        IF total_matches > 0 THEN
            win_rate := ROUND((wins::FLOAT / total_matches::FLOAT) * 100)::TEXT || '%';
        END IF;

        -- Finals Played
        SELECT COALESCE(COUNT(*), 0)::INT INTO finals_played
        FROM matches m
        WHERE m.tournament_id = ANY(selected_tournament_ids)
          AND (m.player_a_id = p_player_id OR m.player_a2_id = p_player_id OR m.player_b_id = p_player_id OR m.player_b2_id = p_player_id)
          AND m.round_number = (
              SELECT MAX(round_number)
              FROM matches
              WHERE tournament_id = m.tournament_id
          )
          AND m.status = 'finished';
    END IF;

    -- 6. Streaks
    -- Best Streak (Selected Year Matches)
    IF array_length(selected_tournament_ids, 1) > 0 THEN
        temp_streak := 0;
        FOR match_rec IN (
            SELECT stats.is_winner
            FROM matches m
            JOIN tournaments t ON t.id = m.tournament_id
            CROSS JOIN LATERAL get_player_match_stats(m, p_player_id) stats
            WHERE m.tournament_id = ANY(selected_tournament_ids)
              AND m.status = 'finished'
              AND (m.player_a_id = p_player_id OR m.player_a2_id = p_player_id OR m.player_b_id = p_player_id OR m.player_b2_id = p_player_id)
            ORDER BY COALESCE(m.scheduled_at, t.start_date, m.created_at) ASC, m.round_number ASC, m.match_order ASC, m.id ASC
        ) LOOP
            IF match_rec.is_winner THEN
                temp_streak := temp_streak + 1;
                IF temp_streak > best_streak THEN
                    best_streak := temp_streak;
                END IF;
            ELSE
                temp_streak := 0;
            END IF;
        END LOOP;
    END IF;

    -- Current Streak (All years of Modality)
    temp_streak := 0;
    FOR match_rec IN (
        SELECT stats.is_winner
        FROM matches m
        JOIN tournaments t ON t.id = m.tournament_id
        CROSS JOIN LATERAL get_player_match_stats(m, p_player_id) stats
        WHERE t.organization_id = p_org_id AND t.level = p_level AND t.modality = p_modality AND t.is_tournament_master = FALSE
          AND m.status = 'finished'
          AND (m.player_a_id = p_player_id OR m.player_a2_id = p_player_id OR m.player_b_id = p_player_id OR m.player_b2_id = p_player_id)
        ORDER BY COALESCE(m.scheduled_at, t.start_date, m.created_at) ASC, m.round_number ASC, m.match_order ASC, m.id ASC
    ) LOOP
        IF match_rec.is_winner THEN
            temp_streak := temp_streak + 1;
        ELSE
            temp_streak := 0;
        END IF;
    END LOOP;
    current_streak := temp_streak;

    -- 7. Debut Year
    SELECT EXTRACT(YEAR FROM COALESCE(t.start_date, t.created_at))::INT INTO debut_year_int
    FROM tournaments t
    LEFT JOIN registrations r ON r.tournament_id = t.id
    LEFT JOIN matches m ON m.tournament_id = t.id
    WHERE t.organization_id = p_org_id AND t.level = p_level AND t.modality = p_modality AND t.is_tournament_master = FALSE
      AND (
        (r.player_id = p_player_id AND r.status = 'confirmed') OR
        (m.player_a_id = p_player_id OR m.player_a2_id = p_player_id OR m.player_b_id = p_player_id OR m.player_b2_id = p_player_id)
      )
    ORDER BY COALESCE(t.start_date, t.created_at) ASC
    LIMIT 1;

    IF debut_year_int IS NOT NULL THEN
        debut_year_val := debut_year_int::TEXT;
    END IF;

    -- 8. Current Rank and Trophies (Selected Completed Tournaments)
    DECLARE
        completed_tournaments UUID[];
    BEGIN
        SELECT COALESCE(ARRAY_AGG(id), '{}'::UUID[]) INTO completed_tournaments
        FROM tournaments
        WHERE organization_id = p_org_id
          AND level = p_level
          AND modality = p_modality
          AND is_tournament_master = FALSE
          AND status IN ('completed', 'finalized', 'finished')
          AND (effective_year IS NULL OR EXTRACT(YEAR FROM COALESCE(start_date, created_at))::INT = effective_year);

        IF array_length(completed_tournaments, 1) > 0 THEN
            SELECT computed_rank, pa.trophies INTO curr_rank_int, trophies
            FROM build_ranking(completed_tournaments) pa
            WHERE pa.player_id = p_player_id AND (pa.points > 0 OR pa.matches_played > 0);

            IF curr_rank_int IS NOT NULL THEN
                curr_rank_val := '#' || curr_rank_int;
            END IF;
        END IF;
    END;

    -- 9. Best and Worst Ranking Range
    IF array_length(available_years, 1) > 0 AND array_length(context_tournament_ids, 1) > 0 THEN
        DECLARE
            yr INT;
            snap_time TIMESTAMPTZ;
            snap_tourney_ids UUID[];
            snap_rank INT;
        BEGIN
            FOREACH yr IN ARRAY available_years LOOP
                FOR m IN 0..11 LOOP
                    snap_time := make_timestamptz(yr, m + 1, 1, 0, 0, 0, 'UTC');
                    SELECT COALESCE(ARRAY_AGG(id), '{}'::UUID[]) INTO snap_tourney_ids
                    FROM tournaments
                    WHERE organization_id = p_org_id
                      AND level = p_level
                      AND modality = p_modality
                      AND is_tournament_master = FALSE
                      AND status IN ('completed', 'finalized', 'finished')
                      AND COALESCE(end_date, start_date, created_at) < snap_time;

                    IF array_length(snap_tourney_ids, 1) > 0 THEN
                        SELECT computed_rank INTO snap_rank
                        FROM build_ranking(snap_tourney_ids) r
                        WHERE r.player_id = p_player_id AND (r.points > 0 OR r.matches_played > 0);

                        IF snap_rank IS NOT NULL THEN
                            IF snap_rank < best_rank_int THEN
                                best_rank_int := snap_rank;
                            END IF;
                            IF snap_rank > worst_rank_int THEN
                                worst_rank_int := snap_rank;
                            END IF;
                        END IF;
                    END IF;
                END LOOP;
            END LOOP;

            -- Include current rank
            IF curr_rank_int IS NOT NULL THEN
                IF curr_rank_int < best_rank_int THEN
                    best_rank_int := curr_rank_int;
                END IF;
                IF curr_rank_int > worst_rank_int THEN
                    worst_rank_int := curr_rank_int;
                END IF;
            END IF;

            IF best_rank_int < 999999 THEN
                best_rank_val := '#' || best_rank_int;
            END IF;
            IF worst_rank_int > 0 THEN
                worst_rank_val := '#' || worst_rank_int;
            END IF;
        END;
    END IF;

    -- 10. Most Faced Rival
    IF array_length(selected_tournament_ids, 1) > 0 THEN
        WITH rival_matches AS (
            SELECT
                CASE
                    WHEN m.player_a_id = p_player_id OR m.player_a2_id = p_player_id THEN
                        UNNEST(ARRAY[m.player_b_id, m.player_b2_id])
                    ELSE
                        UNNEST(ARRAY[m.player_a_id, m.player_a2_id])
                END AS rival_id
            FROM matches m
            WHERE m.tournament_id = ANY(selected_tournament_ids)
              AND (m.player_a_id = p_player_id OR m.player_a2_id = p_player_id OR m.player_b_id = p_player_id OR m.player_b2_id = p_player_id)
        ),
        rival_counts AS (
            SELECT rival_id, COUNT(*) AS match_count
            FROM rival_matches
            WHERE rival_id IS NOT NULL AND rival_id::TEXT <> 'BYE'
            GROUP BY rival_id
        )
        SELECT rc.rival_id, rc.match_count::INT, COALESCE(p.name, 'Jugador')
        INTO most_faced_rival_id, most_faced_rival_matches, most_faced_rival_name
        FROM rival_counts rc
        LEFT JOIN public_profiles p ON p.id = rc.rival_id
        ORDER BY rc.match_count DESC, rc.rival_id::TEXT ASC
        LIMIT 1;
    END IF;

    -- 11. Ranking History
    IF effective_year IS NOT NULL THEN
        FOR m IN 0..11 LOOP
            IF effective_year > EXTRACT(YEAR FROM NOW())::INT OR
               (effective_year = EXTRACT(YEAR FROM NOW())::INT AND m > EXTRACT(MONTH FROM NOW())::INT) THEN
                ranking_history := ranking_history || jsonb_build_object(
                    'month', m,
                    'singlesRank', NULL,
                    'doblesRank', NULL
                );
            ELSE
                SELECT COALESCE(ARRAY_AGG(id), '{}'::UUID[]) INTO month_tournament_ids
                FROM tournaments
                WHERE organization_id = p_org_id
                  AND level = p_level
                  AND modality = p_modality
                  AND is_tournament_master = FALSE
                  AND status IN ('completed', 'finalized', 'finished')
                  AND COALESCE(end_date, start_date, created_at) < make_timestamptz(effective_year, m + 1, 1, 0, 0, 0, 'UTC');

                month_rank := NULL;
                IF array_length(month_tournament_ids, 1) > 0 THEN
                    SELECT r.computed_rank INTO month_rank
                    FROM build_ranking(month_tournament_ids) r
                    WHERE r.player_id = p_player_id AND (r.points > 0 OR r.matches_played > 0);
                END IF;

                IF p_modality = 'singles' THEN
                    ranking_history := ranking_history || jsonb_build_object(
                        'month', m,
                        'singlesRank', month_rank,
                        'doblesRank', NULL
                    );
                ELSE
                    ranking_history := ranking_history || jsonb_build_object(
                        'month', m,
                        'singlesRank', NULL,
                        'doblesRank', month_rank
                    );
                END IF;
            END IF;
        END LOOP;
    END IF;

    -- 12. Build Final Stats Object
    stats_obj := jsonb_build_object(
        'rank', curr_rank_val,
        'trophies', trophies,
        'wins', wins,
        'winRate', win_rate,
        'totalMatches', total_matches,
        'setsWon', sets_won,
        'setsLost', sets_lost,
        'gamesWon', games_won,
        'gamesLost', games_lost,
        'finalsPlayed', finals_played,
        'currentStreak', current_streak,
        'bestStreak', best_streak,
        'debutYear', debut_year_val,
        'bestRanking', best_rank_val,
        'worstRanking', worst_rank_val,
        'mostFacedRivalName', most_faced_rival_name,
        'mostFacedRivalMatches', most_faced_rival_matches,
        'mostFacedRivalId', most_faced_rival_id
    );

    RETURN jsonb_build_object(
        'stats', stats_obj,
        'rankingHistory', ranking_history,
        'availableYears', to_jsonb(available_years),
        'effectiveYear', effective_year
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- Main RPC 2: Get player achievements in a single server-side JSON query
CREATE OR REPLACE FUNCTION get_player_achievements(p_player_id UUID)
RETURNS JSONB AS $$
DECLARE
    achievements JSONB := '[]'::JSONB;
    first_tourney_rec RECORD;
    first_win_rec RECORD;
    total_wins INT := 0;
    champs_won INT := 0;
    max_streak INT := 0;
    curr_streak INT := 0;
    has_undefeated BOOLEAN := FALSE;
    has_no_sets_lost BOOLEAN := FALSE;
    has_no_games_lost BOOLEAN := FALSE;
    
    -- Trigger matches for achievements
    win_trigger_match_10 TIMESTAMP WITH TIME ZONE := NULL;
    win_trigger_match_25 TIMESTAMP WITH TIME ZONE := NULL;
    win_trigger_match_50 TIMESTAMP WITH TIME ZONE := NULL;
    win_trigger_match_100 TIMESTAMP WITH TIME ZONE := NULL;
    win_trigger_match_150 TIMESTAMP WITH TIME ZONE := NULL;
    win_trigger_match_200 TIMESTAMP WITH TIME ZONE := NULL;
    win_trigger_match_250 TIMESTAMP WITH TIME ZONE := NULL;
    
    streak_trigger_5 TIMESTAMP WITH TIME ZONE := NULL;
    streak_trigger_10 TIMESTAMP WITH TIME ZONE := NULL;
    streak_trigger_15 TIMESTAMP WITH TIME ZONE := NULL;
    streak_trigger_20 TIMESTAMP WITH TIME ZONE := NULL;
    streak_trigger_30 TIMESTAMP WITH TIME ZONE := NULL;
    streak_trigger_40 TIMESTAMP WITH TIME ZONE := NULL;
    streak_trigger_50 TIMESTAMP WITH TIME ZONE := NULL;
    
    -- Specific match triggers
    nada_imposible_dt TIMESTAMP WITH TIME ZONE := NULL;
    bombardero_dt TIMESTAMP WITH TIME ZONE := NULL;
    no_estoy_ni_ahi_dt TIMESTAMP WITH TIME ZONE := NULL;
    
    match_rec RECORD;
    t_rec RECORD;
    latest_champ_dt TIMESTAMP WITH TIME ZONE := NULL;
BEGIN
    -- 1. First Tournament played
    SELECT t.name, t.start_date, t.created_at
    INTO first_tourney_rec
    FROM tournaments t
    LEFT JOIN registrations r ON r.tournament_id = t.id
    LEFT JOIN matches m ON m.tournament_id = t.id
    WHERE (r.player_id = p_player_id AND r.status = 'confirmed')
       OR (m.player_a_id = p_player_id OR m.player_a2_id = p_player_id OR m.player_b_id = p_player_id OR m.player_b2_id = p_player_id)
    ORDER BY COALESCE(t.start_date, t.created_at) ASC
    LIMIT 1;

    IF first_tourney_rec.name IS NOT NULL THEN
        achievements := achievements || jsonb_build_object(
            'id', 'first-tournament',
            'title', 'Primer torneo jugado',
            'detail', first_tourney_rec.name || ' - ' || EXTRACT(YEAR FROM COALESCE(first_tourney_rec.start_date, first_tourney_rec.created_at))::TEXT,
            'icon', 'tennisball',
            'tone', 'silver',
            'imageName', 'PrimerTorneoJugado.png',
            'dateEarned', COALESCE(first_tourney_rec.start_date, first_tourney_rec.created_at)
        );
    END IF;

    -- Calculate all finished matches won/streaks/milestones
    FOR match_rec IN (
        SELECT m.id, m.scheduled_at, m.created_at, m.score, t.name AS tournament_name, t.start_date,
               stats.is_winner, stats.sets_won, stats.sets_lost, stats.games_won, stats.games_lost
        FROM matches m
        JOIN tournaments t ON t.id = m.tournament_id
        CROSS JOIN LATERAL get_player_match_stats(m, p_player_id) stats
        WHERE m.status = 'finished'
          AND (m.player_a_id = p_player_id OR m.player_a2_id = p_player_id OR m.player_b_id = p_player_id OR m.player_b2_id = p_player_id)
        ORDER BY COALESCE(m.scheduled_at, t.start_date, m.created_at) ASC
    ) LOOP
        -- Wins
        IF match_rec.is_winner THEN
            total_wins := total_wins + 1;
            
            -- Milestones
            IF total_wins = 1 THEN
                achievements := achievements || jsonb_build_object(
                    'id', 'first-win',
                    'title', 'Primer triunfo',
                    'detail', match_rec.tournament_name,
                    'icon', 'tennisball',
                    'tone', 'gold',
                    'imageName', 'PrimerTriunfo.png',
                    'dateEarned', COALESCE(match_rec.scheduled_at, match_rec.created_at)
                );
            ELSIF total_wins = 10 THEN
                win_trigger_match_10 := COALESCE(match_rec.scheduled_at, match_rec.created_at);
            ELSIF total_wins = 25 THEN
                win_trigger_match_25 := COALESCE(match_rec.scheduled_at, match_rec.created_at);
            ELSIF total_wins = 50 THEN
                win_trigger_match_50 := COALESCE(match_rec.scheduled_at, match_rec.created_at);
            ELSIF total_wins = 100 THEN
                win_trigger_match_100 := COALESCE(match_rec.scheduled_at, match_rec.created_at);
            ELSIF total_wins = 150 THEN
                win_trigger_match_150 := COALESCE(match_rec.scheduled_at, match_rec.created_at);
            ELSIF total_wins = 200 THEN
                win_trigger_match_200 := COALESCE(match_rec.scheduled_at, match_rec.created_at);
            ELSIF total_wins = 250 THEN
                win_trigger_match_250 := COALESCE(match_rec.scheduled_at, match_rec.created_at);
            END IF;

            -- Streaks
            curr_streak := curr_streak + 1;
            IF curr_streak = 5 THEN streak_trigger_5 := COALESCE(match_rec.scheduled_at, match_rec.created_at);
            ELSIF curr_streak = 10 THEN streak_trigger_10 := COALESCE(match_rec.scheduled_at, match_rec.created_at);
            ELSIF curr_streak = 15 THEN streak_trigger_15 := COALESCE(match_rec.scheduled_at, match_rec.created_at);
            ELSIF curr_streak = 20 THEN streak_trigger_20 := COALESCE(match_rec.scheduled_at, match_rec.created_at);
            ELSIF curr_streak = 30 THEN streak_trigger_30 := COALESCE(match_rec.scheduled_at, match_rec.created_at);
            ELSIF curr_streak = 40 THEN streak_trigger_40 := COALESCE(match_rec.scheduled_at, match_rec.created_at);
            ELSIF curr_streak = 50 THEN streak_trigger_50 := COALESCE(match_rec.scheduled_at, match_rec.created_at);
            END IF;

            IF curr_streak > max_streak THEN
                max_streak := curr_streak;
            END IF;
        ELSE
            curr_streak := 0;
        END IF;

        -- Special matches checks
        -- 1. Nada es imposible (comeback)
        IF match_rec.is_winner AND nada_imposible_dt IS NULL THEN
            -- 3 set match, lost 1st set, won next 2
            IF match_rec.score LIKE '%-%' THEN
                DECLARE
                    set_parts TEXT[] := string_to_array(match_rec.score, ',');
                BEGIN
                    IF array_length(set_parts, 1) = 3 THEN
                        -- First set check
                        DECLARE
                            first_parsed RECORD;
                        BEGIN
                            SELECT * INTO first_parsed FROM parse_set_score(set_parts[1]);
                            IF first_parsed IS NOT NULL AND first_parsed.leftValue < first_parsed.rightValue THEN
                                nada_imposible_dt := COALESCE(match_rec.scheduled_at, match_rec.created_at);
                            END IF;
                        END;
                    END IF;
                END;
            END IF;
        END IF;

        -- 2. Bombardero (6-0 set won)
        IF bombardero_dt IS NULL AND match_rec.score LIKE '%6-0%' THEN
            bombardero_dt := COALESCE(match_rec.scheduled_at, match_rec.created_at);
        END IF;

        -- 3. No estoy ni ahi (6-0, 6-0 or similar without ceding games)
        IF match_rec.is_winner AND no_estoy_ni_ahi_dt IS NULL THEN
            IF match_rec.score LIKE '%6-0, 6-0%' OR match_rec.score LIKE '%6-0, 6-0, 6-0%' THEN
                no_estoy_ni_ahi_dt := COALESCE(match_rec.scheduled_at, match_rec.created_at);
            END IF;
        END IF;
    END LOOP;

    -- Append Wins Achievements
    IF win_trigger_match_10 IS NOT NULL THEN
        achievements := achievements || jsonb_build_object('id', 'wins-10', 'title', '10 Triunfos', 'detail', '10 partidos ganados en total', 'icon', 'medal', 'tone', 'bronze', 'imageName', '10Triunfos.png', 'dateEarned', win_trigger_match_10);
    END IF;
    IF win_trigger_match_25 IS NOT NULL THEN
        achievements := achievements || jsonb_build_object('id', 'wins-25', 'title', '25 Triunfos', 'detail', '25 partidos ganados en total', 'icon', 'medal', 'tone', 'silver', 'imageName', '25Triunfos.png', 'dateEarned', win_trigger_match_25);
    END IF;
    IF win_trigger_match_50 IS NOT NULL THEN
        achievements := achievements || jsonb_build_object('id', 'wins-50', 'title', '50 Triunfos', 'detail', '50 partidos ganados en total', 'icon', 'trophy', 'tone', 'gold', 'imageName', '50Triunfos.png', 'dateEarned', win_trigger_match_50);
    END IF;
    IF win_trigger_match_100 IS NOT NULL THEN
        achievements := achievements || jsonb_build_object('id', 'wins-100', 'title', '100 Triunfos', 'detail', '100 partidos ganados en total', 'icon', 'trophy', 'tone', 'gold', 'imageName', '100Triunfos.png', 'dateEarned', win_trigger_match_100);
    END IF;
    IF win_trigger_match_150 IS NOT NULL THEN
        achievements := achievements || jsonb_build_object('id', 'wins-150', 'title', '150 Triunfos', 'detail', '150 partidos ganados en total', 'icon', 'trophy', 'tone', 'gold', 'imageName', '150Triunfos.png', 'dateEarned', win_trigger_match_150);
    END IF;
    IF win_trigger_match_200 IS NOT NULL THEN
        achievements := achievements || jsonb_build_object('id', 'wins-200', 'title', '200 Triunfos', 'detail', '200 partidos ganados en total', 'icon', 'trophy', 'tone', 'gold', 'imageName', '200Triunfos.png', 'dateEarned', win_trigger_match_200);
    END IF;
    IF win_trigger_match_250 IS NOT NULL THEN
        achievements := achievements || jsonb_build_object('id', 'wins-250', 'title', '250 Triunfos', 'detail', '250 partidos ganados en total', 'icon', 'trophy', 'tone', 'gold', 'imageName', '250Triunfos.png', 'dateEarned', win_trigger_match_250);
    END IF;

    -- Append Streaks Achievements
    IF streak_trigger_5 IS NOT NULL THEN
        achievements := achievements || jsonb_build_object('id', 'streak-5', 'title', 'Racha de 5 victorias', 'detail', max_streak || ' victorias consecutivas', 'icon', 'tennisball', 'tone', 'bronze', 'imageName', 'Racha5Victorias.png', 'dateEarned', streak_trigger_5);
    END IF;
    IF streak_trigger_10 IS NOT NULL THEN
        achievements := achievements || jsonb_build_object('id', 'streak-10', 'title', 'Racha de 10 victorias', 'detail', max_streak || ' victorias consecutivas', 'icon', 'tennisball', 'tone', 'silver', 'imageName', 'Racha10Victorias.png', 'dateEarned', streak_trigger_10);
    END IF;
    IF streak_trigger_15 IS NOT NULL THEN
        achievements := achievements || jsonb_build_object('id', 'streak-15', 'title', 'Racha de 15 victorias', 'detail', max_streak || ' victorias consecutivas', 'icon', 'tennisball', 'tone', 'gold', 'imageName', 'Racha15Victorias.png', 'dateEarned', streak_trigger_15);
    END IF;
    IF streak_trigger_20 IS NOT NULL THEN
        achievements := achievements || jsonb_build_object('id', 'streak-20', 'title', 'Racha de 20 victorias', 'detail', max_streak || ' victorias consecutivas', 'icon', 'tennisball', 'tone', 'gold', 'imageName', 'Racha20Victorias.png', 'dateEarned', streak_trigger_20);
    END IF;
    IF streak_trigger_30 IS NOT NULL THEN
        achievements := achievements || jsonb_build_object('id', 'streak-30', 'title', 'Racha de 30 victorias', 'detail', max_streak || ' victorias consecutivas', 'icon', 'tennisball', 'tone', 'gold', 'imageName', 'Racha30Victorias.png', 'dateEarned', streak_trigger_30);
    END IF;
    IF streak_trigger_40 IS NOT NULL THEN
        achievements := achievements || jsonb_build_object('id', 'streak-40', 'title', 'Racha de 40 victorias', 'detail', max_streak || ' victorias consecutivas', 'icon', 'tennisball', 'tone', 'gold', 'imageName', 'Racha40Victorias.png', 'dateEarned', streak_trigger_40);
    END IF;
    IF streak_trigger_50 IS NOT NULL THEN
        achievements := achievements || jsonb_build_object('id', 'streak-50', 'title', 'Racha de 50 victorias', 'detail', max_streak || ' victorias consecutivas', 'icon', 'tennisball', 'tone', 'gold', 'imageName', 'Racha50Victorias.png', 'dateEarned', streak_trigger_50);
    END IF;

    -- 3. Championships and placements
    FOR t_rec IN (
        SELECT t.id, t.name, t.level, t.start_date, t.created_at
        FROM tournaments t
        WHERE t.is_tournament_master = FALSE AND t.status IN ('completed', 'finalized', 'finished')
    ) LOOP
        -- Check if champion of this tournament
        DECLARE
            v_placement_exists BOOLEAN := FALSE;
            v_place INT;
            v_lvl TEXT;
            v_img TEXT;
        BEGIN
            SELECT TRUE, place INTO v_placement_exists, v_place
            FROM get_tournament_placements(t_rec.id)
            WHERE player_id = p_player_id LIMIT 1;

            IF v_placement_exists AND v_place = 1 THEN
                champs_won := champs_won + 1;
                latest_champ_dt := COALESCE(t_rec.start_date, t_rec.created_at);
                v_lvl := TRIM(t_rec.level);
                
                -- Medal filename
                IF v_lvl ILIKE 'primera' OR v_lvl ILIKE '1ra' THEN v_img := 'CampeonPrimera.png';
                ELSIF v_lvl ILIKE 'segunda' OR v_lvl ILIKE '2da' THEN v_img := 'CampeonSegunda.png';
                ELSIF v_lvl ILIKE 'tercera' OR v_lvl ILIKE '3ra' THEN v_img := 'CampeonTercera.png';
                ELSIF v_lvl ILIKE 'cuarta' OR v_lvl ILIKE '4ta' THEN v_img := 'CampeonCuarta.png';
                ELSIF v_lvl ILIKE 'quinta' OR v_lvl ILIKE '5ta' THEN v_img := 'CampeonQuinta.png';
                ELSIF v_lvl ILIKE 'honor' THEN v_img := 'CampeonHonor.png';
                ELSIF v_lvl ILIKE 'escalafon' THEN v_img := 'CampeonEscalafon.png';
                ELSIF v_lvl ILIKE 'inicial' THEN v_img := 'CampeonInicial.png';
                ELSE v_img := 'CampeonPrimera.png';
                END IF;

                achievements := achievements || jsonb_build_object(
                    'id', 'champion-' || lower(v_lvl),
                    'title', 'Campeón ' || t_rec.level,
                    'detail', t_rec.name,
                    'icon', 'trophy',
                    'tone', 'gold',
                    'imageName', v_img,
                    'dateEarned', latest_champ_dt
                );

                -- Check undefeated / no set / no game lost champion
                DECLARE
                    t_matches_played INT := 0;
                    t_matches_won INT := 0;
                    t_sets_lost INT := 0;
                    t_games_lost INT := 0;
                BEGIN
                    SELECT
                        COUNT(*)::INT,
                        SUM(CASE WHEN stats.is_winner THEN 1 ELSE 0 END)::INT,
                        SUM(stats.sets_lost)::INT,
                        SUM(stats.games_lost)::INT
                    INTO t_matches_played, t_matches_won, t_sets_lost, t_games_lost
                    FROM matches m
                    CROSS JOIN LATERAL get_player_match_stats(m, p_player_id) stats
                    WHERE m.tournament_id = t_rec.id AND m.status = 'finished'
                      AND (m.player_a_id = p_player_id OR m.player_a2_id = p_player_id OR m.player_b_id = p_player_id OR m.player_b2_id = p_player_id);

                    IF t_matches_played > 0 THEN
                        IF t_matches_won = t_matches_played THEN has_undefeated := TRUE; END IF;
                        IF t_sets_lost = 0 THEN has_no_sets_lost := TRUE; END IF;
                        IF t_games_lost = 0 THEN has_no_games_lost := TRUE; END IF;
                    END IF;
                END;
            END IF;
        END;
    END LOOP;

    -- Append Champion details
    IF has_undefeated THEN
        achievements := achievements || jsonb_build_object('id', 'undefeated-champion', 'title', 'Campeón invicto', 'detail', 'Título ganado sin perder partidos', 'icon', 'trophy', 'tone', 'gold', 'imageName', 'CampeónInvicto.png', 'dateEarned', latest_champ_dt);
    END IF;
    IF has_no_sets_lost THEN
        achievements := achievements || jsonb_build_object('id', 'no-set-lost-champion', 'title', 'Campeón sin ceder sets', 'detail', 'Título ganado sin perder sets', 'icon', 'ribbon', 'tone', 'silver', 'imageName', 'CampeonSinCederSets.png', 'dateEarned', latest_champ_dt);
    END IF;
    IF has_no_games_lost THEN
        achievements := achievements || jsonb_build_object('id', 'no-game-lost-champion', 'title', 'Campeón sin ceder games', 'detail', 'Título ganado sin perder games', 'icon', 'medal', 'tone', 'gold', 'imageName', 'CampeonSinCederGames.png', 'dateEarned', latest_champ_dt);
    END IF;
    IF has_undefeated AND has_no_sets_lost AND has_no_games_lost THEN
        achievements := achievements || jsonb_build_object('id', 'dios-del-tenis', 'title', 'Dios del Tenis', 'detail', 'Campeón invicto, sin perder sets y sin ceder games', 'icon', 'star', 'tone', 'gold', 'imageName', 'DiosDelTenis.png', 'dateEarned', latest_champ_dt);
    END IF;

    -- Special matches achievements
    IF nada_imposible_dt IS NOT NULL THEN
        achievements := achievements || jsonb_build_object('id', 'nada-es-imposible', 'title', 'Nada es imposible weon! Ni una wea!', 'detail', 'Ganar un partido de 3 sets habiendo perdido el primer set', 'icon', 'star', 'tone', 'gold', 'imageName', 'NadaEsImposible.png', 'dateEarned', nada_imposible_dt);
    END IF;
    IF bombardero_dt IS NOT NULL THEN
        achievements := achievements || jsonb_build_object('id', 'bombardero', 'title', 'Bombardero', 'detail', 'Ganar un set 6-0', 'icon', 'tennisball', 'tone', 'gold', 'imageName', 'Bombardero.png', 'dateEarned', bombardero_dt);
    END IF;
    IF no_estoy_ni_ahi_dt IS NOT NULL THEN
        achievements := achievements || jsonb_build_object('id', 'no-estoy-ni-ahi', 'title', 'No estoy ni ahí', 'detail', 'Ganar un partido de 3 o 5 sets sin perder ningún game', 'icon', 'star', 'tone', 'gold', 'imageName', 'NoEstoyNiAhi.png', 'dateEarned', no_estoy_ni_ahi_dt);
    END IF;

    IF nada_imposible_dt IS NOT NULL AND bombardero_dt IS NOT NULL AND no_estoy_ni_ahi_dt IS NOT NULL THEN
        DECLARE
            max_dt TIMESTAMP WITH TIME ZONE;
        BEGIN
            max_dt := nada_imposible_dt;
            IF bombardero_dt > max_dt THEN max_dt := bombardero_dt; END IF;
            IF no_estoy_ni_ahi_dt > max_dt THEN max_dt := no_estoy_ni_ahi_dt; END IF;

            achievements := achievements || jsonb_build_object(
                'id', 'ce-hache-i',
                'title', 'Ce Hache Í!!!',
                'detail', 'Obtener los logros "Nada es imposible weon! Ni una wea!", "Bombardero" y "No estoy ni ahí"',
                'icon', 'trophy',
                'tone', 'gold',
                'imageName', 'CeHacheI.png',
                'dateEarned', max_dt
            );
        END;
    END IF;

    RETURN achievements;
END;
$$ LANGUAGE plpgsql STABLE;

-- Help function to parse set score string in get_player_achievements helper loop
CREATE OR REPLACE FUNCTION parse_set_score(set_score TEXT)
RETURNS TABLE(leftValue INT, rightValue INT) AS $$
DECLARE
    set_score_norm TEXT;
    parts TEXT[];
BEGIN
    set_score_norm := REGEXP_REPLACE(set_score, '[^\d-]', '', 'g');
    parts := string_to_array(TRIM(set_score_norm), '-');
    IF array_length(parts, 1) = 2 THEN
        RETURN QUERY SELECT parts[1]::INT, parts[2]::INT;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Return nothing on parsing error
END;
$$ LANGUAGE plpgsql IMMUTABLE;
