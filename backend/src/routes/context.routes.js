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
