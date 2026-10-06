/**
 * Sandbox context = the technical shape of a client's AEP setup (no customer data).
 * Lives in chrome.storage.local; users can export/import it as a JSON file to keep it on
 * their own machine or drive, or hand it to a teammate.
 */
import { load, save } from './storage.js';

export const CONTEXT_VERSION = 1;

export function emptyContext(name = 'My sandbox') {
    return {
        version: CONTEXT_VERSION,
        name,
        sandbox: '',
        updatedAt: null,
        schemas: [],          // { id, title, class?, fields?: [{ path, type, title, enum? }] }
        namespaces: [],       // { code, name, type }
        audiences: [],        // { id, name, description, rule, evaluation }
        datasets: [],         // { id, name, schema, profileEnabled }
        flows: [],            // { id, name, flowSpec, state }
        mergePolicies: [],    // { id, name, default }
        journeyEvents: [],    // { name, type: 'unitary'|'business', fields: string }
        customActions: [],    // { name, description }
        channels: ['email', 'push', 'sms'],
        dataDictionary: [],   // { field, type, description, source }
        notes: ''
    };
}

const KEY = 'aepContexts';

export async function loadContexts() {
    const stored = await load(KEY, null);
    if (stored?.items?.length) return stored;
    const ctx = emptyContext();
    return { activeIndex: 0, items: [ctx] };
}

export async function saveContexts(state) {
    await save(KEY, state);
}

/** Pull a metadata snapshot from the local AEP AI Center backend (OAuth server-to-server). */
export async function fetchFromBackend(backendUrl, sandbox) {
    const base = backendUrl.replace(/\/+$/, '');
    const headers = sandbox ? { 'x-sandbox-name': sandbox } : {};
    const res = await fetch(`${base}/api/context/metadata`, { headers });
    if (!res.ok) throw new Error(`Backend returned ${res.status}. Is it running at ${base}?`);
    return res.json();
}

export async function fetchSchemaFields(backendUrl, schemaId, sandbox) {
    const base = backendUrl.replace(/\/+$/, '');
    const headers = sandbox ? { 'x-sandbox-name': sandbox } : {};
    const res = await fetch(`${base}/api/context/schema-fields?id=${encodeURIComponent(schemaId)}`, { headers });
    if (!res.ok) throw new Error(`Could not load fields (${res.status})`);
    return res.json();
}

/** Merge a backend snapshot into a context, keeping manual entries and already-loaded fields. */
export function mergeSnapshot(ctx, snap) {
    const warnings = [];
    const take = (key) => {
        const s = snap[key];
        if (!s) return ctx[key];
        if (!s.ok) {
            warnings.push(`${key}: ${s.error}`);
            return ctx[key];
        }
        return s.data;
    };
    const loadedFields = new Map(ctx.schemas.filter((s) => s.fields).map((s) => [s.id, s]));
    const schemas = take('schemas').map((s) => loadedFields.get(s.id) ? { ...s, ...loadedFields.get(s.id) } : s);
    return {
        ctx: {
            ...ctx,
            sandbox: snap.sandbox || ctx.sandbox,
            updatedAt: snap.fetchedAt || new Date().toISOString(),
            schemas,
            namespaces: take('namespaces'),
            audiences: take('audiences'),
            datasets: take('datasets'),
            flows: take('flows'),
            mergePolicies: take('mergePolicies')
        },
        warnings
    };
}

/**
 * Parse a data dictionary CSV. Only header-level metadata columns are kept
 * (field / type / description / source). Columns that look like sample values are dropped.
 */
