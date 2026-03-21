import { supabase } from './supabase';

export const classesService = {
    getClassesInRange: (startDate: string, endDate: string, studentId?: string) =>
        supabase.rpc('get_available_classes', {
            p_start_date: startDate,
            p_end_date: endDate,
            p_student_id: studentId || null,
        }),

    getClassById: (id: string) =>
        supabase.from('classes_with_availability').select('*').eq('id', id).single(),

    createClass: (data: any) =>
        supabase.from('classes').insert(data).select().single(),

    updateClass: (id: string, data: any) =>
        supabase.from('classes').update(data).eq('id', id).select().single(),

    cancelClass: (id: string, reason: string) =>
        supabase.from('classes').update({
            status: 'cancelled',
            cancellation_reason: reason,
        }).eq('id', id),

    getAllClasses: () =>
        supabase.from('classes_with_availability')
            .select('*')
            .order('start_datetime', { ascending: true }),

    deleteClass: (id: string) =>
        supabase.from('classes').delete().eq('id', id),
};
