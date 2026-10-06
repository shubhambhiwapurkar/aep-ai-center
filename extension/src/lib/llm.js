/**
 * Bring-your-own-key LLM client. Calls go straight from the browser to the provider the user
 * picked - there is no AEP AI Center server in between. Every message is passed through the
 * PII guard first.
 */
import { redact } from './pii.js';

export const PROVIDERS = {
    anthropic: { label: 'Anthropic Claude', defaultModel: 'claude-sonnet-5-5', needsBaseUrl: false },
    openai: { label: 'OpenAI-compatible (OpenAI, Azure, Ollama, LM Studio)', defaultModel: '', needsBaseUrl: true },
    gemini: { label: 'Google Gemini', defaultModel: 'gemini-2.5-flash', needsBaseUrl: false }
};

export const DEFAULT_SETTINGS = {
    provider: 'anthropic',
    model: PROVIDERS.anthropic.defaultModel,
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    backendUrl: 'http://localhost:3001'
};

export function isConfigured(settings) {
    if (!settings?.provider || !settings.model) return false;
    // Local OpenAI-compatible servers (Ollama etc.) don't need a key
    if (settings.provider === 'openai') return Boolean(settings.baseUrl);
    return Boolean(settings.apiKey);
}

async function postJson(url, headers, body) {
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body)
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${res.status} from LLM provider: ${text.slice(0, 400)}`);
    return JSON.parse(text);
}

/**
 * @param {object} settings  provider settings from the Settings page
 * @param {{ system: string, messages: {role: 'user'|'assistant', content: string}[], maxTokens?: number }} req
 * @returns {Promise<{ text: string, redactions: Record<string, number> }>}
 */
export async function chat(settings, { system, messages, maxTokens = 8000 }) {
    if (!isConfigured(settings)) throw new Error('Add an LLM provider and key in Settings first.');

    const redactions = {};
    const clean = (s) => {
        const r = redact(s);
        for (const [k, v] of Object.entries(r.hits)) redactions[k] = (redactions[k] || 0) + v;
        return r.text;
    };
    const sys = clean(system);
    const msgs = messages.map((m) => ({ role: m.role, content: clean(m.content) }));

    let text;
    if (settings.provider === 'anthropic') {
        const data = await postJson(
            'https://api.anthropic.com/v1/messages',
            {
                'x-api-key': settings.apiKey,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true'
            },
            { model: settings.model, max_tokens: maxTokens, system: sys, messages: msgs }
        );
        text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
    } else if (settings.provider === 'openai') {
        const base = settings.baseUrl.replace(/\/+$/, '');
        // Azure: base is .../openai/deployments/<name>?api-version=... - keep query string at the end
        const [path, query] = base.split('?');
        const url = `${path}/chat/completions${query ? `?${query}` : ''}`;
        const headers = settings.apiKey
            ? (/azure\.com/.test(base) ? { 'api-key': settings.apiKey } : { Authorization: `Bearer ${settings.apiKey}` })
            : {};
        const data = await postJson(url, headers, {
            model: settings.model,
            messages: [{ role: 'system', content: sys }, ...msgs]
        });
        text = data.choices?.[0]?.message?.content || '';
    } else if (settings.provider === 'gemini') {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(settings.model)}:generateContent`;
        const data = await postJson(url, { 'x-goog-api-key': settings.apiKey }, {
            systemInstruction: { parts: [{ text: sys }] },
            contents: msgs.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
            generationConfig: { maxOutputTokens: maxTokens }
        });
        text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
    } else {
        throw new Error(`Unknown provider ${settings.provider}`);
    }
    return { text, redactions };
}

/** Pull the first JSON object/array out of a model reply (handles ```json fences and chatter). */
export function extractJson(text) {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const candidate = fenced ? fenced[1] : text;
    const start = candidate.search(/[[{]/);
    if (start === -1) throw new Error('The model did not return JSON.');
    const open = candidate[start];
    const close = open === '{' ? '}' : ']';
    const end = candidate.lastIndexOf(close);
    return JSON.parse(candidate.slice(start, end + 1));
}

/**
 * Ask the browser to allow custom hosts (Azure / self-hosted LLMs, a remote backend).
 * Must be called straight from a click handler - one request, no awaits before it - because
 * Chrome only shows permission prompts during a user gesture. Already-granted hosts return true.
 */
export async function ensureHostPermissions(urls) {
    if (typeof chrome === 'undefined' || !chrome.permissions) return true;
    try {
        const origins = [...new Set(urls.map((u) => {
            const { protocol, hostname } = new URL(u);
            return `${protocol}//${hostname}/*`;
        }))];
        return await chrome.permissions.request({ origins });
    } catch {
        return false;
    }
}