export function parseDataDictionaryCsv(text) {
    const rows = parseCsv(text);
    if (rows.length < 2) throw new Error('The CSV needs a header row and at least one field row.');
    const header = rows[0].map((h) => h.trim().toLowerCase());
    const find = (...names) => header.findIndex((h) => names.some((n) => h === n || h.includes(n)));
    const iField = find('field', 'attribute', 'column', 'name');
    const iType = find('type', 'datatype', 'data type');
    const iDesc = find('description', 'definition', 'desc');
    const iSource = find('source', 'system', 'table');
    if (iField === -1) throw new Error('Could not find a "field" / "attribute" / "column" header.');
    const dropped = header.filter((h) => /sample|example|value/.test(h));
    const fields = rows.slice(1)
        .filter((r) => r[iField]?.trim())
        .map((r) => ({
            field: r[iField].trim(),
            type: iType >= 0 ? r[iType]?.trim() : '',
            description: iDesc >= 0 ? r[iDesc]?.trim() : '',
            source: iSource >= 0 ? r[iSource]?.trim() : ''
        }));
    return { fields, dropped };
}

/** Minimal RFC-4180 CSV parser (quotes, escaped quotes, newlines in quotes). */
export function parseCsv(text) {
    const rows = [];
    let row = [];
    let cell = '';
    let quoted = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (quoted) {
            if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
            else if (c === '"') quoted = false;
            else cell += c;
        } else if (c === '"') quoted = true;
        else if (c === ',') { row.push(cell); cell = ''; }
        else if (c === '\n' || c === '\r') {
            if (c === '\r' && text[i + 1] === '\n') i++;
            row.push(cell); rows.push(row); row = []; cell = '';
        } else cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows.filter((r) => r.some((c) => c.trim()));
}

/** Compact text summary of the context for LLM prompts. Bounded so it fits any model. */
export function contextToPrompt(ctx, { maxChars = 24000 } = {}) {
    if (!ctx) return 'No sandbox context loaded.';
    const lines = [`SANDBOX CONTEXT: ${ctx.name}${ctx.sandbox ? ` (sandbox: ${ctx.sandbox})` : ''}`];
    const list = (title, items, fmt, limit = 60) => {
        if (!items?.length) return;
        lines.push(`\n${title} (${items.length}):`);
        items.slice(0, limit).forEach((i) => lines.push(`- ${fmt(i)}`));
        if (items.length > limit) lines.push(`- ...and ${items.length - limit} more`);
    };
    list('Journey events', ctx.journeyEvents, (e) => `${e.name} [${e.type}]${e.fields ? ` fields: ${e.fields}` : ''}`);
    list('Audiences', ctx.audiences, (a) => `${a.name} (${a.evaluation || 'batch'})${a.rule ? ` rule: ${a.rule.slice(0, 160)}` : ''}`);
    list('Identity namespaces', ctx.namespaces, (n) => `${n.code} - ${n.name}${n.type ? ` (${n.type})` : ''}`);
    list('Custom actions', ctx.customActions, (a) => `${a.name}${a.description ? `: ${a.description}` : ''}`);
    if (ctx.channels?.length) lines.push(`\nChannels configured: ${ctx.channels.join(', ')}`);
    list('Schemas', ctx.schemas, (s) => `${s.title}${s.class ? ` [${s.class.split('/').pop()}]` : ''}`, 40);
    for (const s of ctx.schemas.filter((x) => x.fields?.length)) {
        list(`Fields of "${s.title}"`, s.fields, (f) => `${f.path} (${f.type})${f.enum ? ` values: ${f.enum.join('|')}` : ''}`, 120);
    }
    list('Datasets', ctx.datasets, (d) => `${d.name}${d.profileEnabled ? ' [profile]' : ''}`, 40);
    list('Source dataflows', ctx.flows, (f) => `${f.name} (${f.state || 'unknown'})`, 30);
    list('Merge policies', ctx.mergePolicies, (m) => `${m.name}${m.default ? ' [default]' : ''}`);
    list('Data dictionary', ctx.dataDictionary, (f) => `${f.field}${f.type ? ` (${f.type})` : ''}${f.source ? ` from ${f.source}` : ''}${f.description ? ` - ${f.description}` : ''}`, 200);
    if (ctx.notes) lines.push(`\nNotes: ${ctx.notes}`);
    const text = lines.join('\n');
    return text.length > maxChars ? `${text.slice(0, maxChars)}\n...(context truncated)` : text;
}
