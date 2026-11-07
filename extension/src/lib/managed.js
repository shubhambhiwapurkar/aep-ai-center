/**
 * Enterprise policy. IT admins can push settings through Chrome Enterprise
 * (ExtensionSettings / 3rdparty policy) using the schema in public/managed_schema.json.
 * Managed values override the user's own settings and are shown read-only in Settings.
 */

export const MANAGED_KEYS = ['backendUrl', 'backendToken', 'provider', 'model', 'baseUrl', 'apiKey', 'followPageSandbox', 'allowedProviders', 'disableAi', 'orgName', 'supportUrl'];

export async function loadManagedPolicy() {
    try {
        if (typeof chrome === 'undefined' || !chrome.storage?.managed) return {};
        const policy = await chrome.storage.managed.get(null);
        return Object.fromEntries(Object.entries(policy || {}).filter(([k, v]) => MANAGED_KEYS.includes(k) && v !== undefined && v !== ''));
    } catch {
        return {}; // not managed, or schema missing in a dev build
    }
}

/** Overlay policy on user settings. Returns { settings, locked: Set<string> }. */
export function applyPolicy(settings, policy = {}) {
    const locked = new Set();
    const next = { ...settings };
    for (const k of ['backendUrl', 'backendToken', 'provider', 'model', 'baseUrl', 'apiKey', 'followPageSandbox']) {
        if (policy[k] !== undefined) {
            next[k] = policy[k];
            locked.add(k);
        }
    }
    if (Array.isArray(policy.allowedProviders) && policy.allowedProviders.length && !policy.allowedProviders.includes(next.provider)) {
        next.provider = policy.allowedProviders[0];
        next.model = '';
    }
    if (policy.disableAi) {
        next.aiDisabled = true;
        locked.add('provider');
    }
    return { settings: next, locked, policy };
}
