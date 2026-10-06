/**
 * Metadata-only context for the Chrome side panel (extension/).
 *
 * Returns the *shape* of the sandbox - schemas, fields, identity namespaces, audience rules,
 * datasets, flows, merge policies - so an LLM can design journeys and implementations.
 * It never returns profile records, batch contents, query results or any other customer data.
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
import { getSandboxName } from '../config/config.js';

const router = Router();

const MAX_FIELDS_PER_SCHEMA = 400;

/** Flatten an expanded XDM schema into dotted field paths (metadata only). */
export function flattenSchemaFields(properties, prefix = '', out = []) {
    if (!properties || out.length >= MAX_FIELDS_PER_SCHEMA) return out;
    for (const [key, def] of Object.entries(properties)) {
        if (out.length >= MAX_FIELDS_PER_SCHEMA) break;
        const path = prefix ? `${prefix}.${key}` : key;
        if (def?.type === 'object' && def.properties) {
            flattenSchemaFields(def.properties, path, out);
        } else if (def?.type === 'array' && def.items?.properties) {
            out.push({ path, type: 'array<object>', title: def.title });
            flattenSchemaFields(def.items.properties, `${path}[]`, out);
        } else {
            out.push({
                path,
                type: def?.type === 'array' ? `array<${def.items?.type || 'any'}>` : def?.type || 'unknown',
                title: def?.title,
                ...(def?.enum ? { enum: def.enum.slice(0, 20) } : {}),
                ...(def?.['meta:enum'] && !def?.enum ? { enum: Object.keys(def['meta:enum']).slice(0, 20) } : {})
            });
        }
    }
    return out;
}

async function section(fn) {
    try {
        return { ok: true, data: await fn() };
    } catch (e) {
        return { ok: false, error: e.message };
    }
}

// GET /api/context/metadata - one snapshot of everything the LLM needs
router.get('/metadata', async (req, res) => {
    const [schemas, namespaces, audiences, datasets, flows, mergePolicies] = await Promise.all([
        section(async () => (await schemaService.listAllSchemas('tenant')).map((s) => ({
            id: s.$id,
            altId: s['meta:altId'],
            title: s.title,
            version: s.version
        }))),
        section(async () => (await identityService.listNamespaces() || []).map((n) => ({
            code: n.code,
            name: n.name,
            type: n.idType,
            custom: Boolean(n.custom)
        }))),
        section(async () => ((await segmentService.listSegments({ limit: 100 }))?.segments || []).map((s) => ({
            id: s.id,
            name: s.name,
            description: s.description,
            rule: s.expression?.value,
            evaluation: s.evaluationInfo?.continuous?.enabled ? 'streaming'
                : s.evaluationInfo?.synchronous?.enabled ? 'edge' : 'batch'
        }))),
        section(async () => Object.entries(await datasetService.listAllDatasets() || {}).map(([id, d]) => ({
            id,
            name: d.name,
            schema: d.schemaRef?.id,
            profileEnabled: Boolean(d.tags?.unifiedProfile?.some((t) => t.includes('enabled:true')))
        }))),
        section(async () => ((await flowService.listFlows({ limit: 100 }))?.items || []).map((f) => ({
            id: f.id,
            name: f.name,
            flowSpec: f.flowSpec?.id,
            state: f.state
        }))),
        section(async () => ((await profileService.listMergePolicies({ limit: 50 }))?.children || []).map((m) => ({
            id: m.id,
            name: m.name,
            default: m.default,
            schemaClass: m.schema?.name
        })))
    ]);

    res.json({
        sandbox: req.sandboxOverride || getSandboxName(),
        fetchedAt: new Date().toISOString(),
        schemas,
        namespaces,
        audiences,
        datasets,
        flows,
        mergePolicies
    });
});

const trim = (s, n = 240) => (s ? String(s).slice(0, n) : '');

/** A stats helper that swallowed its error and returned zeros counts as failed. */
async function stats(fn) {
    const res = await section(fn);
    if (res.ok && res.data?.error) return { ok: false, error: res.data.error };
    return res;
}

