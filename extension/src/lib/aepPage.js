/**
 * "What am I looking at?" - parse the active tab's Adobe Experience Cloud URL into
 * { app, org, sandbox, area, entity: { type, id } | null }.
 *
 * The AEP / AJO UIs are hash-routed SPAs, e.g.
 *   https://experience.adobe.com/#/@acme/sname:dev/platform/dataset/browse/64a1f0c2e5b7d1001c3e9a77
 *   https://experience.adobe.com/#/@acme/sname:prod/journey-optimizer/journeys/journey/<uuid>
 * Adobe doesn't document these routes and changes them, so matching is deliberately loose:
 * find the sandbox (`sname:`), the app, then an area keyword followed (anywhere later) by an id
 * of the right shape for that object type.
 *
 * Privacy: profile and identity pages are recognised as an *area* only. Their URLs can carry
 * identity values (emails, ECIDs), which are never captured as an entity id.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CATALOG_ID = /^[0-9a-f]{24}$/i;               // datasets (Catalog object ids)
const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/;             // batch ids
const SCHEMA_ALT = /^_[a-z0-9]+\.schemas\.[a-z0-9]+$/i; // meta:altId
const SCHEMA_URL = /^https:\/\/ns\.adobe\.com\/[^/]+\/schemas\/[0-9a-z]+/i;

const AEP_HOSTS = ['experience.adobe.com', 'experience-stage.adobe.com'];

/** Ordered: first rule whose keyword appears and has a matching id wins. */
const RULES = [
    { type: 'batch', keywords: ['batch', 'batches'], id: (s) => ULID.test(s) || CATALOG_ID.test(s) },
    { type: 'dataset', keywords: ['dataset', 'datasets'], id: (s) => CATALOG_ID.test(s) },
    { type: 'schema', keywords: ['schema', 'schemas'], id: (s) => SCHEMA_ALT.test(s) || SCHEMA_URL.test(s) },
    { type: 'audience', keywords: ['segment', 'segments', 'audience', 'audiences', 'segmentation'], id: (s) => UUID.test(s) },
    { type: 'journey', keywords: ['journey', 'journeys'], id: (s) => UUID.test(s) },
    { type: 'flow', keywords: ['dataflow', 'dataflows', 'source', 'sources', 'destination', 'destinations', 'flow', 'flows'], id: (s) => UUID.test(s) },
    { type: 'mergePolicy', keywords: ['merge-policies', 'mergepolicies', 'merge-policy'], id: (s) => UUID.test(s) }
];

const PRIVATE_AREAS = ['profile', 'profiles', 'identity', 'identities', 'graph-viewer', 'privacy'];

const AREA_LABELS = {
    dataset: 'Datasets', datasets: 'Datasets', schema: 'Schemas', schemas: 'Schemas',
    segment: 'Audiences', audience: 'Audiences', audiences: 'Audiences', segmentation: 'Audiences',
    source: 'Sources', sources: 'Sources', destination: 'Destinations', destinations: 'Destinations',
    query: 'Queries', queries: 'Queries', profile: 'Profiles', identity: 'Identities', identities: 'Identities',
    journeys: 'Journeys', journey: 'Journeys', campaigns: 'Campaigns', monitoring: 'Monitoring'
};

const safeDecode = (s) => {
    try {
        return decodeURIComponent(s);
    } catch {
        return s;
    }
};

export function parseAepUrl(url) {
    let u;
    try {
        u = new URL(url);
    } catch {
        return null;
    }
    if (!AEP_HOSTS.includes(u.hostname)) return null;

    // Route lives in the hash (#/@org/sname:x/...), sometimes in the path.
    const route = (u.hash.replace(/^#/, '') || u.pathname).split('?')[0];
    const parts = route.split('/').filter(Boolean).map(safeDecode);

    const out = { url, org: null, sandbox: null, app: null, area: null, areaLabel: null, entity: null, private: false };
    let i = 0;
    for (; i < parts.length; i++) {
        const p = parts[i];
        if (p.startsWith('@')) out.org = p.slice(1);
        else if (p.startsWith('sname:')) out.sandbox = p.slice(6);
        else break;
    }
    const rest = parts.slice(i);
    out.app = rest[0] || null;
    const lower = rest.map((p) => p.toLowerCase());

    const areaIdx = lower.findIndex((p) => AREA_LABELS[p] || PRIVATE_AREAS.includes(p));
    if (areaIdx >= 0) {
        out.area = lower[areaIdx];
        out.areaLabel = AREA_LABELS[lower[areaIdx]] || null;
    }
    if (lower.some((p) => PRIVATE_AREAS.includes(p))) {
        out.private = true;
        return out; // never treat anything on these pages as an id
    }

    for (const rule of RULES) {
        const k = lower.findIndex((p) => rule.keywords.includes(p));
        if (k < 0) continue;
        const id = rest.slice(k + 1).find((p) => rule.id(p));
        if (id) {
            out.entity = { type: rule.type, id };
            break;
        }
    }
    return out;
}

export const ENTITY_LABELS = {
    dataset: 'Dataset', schema: 'Schema', audience: 'Audience', flow: 'Dataflow', batch: 'Batch',
    journey: 'Journey', namespace: 'Identity namespace', mergePolicy: 'Merge policy'
};

/** Types the backend can describe via /api/ext/entity. */
export const RESOLVABLE = ['dataset', 'schema', 'audience', 'flow', 'batch', 'namespace', 'mergePolicy'];

/** Short human description for the "On this page" chip. */
export function describePage(page) {
    if (!page) return null;
    if (page.entity) return `${ENTITY_LABELS[page.entity.type] || page.entity.type}${page.sandbox ? ` · ${page.sandbox}` : ''}`;
    if (page.areaLabel) return `${page.areaLabel}${page.sandbox ? ` · ${page.sandbox}` : ''}`;
    return page.sandbox ? `Sandbox ${page.sandbox}` : 'Adobe Experience Cloud';
}
