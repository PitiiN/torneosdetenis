import { supabase } from './supabase';

export const paymentsService = {
    getStudentSummary: (studentId: string) =>
        supabase.rpc('get_student_payment_summary', { p_student_id: studentId }),

    getStudentPayments: (studentId: string) =>
        supabase.from('payments')
            .select(`*, classes (title, start_datetime)`)
            .eq('student_id', studentId)
            .order('created_at', { ascending: false }),

    getAllPayments: (status?: string) => {
        let query = supabase.from('payments')
            .select(`*, profiles!payments_student_id_fkey (full_name, email), classes (title)`);
        if (status) query = query.eq('status', status);
        return query.order('created_at', { ascending: false });
    },

    markAsPaid: (paymentId: string, method: string, reference?: string) =>
        supabase.from('payments').update({
            status: 'paid',
            payment_method: method,
            payment_reference: reference,
            paid_at: new Date().toISOString(),
        }).eq('id', paymentId),

    markAsOverdue: (paymentId: string) =>
        supabase.from('payments').update({ status: 'overdue' }).eq('id', paymentId),
};
