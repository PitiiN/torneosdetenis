import { supabase } from './supabase';
import { addWeeks, format } from 'date-fns';
import { es } from 'date-fns/locale';

export const enrollmentsService = {
    async enrollRecurring(classId: string, studentId: string, count: number) {
        // 1. Validate credits
        const { data: allowance, error: allowanceError } = await supabase.rpc('get_student_class_allowance', { p_student_id: studentId });
        if (allowanceError) throw allowanceError;

        const remaining = allowance?.[0]?.remaining_classes || 0;
        const totalNeeded = 1 + count;

        if (remaining < totalNeeded) {
            throw new Error(`No tienes clases disponibles suficientes para realizar esta inscripción y sus repeticiones. Necesitas ${totalNeeded} y tienes ${remaining}.`);
        }

        // 2. Fetch target class details
        const { data: targetClass, error: targetError } = await supabase
            .from('classes')
            .select('*')
            .eq('id', classId)
            .single();
        if (targetError) throw targetError;

        // 3. Generate future dates and find classes
        const enrollmentDates = [new Date(targetClass.start_datetime)];
        for (let i = 1; i <= count; i++) {
            enrollmentDates.push(addWeeks(new Date(targetClass.start_datetime), i));
        }

        const classesToEnroll = [];

        // Match logic: same start_datetime and same coach or same title?
        // User says "same day and same hour". We use start_datetime.
        for (const date of enrollmentDates) {
            const dateStr = date.toISOString();
            const { data: foundBatch, error: findError } = await supabase
                .from('classes_with_availability')
                .select('*')
                .eq('start_datetime', dateStr)
                .eq('status', 'scheduled')
                .limit(5); // In case there are multiple courts, we'll try to match more precisely

            if (findError) throw findError;

            // Try to find the "closest" match (same court or coach or title)
            let match = foundBatch?.find(c => c.court_id === targetClass.court_id);
            if (!match) match = foundBatch?.find(c => c.coach_id === targetClass.coach_id);
            if (!match) match = foundBatch?.find(c => c.title === targetClass.title);
            if (!match && foundBatch?.length > 0) match = foundBatch[0];

            if (!match) {
                const formattedDate = format(date, "EEEE d 'de' MMMM", { locale: es });
                throw new Error(`No se encontró la clase equivalente para el ${formattedDate}.`);
            }

            if (match.available_spots <= 0) {
                const formattedDate = format(date, "EEEE d 'de' MMMM", { locale: es });
                throw new Error(`La clase del ${formattedDate} ya no tiene cupos disponibles.`);
            }

            // Check if already enrolled
            const { data: existing } = await supabase
                .from('enrollments')
                .select('id, status')
                .eq('class_id', match.id)
                .eq('student_id', studentId)
                .maybeSingle();

            if (existing?.status === 'confirmed') {
                const formattedDate = format(date, "EEEE d 'de' MMMM", { locale: es });
                throw new Error(`Ya estás inscrito en la clase del ${formattedDate}.`);
            }

            classesToEnroll.push(match);
        }

        // 4. Perform enrollments
        // Since we want atomic-like behavior and Superbase/JS doesn't easily support batch upserts via service logic
        // without a custom RPC, we loop. If one fails, it's unfortunate but we validated before.
        const results = [];
        for (const cls of classesToEnroll) {
            results.push(await this.enroll(cls.id, studentId));
        }

        return results;
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
