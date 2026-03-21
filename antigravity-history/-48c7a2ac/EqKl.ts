/**
 * lib/permissions.ts
 * Helper functions to check permissions based on user role.
 */

export type Role = 'admin' | 'staff' | 'user';

export const PERMISSIONS = {
    MANAGE_PRODUCT: ['admin'],
    MANAGE_USERS: ['admin'],
    OPERATE_MATCHES: ['admin', 'staff'],
    VIEW_REPORTS: ['admin'],
    PARTICIPATE: ['admin', 'staff', 'user'],
};

export function hasPermission(role: Role, action: keyof typeof PERMISSIONS): boolean {
    if (!role) return false;
    return PERMISSIONS[action].includes(role);
}
