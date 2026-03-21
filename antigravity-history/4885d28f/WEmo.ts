import { supabase } from './supabase';

export const notificationsService = {
    getUserNotifications: (userId: string) =>
        supabase.from('notifications')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(50),

    markAsRead: (notificationId: string) =>
        supabase.from('notifications').update({
            is_read: true,
            read_at: new Date().toISOString(),
        }).eq('id', notificationId),

    markAllRead: (userId: string) =>
        supabase.from('notifications').update({
            is_read: true,
            read_at: new Date().toISOString(),
        }).eq('user_id', userId).eq('is_read', false),

    createNotification: (userId: string, title: string, body: string, type: string, data?: any) =>
        supabase.from('notifications').insert({
            user_id: userId,
            title,
            body,
            type,
            data: data || {},
        }),

    getUnreadCount: async (userId: string) => {
        const { count } = await supabase
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('is_read', false);
        return count || 0;
    },
};
