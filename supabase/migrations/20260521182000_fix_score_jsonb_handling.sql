-- Create helper function to safely extract and format score text from jsonb
CREATE OR REPLACE FUNCTION get_score_text(p_score JSONB)
RETURNS TEXT AS $$
DECLARE
    v_type TEXT;
    v_wo BOOLEAN;
    v_text TEXT;
    v_score TEXT;
    v_sets JSONB;
    v_set TEXT;
    v_sets_arr TEXT[] := '{}'::TEXT[];
BEGIN
    IF p_score IS NULL THEN
        RETURN '';
    END IF;

    v_type := jsonb_typeof(p_score);

    IF v_type = 'string' THEN
        RETURN TRIM(p_score#>>'{}');
    ELSIF v_type = 'object' THEN
        -- Check if it is {wo: true}
        IF p_score->'wo' IS NOT NULL THEN
            BEGIN
                v_wo := (p_score->>'wo')::BOOLEAN;
                IF v_wo = TRUE THEN
                    RETURN 'W.O.';
                END IF;
            EXCEPTION WHEN OTHERS THEN
                -- Ignore boolean parsing error
            END;
        END IF;

        -- Check if it is {text: ...}
        v_text := p_score->>'text';
        IF v_text IS NOT NULL THEN
            RETURN TRIM(v_text);
        END IF;

        -- Check if it is {score: ...}
        v_score := p_score->>'score';
        IF v_score IS NOT NULL THEN
            RETURN TRIM(v_score);
        END IF;

        -- Check if it is {sets: [...]}
        v_sets := p_score->'sets';
        IF v_sets IS NOT NULL AND jsonb_typeof(v_sets) = 'array' THEN
            FOR v_set IN SELECT jsonb_array_elements_text(v_sets) LOOP
                IF TRIM(v_set) <> '' THEN
                    v_sets_arr := array_append(v_sets_arr, TRIM(v_set));
                END IF;
            END LOOP;
            RETURN array_to_string(v_sets_arr, ', ');
        END IF;

        RETURN '';
    ELSE
        RETURN '';
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;


-- 1. Redefine resolve_match_winner_side using get_score_text
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

    score_text := get_score_text(p_match.score);
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


-- 2. Redefine get_player_match_stats using get_score_text
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

    score_text := get_score_text(p_match.score);
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
$$ LANGUAGE plpgsql IMMUTABLE;


-- 3. Redefine get_player_achievements using get_score_text and score_text
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
        SELECT m.id, m.scheduled_at, m.created_at, get_score_text(m.score) AS score_text, t.name AS tournament_name, t.start_date,
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
            IF match_rec.score_text LIKE '%-%' THEN
                DECLARE
                    set_parts TEXT[] := string_to_array(match_rec.score_text, ',');
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
        IF bombardero_dt IS NULL AND match_rec.score_text LIKE '%6-0%' THEN
            bombardero_dt := COALESCE(match_rec.scheduled_at, match_rec.created_at);
        END IF;

        -- 3. No estoy ni ahi (6-0, 6-0 or similar without ceding games)
        IF match_rec.is_winner AND no_estoy_ni_ahi_dt IS NULL THEN
            IF match_rec.score_text LIKE '%6-0, 6-0%' OR match_rec.score_text LIKE '%6-0, 6-0, 6-0%' THEN
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

