import crypto from 'crypto';

export const ADMIN_USERNAME = process.env.ADMIN_USERNAME || '';
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
export const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || '';

function toBuffer(value) {
    return Buffer.from(String(value ?? ''), 'utf8');
}

export function safeEqual(left, right) {
    const leftBuffer = toBuffer(left);
    const rightBuffer = toBuffer(right);

    if (leftBuffer.length !== rightBuffer.length) return false;
    return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

const ADMIN_CONFIGURED = Boolean(ADMIN_USERNAME && ADMIN_PASSWORD && ADMIN_SESSION_SECRET);

export function verifyAdminCredentials(username, password) {
    if (!ADMIN_CONFIGURED) return false;
    return safeEqual(username, ADMIN_USERNAME) && safeEqual(password, ADMIN_PASSWORD);
}

export function createAdminSessionToken() {
    return crypto
        .createHash('sha256')
        .update(`${ADMIN_USERNAME}:${ADMIN_PASSWORD}:${ADMIN_SESSION_SECRET}`)
        .digest('hex');
}

export function verifyAdminSessionToken(token) {
    if (!ADMIN_CONFIGURED) return false;
    return safeEqual(token, createAdminSessionToken());
}
