/**
 * Unified metadata search for the extension's Explore tab and command palette.
 * Pure functions (no I/O) so ranking is unit-tested; the route builds the index.
 *
 * An index entry: { type, id, name, subtitle?, keywords? }. Names and ids only - no records.
 */

export const ENTITY_TYPES = ['dataset', 'schema', 'audience', 'flow', 'namespace', 'mergePolicy'];

const norm = (s) => String(s || '').toLowerCase();

/**
 * Score one entry against a query. Higher is better, 0 means no match.
 * exact id > exact name > name prefix > word prefix (all terms) > substring (all terms).
 */
export function scoreEntry(entry, query) {
    const q = norm(query).trim();
    if (!q) return 0;
    const name = norm(entry.name);
    const id = norm(entry.id);
    if (id === q) return 1000;
    if (name === q) return 900;
    if (name.startsWith(q)) return 700 - Math.min(name.length, 200) / 10;
    if (id.startsWith(q) && q.length >= 6) return 650;
    const hay = `${name} ${norm(entry.subtitle)} ${norm(entry.keywords)}`;
    const words = hay.split(/[^a-z0-9]+/).filter(Boolean);
    const terms = q.split(/\s+/).filter(Boolean);
    if (terms.every((t) => words.some((w) => w.startsWith(t)))) return 500 - Math.min(name.length, 200) / 10;
    if (terms.every((t) => hay.includes(t))) return 300 - Math.min(name.length, 200) / 10;
    if (q.length >= 8 && id.includes(q)) return 200;
    return 0;
}

export function searchIndex(entries, query, { types, limit = 30 } = {}) {
    const allowed = types?.length ? new Set(types) : null;
    return entries
        .filter((e) => !allowed || allowed.has(e.type))
        .map((e) => ({ e, s: scoreEntry(e, query) }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s || norm(a.e.name).localeCompare(norm(b.e.name)))
        .slice(0, limit)
        .map(({ e, s }) => ({ ...e, score: Math.round(s) }));
}
