
-- Create a function to delete an organization and all its associated data
CREATE OR REPLACE FUNCTION delete_organization_cascade(p_organization_id UUID)
RETURNS VOID AS $$
DECLARE
    v_tournament_ids UUID[];
BEGIN
    -- 1. Check if the current user is super admin
    IF NOT public.current_user_is_super_admin() THEN
        RAISE EXCEPTION 'Solo super administradores pueden eliminar organizaciones';
    END IF;

    -- 2. Get all tournament IDs for this organization
    SELECT ARRAY_AGG(id) INTO v_tournament_ids
    FROM public.tournaments
    WHERE organization_id = p_organization_id;

    -- 3. Delete dependent data that might not cascade automatically
    IF v_tournament_ids IS NOT NULL THEN
        -- Delete payment proofs associated with registrations of these tournaments
        DELETE FROM public.payment_proofs
        WHERE registration_id IN (
            SELECT id FROM public.registrations WHERE tournament_id = ANY(v_tournament_ids)
        );

        -- Delete from tournaments
        -- (This handles CASCADE for matches, registrations, etc. if they are configured)
        -- We delete them manually just in case some constraints are RESTRICT
        DELETE FROM public.tournaments WHERE organization_id = p_organization_id;
    END IF;

    -- 4. Delete registration requests for this org (directly linked)
    DELETE FROM public.tournament_registration_requests WHERE organization_id = p_organization_id;

    -- 5. Finally delete the organization
    DELETE FROM public.organizations WHERE id = p_organization_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.delete_organization_cascade(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_organization_cascade(UUID) TO service_role;
