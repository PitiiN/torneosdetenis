type SupabaseLikeError = {
    message?: string;
    status?: number;
};

const AUTH_INVALID_CREDENTIALS_MARKERS = [
    'invalid login credentials',
    'invalid credentials',
    'email not confirmed',
    'invalid_grant',
];

const AUTH_DUPLICATE_USER_MARKERS = [
    'user already registered',
    'already registered',
];

const normalizeMessage = (value?: string) => (value || '').toLowerCase();

export const getSafeAuthErrorMessage = (
    error: SupabaseLikeError | null | undefined,
    context: 'login' | 'register'
) => {
    const normalized = normalizeMessage(error?.message);

    if (context === 'register') {
        if (AUTH_DUPLICATE_USER_MARKERS.some(marker => normalized.includes(marker))) {
            return 'Este correo ya esta registrado. Inicia sesion o recupera tu clave.';
        }
        return 'No pudimos crear tu cuenta. Revisa los datos e intenta nuevamente.';
    }

    if (AUTH_INVALID_CREDENTIALS_MARKERS.some(marker => normalized.includes(marker))) {
        return 'Credenciales invalidas. Revisa correo y contrasena.';
    }

    return 'No pudimos iniciar sesion. Intenta nuevamente en unos minutos.';
};

export const getSafeUnexpectedErrorMessage = () =>
    'Ocurrio un problema inesperado. Intenta nuevamente.';
