-- Migration: Add matchDetail and tournamentName metadata to achievements
-- Date: 2026-07-15

CREATE OR REPLACE FUNCTION public.get_player_achievements(p_player_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
AS $function$
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

    -- Milestone details
    first_win_match_detail TEXT := NULL;
    win_10_match_detail TEXT := NULL;
    win_25_match_detail TEXT := NULL;
    win_50_match_detail TEXT := NULL;
    win_100_match_detail TEXT := NULL;
    win_150_match_detail TEXT := NULL;
    win_200_match_detail TEXT := NULL;
    win_250_match_detail TEXT := NULL;
    
    streak_5_match_detail TEXT := NULL;
    streak_10_match_detail TEXT := NULL;
    streak_15_match_detail TEXT := NULL;
    streak_20_match_detail TEXT := NULL;
    streak_30_match_detail TEXT := NULL;
    streak_40_match_detail TEXT := NULL;
    streak_50_match_detail TEXT := NULL;
    
    nada_imposible_match_detail TEXT := NULL;
    bombardero_match_detail TEXT := NULL;
    no_estoy_ni_ahi_match_detail TEXT := NULL;

    undefeated_tournament_name TEXT := NULL;
    no_sets_lost_tournament_name TEXT := NULL;
    no_games_lost_tournament_name TEXT := NULL;
    dios_del_tenis_tournament_name TEXT := NULL;
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
               stats.is_winner, stats.sets_won, stats.sets_lost, stats.games_won, stats.games_lost,
               m.player_a_id, m.player_a2_id, m.player_b_id, m.player_b2_id
        FROM matches m
        JOIN tournaments t ON t.id = m.tournament_id
        CROSS JOIN LATERAL get_player_match_stats(m, p_player_id) stats
        WHERE m.status = 'finished'
          AND (m.player_a_id = p_player_id OR m.player_a2_id = p_player_id OR m.player_b_id = p_player_id OR m.player_b2_id = p_player_id)
          AND COALESCE(m.is_bye, FALSE) = FALSE
        ORDER BY COALESCE(m.scheduled_at, t.start_date, m.created_at) ASC
    ) LOOP
        -- Resolve match names
        DECLARE
            v_rival_name TEXT := '';
            v_partner_name TEXT := '';
            v_match_info TEXT := '';
        BEGIN
            IF match_rec.player_a_id = p_player_id OR match_rec.player_a2_id = p_player_id THEN
                SELECT COALESCE(string_agg(name, ' / '), 'TBD') INTO v_rival_name
                FROM public_profiles
                WHERE id IN (match_rec.player_b_id, match_rec.player_b2_id);

                IF match_rec.player_a2_id IS NOT NULL THEN
                    SELECT name INTO v_partner_name
                    FROM public_profiles
                    WHERE id = CASE WHEN match_rec.player_a_id = p_player_id THEN match_rec.player_a2_id ELSE match_rec.player_a_id END;
                END IF;
            ELSE
                SELECT COALESCE(string_agg(name, ' / '), 'TBD') INTO v_rival_name
                FROM public_profiles
                WHERE id IN (match_rec.player_a_id, match_rec.player_a2_id);

                IF match_rec.player_b2_id IS NOT NULL THEN
                    SELECT name INTO v_partner_name
                    FROM public_profiles
                    WHERE id = CASE WHEN match_rec.player_b_id = p_player_id THEN match_rec.player_b2_id ELSE match_rec.player_b_id END;
                END IF;
            END IF;

            v_match_info := 'VS ' || v_rival_name;
            IF v_partner_name <> '' THEN
                v_match_info := 'Con ' || v_partner_name || ' ' || v_match_info;
            END IF;
            IF match_rec.score_text IS NOT NULL AND match_rec.score_text <> '' THEN
                v_match_info := v_match_info || ' (' || match_rec.score_text || ')';
            END IF;
            v_match_info := v_match_info || ' en ' || match_rec.tournament_name;

            -- Wins
            IF match_rec.is_winner THEN
                total_wins := total_wins + 1;
                
                -- Milestones
                IF total_wins = 1 THEN
                    first_win_match_detail := v_match_info;
                    achievements := achievements || jsonb_build_object(
                        'id', 'first-win',
                        'title', 'Primer triunfo',
                        'detail', match_rec.tournament_name,
                        'icon', 'tennisball',
                        'tone', 'gold',
                        'imageName', 'PrimerTriunfo.png',
                        'dateEarned', COALESCE(match_rec.scheduled_at, match_rec.created_at),
                        'matchDetail', first_win_match_detail
                    );
                ELSIF total_wins = 10 THEN
                    win_trigger_match_10 := COALESCE(match_rec.scheduled_at, match_rec.created_at);
                    win_10_match_detail := v_match_info;
                ELSIF total_wins = 25 THEN
                    win_trigger_match_25 := COALESCE(match_rec.scheduled_at, match_rec.created_at);
                    win_25_match_detail := v_match_info;
                ELSIF total_wins = 50 THEN
                    win_trigger_match_50 := COALESCE(match_rec.scheduled_at, match_rec.created_at);
                    win_50_match_detail := v_match_info;
                ELSIF total_wins = 100 THEN
                    win_trigger_match_100 := COALESCE(match_rec.scheduled_at, match_rec.created_at);
                    win_100_match_detail := v_match_info;
                ELSIF total_wins = 150 THEN
                    win_trigger_match_150 := COALESCE(match_rec.scheduled_at, match_rec.created_at);
                    win_150_match_detail := v_match_info;
                ELSIF total_wins = 200 THEN
                    win_trigger_match_200 := COALESCE(match_rec.scheduled_at, match_rec.created_at);
                    win_200_match_detail := v_match_info;
                ELSIF total_wins = 250 THEN
                    win_trigger_match_250 := COALESCE(match_rec.scheduled_at, match_rec.created_at);
                    win_250_match_detail := v_match_info;
                END IF;

                -- Streaks
                curr_streak := curr_streak + 1;
                IF curr_streak = 5 THEN
                    streak_trigger_5 := COALESCE(match_rec.scheduled_at, match_rec.created_at);
                    streak_5_match_detail := v_match_info;
                ELSIF curr_streak = 10 THEN
                    streak_trigger_10 := COALESCE(match_rec.scheduled_at, match_rec.created_at);
                    streak_10_match_detail := v_match_info;
                ELSIF curr_streak = 15 THEN
                    streak_trigger_15 := COALESCE(match_rec.scheduled_at, match_rec.created_at);
                    streak_15_match_detail := v_match_info;
                ELSIF curr_streak = 20 THEN
                    streak_trigger_20 := COALESCE(match_rec.scheduled_at, match_rec.created_at);
                    streak_20_match_detail := v_match_info;
                ELSIF curr_streak = 30 THEN
                    streak_trigger_30 := COALESCE(match_rec.scheduled_at, match_rec.created_at);
                    streak_30_match_detail := v_match_info;
                ELSIF curr_streak = 40 THEN
                    streak_trigger_40 := COALESCE(match_rec.scheduled_at, match_rec.created_at);
                    streak_40_match_detail := v_match_info;
                ELSIF curr_streak = 50 THEN
                    streak_trigger_50 := COALESCE(match_rec.scheduled_at, match_rec.created_at);
                    streak_50_match_detail := v_match_info;
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
                IF match_rec.score_text LIKE '%-%' THEN
                    DECLARE
                        set_parts TEXT[] := string_to_array(match_rec.score_text, ',');
                    BEGIN
                        IF array_length(set_parts, 1) = 3 THEN
                            DECLARE
                                first_parsed RECORD;
                            BEGIN
                                SELECT * INTO first_parsed FROM parse_set_score(set_parts[1]);
                                IF first_parsed IS NOT NULL AND first_parsed.leftValue < first_parsed.rightValue THEN
                                    nada_imposible_dt := COALESCE(match_rec.scheduled_at, match_rec.created_at);
                                    nada_imposible_match_detail := v_match_info;
                                END IF;
                            END;
                        END IF;
                    END;
                END IF;
            END IF;

            -- 2. Bombardero (6-0 set won)
            IF bombardero_dt IS NULL AND match_rec.score_text LIKE '%6-0%' THEN
                bombardero_dt := COALESCE(match_rec.scheduled_at, match_rec.created_at);
                bombardero_match_detail := v_match_info;
            END IF;

            -- 3. No estoy ni ahi (6-0, 6-0 or similar without ceding games)
            IF match_rec.is_winner AND no_estoy_ni_ahi_dt IS NULL THEN
                IF match_rec.score_text LIKE '%6-0, 6-0%' OR match_rec.score_text LIKE '%6-0, 6-0, 6-0%' THEN
                    no_estoy_ni_ahi_dt := COALESCE(match_rec.scheduled_at, match_rec.created_at);
                    no_estoy_ni_ahi_match_detail := v_match_info;
                END IF;
            END IF;
        END;
    END LOOP;

    -- Append Wins Achievements
    IF win_trigger_match_10 IS NOT NULL THEN
        achievements := achievements || jsonb_build_object('id', 'wins-10', 'title', '10 Triunfos', 'detail', '10 partidos ganados en total', 'icon', 'medal', 'tone', 'bronze', 'imageName', '10Triunfos.png', 'dateEarned', win_trigger_match_10, 'matchDetail', win_10_match_detail);
    END IF;
    IF win_trigger_match_25 IS NOT NULL THEN
        achievements := achievements || jsonb_build_object('id', 'wins-25', 'title', '25 Triunfos', 'detail', '25 partidos ganados en total', 'icon', 'medal', 'tone', 'silver', 'imageName', '25Triunfos.png', 'dateEarned', win_trigger_match_25, 'matchDetail', win_25_match_detail);
    END IF;
    IF win_trigger_match_50 IS NOT NULL THEN
        achievements := achievements || jsonb_build_object('id', 'wins-50', 'title', '50 Triunfos', 'detail', '50 partidos ganados en total', 'icon', 'trophy', 'tone', 'gold', 'imageName', '50Triunfos.png', 'dateEarned', win_trigger_match_50, 'matchDetail', win_50_match_detail);
    END IF;
    IF win_trigger_match_100 IS NOT NULL THEN
        achievements := achievements || jsonb_build_object('id', 'wins-100', 'title', '100 Triunfos', 'detail', '100 partidos ganados en total', 'icon', 'trophy', 'tone', 'gold', 'imageName', '100Triunfos.png', 'dateEarned', win_trigger_match_100, 'matchDetail', win_100_match_detail);
    END IF;
    IF win_trigger_match_150 IS NOT NULL THEN
        achievements := achievements || jsonb_build_object('id', 'wins-150', 'title', '150 Triunfos', 'detail', '150 partidos ganados en total', 'icon', 'trophy', 'tone', 'gold', 'imageName', '150Triunfos.png', 'dateEarned', win_trigger_match_150, 'matchDetail', win_150_match_detail);
    END IF;
    IF win_trigger_match_200 IS NOT NULL THEN
        achievements := achievements || jsonb_build_object('id', 'wins-200', 'title', '200 Triunfos', 'detail', '200 partidos ganados en total', 'icon', 'trophy', 'tone', 'gold', 'imageName', '200Triunfos.png', 'dateEarned', win_trigger_match_200, 'matchDetail', win_200_match_detail);
    END IF;
    IF win_trigger_match_250 IS NOT NULL THEN
        achievements := achievements || jsonb_build_object('id', 'wins-250', 'title', '250 Triunfos', 'detail', '250 partidos ganados en total', 'icon', 'trophy', 'tone', 'gold', 'imageName', '250Triunfos.png', 'dateEarned', win_trigger_match_250, 'matchDetail', win_250_match_detail);
    END IF;

    -- Append Streaks Achievements
    IF streak_trigger_5 IS NOT NULL THEN
        achievements := achievements || jsonb_build_object('id', 'streak-5', 'title', 'Racha de 5 victorias', 'detail', max_streak || ' victorias consecutivas', 'icon', 'tennisball', 'tone', 'bronze', 'imageName', 'Racha5Victorias.png', 'dateEarned', streak_trigger_5, 'matchDetail', streak_5_match_detail);
    END IF;
    IF streak_trigger_10 IS NOT NULL THEN
        achievements := achievements || jsonb_build_object('id', 'streak-10', 'title', 'Racha de 10 victorias', 'detail', max_streak || ' victorias consecutivas', 'icon', 'tennisball', 'tone', 'silver', 'imageName', 'Racha10Victorias.png', 'dateEarned', streak_trigger_10, 'matchDetail', streak_10_match_detail);
    END IF;
    IF streak_trigger_15 IS NOT NULL THEN
        achievements := achievements || jsonb_build_object('id', 'streak-15', 'title', 'Racha de 15 victorias', 'detail', max_streak || ' victorias consecutivas', 'icon', 'tennisball', 'tone', 'gold', 'imageName', 'Racha15Victorias.png', 'dateEarned', streak_trigger_15, 'matchDetail', streak_15_match_detail);
    END IF;
    IF streak_trigger_20 IS NOT NULL THEN
        achievements := achievements || jsonb_build_object('id', 'streak-20', 'title', 'Racha de 20 victorias', 'detail', max_streak || ' victorias consecutivas', 'icon', 'tennisball', 'tone', 'gold', 'imageName', 'Racha20Victorias.png', 'dateEarned', streak_trigger_20, 'matchDetail', streak_20_match_detail);
    END IF;
    IF streak_trigger_30 IS NOT NULL THEN
        achievements := achievements || jsonb_build_object('id', 'streak-30', 'title', 'Racha de 30 victorias', 'detail', max_streak || ' victorias consecutivas', 'icon', 'tennisball', 'tone', 'gold', 'imageName', 'Racha30Victorias.png', 'dateEarned', streak_trigger_30, 'matchDetail', streak_30_match_detail);
    END IF;
    IF streak_trigger_40 IS NOT NULL THEN
        achievements := achievements || jsonb_build_object('id', 'streak-40', 'title', 'Racha de 40 victorias', 'detail', max_streak || ' victorias consecutivas', 'icon', 'tennisball', 'tone', 'gold', 'imageName', 'Racha40Victorias.png', 'dateEarned', streak_trigger_40, 'matchDetail', streak_40_match_detail);
    END IF;
    IF streak_trigger_50 IS NOT NULL THEN
        achievements := achievements || jsonb_build_object('id', 'streak-50', 'title', 'Racha de 50 victorias', 'detail', max_streak || ' victorias consecutivas', 'icon', 'tennisball', 'tone', 'gold', 'imageName', 'Racha50Victorias.png', 'dateEarned', streak_trigger_50, 'matchDetail', streak_50_match_detail);
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
                      AND (m.player_a_id = p_player_id OR m.player_a2_id = p_player_id OR m.player_b_id = p_player_id OR m.player_b2_id = p_player_id)
                      AND COALESCE(m.is_bye, FALSE) = FALSE;

                    IF t_matches_played > 0 THEN
                        IF t_matches_won = t_matches_played THEN 
                            has_undefeated := TRUE; 
                            undefeated_tournament_name := t_rec.name;
                        END IF;
                        IF t_sets_lost = 0 THEN 
                            has_no_sets_lost := TRUE; 
                            no_sets_lost_tournament_name := t_rec.name;
                        END IF;
                        IF t_games_lost = 0 THEN 
                            has_no_games_lost := TRUE; 
                            no_games_lost_tournament_name := t_rec.name;
                        END IF;
                        IF t_matches_won = t_matches_played AND t_sets_lost = 0 AND t_games_lost = 0 THEN
                            dios_del_tenis_tournament_name := t_rec.name;
                        END IF;
                    END IF;
                END;
            END IF;
        END;
    END LOOP;

    -- Append Champion details
    IF has_undefeated THEN
        achievements := achievements || jsonb_build_object('id', 'undefeated-champion', 'title', 'Campeón invicto', 'detail', 'Título ganado sin perder partidos', 'icon', 'trophy', 'tone', 'gold', 'imageName', 'CampeónInvicto.png', 'dateEarned', latest_champ_dt, 'tournamentName', undefeated_tournament_name);
    END IF;
    IF has_no_sets_lost THEN
        achievements := achievements || jsonb_build_object('id', 'no-set-lost-champion', 'title', 'Campeón sin ceder sets', 'detail', 'Título ganado sin perder sets', 'icon', 'ribbon', 'tone', 'silver', 'imageName', 'CampeonSinCederSets.png', 'dateEarned', latest_champ_dt, 'tournamentName', no_sets_lost_tournament_name);
    END IF;
    IF has_no_games_lost THEN
        achievements := achievements || jsonb_build_object('id', 'no-game-lost-champion', 'title', 'Campeón sin ceder games', 'detail', 'Título ganado sin perder games', 'icon', 'medal', 'tone', 'gold', 'imageName', 'CampeonSinCederGames.png', 'dateEarned', latest_champ_dt, 'tournamentName', no_games_lost_tournament_name);
    END IF;
    IF has_undefeated AND has_no_sets_lost AND has_no_games_lost THEN
        achievements := achievements || jsonb_build_object('id', 'dios-del-tenis', 'title', 'Dios del Tenis', 'detail', 'Campeón invicto, sin perder sets y sin ceder games', 'icon', 'star', 'tone', 'gold', 'imageName', 'DiosDelTenis.png', 'dateEarned', latest_champ_dt, 'tournamentName', dios_del_tenis_tournament_name);
    END IF;

    -- Special matches achievements
    IF nada_imposible_dt IS NOT NULL THEN
        achievements := achievements || jsonb_build_object('id', 'nada-es-imposible', 'title', 'Nada es imposible weon! Ni una wea!', 'detail', 'Ganar un partido de 3 sets habiendo perdido el primer set', 'icon', 'star', 'tone', 'gold', 'imageName', 'NadaEsImposible.png', 'dateEarned', nada_imposible_dt, 'matchDetail', nada_imposible_match_detail);
    END IF;
    IF bombardero_dt IS NOT NULL THEN
        achievements := achievements || jsonb_build_object('id', 'bombardero', 'title', 'Bombardero', 'detail', 'Ganar un set 6-0', 'icon', 'tennisball', 'tone', 'gold', 'imageName', 'Bombardero.png', 'dateEarned', bombardero_dt, 'matchDetail', bombardero_match_detail);
    END IF;
    IF no_estoy_ni_ahi_dt IS NOT NULL THEN
        achievements := achievements || jsonb_build_object('id', 'no-estoy-ni-ahi', 'title', 'No estoy ni ahí', 'detail', 'Ganar un partido de 3 o 5 sets sin perder ningún game', 'icon', 'star', 'tone', 'gold', 'imageName', 'NoEstoyNiAhi.png', 'dateEarned', no_estoy_ni_ahi_dt, 'matchDetail', no_estoy_ni_ahi_match_detail);
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
$function$;
