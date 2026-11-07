/**
 * Sandbox hygiene audit. Pure rules over metadata snapshots so they're unit-tested; the
 * /api/ext/audit route gathers the inputs. Every finding is { id, severity, category, title,
 * detail, entity?: { type, id, name }, fix }.
 *
 * Severities: 'high' (broken now), 'medium' (will bite soon / costs money), 'low' (tidy-up).
 */

const DAY = 24 * 60 * 60 * 1000;
const ts = (v) => (typeof v === 'number' ? v : Date.parse(v) || 0);

/**
 * @param {object} input
 * @param {Array<{id,name,schema,profileEnabled}>} input.datasets
 * @param {Array<{id,title}>} input.schemas            tenant schemas
 * @param {Array<{id,status,created,datasetId}>} input.batches   last ~30 days
 * @param {Array<{id,name,state}>} input.flows
 * @param {Array<{id,flowId,state,createdAt}>} input.flowRuns   recent runs
 * @param {Array<{id,name,evaluation,updated,totalProfiles}>} input.audiences
 * @param {Array<{segmentIds:string[],status,updated}>} input.segmentJobs
 * @param {Array<{id,name,default}>} input.mergePolicies
 * @param {number} [input.now]
 */
export function runAudit(input) {
    const now = input.now ?? Date.now();
    const findings = [];
    const add = (f) => findings.push(f);

    // ---- Datasets & ingestion ----
    const batchesByDataset = new Map();
    for (const b of input.batches || []) {
        if (!b.datasetId) continue;
        if (!batchesByDataset.has(b.datasetId)) batchesByDataset.set(b.datasetId, []);
        batchesByDataset.get(b.datasetId).push(b);
    }
    for (const d of input.datasets || []) {
        const bs = (batchesByDataset.get(d.id) || []).sort((a, b) => ts(b.created) - ts(a.created));
        const failed = bs.filter((b) => b.status === 'failed').length;
        if (bs.length >= 3 && failed / bs.length >= 0.5) {
            add({
                id: `dataset-failing-${d.id}`, severity: 'high', category: 'Ingestion',
                title: `${failed} of ${bs.length} recent batches failed`,
                detail: `Dataset "${d.name}" is failing more often than it succeeds.`,
                entity: { type: 'dataset', id: d.id, name: d.name },
                fix: 'Open the dataset → Dataset activity, inspect a failed batch\'s error codes, and fix the source mapping or file format.'
            });
        } else if (bs.length && bs[0].status === 'failed') {
            add({
                id: `dataset-lastfailed-${d.id}`, severity: 'medium', category: 'Ingestion',
                title: 'Latest batch failed',
                detail: `The most recent batch into "${d.name}" failed.`,
                entity: { type: 'dataset', id: d.id, name: d.name },
                fix: 'Check the batch errors; if the next scheduled run also fails, data in Profile is going stale.'
            });
        }
        if (d.profileEnabled && input.batches && bs.length === 0) {
            add({
                id: `dataset-stale-${d.id}`, severity: 'low', category: 'Ingestion',
                title: 'Profile-enabled dataset with no batches in the audit window',
                detail: `"${d.name}" feeds Real-Time Customer Profile but received no batch data recently. Fine for streaming-only datasets; otherwise data may be stale.`,
                entity: { type: 'dataset', id: d.id, name: d.name },
                fix: 'Confirm the source dataflow is enabled and scheduled, or disable the dataset for Profile if it is retired.'
            });
        }
    }

    // ---- Schemas ----
    const usedSchemas = new Set((input.datasets || []).map((d) => d.schema).filter(Boolean));
    if (input.datasets?.length) {
        for (const s of input.schemas || []) {
            if (!usedSchemas.has(s.id)) {
                add({
                    id: `schema-orphan-${s.id}`, severity: 'low', category: 'Data model',
                    title: 'Schema not used by any dataset',
                    detail: `"${s.title}" has no dataset. Unused schemas still count toward union schema field limits if enabled for Profile.`,
                    entity: { type: 'schema', id: s.id, name: s.title },
                    fix: 'Delete it if it was a draft, or create the dataset it was meant for.'
                });
            }
        }
    }

    // ---- Dataflows ----
    const runsByFlow = new Map();
    for (const r of input.flowRuns || []) {
        if (!runsByFlow.has(r.flowId)) runsByFlow.set(r.flowId, []);
        runsByFlow.get(r.flowId).push(r);
    }
    for (const f of input.flows || []) {
        if (f.state !== 'enabled') continue;
        const runs = (runsByFlow.get(f.id) || []).sort((a, b) => ts(b.createdAt) - ts(a.createdAt)).slice(0, 5);
        if (runs.length >= 2 && runs.every((r) => r.state === 'failed')) {
            add({
                id: `flow-failing-${f.id}`, severity: 'high', category: 'Dataflows',
                title: `Last ${runs.length} runs failed`,
                detail: `Dataflow "${f.name}" is enabled but has not succeeded recently.`,
                entity: { type: 'flow', id: f.id, name: f.name },
                fix: 'Sources → Dataflows → open the flow → Dataflow activity. Common causes: expired source credentials, changed source file layout, schema mapping errors.'
            });
        }
    }

    // ---- Audiences ----
    const lastEval = new Map();
    for (const j of input.segmentJobs || []) {
        if (String(j.status).toUpperCase() !== 'SUCCEEDED') continue;
        for (const id of j.segmentIds || []) lastEval.set(id, Math.max(lastEval.get(id) || 0, ts(j.updated)));
    }
    for (const a of input.audiences || []) {
        const updated = ts(a.updated);
        const evaluated = lastEval.get(a.id);
        if (a.evaluation === 'batch' && evaluated && updated > evaluated + 60 * 1000) {
            add({
                id: `audience-edited-${a.id}`, severity: 'medium', category: 'Audiences',
                title: 'Edited after its last evaluation',
                detail: `"${a.name}" was changed ${Math.round((now - updated) / 3600000)}h ago, after its last successful batch evaluation. Destinations keep receiving the old membership until the next evaluation.`,
                entity: { type: 'audience', id: a.id, name: a.name },
                fix: 'Wait for the daily evaluation, or run an on-demand evaluation if activation must reflect the change today.'
            });
        }
        if (typeof a.totalProfiles === 'number' && a.totalProfiles === 0 && updated && now - updated > 2 * DAY) {
            add({
                id: `audience-empty-${a.id}`, severity: 'medium', category: 'Audiences',
                title: 'Audience has 0 profiles',
                detail: `"${a.name}" qualified nobody. Usually the rule references a field no profile has, a wrong enum value, or a merge policy without the source dataset.`,
                entity: { type: 'audience', id: a.id, name: a.name },
                fix: 'Use "Explain" in the extension or the agent\'s debug_segment tool to check fields and merge policy.'
            });
        }
    }

    // ---- Merge policies ----
    if (input.mergePolicies && input.mergePolicies.length && !input.mergePolicies.some((m) => m.default)) {
        add({
            id: 'merge-no-default', severity: 'medium', category: 'Profile',
            title: 'No default merge policy',
            detail: 'Audiences and lookups without an explicit merge policy will fail or behave unexpectedly.',
            fix: 'Profiles → Merge policies → mark one policy as default for XDM Individual Profile.'
        });
    }

    const order = { high: 0, medium: 1, low: 2 };
    findings.sort((a, b) => order[a.severity] - order[b.severity]);
    const summary = { high: 0, medium: 0, low: 0 };
    for (const f of findings) summary[f.severity]++;
    const score = Math.max(0, 100 - summary.high * 15 - summary.medium * 5 - Math.min(20, summary.low));
    return { score, summary, findings };
}
