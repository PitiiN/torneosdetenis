
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

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

export async function sendBookingConfirmationEmail(to: string, fieldName: string) {
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

    try {
        const data = await resend.emails.send({
            from: 'Arriendo Canchas <onboarding@resend.dev>', // Keep defaults for now
            to: [to],
            subject: subject,
            html: html,
        });
        return data;
    } catch (error) {
        console.error('Error sending email:', error);
        // Don't throw, just log. We don't want to block the booking update on email failure
    }
}
