import { supabase } from './supabase';

export async function logAuditAction(productId: string | null, action: string, entityType: string, entityId: string | null = null, metadata: any = {}) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    await supabase.from('audit_logs').insert([{
        product_id: productId,
        actor_user_id: session.user.id,
        action,
        entity_type: entityType,
        entity_id: entityId,
        metadata
    }]);
}
