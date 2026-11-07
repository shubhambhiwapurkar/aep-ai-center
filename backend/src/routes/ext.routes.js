/**
 * Endpoints for the AEP AI Center Chrome extension (extension/).
 *
 * Read-only and metadata-only: names, ids, states, counts and error codes. Nothing here returns
 * profile records, identity values, batch file contents or query results, so the side panel can
 * keep its "metadata only" promise even when it talks to the backend.
 */
import { Router } from 'express';
import * as schemaService from '../services/schema.service.js';
import * as identityService from '../services/identity.service.js';
import * as segmentService from '../services/segment.service.js';
import * as datasetService from '../services/dataset.service.js';
import * as flowService from '../services/flow.service.js';
import * as profileService from '../services/profile.service.js';
import * as batchService from '../services/batch.service.js';
import { checkConnection } from '../services/auth.service.js';
import { config, getSandboxName } from '../config/config.js';
import { searchIndex, ENTITY_TYPES } from '../services/search-index.js';
import { runAudit } from '../services/audit-rules.js';

const router = Router();
const VERSION = '1.0.0';

const trim = (s, n = 240) => (s ? String(s).slice(0, n) : '');
const toList = (mapOrArr) => (Array.isArray(mapOrArr) ? mapOrArr : Object.entries(mapOrArr || {}).map(([id, v]) => ({ id, ...v })));
const evaluationOf = (s) => (s.evaluationInfo?.continuous?.enabled ? 'streaming' : s.evaluationInfo?.synchronous?.enabled ? 'edge' : 'batch');
const datasetIdOfBatch = (b) => b.relatedObjects?.find((o) => o.type === 'dataSet')?.id || null;
const isProfileEnabled = (d) => Boolean(d.tags?.unifiedProfile?.some((t) => t.includes('enabled:true')));
const errorsOf = (list) => (list || []).slice(0, 5).map((e) => ({ code: e.code, message: trim(e.description || e.message) }));

async function safe(fn, fallback = null) {
    try {
        return await fn();
    } catch (e) {
        return fallback ?? { error: e.message };
    }
}

const asyncRoute = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => {
    const status = /\b404\b/.test(e.message) ? 404 : /\b400\b/.test(e.message) ? 400 : 502;
    res.status(status).json({ error: e.message });
});

// ---------------------------------------------------------------------------------------------
// GET /api/ext/status - public. Lets the extension tell "backend offline" from "token needed".
router.get('/status', (req, res) => {
    res.json({
        service: 'aep-ai-center',
        version: VERSION,
        tokenRequired: Boolean(config.apiToken),
        features: ['search', 'entity', 'audit', 'vitals', 'metadata', 'estimate']
    });
});

// GET /api/ext/whoami - authenticated pairing check
router.get('/whoami', asyncRoute(async (req, res) => {
    const connection = await safe(() => checkConnection(), { connected: false });
    res.json({ version: VERSION, sandbox: getSandboxName(), defaultSandbox: config.sandboxName, connection });
}));

// ---------------------------------------------------------------------------------------------
// Search index, cached per sandbox for 5 minutes
const INDEX_TTL_MS = 5 * 60 * 1000;
const indexCache = new Map(); // sandbox -> { at, entries, warnings, promise }

