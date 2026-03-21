// Edge Function: auto-cancel-classes
// Deploy with: supabase functions deploy auto-cancel-classes --no-verify-jwt
// Schedule this to run daily at 07:00 AM Chile time using:
//   - cron-job.org (free)
//   - GitHub Actions scheduled workflow
//   - Vercel Cron
//
// Example cron invocation:
//   curl -X POST https://dfrjbwqgslyhpjmzwqvx.supabase.co/functions/v1/auto-cancel-classes \
//     -H "x-cron-secret: YOUR_CRON_SECRET"

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req: Request) => {
    try {
        // Verify secret token to prevent unauthorized invocations
        const authHeader = req.headers.get("x-cron-secret");
        const cronSecret = Deno.env.get("CRON_SECRET");
        if (cronSecret && authHeader !== cronSecret) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { "Content-Type": "application/json" },
            });
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        // Get today's date in Chile timezone
        const now = new Date();
        const chileTZ = "America/Santiago";
        const todayStr = now.toLocaleDateString("en-CA", { timeZone: chileTZ }); // YYYY-MM-DD

        // Find scheduled classes for today with auto_cancelled = false
        const { data: todayClasses, error: classesErr } = await supabase
            .from("classes")
            .select("id, title, start_datetime, max_students")
            .eq("status", "scheduled")
            .eq("auto_cancelled", false)
            .gte("start_datetime", todayStr + "T00:00:00")
            .lte("start_datetime", todayStr + "T23:59:59")
            .order("start_datetime");

        if (classesErr) throw classesErr;
        if (!todayClasses || todayClasses.length === 0) {
            return new Response(JSON.stringify({ message: "No classes to check", cancelled: 0 }), {
                headers: { "Content-Type": "application/json" },
            });
        }

        let totalCancelled = 0;
        const results: any[] = [];

        for (const cls of todayClasses) {
            // Count confirmed enrollments
            const { count } = await supabase
                .from("enrollments")
                .select("*", { count: "exact", head: true })
                .eq("class_id", cls.id)
                .eq("status", "confirmed");

            const enrolledCount = count || 0;

            if (enrolledCount < 3) {
                // Get enrolled students before cancelling
                const { data: enrollments } = await supabase
                    .from("enrollments")
                    .select("id, student_id")
                    .eq("class_id", cls.id)
                    .eq("status", "confirmed");

                // Cancel enrollments (returns credits via existing triggers)
                if (enrollments && enrollments.length > 0) {
                    await supabase
                        .from("enrollments")
                        .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
                        .eq("class_id", cls.id)
                        .eq("status", "confirmed");

                    // Send push notifications
                    const classDate = new Date(cls.start_datetime);
                    const timeStr = classDate.toLocaleTimeString("es-CL", {
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: chileTZ,
                    });

                    for (const enr of enrollments) {
                        // Create in-app notification
                        await supabase.from("notifications").insert({
                            user_id: enr.student_id,
                            title: "Clase Cancelada Automáticamente",
                            body: `La clase "${cls.title}" de las ${timeStr} fue cancelada porque no se alcanzó el mínimo de 3 alumnos. Tu crédito ha sido devuelto.`,
                            type: "auto_cancel",
                            data: { class_id: cls.id },
                        });

                        // Send push notification via Expo
                        const { data: tokens } = await supabase
                            .from("push_tokens")
                            .select("token")
                            .eq("user_id", enr.student_id);

                        if (tokens && tokens.length > 0) {
                            const messages = tokens.map((t: any) => ({
                                to: t.token,
                                sound: "default",
                                title: "Clase Cancelada",
                                body: `"${cls.title}" (${timeStr}) fue cancelada por mínimo de alumnos. Tu crédito fue devuelto.`,
                                data: { classId: cls.id },
                            }));

                            await fetch("https://exp.host/--/api/v2/push/send", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify(messages),
                            });
                        }
                    }
                }

                // Mark class as auto-cancelled (keep visible with 0 students)
                await supabase
                    .from("classes")
                    .update({ auto_cancelled: true })
                    .eq("id", cls.id);

                totalCancelled++;
                results.push({
                    class_id: cls.id,
                    title: cls.title,
                    enrolled: enrolledCount,
                    students_notified: enrollments?.length || 0,
                });
            }
        }

        // Notify Admins if any classes were cancelled
        if (totalCancelled > 0) {
            const { data: admins } = await supabase.from('profiles').select('id').eq('role', 'admin');

            if (admins && admins.length > 0) {
                const adminIds = admins.map((a: any) => a.id);
                const adminMessageStr = `Se han auto-cancelado ${totalCancelled} clase(s) el día de hoy mediante el proceso automático de las 7:00 AM.`;

                // create in-app notifications
                for (const adminId of adminIds) {
                    await supabase.from('notifications').insert({
                        user_id: adminId,
                        title: 'Reporte: Auto-cancelación',
                        body: adminMessageStr,
                        type: 'general',
                        data: { results }
                    });
                }

                // send expo push
                const { data: adminTokens } = await supabase.from('push_tokens').select('token').in('user_id', adminIds);
                if (adminTokens && adminTokens.length > 0) {
                    const messages = adminTokens.map((t: any) => ({
                        to: t.token,
                        sound: 'default',
                        title: 'Reporte diario',
                        body: adminMessageStr,
                    }));
                    await fetch('https://exp.host/--/api/v2/push/send', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(messages),
                    });
                }
            }
        }

        return new Response(
            JSON.stringify({
                message: `Processed ${todayClasses.length} classes, auto-cancelled ${totalCancelled}`,
                cancelled: totalCancelled,
                details: results,
            }),
            { headers: { "Content-Type": "application/json" } }
        );
    } catch (error: any) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
});
