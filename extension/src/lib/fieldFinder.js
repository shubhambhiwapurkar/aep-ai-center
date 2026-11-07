/**
 * "Which field holds X?" - ranks XDM field paths and data-dictionary entries from the synced
 * sandbox context against a plain-language query. Local only.
 */

// Small synonym table for vocabulary marketers use vs. what XDM calls things.
const SYNONYMS = {
    email: ['emailaddress', 'personalemail', 'workemail', 'address'],
    phone: ['mobilephone', 'homephone', 'phonenumber', 'number'],
    name: ['firstname', 'lastname', 'fullname', 'person'],
    birthday: ['birthdate', 'birthdayandmonth', 'dateofbirth'],
    dob: ['birthdate'],
    zip: ['postalcode'],
    postcode: ['postalcode'],
    country: ['countrycode', 'country'],
    city: ['city', 'homeaddress'],
    points: ['pointsbalance', 'points', 'loyalty'],
    tier: ['tier', 'level', 'status'],
    consent: ['consents', 'marketing', 'preferences', 'optin'],
    optin: ['consents', 'marketing'],
    revenue: ['pricetotal', 'value', 'amount', 'commerce'],
    order: ['purchaseid', 'order', 'commerce'],
    purchase: ['purchases', 'commerce', 'order'],
    cart: ['productlistadds', 'checkouts', 'commerce'],
    page: ['webpagedetails', 'pageviews', 'url'],
    device: ['device', 'environment', 'useragent'],
    id: ['identitymap', 'id', 'ecid', 'crmid']
};

const words = (s) => String(s || '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

export function expandQuery(q) {
    const terms = words(q);
    return terms.map((t) => [t, ...(SYNONYMS[t] || [])]);
}

/** Collect candidate fields from a sandbox context. */
export function candidateFields(ctx) {
    const out = [];
    for (const s of ctx?.schemas || []) {
        for (const f of s.fields || []) out.push({ path: f.path, type: f.type, title: f.title, enum: f.enum, source: s.title, kind: 'xdm' });
    }
    for (const d of ctx?.dataDictionary || []) {
        out.push({ path: d.field, type: d.type, title: d.description, source: d.source || 'Data dictionary', kind: 'dictionary' });
    }
    return out;
}

export function scoreField(field, groups) {
    if (!groups.length) return 0;
    const pathWords = words(field.path);
    const segments = String(field.path || '').split('.');
    const leafWords = new Set(words(segments[segments.length - 1]));
    const hay = new Set([...pathWords, ...words(field.title)]);
    const joined = `${field.path} ${field.title || ''}`.toLowerCase().replace(/[^a-z0-9]/g, '');
    let score = 0;
    for (const group of groups) {
        let best = 0;
        for (const [i, t] of group.entries()) {
            const weight = i === 0 ? 1 : 0.6; // synonyms count a bit less
            if (leafWords.has(t)) best = Math.max(best, 10 * weight);
            else if (hay.has(t)) best = Math.max(best, 6 * weight);
            else if ([...hay].some((w) => w.startsWith(t) && t.length >= 3)) best = Math.max(best, 4 * weight);
            else if (t.length >= 4 && joined.includes(t)) best = Math.max(best, 2 * weight);
        }
        if (best === 0) return 0; // every query term must match something
        score += best;
    }
    // Prefer tenant fields and shorter paths
    if (field.path.startsWith('_')) score += 1;
    // A real schema path is the actionable answer; source-system columns are supporting evidence.
    if (field.kind === 'dictionary') score *= 0.75;
    score -= Math.min(3, pathWords.length / 4);
    return score;
}

export function findFields(ctx, query, limit = 25) {
    const groups = expandQuery(query);
    if (!groups.length) return [];
    const seen = new Set();
    return candidateFields(ctx)
        .map((f) => ({ ...f, score: scoreField(f, groups) }))
        .filter((f) => f.score > 0)
        .sort((a, b) => b.score - a.score || a.path.length - b.path.length)
        .filter((f) => {
            const k = `${f.path}|${f.source}`;
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
        })
        .slice(0, limit);
}
