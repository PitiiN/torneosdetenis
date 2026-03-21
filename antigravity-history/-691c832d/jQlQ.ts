
import { config } from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
config({ path: path.resolve(process.cwd(), '.env.local') });

// Static import removed


async function main() {
    const testEmail = 'jaravena@f2sports.cl'; // User provided admin email for testing
    const testField = 'Cancha Tabancura';

    console.log(`Testing email send to: ${testEmail} for field: ${testField}`);
    console.log('RESEND_API_KEY present:', !!process.env.RESEND_API_KEY);

    if (!process.env.RESEND_API_KEY) {
        console.error('ERROR: RESEND_API_KEY is missing in environment variables.');
        return;
    }

    try {
        const result = await sendBookingConfirmationEmail(testEmail, testField);
        console.log('Email send result:', result);
    } catch (error) {
        console.error('Error sending email:', error);
    }
}

main();
