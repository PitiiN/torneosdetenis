import { supabase } from './supabase';

export const enrollmentsService = {
    enroll: async (classId: string, studentId: string) => {
        // Check availability
        const { data: classData, error: classError } = await supabase
            .from('classes_with_availability')
            .select('available_spots, price, status, start_datetime')
            .eq('id', classId)
            .single();

        if (classError) throw classError;
        if (classData?.status !== 'scheduled') throw new Error('Clase no disponible');
        if ((classData.available_spots as number) <= 0) throw new Error('No hay cupos disponibles');

        // Create or update enrollment (upsert to handle re-enrollment after cancel)
        const { data: enrollment, error } = await supabase
            .from('enrollments')
            .upsert({
                class_id: classId,
                student_id: studentId,
                enrolled_by: studentId,
                status: 'confirmed',
                cancelled_at: null,
            }, { onConflict: 'class_id,student_id' })
            .select()
            .single();

        if (error) throw error;

        // Create pending payment if class has a price
        if (classData.price > 0) {
            await supabase.from('payments').insert({
                student_id: studentId,
                class_id: classId,
                enrollment_id: enrollment.id,
                amount: classData.price,
                status: 'pending',
                due_date: classData.start_datetime.split('T')[0],
                description: 'Pago por clase',
            });
        }

        return enrollment;
    },

    cancelEnrollment: (enrollmentId: string, reason?: string) =>
        supabase.from('enrollments').update({
            status: 'cancelled',
            cancelled_at: new Date().toISOString(),
            cancel_reason: reason || 'Cancelado por alumno',
        }).eq('id', enrollmentId),

    getStudentEnrollments: (studentId: string) =>
        supabase.from('enrollments')
            .select(`
        *,
        classes (
          id, title, start_datetime, end_datetime, status, price,
          courts (name),
          profiles!classes_coach_id_fkey (full_name)
        )
      `)
            .eq('student_id', studentId)
            .neq('status', 'cancelled')
            .order('enrolled_at', { ascending: false }),

    getClassEnrollments: (classId: string) =>
        supabase.from('enrollments')
            .select(`
        *,
        profiles!enrollments_student_id_fkey (full_name, email, phone)
      `)
            .eq('class_id', classId)
            .eq('status', 'confirmed'),
};
