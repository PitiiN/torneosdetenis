import { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type AccessProfile = {
    id: string;
    role: string | null;
    org_id: string | null;
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

const normalizeBoolean = (value: unknown) => value === true;

const inferSuperAdminFromLegacyProfile = (profile: AccessProfile | null) => {
    if (!profile) return false;
    return profile.role === 'super_admin' || (profile.role === 'admin' && !profile.org_id);
};

async function fetchAccessProfile(userId: string): Promise<AccessProfile | null> {
    const withSuperAdmin = await supabase
        .from('profiles')
        .select(PROFILE_SELECT_WITH_SUPER)
        .eq('id', userId)
        .single();

    if (!withSuperAdmin.error) {
        return withSuperAdmin.data as AccessProfile;
    }

    const fallback = await supabase
        .from('profiles')
        .select(PROFILE_SELECT_FALLBACK)
        .eq('id', userId)
        .single();

    if (fallback.error) {
        return null;
    }

    return fallback.data as AccessProfile;
}

export async function getCurrentUserAccessContext(): Promise<UserAccessContext | null> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) return null;

    const profile = await fetchAccessProfile(session.user.id);
    if (!profile) return null;

    const hasExplicitSuperAdmin = normalizeBoolean(profile.is_super_admin);
    const isSuperAdmin = hasExplicitSuperAdmin || inferSuperAdminFromLegacyProfile(profile);
    const isAdmin = isSuperAdmin || profile.role === 'admin' || profile.role === 'organizer';

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
        context.profile.org_id === organizationId;
}

export function canAccessAdminArea(context: UserAccessContext | null) {
    return Boolean(context?.isAdmin);
}

