import { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type AccessProfile = {
    id: string;
    role: string | null;
    org_id: string | null;
    admin_org_ids?: string[] | null;
    is_super_admin?: boolean | null;
};

export type UserAccessContext = {
    session: Session;
    profile: AccessProfile;
    isSuperAdmin: boolean;
    isAdmin: boolean;
};

const PROFILE_SELECT_WITH_SUPER = 'id, role, org_id, is_super_admin';
const PROFILE_SELECT_FALLBACK = 'id, role, org_id';
const DEFAULT_PROFILE_NAME = 'Jugador';
const SUPER_ADMIN_EMAIL_ALLOWLIST = new Set(['javier.aravena25@gmail.com']);

const normalizeBoolean = (value: unknown) => value === true;
const normalizeEmail = (value: unknown) => String(value || '').trim().toLowerCase();

const inferSuperAdminFromLegacyProfile = (profile: AccessProfile | null) => {
    if (!profile) return false;
    return profile.role === 'super_admin';
};

const buildCandidateProfileName = (session: Session) => {
    const metadata = (session.user.user_metadata || {}) as Record<string, unknown>;
    const joinedFirstLast = [metadata.first_name, metadata.last_name]
        .map((value) => String(value || '').trim())
        .filter(Boolean)
        .join(' ');

    const options = [
        metadata.name,
        metadata.full_name,
        metadata.display_name,
        joinedFirstLast,
        session.user.email ? String(session.user.email).split('@')[0] : '',
    ]
        .map((value) => String(value || '').trim())
        .filter(Boolean);

    const selected = options[0] || DEFAULT_PROFILE_NAME;
    return selected.slice(0, 80);
};

async function bootstrapMissingProfile(session: Session) {
    const basePayload = {
        id: session.user.id,
        role: 'player',
        org_id: null,
        is_super_admin: false,
        notifications_enabled: true,
    };

    const withName = {
        ...basePayload,
        name: buildCandidateProfileName(session),
    };

    const withNameInsert = await supabase
        .from('profiles')
        .upsert([withName], { onConflict: 'id', ignoreDuplicates: true });

    if (!withNameInsert.error) {
        return;
    }

    // Legacy fallback: some databases may not have "name" in profiles.
    await supabase
        .from('profiles')
        .upsert([basePayload], { onConflict: 'id', ignoreDuplicates: true });
}

async function fetchAccessProfile(userId: string): Promise<AccessProfile | null> {
    const withSuperAdmin = await supabase
        .from('profiles')
        .select(PROFILE_SELECT_WITH_SUPER)
        .eq('id', userId)
        .single();

    let profile: AccessProfile | null = null;

    if (!withSuperAdmin.error) {
        profile = withSuperAdmin.data as AccessProfile;
    } else {
        const fallback = await supabase
            .from('profiles')
            .select(PROFILE_SELECT_FALLBACK)
            .eq('id', userId)
            .single();

        if (!fallback.error) {
            profile = fallback.data as AccessProfile;
        }
    }

    if (!profile) return null;

    // Fetch administered organizations
    const { data: adminOrgs, error: adminOrgsError } = await supabase
        .from('organization_admins')
        .select('org_id')
        .eq('user_id', userId);

    profile.admin_org_ids = adminOrgs && !adminOrgsError
        ? adminOrgs.map((row: any) => row.org_id)
        : [];

    return profile;
}

export async function getCurrentUserAccessContext(): Promise<UserAccessContext | null> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) return null;

    let profile = await fetchAccessProfile(session.user.id);
    if (!profile) {
        await bootstrapMissingProfile(session);
        profile = await fetchAccessProfile(session.user.id);
    }
    if (!profile) return null;

    const sessionEmail = normalizeEmail(session.user.email);
    const isAllowedSuperAdminEmail = SUPER_ADMIN_EMAIL_ALLOWLIST.has(sessionEmail);
    const hasExplicitSuperAdmin = normalizeBoolean(profile.is_super_admin);
    const isSuperAdmin = isAllowedSuperAdminEmail && (hasExplicitSuperAdmin || inferSuperAdminFromLegacyProfile(profile));
    const hasOrganizationScopedAdminRole =
        (profile.role === 'admin' || profile.role === 'organizer') &&
        (Boolean(profile.org_id) || Boolean(profile.admin_org_ids && profile.admin_org_ids.length > 0));
    const isAdmin = isSuperAdmin || hasOrganizationScopedAdminRole;

    return {
        session,
        profile,
        isSuperAdmin,
        isAdmin,
    };
}

export function canManageOrganization(
    context: UserAccessContext | null,
    organizationId?: string | null
) {
    if (!context || !organizationId) return false;
    if (context.isSuperAdmin) return true;
    return (context.profile.role === 'admin' || context.profile.role === 'organizer') &&
        Array.isArray(context.profile.admin_org_ids) &&
        context.profile.admin_org_ids.includes(organizationId);
}

export function canAccessAdminArea(context: UserAccessContext | null) {
    return Boolean(context?.isAdmin);
}

