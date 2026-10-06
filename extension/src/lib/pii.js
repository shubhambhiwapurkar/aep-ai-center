/**
 * PII guard. Everything sent to an LLM passes through redact() first.
 * The extension only works with metadata (schemas, field names, audience rules, journey
 * structure), but users can type or paste anything - this catches the common leaks.
 */

const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const digitCount = (s) => (s.match(/\d/g) || []).length;
const isIsoDate = (s) => /^\d{4}-\d{2}-\d{2}/.test(s.trim());

// Order matters: longer/more specific patterns run first.
const PATTERNS = [
    { name: 'email', re: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, token: '[EMAIL]' },
    { name: 'ecid', re: /\b\d{38}\b/g, token: '[ECID]' },
    { name: 'uuid-like-id', re: UUID_RE, token: '[ID]' },
    { name: 'card', re: /\b(?:\d[ -]?){12,18}\d\b/g, token: '[NUMBER]', accept: (m) => digitCount(m) >= 13 && !isIsoDate(m) },
    { name: 'phone', re: /\+?\(?\d[\d\s().-]{8,}\d/g, token: '[PHONE]', accept: (m) => digitCount(m) >= 10 && digitCount(m) <= 15 && !isIsoDate(m) },
    { name: 'ipv4', re: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, token: '[IP]' }
];

/**
 * @param {string} text
 * @param {{ keepIds?: boolean }} opts keepIds leaves UUIDs alone (journey/audience ids are metadata)
 * @returns {{ text: string, hits: Record<string, number> }}
 */
export function redact(text, { keepIds = true } = {}) {
    if (!text) return { text: '', hits: {} };
    const hits = {};
    let out = String(text);
    // Shield ids from the number patterns (a UUID's digit-only groups look like a card number)
    const kept = [];
    if (keepIds) {
        out = out.replace(UUID_RE, (m) => {
            kept.push(m);
            return `\u0000${kept.length - 1}\u0000`;
        });
    }
    for (const p of PATTERNS) {
        if (keepIds && p.name === 'uuid-like-id') continue;
        out = out.replace(p.re, (m) => {
            if (p.accept && !p.accept(m)) return m;
            hits[p.name] = (hits[p.name] || 0) + 1;
            return p.token;
        });
    }
    if (kept.length) out = out.replace(/\u0000(\d+)\u0000/g, (_, i) => kept[Number(i)]);
    return { text: out, hits };
}

export function describeHits(hits) {
    const parts = Object.entries(hits).map(([k, v]) => `${v} ${k}`);
    return parts.length ? `Redacted before sending: ${parts.join(', ')}` : '';
}
