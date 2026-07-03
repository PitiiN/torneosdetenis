-- Migration: Exclude BYE matches from player statistics and rankings
-- Date: 2026-07-02

-- 1. Redefine build_ranking
CREATE OR REPLACE FUNCTION public.build_ranking(p_tournament_ids uuid[])
 RETURNS TABLE(player_id uuid, points integer, trophies integer, matches_played integer, matches_won integer, sets_won integer, games_won integer, rank integer)
 LANGUAGE plpgsql
 STABLE
AS $function$
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
          AND (m.player_a_id IS NULL OR m.player_a_id::TEXT <> 'BYE')
          AND (m.player_b_id IS NULL OR m.player_b_id::TEXT <> 'BYE')
          AND (m.player_a2_id IS NULL OR m.player_a2_id::TEXT <> 'BYE')
          AND (m.player_b2_id IS NULL OR m.player_b2_id::TEXT <> 'BYE')
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
          AND (m.player_a_id IS NULL OR m.player_a_id::TEXT <> 'BYE')
          AND (m.player_b_id IS NULL OR m.player_b_id::TEXT <> 'BYE')
          AND (m.player_a2_id IS NULL OR m.player_a2_id::TEXT <> 'BYE')
          AND (m.player_b2_id IS NULL OR m.player_b2_id::TEXT <> 'BYE')
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
$function$;