async function buildIndex() {
    const warnings = [];
    const part = async (label, fn) => {
        try {
            return await fn();
        } catch (e) {
            warnings.push(`${label}: ${e.message}`);
            return [];
        }
    };
    const [schemas, datasets, audiences, flows, namespaces, mergePolicies] = await Promise.all([
        part('schemas', async () => (await schemaService.listAllSchemas('tenant')).map((s) => ({
            type: 'schema', id: s.$id, name: s.title, subtitle: `v${s.version || '1'}`, keywords: s['meta:altId']
        }))),
        part('datasets', async () => toList(await datasetService.listAllDatasets()).map((d) => ({
            type: 'dataset', id: d.id, name: d.name, subtitle: isProfileEnabled(d) ? 'Profile-enabled' : 'Dataset', keywords: d.schemaRef?.id
        }))),
        part('audiences', async () => {
            const out = [];
            let start;
            for (let page = 0; page < 10; page++) {
                const r = await segmentService.listSegments({ limit: 100, ...(start ? { start } : {}) });
                for (const s of r?.segments || []) {
                    out.push({ type: 'audience', id: s.id, name: s.name, subtitle: `${evaluationOf(s)} audience`, keywords: s.description });
                }
                start = r?._page?.next;
                if (!start || !(r?.segments?.length)) break;
            }
            return out;
        }),
        part('flows', async () => ((await flowService.listFlows({ limit: 100 }))?.items || []).map((f) => ({
            type: 'flow', id: f.id, name: f.name, subtitle: `Dataflow · ${f.state}`
        }))),
        part('namespaces', async () => (await identityService.listNamespaces() || []).map((n) => ({
            type: 'namespace', id: n.code, name: n.name, subtitle: `Identity · ${n.idType || ''}`.trim(), keywords: n.code
        }))),
        part('mergePolicies', async () => ((await profileService.listMergePolicies({ limit: 50 }))?.children || []).map((m) => ({
            type: 'mergePolicy', id: m.id, name: m.name, subtitle: m.default ? 'Default merge policy' : 'Merge policy'
        })))
    ]);
    return { at: Date.now(), entries: [...schemas, ...datasets, ...audiences, ...flows, ...namespaces, ...mergePolicies].filter((e) => e.id && e.name), warnings };
}

async function getIndex(force = false) {
    const key = getSandboxName();
    const cached = indexCache.get(key);
    if (!force && cached?.entries && Date.now() - cached.at < INDEX_TTL_MS) return cached;
    if (cached?.promise) return cached.promise;
    const promise = buildIndex().then((idx) => {
        indexCache.set(key, idx);
        return idx;
    }).catch((e) => {
        indexCache.delete(key);
        throw e;
    });
    indexCache.set(key, { ...(cached || {}), promise });
    return promise;
}

// GET /api/ext/search?q=loyalty&types=dataset,schema&limit=30&refresh=1
router.get('/search', asyncRoute(async (req, res) => {
    const q = String(req.query.q || '').slice(0, 200);
    const types = String(req.query.types || '').split(',').filter((t) => ENTITY_TYPES.includes(t));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
    const idx = await getIndex(req.query.refresh === '1');
    const counts = {};
    for (const e of idx.entries) counts[e.type] = (counts[e.type] || 0) + 1;
    res.json({
        sandbox: getSandboxName(),
        indexedAt: new Date(idx.at).toISOString(),
        counts,
        warnings: idx.warnings,
        results: q ? searchIndex(idx.entries, q, { types, limit }) : []
    });
}));

