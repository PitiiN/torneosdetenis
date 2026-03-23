type SupabaseLikeError = {
    message?: string;
    status?: number;
    code?: string;
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
    'already been registered',
    'email address is already in use',
    'email_exists',
    'email already in use',
];

const AUTH_SIGNUP_CONFIGURATION_MARKERS = [
    'database error saving new user',
    'signup is disabled',
    'signups not allowed',
];

const normalizeMessage = (value?: string) => (value || '').toLowerCase();
const normalizeCode = (value?: string) => (value || '').toLowerCase();

export const isAuthDuplicateUserError = (error: SupabaseLikeError | null | undefined) => {
    const normalizedMessage = normalizeMessage(error?.message);
    const normalizedCode = normalizeCode(error?.code);

    return AUTH_DUPLICATE_USER_MARKERS.some(marker => normalizedMessage.includes(marker))
        || normalizedCode === 'user_already_exists'
        || normalizedCode === 'email_exists';
};

export const isAuthSignupConfigurationError = (error: SupabaseLikeError | null | undefined) => {
    const normalizedMessage = normalizeMessage(error?.message);
    return AUTH_SIGNUP_CONFIGURATION_MARKERS.some(marker => normalizedMessage.includes(marker));
};

export const getSafeAuthErrorMessage = (
    error: SupabaseLikeError | null | undefined,
    context: 'login' | 'register'
) => {
    const normalized = normalizeMessage(error?.message);

    if (context === 'register') {
        if (isAuthDuplicateUserError(error)) {
            return 'Este correo ya está registrado. Inicia sesión o recupera tu clave.';
        }
        if (isAuthSignupConfigurationError(error)) {
            return 'No pudimos crear la cuenta por una configuración del servidor. Intenta más tarde o contacta al administrador.';
        }
        return 'No pudimos crear tu cuenta. Revisa los datos e intenta nuevamente.';
    }

    if (AUTH_INVALID_CREDENTIALS_MARKERS.some(marker => normalized.includes(marker))) {
        return 'Credenciales inválidas. Revisa correo y contraseña.';
    }

    return 'No pudimos iniciar sesión. Intenta nuevamente en unos minutos.';
};

export const getSafeUnexpectedErrorMessage = () =>
    'Ocurrió un problema inesperado. Intenta nuevamente.';