-- 2. Redefine get_player_profile_stats
CREATE OR REPLACE FUNCTION public.get_player_profile_stats(p_player_id uuid, p_org_id uuid, p_level text, p_modality text, p_selected_year integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
AS $function$
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
    month_idx INT;
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
        SELECT DISTINCT EXTRACT(YEAR FROM COALESCE(t.start_date, t.created_at))::INT AS yr
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
          AND (m.player_a_id = p_player_id OR m.player_a2_id = p_player_id OR m.player_b_id = p_player_id OR m.player_b2_id = p_player_id)
          AND (m.player_a_id IS NULL OR m.player_a_id::TEXT <> 'BYE')
          AND (m.player_b_id IS NULL OR m.player_b_id::TEXT <> 'BYE')
          AND (m.player_a2_id IS NULL OR m.player_a2_id::TEXT <> 'BYE')
          AND (m.player_b2_id IS NULL OR m.player_b2_id::TEXT <> 'BYE');

        IF total_matches > 0 THEN
            win_rate := ROUND((wins::FLOAT / total_matches::FLOAT) * 100)::TEXT || '%';
        END IF;

        -- Finals Played
        SELECT COALESCE(COUNT(*), 0)::INT INTO finals_played
        FROM matches m
        WHERE m.tournament_id = ANY(selected_tournament_ids)
          AND (m.player_a_id = p_player_id OR m.player_a2_id = p_player_id OR m.player_b_id = p_player_id OR m.player_b2_id = p_player_id)
          AND (m.player_a_id IS NULL OR m.player_a_id::TEXT <> 'BYE')
          AND (m.player_b_id IS NULL OR m.player_b_id::TEXT <> 'BYE')
          AND (m.player_a2_id IS NULL OR m.player_a2_id::TEXT <> 'BYE')
          AND (m.player_b2_id IS NULL OR m.player_b2_id::TEXT <> 'BYE')
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
              AND (m.player_a_id IS NULL OR m.player_a_id::TEXT <> 'BYE')
              AND (m.player_b_id IS NULL OR m.player_b_id::TEXT <> 'BYE')
              AND (m.player_a2_id IS NULL OR m.player_a2_id::TEXT <> 'BYE')
              AND (m.player_b2_id IS NULL OR m.player_b2_id::TEXT <> 'BYE')
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
          AND (m.player_a_id IS NULL OR m.player_a_id::TEXT <> 'BYE')
          AND (m.player_b_id IS NULL OR m.player_b_id::TEXT <> 'BYE')
          AND (m.player_a2_id IS NULL OR m.player_a2_id::TEXT <> 'BYE')
          AND (m.player_b2_id IS NULL OR m.player_b2_id::TEXT <> 'BYE')
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
        ((m.player_a_id = p_player_id OR m.player_a2_id = p_player_id OR m.player_b_id = p_player_id OR m.player_b2_id = p_player_id)
          AND (m.player_a_id IS NULL OR m.player_a_id::TEXT <> 'BYE')
          AND (m.player_b_id IS NULL OR m.player_b_id::TEXT <> 'BYE')
          AND (m.player_a2_id IS NULL OR m.player_a2_id::TEXT <> 'BYE')
          AND (m.player_b2_id IS NULL OR m.player_b2_id::TEXT <> 'BYE'))
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
            SELECT pa.rank, pa.trophies INTO curr_rank_int, trophies
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
                FOR month_idx IN 0..11 LOOP
                    snap_time := make_timestamptz(yr, month_idx + 1, 1, 0, 0, 0, 'UTC');
                    SELECT COALESCE(ARRAY_AGG(id), '{}'::UUID[]) INTO snap_tourney_ids
                    FROM tournaments
                    WHERE organization_id = p_org_id
                      AND level = p_level
                      AND modality = p_modality
                      AND is_tournament_master = FALSE
                      AND status IN ('completed', 'finalized', 'finished')
                      AND COALESCE(end_date, start_date, created_at) < snap_time;

                    IF array_length(snap_tourney_ids, 1) > 0 THEN
                        SELECT r.rank INTO snap_rank
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
            SELECT UNNEST(ARRAY[m.player_b_id, m.player_b2_id]) AS rival_id
            FROM matches m
            WHERE m.tournament_id = ANY(selected_tournament_ids)
              AND (m.player_a_id = p_player_id OR m.player_a2_id = p_player_id)
              AND (m.player_a_id IS NULL OR m.player_a_id::TEXT <> 'BYE')
              AND (m.player_b_id IS NULL OR m.player_b_id::TEXT <> 'BYE')
              AND (m.player_a2_id IS NULL OR m.player_a2_id::TEXT <> 'BYE')
              AND (m.player_b2_id IS NULL OR m.player_b2_id::TEXT <> 'BYE')
            UNION ALL
            SELECT UNNEST(ARRAY[m.player_a_id, m.player_a2_id]) AS rival_id
            FROM matches m
            WHERE m.tournament_id = ANY(selected_tournament_ids)
              AND (m.player_b_id = p_player_id OR m.player_b2_id = p_player_id)
              AND (m.player_a_id IS NULL OR m.player_a_id::TEXT <> 'BYE')
              AND (m.player_b_id IS NULL OR m.player_b_id::TEXT <> 'BYE')
              AND (m.player_a2_id IS NULL OR m.player_a2_id::TEXT <> 'BYE')
              AND (m.player_b2_id IS NULL OR m.player_b2_id::TEXT <> 'BYE')
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
        FOR month_idx IN 0..11 LOOP
            IF effective_year > EXTRACT(YEAR FROM NOW())::INT OR
               (effective_year = EXTRACT(YEAR FROM NOW())::INT AND month_idx > EXTRACT(MONTH FROM NOW())::INT) THEN
                ranking_history := ranking_history || jsonb_build_object(
                    'month', month_idx,
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
                  AND COALESCE(end_date, start_date, created_at) < make_timestamptz(effective_year, month_idx + 1, 1, 0, 0, 0, 'UTC');

                month_rank := NULL;
                IF array_length(month_tournament_ids, 1) > 0 THEN
                    SELECT r.rank INTO month_rank
                    FROM build_ranking(month_tournament_ids) r
                    WHERE r.player_id = p_player_id AND (r.points > 0 OR r.matches_played > 0);
                END IF;

                IF p_modality = 'singles' THEN
                    ranking_history := ranking_history || jsonb_build_object(
                        'month', month_idx,
                        'singlesRank', month_rank,
                        'doblesRank', NULL
                    );
                ELSE
                    ranking_history := ranking_history || jsonb_build_object(
                        'month', month_idx,
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
$function$;
