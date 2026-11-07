/**
 * Client for the AEP AI Center backend. Adds the API token and the target sandbox to every
 * request and turns failures into messages a practitioner can act on.
 */

export class BackendError extends Error {
    constructor(message, { status = 0, kind = 'error' } = {}) {
        super(message);
        this.status = status;
        this.kind = kind; // 'offline' | 'auth' | 'forbidden' | 'error'
    }
}

export function backendBase(settings) {
    return String(settings?.backendUrl || 'http://localhost:3001').replace(/\/+$/, '');
}

export function backendHeaders(settings, sandbox) {
    const h = { 'x-aep-ai-center-client': 'extension' };
    if (settings?.backendToken) h.Authorization = `Bearer ${settings.backendToken}`;
    if (sandbox) h['x-sandbox-name'] = sandbox;
    return h;
}

/**
 * @param {object} settings  extension settings (backendUrl, backendToken)
 * @param {string} path      e.g. '/api/ext/search?q=x'
 * @param {{ sandbox?: string, method?: string, body?: any, signal?: AbortSignal }} [opts]
 */
export async function backendFetch(settings, path, { sandbox, method = 'GET', body, signal } = {}) {
    const base = backendBase(settings);
    let res;
    try {
        res = await fetch(`${base}${path}`, {
            method,
            signal,
            headers: { ...backendHeaders(settings, sandbox), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
            body: body !== undefined ? JSON.stringify(body) : undefined
        });
    } catch (e) {
        if (e.name === 'AbortError') throw e;
        throw new BackendError(`Can't reach the backend at ${base}. Start it with "cd backend && npm start", or check the URL in Settings.`, { kind: 'offline' });
    }
    const text = await res.text();
    let data = null;
    try {
        data = text ? JSON.parse(text) : null;
    } catch {
        data = { error: text.slice(0, 300) };
    }
    if (res.status === 401) throw new BackendError('The backend needs an API token. Add it in Settings → Backend.', { status: 401, kind: 'auth' });
    if (res.status === 403) throw new BackendError(data?.error || 'The backend rejected this extension\'s origin. Add its id to ALLOWED_EXTENSION_IDS.', { status: 403, kind: 'forbidden' });
    if (!res.ok) throw new BackendError(data?.error || `Backend returned ${res.status}`, { status: res.status });
    return data;
}

/** Probe without a token, then with it. Returns a status object for the Settings page. */
export async function checkBackend(settings) {
    let status;
    try {
        status = await backendFetch({ backendUrl: settings.backendUrl }, '/api/ext/status');
    } catch (e) {
        return { ok: false, kind: e.kind, message: e.message };
    }
    if (status?.service !== 'aep-ai-center') {
        return { ok: false, kind: 'error', message: 'Something answered at that URL, but it is not the AEP AI Center backend (or it is an older version without /api/ext).' };
    }
    try {
        const who = await backendFetch(settings, '/api/ext/whoami');
        return { ok: true, version: status.version, tokenRequired: status.tokenRequired, sandbox: who.sandbox, connected: Boolean(who.connection?.connected), connection: who.connection };
    } catch (e) {
        return { ok: false, kind: e.kind, tokenRequired: status.tokenRequired, message: e.message };
    }
}
