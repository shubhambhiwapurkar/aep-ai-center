import dotenv from 'dotenv';
import { AsyncLocalStorage } from 'node:async_hooks';
dotenv.config();

export const config = {
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    apiKey: process.env.API_KEY,
    imsOrg: process.env.IMS_ORG,
    sandboxName: process.env.SANDBOX_NAME || 'prod',
    imsUrl: process.env.IMS_URL || 'https://ims-na1.adobelogin.com',
    platformUrl: process.env.PLATFORM_URL || 'https://platform.adobe.io',
    scopes: process.env.SCOPES || 'openid,AdobeID,read_organizations',
    port: Number(process.env.PORT) || 3001,
    // Bind to loopback by default: the backend holds org-wide AEP credentials.
    host: process.env.HOST || '127.0.0.1',
    // Optional shared secret. When set, every /api request must send it
    // (Authorization: Bearer <token> or x-aep-ai-center-token).
    apiToken: process.env.API_TOKEN || '',
    // Comma-separated browser origins allowed by CORS, in addition to the defaults
    // (local Vite dev server and Chrome extensions).
    allowedOrigins: (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
    // Comma-separated extension ids. When set, only these chrome-extension:// origins are allowed.
    allowedExtensionIds: (process.env.ALLOWED_EXTENSION_IDS || '').split(',').map((s) => s.trim()).filter(Boolean)
};

/*
 * Sandbox scoping.
 *
 * The default sandbox is process-wide (changed by POST /api/sandbox/switch). A request can
 * target a different sandbox with the `x-sandbox-name` header or `?sandbox=` query param;
 * that override is held in AsyncLocalStorage so concurrent requests for different sandboxes
 * (Sandbox Compare, the extension following the sandbox open in the AEP UI) don't interfere.
 */
const sandboxScope = new AsyncLocalStorage();

const SANDBOX_NAME_RE = /^[a-z0-9][a-z0-9-]{0,255}$/i;

export function isValidSandboxName(name) {
    return typeof name === 'string' && SANDBOX_NAME_RE.test(name);
}

/** Run `fn` with `sandbox` as the sandbox for every AEP call made inside it. */
export function runWithSandbox(sandbox, fn) {
    if (!isValidSandboxName(sandbox)) return fn();
    return sandboxScope.run({ sandbox }, fn);
}

// Allow dynamic sandbox switching (process-wide default)
export function setSandboxName(sandbox) {
    if (isValidSandboxName(sandbox)) {
        config.sandboxName = sandbox;
        console.log(`[Config] Sandbox switched to: ${sandbox}`);
        return true;
    }
    return false;
}

/** The sandbox for the current request, falling back to the process-wide default. */
export function getSandboxName() {
    return sandboxScope.getStore()?.sandbox || config.sandboxName;
}

export function getDefaultSandboxName() {
    return config.sandboxName;
}
