-- Migration: Fix tiebreak score parsing in match stats and winner side resolution
-- Date: 2026-07-08

-- 1. Redefine parse_set_score to cleanly ignore tiebreak markers in parentheses or brackets
CREATE OR REPLACE FUNCTION public.parse_set_score(set_score text)
 RETURNS TABLE(leftvalue integer, rightvalue integer)
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
DECLARE
    set_score_norm TEXT;
    parts TEXT[];
BEGIN
    -- Strip parenthesized/bracketed details (e.g. tiebreak values)
    set_score_norm := REGEXP_REPLACE(set_score, '\([^)]*\)|\[[^\]]*\]', '', 'g');
    -- Strip non-digit and non-hyphen chars
    set_score_norm := REGEXP_REPLACE(set_score_norm, '[^\d-]', '', 'g');
    parts := string_to_array(TRIM(set_score_norm), '-');
    IF array_length(parts, 1) = 2 THEN
        RETURN QUERY SELECT parts[1]::INT, parts[2]::INT;
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Return nothing on parsing error
END;
$function$;

-- 2. Redefine resolve_match_winner_side to cleanly ignore tiebreak markers in parentheses or brackets
CREATE OR REPLACE FUNCTION public.resolve_match_winner_side(p_match public.matches)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
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
        -- Strip parenthesized/bracketed details (e.g. tiebreak values)
        set_score := REGEXP_REPLACE(set_score, '\([^)]*\)|\[[^\]]*\]', '', 'g');
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
$function$;

-- 3. Redefine get_player_match_stats to cleanly ignore tiebreak markers in parentheses or brackets
CREATE OR REPLACE FUNCTION public.get_player_match_stats(p_match public.matches, p_player_id uuid)
 RETURNS TABLE(sets_won integer, sets_lost integer, games_won integer, games_lost integer, is_winner boolean)
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
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
            -- Strip parenthesized/bracketed details (e.g. tiebreak values)
            set_score := REGEXP_REPLACE(set_score, '\([^)]*\)|\[[^\]]*\]', '', 'g');
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

    RETURN QUERY SELECT s_won, s_lost, g_won, g_lost, (winner_side = player_side);
END;
$function$;
