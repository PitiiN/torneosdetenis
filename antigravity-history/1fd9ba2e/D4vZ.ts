import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const TABANCURA_HTML = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: 'Segoe UI', sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 10px; overflow: hidden; }
    .header { background-color: #002147; color: white; padding: 20px; text-align: center; padding-bottom: 16px; }
    .header h1 { margin: 0; font-size: 24px; }
    .header h2 { margin: 8px 0 0 0; font-weight: normal; font-size: 16px; color: #cccccc; }
    .content { padding: 20px; font-size: 14px; color: #2c3e50; }
    .number { background-color: #ffda44; color: #002147; font-weight: bold; border-radius: 50%; display: inline-block; width: 24px; height: 24px; line-height: 24px; text-align: center; font-size: 13px; margin-right: 8px; vertical-align: middle; }
    .line { margin-bottom: 16px; }
    .cta { text-align: center; margin: 30px 0 20px; }
    .cta a { display: inline-block; background-color: #25D366; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; }
    a { color: #0066cc; text-decoration: none; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Uso Cancha Tabancureños</h1>
      <h2>A tener en consideración</h2>
    </div>
    <div class="content">
      <div class="line"><span class="number">1</span> Deben abrir el candado con el código <strong>4224</strong></div>
      <div class="line"><span class="number">2</span> Cada vez que un jugador ingrese debe cerrar la puerta</div>
      <div class="line"><span class="number">3</span> Las luces son con encendido automático</div>
      <div class="line"><span class="number">4</span> Deben enviar una foto <a href="https://wa.me/56995158428">acá</a> del candado cerrado una vez finalizado el uso</div>
      <div class="line"><span class="number">5</span> Prohibido fumar o tomar dentro del colegio, así como usar otros espacios del colegio. Además, deben precocuparse de dejar limpio como se encontró, y respetar a los vecinos aledaños a la cancha</div>
      <div class="line" style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 10px;"><span class="number">6</span> Se aplicarán multas en caso de incumplimiento de alguna de estas. Primera ocurrencia: 0,5UF. Segunda ocurrencia: 1UF. Tercera ocurrencia: prohibición de arriendo del espacio </div>
    </div>
    <div class="cta">
      <a href="https://wa.me/56995158428">Contáctanos</a>
    </div>
  </div>
</body>
</html>
`;

const HUELEN_HTML = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: 'Segoe UI', sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 10px; overflow: hidden; }
    .header { background-color: #002147; color: white; padding: 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .header h2 { margin: 8px 0 0 0; font-weight: normal; font-size: 16px; color: #cccccc; }
    .content { padding: 20px; font-size: 14px; color: #2c3e50; }
    .number { background-color: #ffda44; color: #002147; font-weight: bold; border-radius: 50%; display: inline-block; width: 24px; height: 24px; line-height: 24px; text-align: center; font-size: 13px; margin-right: 8px; vertical-align: middle; }
    .line { margin-bottom: 16px; }
    .cta { text-align: center; margin: 30px 0 20px; }
    .cta a { display: inline-block; background-color: #25D366; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px; }
    a { color: #0066cc; text-decoration: none; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Uso Cancha Huelen</h1>
      <h2>A tener en consideración</h2>
    </div>
    <div class="content">
      <div class="line"><span class="number">1</span> Deben tocar el timbre y la central les abrirá previa coordinación</div>
      <div class="line"><span class="number">2</span> Cada vez que un jugador ingrese o se retire, debe cerrar la puerta</div>
      <div class="line"><span class="number">3</span> Deben encender (primer turno) y apagar las luces (último turno). Puedes ver cómo hacerlo en estos videos: <a href="https://www.youtube.com/shorts/C9T5Okycit4" target="_blank">cancha grande</a> y <a href="https://www.youtube.com/shorts/3O4yOXi82Xs?feature=share" target="_blank">cancha chica</a></div>
      <div class="line"><span class="number">4</span> Deben enviar una foto de las luces apagadas (último turno) <a href="https://wa.me/56995158428">acá</a></div>
      <div class="line"><span class="number">5</span> Pueden usar los baños habilitados de las canchas</div>
      <div class="line"><span class="number">6</span> Prohibido fumar o tomar dentro del colegio, así como usar otros espacios del colegio. Además deben preocuparse de dejar el espacio limpio como se encontró. Se debe respetar a los vecinos aledaños a la cancha</div>
      <div class="line" style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 10px;"><span class="number">7</span> Se aplicarán multas en caso de incumplimiento de alguna de estas. Primera ocurrencia: 0,5UF. Segunda ocurrencia: 1UF. Tercera ocurrencia: prohibición de arriendo del espacio </div>
    </div>
    <div class="cta">
      <a href="https://wa.me/56995158428">Contáctanos</a>
    </div>
  </div>
</body>
</html>
`;

async function sendBookingConfirmationEmail(to: string, fieldName: string) {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
        console.error('RESEND_API_KEY not set');
        return;
    }

    const normalizedField = fieldName.toLowerCase().trim();
    let html = '';
    let subject = '';

    if (normalizedField.includes('tabancura')) {
        html = TABANCURA_HTML;
        subject = 'Instrucciones Cancha Tabancureños y Reserva Confirmada';
    } else if (normalizedField.includes('huelen') || normalizedField.includes('huelén')) {
        html = HUELEN_HTML;
        subject = 'Instrucciones Cancha Huelen y Reserva Confirmada';
    } else {
        console.log('No email template for field:', fieldName);
        return;
    }

    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${resendApiKey}`
        },
        body: JSON.stringify({
            from: 'Arriendo Canchas <onboarding@resend.dev>',
            to: [to],
            subject: subject,
            html: html,
        })
    });

    return await response.json();
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        )

        // Verify User is Admin
        const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
        if (authError || !user) throw new Error('Unauthorized')

        const { data: roleData } = await supabaseClient
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id)
            .single()

        if (roleData?.role !== 'ADMIN') throw new Error('Forbidden')

        // Initialize Admin Client (Service Role)
        const adminClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const { bookingId, action, updateData } = await req.json()

        if (action === 'update' || action === 'verify') {
            // 1. Get existing booking state
            const { data: existing, error: fetchError } = await adminClient
                .from('bookings')
                .select('*')
                .eq('id', bookingId)
                .single()

            if (fetchError || !existing) throw new Error('Booking not found')

            // 2. Prepare Update
            const payload: any = {
                ...updateData,
                updated_at: new Date().toISOString()
            }

            if (updateData.status) {
                payload.status_updated_by = user.id
                payload.status_updated_at = new Date().toISOString()
            }

            // 3. Execute Update
            const { data: updated, error: updateError } = await adminClient
                .from('bookings')
                .update(payload)
                .eq('id', bookingId)
                .select('*, field:fields(name)')
                .single()

            if (updateError) throw updateError

            // 4. Handle Email Side Effect
            if (updateData.status === 'PAGADA' && existing.status !== 'PAGADA') {
                // Fetch user email from auth admin
                const { data: { user: authUser }, error: userError } = await adminClient.auth.admin.getUserById(updated.user_id)

                if (!userError && authUser?.email && updated.field?.name) {
                    await sendBookingConfirmationEmail(authUser.email, updated.field.name)
                }
            }

            return new Response(JSON.stringify({ success: true, booking: updated }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            })
        }

        throw new Error('Action not supported')

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
