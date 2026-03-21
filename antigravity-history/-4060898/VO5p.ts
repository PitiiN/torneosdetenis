import { supabase } from './supabase';
import { addWeeks, format } from 'date-fns';
import { es } from 'date-fns/locale';

export const enrollmentsService = {
    async validateRecurringEnrollment(classId: string, studentId: string, count: number) {
        // 1. Get allowance
        const { data: allowance } = await supabase.rpc('get_student_class_allowance', { p_student_id: studentId });
        const remaining = allowance?.[0]?.remaining_classes || 0;

        // 2. Fetch target class details
        const { data: targetClass } = await supabase.from('classes').select('*').eq('id', classId).single();
        if (!targetClass) throw new Error('Clase base no encontrada');

        const enrollmentDates = [new Date(targetClass.start_datetime)];
        for (let i = 1; i <= count; i++) {
            enrollmentDates.push(addWeeks(new Date(targetClass.start_datetime), i));
        }

        const availableClasses = [];
        const conflicts = [];

        for (const date of enrollmentDates) {
            const dateStr = date.toISOString();
            const formattedDate = format(date, "EEEE d 'de' MMMM", { locale: es });

            const { data: foundBatch } = await supabase
                .from('classes_with_availability')
                .select('*')
                .eq('start_datetime', dateStr)
                .eq('status', 'scheduled');

            let match = (foundBatch || [])?.find(c => c.court_id === targetClass.court_id);
            if (!match) match = (foundBatch || [])?.find(c => c.coach_id === targetClass.coach_id);
            if (!match) match = (foundBatch || [])?.find(c => c.title === targetClass.title);
            if (!match && foundBatch && foundBatch.length > 0) match = foundBatch[0];

            if (!match) {
                conflicts.push({ date: formattedDate, reason: 'No se encontró la clase' });
                continue;
            }

            if (match.available_spots <= 0) {
                conflicts.push({ date: formattedDate, reason: 'Clase llena' });
                continue;
            }

            const { data: existing } = await supabase.from('enrollments').select('id, status').eq('class_id', match.id).eq('student_id', studentId).maybeSingle();
            if (existing?.status === 'confirmed') {
                conflicts.push({ date: formattedDate, reason: 'Ya estás inscrito' });
                continue;
            }

            availableClasses.push(match);
        }

        return {
            availableClasses,
            conflicts,
            remainingCredits: remaining
        };
    },

    async enrollBatch(classIds: string[], studentId: string) {
        const results = [];
        for (const id of classIds) {
            results.push(await this.enroll(id, studentId));
        }
        return results;
    },

    async enrollRecurring(classId: string, studentId: string, count: number) {
        const { availableClasses, conflicts } = await this.validateRecurringEnrollment(classId, studentId, count);

        if (conflicts.length > 0) {
            const firstConflict = conflicts[0];
            throw new Error(`${firstConflict.reason} el ${firstConflict.date}.`);
        }

        return this.enrollBatch(availableClasses.map(c => c.id), studentId);
    },

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

        // Check if already enrolled
        const { data: existing } = await supabase
            .from('enrollments')
            .select('id, status')
            .eq('class_id', classId)
            .eq('student_id', studentId)
            .maybeSingle();

        if (existing?.status === 'confirmed') {
            throw new Error('Ya estás inscrito en esta clase');
        }

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
