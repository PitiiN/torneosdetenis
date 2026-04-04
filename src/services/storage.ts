import { supabase } from './supabase';

const STORAGE_BUCKET = 'organizations';
const ALLOWED_ASSET_PREFIXES = new Set(['avatars', 'logos', 'payment-proofs', 'posters']);
const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LEGACY_OWNER_PATTERN = /^[A-Za-z0-9_-]{1,80}$/;
const PUBLIC_OBJECT_PREFIX = `/storage/v1/object/public/${STORAGE_BUCKET}/`;
const AUTH_OBJECT_PREFIX = `/storage/v1/object/authenticated/${STORAGE_BUCKET}/`;
const SIGNED_OBJECT_PREFIX = `/storage/v1/object/sign/${STORAGE_BUCKET}/`;

const trimLeadingSlashes = (value: string) => value.replace(/^\/+/, '');
const hasPathTraversal = (value: string) => value.includes('..');
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const stripQueryAndHash = (value: string) => value.split('#')[0].split('?')[0];

const safeDecodeURIComponent = (value: string) => {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
};

const normalizeStoragePathCandidate = (value: string) => {
    const decoded = trimLeadingSlashes(safeDecodeURIComponent(stripQueryAndHash(value)));
    const bucketPrefix = `${STORAGE_BUCKET.toLowerCase()}/`;
    if (decoded.toLowerCase().startsWith(bucketPrefix)) {
        return decoded.slice(STORAGE_BUCKET.length + 1);
    }
    return decoded;
};

const getFileExtension = (fileName: string) => {
    const dot = fileName.lastIndexOf('.');
    if (dot <= 0 || dot === fileName.length - 1) return null;
    return fileName.slice(dot + 1).toLowerCase();
};

export function isAllowedStorageAssetPath(path: string) {
    const normalized = trimLeadingSlashes(path);
    if (!normalized || hasPathTraversal(normalized)) return false;

    const segments = normalized.split('/').filter(Boolean);
    if (segments.length < 3) return false;

    const [rootPrefix, ownerKey, ...fileSegments] = segments;
    if (!ALLOWED_ASSET_PREFIXES.has(rootPrefix)) return false;

    if (rootPrefix === 'payment-proofs') {
        if (segments.length < 5) return false;
        const tournamentId = segments[2];
        const playerId = segments[3];
        if (!UUID_PATTERN.test(ownerKey)) return false;
        if (!UUID_PATTERN.test(tournamentId)) return false;
        if (!UUID_PATTERN.test(playerId)) return false;
        if (fileSegments.length < 3) return false;
    } else {
        if (!UUID_PATTERN.test(ownerKey) && !LEGACY_OWNER_PATTERN.test(ownerKey)) return false;
        if (fileSegments.length === 0) return false;
    }

    const fileName = fileSegments[fileSegments.length - 1];
    const extension = getFileExtension(fileName);
    if (!extension || !ALLOWED_EXTENSIONS.has(extension)) return false;

    return true;
}

export function extractStoragePath(pathOrUrl?: string | null): string | null {
    const value = pathOrUrl?.trim();
    if (!value) return null;

    if (!value.startsWith('http://') && !value.startsWith('https://')) {
        return normalizeStoragePathCandidate(value);
    }

    try {
        const parsed = new URL(value);
        const pathname = parsed.pathname || '';
        const markers = [PUBLIC_OBJECT_PREFIX, AUTH_OBJECT_PREFIX, SIGNED_OBJECT_PREFIX];

        for (const marker of markers) {
            const index = pathname.indexOf(marker);
            if (index >= 0) {
                return normalizeStoragePathCandidate(pathname.slice(index + marker.length));
            }
        }

        const fallbackMarkerMatch = pathname.match(/\/storage\/v1\/object\/(?:public|authenticated|sign)\/(.+)$/i);
        if (fallbackMarkerMatch?.[1]) {
            return normalizeStoragePathCandidate(fallbackMarkerMatch[1]);
        }
    } catch {
        return null;
    }

    return null;
}

export async function resolveStorageAssetUrl(pathOrUrl?: string | null, expiresInSeconds = 3600) {
    if (!pathOrUrl) return null;

    const storagePath = extractStoragePath(pathOrUrl);
    if (!storagePath) return null;

    if (!isAllowedStorageAssetPath(storagePath)) return null;

    const clampedExpiry = Math.max(60, Math.min(expiresInSeconds, 86400));

    const { data, error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(storagePath, clampedExpiry);

    if (error || !data?.signedUrl) {
        return null;
    }

    return data.signedUrl;
}

type ResolveWithRetryOptions = {
    expiresInSeconds?: number;
    attempts?: number;
    baseDelayMs?: number;
};

export async function resolveStorageAssetUrlWithRetry(
    pathOrUrl?: string | null,
    options?: ResolveWithRetryOptions
) {
    const expiresInSeconds = options?.expiresInSeconds ?? 3600;
    const attempts = Math.max(1, Math.min(options?.attempts ?? 3, 5));
    const baseDelayMs = Math.max(100, Math.min(options?.baseDelayMs ?? 300, 1500));

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        const signedUrl = await resolveStorageAssetUrl(pathOrUrl, expiresInSeconds);
        if (signedUrl) return signedUrl;

        if (attempt < attempts) {
            await sleep(baseDelayMs * attempt);
        }
    }

    return null;
}
