-- 4. Redefine get_player_profile_stats without set-returning functions in CASE
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
            END If;
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
            UNION ALL
            SELECT UNNEST(ARRAY[m.player_a_id, m.player_a2_id]) AS rival_id
            FROM matches m
            WHERE m.tournament_id = ANY(selected_tournament_ids)
              AND (m.player_b_id = p_player_id OR m.player_b2_id = p_player_id)
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
                    SELECT r.computed_rank INTO month_rank
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
$$ LANGUAGE plpgsql STABLE;