// GET /api/context/vitals - health of the sandbox for the side panel home screen.
// Counts, states and error codes only; no record contents.
router.get('/vitals', async (req, res) => {
    const since = Date.now() - 24 * 60 * 60 * 1000;
    const [connection, ingestion, dataflows, profiles, audiences, schemas, datasets] = await Promise.all([
        section(() => checkConnection()),
        section(async () => {
            const raw = await batchService.listBatches({ limit: '500', createdAfter: String(since) });
            const batches = Object.entries(raw || {}).map(([id, b]) => ({ id, ...b }));
            const count = (s) => batches.filter((b) => b.status === s).length;
            const success = count('success');
            const failed = count('failed');
            const hours = {};
            for (const b of batches) {
                const h = new Date(b.created).toISOString().slice(0, 13);
                hours[h] ||= { hour: h, success: 0, failed: 0, other: 0 };
                hours[h][b.status === 'success' ? 'success' : b.status === 'failed' ? 'failed' : 'other']++;
            }
            return {
                window: '24h',
                total: batches.length,
                success,
                failed,
                active: batches.filter((b) => ['active', 'processing', 'loading', 'staging'].includes(b.status)).length,
                successRate: success + failed ? Math.round((success / (success + failed)) * 1000) / 10 : null,
                records: batches.reduce((s, b) => s + (b.recordCount || 0), 0),
                failedRecords: batches.reduce((s, b) => s + (b.failedRecordCount || 0), 0),
                timeline: Object.values(hours).sort((a, b) => a.hour.localeCompare(b.hour)),
                failures: batches.filter((b) => b.status === 'failed').slice(0, 15).map((b) => ({
                    id: b.id,
                    datasetId: b.relatedObjects?.find((o) => o.type === 'dataSet')?.id || null,
                    created: b.created,
                    errors: (b.errors || []).slice(0, 3).map((e) => ({ code: e.code, message: trim(e.description || e.message) }))
                }))
            };
        }),
        section(async () => {
            const [flows, runs] = await Promise.all([
                flowService.listFlows({ limit: '100' }),
                flowService.listFlowRuns({ limit: '100' })
            ]);
            const flowList = flows?.items || [];
            const runList = runs?.items || [];
            const names = new Map(flowList.map((f) => [f.id, f.name]));
            const byState = {};
            for (const r of runList) byState[r.state || 'unknown'] = (byState[r.state || 'unknown'] || 0) + 1;
            const errorsOf = (r) => [
                ...(r.statusSummary?.errors || []),
                ...(r.activities || []).flatMap((a) => a.statusSummary?.errors || [])
            ].slice(0, 3).map((e) => ({ code: e.code, message: trim(e.message) }));
            return {
                total: flowList.length,
                enabled: flowList.filter((f) => f.state === 'enabled').length,
                runs: runList.length,
                runsByState: byState,
                failures: runList.filter((r) => r.state === 'failed').slice(0, 15).map((r) => ({
                    id: r.id,
                    flowId: r.flowId,
                    flowName: names.get(r.flowId) || null,
                    createdAt: r.createdAt,
                    errors: errorsOf(r)
                }))
            };
        }),
        stats(async () => {
            const p = await profileService.getProfileStats();
            return { error: p.error, totalProfiles: p.totalProfiles, mergePolicies: p.mergePolicies, lastSampleTime: p.lastSampleTime };
        }),
        stats(async () => {
            const s = await segmentService.getSegmentStats();
            return { error: s.error, total: s.totalSegments, evaluationJobs: s.evaluationJobs, exportJobs: s.exportJobs };
        }),
        stats(async () => {
            const s = await schemaService.getSchemaStats();
            return { error: s.error, tenantSchemas: s.tenantSchemas, fieldGroups: s.fieldGroups, unions: s.unions };
        }),
        stats(async () => {
            const s = await datasetService.getDatasetStats();
            return { error: s.error, total: s.total, profileEnabled: s.enabledForProfile };
        })
    ]);

    res.json({
        sandbox: getSandboxName(),
        fetchedAt: new Date().toISOString(),
        connection,
        ingestion,
        dataflows,
        profiles,
        audiences,
        schemas,
        datasets
    });
});

// GET /api/context/schema-fields?id=<schema $id or altId> - field paths for one schema
router.get('/schema-fields', async (req, res) => {
    if (!req.query.id) return res.status(400).json({ error: 'id is required' });
    try {
        const schema = await schemaService.getSchemaDetails(req.query.id, 'tenant');
        res.json({
            id: schema.$id,
            title: schema.title,
            class: schema['meta:class'],
            fields: flattenSchemaFields(schema.properties)
        });
    } catch (e) {
        res.status(502).json({ error: e.message });
    }
});

export default router;