// ---------------------------------------------------------------------------------------------
// GET /api/ext/entity/:type/:id - summary of one object, used for "what am I looking at" in the
// AEP UI and for Explore detail views.
const SIMPLE_ID = /^[A-Za-z0-9_.:-]{1,160}$/;
const SCHEMA_ID = /^[A-Za-z0-9_.:/%#-]{1,400}$/;

const resolvers = {
    async dataset(id) {
        const raw = await datasetService.getDatasetDetails(id);
        const d = raw?.[id] || Object.values(raw || {})[0];
        if (!d) throw new Error('404: dataset not found');
        const [batchesRaw, labels, schema] = await Promise.all([
            safe(() => datasetService.getDatasetBatches(id, { limit: 10 }), {}),
            safe(() => datasetService.getDatasetLabels(id), null),
            d.schemaRef?.id ? safe(() => schemaService.getSchemaDetails(d.schemaRef.id), null) : null
        ]);
        const batches = toList(batchesRaw).filter((b) => b.status).sort((a, b) => (b.created || 0) - (a.created || 0));
        return {
            type: 'dataset', id, name: d.name, description: trim(d.description, 400),
            created: d.created, updated: d.updated,
            profileEnabled: isProfileEnabled(d),
            identityEnabled: Boolean(d.tags?.unifiedIdentity?.some((t) => t.includes('enabled:true'))),
            schema: d.schemaRef?.id ? { id: d.schemaRef.id, title: schema?.title || null, class: schema?.['meta:class'] || null } : null,
            labels: labels && !labels.error ? (labels.labels || []) : [],
            recentBatches: batches.slice(0, 10).map((b) => ({
                id: b.id, status: b.status, created: b.created,
                records: b.metrics?.inputRecordCount ?? b.recordCount ?? null,
                failedRecords: b.metrics?.failedRecordCount ?? b.failedRecordCount ?? null,
                errors: errorsOf(b.errors)
            }))
        };
    },
    async schema(id) {
        const s = await schemaService.getSchemaDetails(id);
        const idx = await safe(() => getIndex(), { entries: [] });
        const datasets = (idx.entries || []).filter((e) => e.type === 'dataset' && e.keywords === s.$id).map((e) => ({ id: e.id, name: e.name }));
        const fieldCount = (() => {
            let n = 0;
            const walk = (p) => { for (const v of Object.values(p || {})) { if (v?.properties) walk(v.properties); else n++; } };
            walk(s.properties);
            return n;
        })();
        return {
            type: 'schema', id: s.$id, name: s.title, description: trim(s.description, 400),
            class: s['meta:class'], version: s.version,
            profileEnabled: Array.isArray(s['meta:immutableTags']) && s['meta:immutableTags'].includes('union'),
            fieldCount,
            fieldGroups: (s['meta:extends'] || []).filter((x) => x.includes('mixins') || x.includes('fieldgroups')).length,
            datasets
        };
    },
    async audience(id) {
        const s = await segmentService.getSegmentDetails(id);
        const jobs = await safe(() => segmentService.listSegmentJobs({ segmentId: id, limit: 5 }), {});
        const last = (jobs?.children || [])[0];
        return {
            type: 'audience', id: s.id, name: s.name, description: trim(s.description, 400),
            evaluation: evaluationOf(s), rule: trim(s.expression?.value, 4000), mergePolicyId: s.mergePolicyId,
            created: s.creationTime, updated: s.updateTime,
            totalProfiles: s.metrics?.data?.totalProfiles ?? null,
            lastEvaluation: last ? { status: last.status, updated: last.updateTime, id: last.id } : null
        };
    },
    async flow(id) {
        const raw = await flowService.getFlowDetails(id);
        const f = raw?.items?.[0] || raw;
        const runs = await safe(() => flowService.listFlowRuns({ property: `flowId==${id}`, limit: 10 }), {});
        return {
            type: 'flow', id: f.id, name: f.name, description: trim(f.description, 400), state: f.state,
            flowSpec: f.flowSpec?.id, created: f.createdAt, updated: f.updatedAt,
            recentRuns: (runs?.items || []).slice(0, 10).map((r) => ({
                id: r.id, state: r.state, createdAt: r.createdAt,
                recordsRead: r.metrics?.recordSummary?.inputRecordCount ?? null,
                recordsFailed: r.metrics?.recordSummary?.failedRecordCount ?? null,
                errors: errorsOf([...(r.statusSummary?.errors || []), ...(r.activities || []).flatMap((a) => a.statusSummary?.errors || [])])
            }))
        };
    },
    async batch(id) {
        const raw = await batchService.getBatchDetails(id);
        const b = raw?.[id] || Object.values(raw || {})[0];
        if (!b) throw new Error('404: batch not found');
        return {
            type: 'batch', id, name: `Batch ${id}`, status: b.status, created: b.created, completed: b.completed,
            datasetId: datasetIdOfBatch(b),
            records: b.metrics?.inputRecordCount ?? null,
            failedRecords: b.metrics?.failedRecordCount ?? null,
            errors: errorsOf(b.errors)
        };
    },
    async namespace(code) {
        const all = await identityService.listNamespaces();
        const n = (all || []).find((x) => x.code === code || String(x.id) === code);
        if (!n) throw new Error('404: namespace not found');
        return { type: 'namespace', id: n.code, name: n.name, description: trim(n.description, 400), idType: n.idType, custom: Boolean(n.custom), status: n.status };
    },
    async mergePolicy(id) {
        const m = await profileService.getMergePolicyDetails(id);
        return {
            type: 'mergePolicy', id: m.id, name: m.name, default: m.default,
            identityGraph: m.identityGraph?.type, attributeMerge: m.attributeMerge?.type, activeOnEdge: m.activeOnEdge
        };
    }
};

router.get('/entity/:type/:id(*)', asyncRoute(async (req, res) => {
    const { type } = req.params;
    const id = req.params.id;
    const resolver = resolvers[type];
    if (!resolver) return res.status(400).json({ error: `Unsupported type "${type}". Supported: ${Object.keys(resolvers).join(', ')}` });
    if (!(type === 'schema' ? SCHEMA_ID : SIMPLE_ID).test(id)) return res.status(400).json({ error: 'Invalid id' });
    res.json({ sandbox: getSandboxName(), fetchedAt: new Date().toISOString(), entity: await resolver(id) });
}));

// ---------------------------------------------------------------------------------------------
// GET /api/ext/audit - sandbox hygiene findings (see services/audit-rules.js)
router.get('/audit', asyncRoute(async (req, res) => {
    const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const warnings = [];
    const part = async (label, fn) => {
        try {
            return await fn();
        } catch (e) {
            warnings.push(`${label}: ${e.message}`);
            return undefined;
        }
    };
    const [datasets, schemas, batches, flows, flowRuns, audiences, segmentJobs, mergePolicies] = await Promise.all([
        part('datasets', async () => toList(await datasetService.listAllDatasets()).map((d) => ({ id: d.id, name: d.name, schema: d.schemaRef?.id, profileEnabled: isProfileEnabled(d) }))),
        part('schemas', async () => (await schemaService.listAllSchemas('tenant')).map((s) => ({ id: s.$id, title: s.title }))),
        part('batches', async () => toList(await batchService.listBatches({ limit: '500', createdAfter: String(since) })).map((b) => ({ id: b.id, status: b.status, created: b.created, datasetId: datasetIdOfBatch(b) }))),
        part('flows', async () => ((await flowService.listFlows({ limit: 100 }))?.items || []).map((f) => ({ id: f.id, name: f.name, state: f.state }))),
        part('flowRuns', async () => ((await flowService.listFlowRuns({ limit: 100 }))?.items || []).map((r) => ({ id: r.id, flowId: r.flowId, state: r.state, createdAt: r.createdAt }))),
        part('audiences', async () => ((await segmentService.listSegments({ limit: 100 }))?.segments || []).map((s) => ({
            id: s.id, name: s.name, evaluation: evaluationOf(s), updated: s.updateTime, totalProfiles: s.metrics?.data?.totalProfiles
        }))),
        part('segmentJobs', async () => ((await segmentService.listSegmentJobs({ limit: 100 }))?.children || []).map((j) => ({
            segmentIds: (j.segments || []).map((x) => x.segmentId), status: j.status, updated: j.updateTime
        }))),
        part('mergePolicies', async () => ((await profileService.listMergePolicies({ limit: 50 }))?.children || []).map((m) => ({ id: m.id, name: m.name, default: m.default })))
    ]);
    const result = runAudit({ datasets, schemas, batches, flows, flowRuns, audiences, segmentJobs, mergePolicies });
    res.json({ sandbox: getSandboxName(), fetchedAt: new Date().toISOString(), warnings, ...result });
}));

// POST /api/ext/estimate { expression, mergePolicyId? } - audience size for a PQL rule (counts only)
router.post('/estimate', asyncRoute(async (req, res) => {
    const { expression, mergePolicyId } = req.body || {};
    res.json(await segmentService.estimateExpression(expression, { mergePolicyId }));
}));

export default router;
