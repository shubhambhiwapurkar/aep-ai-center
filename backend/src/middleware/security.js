/**
 * Request guards for the AEP AI Center backend.
 *
 * The backend holds org-wide Adobe server-to-server credentials, so any web page the user
 * visits must not be able to drive it. Three layers:
 *  1. Listen on 127.0.0.1 by default (config.host).
 *  2. Origin allowlist: requests that carry an Origin header (i.e. come from a browser page)
 *     are rejected unless the origin is the local web app, an allowed Chrome extension or an
 *     origin listed in ALLOWED_ORIGINS. This blocks cross-site requests outright rather than
 *     only hiding the response.
 *  3. Optional API token (API_TOKEN). When set, every /api request must present it.
 */
import crypto from 'node:crypto';
import { config, runWithSandbox } from '../config/config.js';

const LOCAL_ORIGIN_RE = /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;
const EXTENSION_ORIGIN_RE = /^chrome-extension:\/\/([a-p]{32})$/;

export function isOriginAllowed(origin, cfg = config) {
    if (!origin) return true; // curl, server-to-server, same-origin navigations
    if (LOCAL_ORIGIN_RE.test(origin)) return true;
    const ext = origin.match(EXTENSION_ORIGIN_RE);
    if (ext) return cfg.allowedExtensionIds.length === 0 || cfg.allowedExtensionIds.includes(ext[1]);
    return cfg.allowedOrigins.includes(origin);
}

/** CORS + origin enforcement. Replaces the previous wide-open `cors()`. */
export function originGuard(req, res, next) {
    const origin = req.headers.origin;
    if (!isOriginAllowed(origin)) {
        return res.status(403).json({ error: `Origin ${origin} is not allowed. Add it to ALLOWED_ORIGINS in backend/.env.` });
    }
    if (origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-sandbox-name, x-aep-ai-center-token, x-aep-ai-center-client');
        res.setHeader('Access-Control-Max-Age', '600');
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
}

function safeEqual(a, b) {
    const ab = Buffer.from(String(a));
    const bb = Buffer.from(String(b));
    return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

export function extractToken(req) {
    const auth = req.headers.authorization || '';
    if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
    return req.headers['x-aep-ai-center-token'] || '';
}

/** Paths reachable without a token: liveness and the extension's "is a token needed?" probe. */
const PUBLIC_PATHS = new Set(['/health', '/api/ext/status']);

export function tokenGuard(req, res, next) {
    if (!config.apiToken || PUBLIC_PATHS.has(req.path)) return next();
    if (safeEqual(extractToken(req), config.apiToken)) return next();
    res.status(401).json({ error: 'Missing or invalid API token. Set it in the web app (Settings → Extension) or the extension settings.' });
}

/** Scope every request to the sandbox it asks for (x-sandbox-name header or ?sandbox=). */
export function sandboxScope(req, res, next) {
    const requested = req.headers['x-sandbox-name'] || req.query.sandbox;
    runWithSandbox(typeof requested === 'string' ? requested : undefined, next);
}
