import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreEntry, searchIndex } from '../src/services/search-index.js';
import { runAudit } from '../src/services/audit-rules.js';

const entries = [
    { type: 'dataset', id: '5f1a2b3c4d5e6f7a8b9c0d1e', name: 'Loyalty Members' },
    { type: 'schema', id: 'https://ns.adobe.com/acme/schemas/abc', name: 'Loyalty Profile Schema' },
    { type: 'audience', id: 'a1b2c3d4-0000-1111-2222-333344445555', name: 'Gold loyalty tier' },
    { type: 'flow', id: 'f-1', name: 'CRM daily import' }
];

test('exact id beats everything', () => {
    const r = searchIndex(entries, '5f1a2b3c4d5e6f7a8b9c0d1e');
    assert.equal(r[0].type, 'dataset');
    assert.equal(r[0].score, 1000);
});

test('name prefix outranks word prefix and substring', () => {
    const r = searchIndex(entries, 'loyalty');
    assert.deepEqual(r.map((x) => x.name).slice(0, 2), ['Loyalty Members', 'Loyalty Profile Schema']);
    assert.equal(r[2].name, 'Gold loyalty tier');
});

test('multi-term queries need every term', () => {
    assert.equal(searchIndex(entries, 'gold tier').length, 1);
    assert.equal(searchIndex(entries, 'gold crm').length, 0);
});

test('type filter and empty query', () => {
    assert.deepEqual(searchIndex(entries, 'loyalty', { types: ['schema'] }).map((x) => x.type), ['schema']);
    assert.equal(scoreEntry(entries[0], '   '), 0);
});

const NOW = Date.parse('2026-11-01T12:00:00Z');
const h = (n) => NOW - n * 3600 * 1000;

test('audit flags failing datasets, broken flows, stale audiences and missing default merge policy', () => {
    const out = runAudit({
        now: NOW,
        datasets: [
            { id: 'd1', name: 'Orders', schema: 's1', profileEnabled: true },
            { id: 'd2', name: 'Web events', schema: 's2', profileEnabled: false }
        ],
        schemas: [{ id: 's1', title: 'Orders' }, { id: 's2', title: 'Web' }, { id: 's3', title: 'Draft schema' }],
        batches: [
            { id: 'b1', status: 'failed', created: h(1), datasetId: 'd1' },
            { id: 'b2', status: 'failed', created: h(2), datasetId: 'd1' },
            { id: 'b3', status: 'success', created: h(3), datasetId: 'd1' },
            { id: 'b4', status: 'failed', created: h(1), datasetId: 'd2' },
            { id: 'b5', status: 'success', created: h(5), datasetId: 'd2' }
        ],
        flows: [{ id: 'f1', name: 'CRM', state: 'enabled' }, { id: 'f2', name: 'Old', state: 'disabled' }],
        flowRuns: [
            { id: 'r1', flowId: 'f1', state: 'failed', createdAt: h(1) },
            { id: 'r2', flowId: 'f1', state: 'failed', createdAt: h(25) },
            { id: 'r3', flowId: 'f2', state: 'failed', createdAt: h(1) },
            { id: 'r4', flowId: 'f2', state: 'failed', createdAt: h(2) }
        ],
        audiences: [
            { id: 'a1', name: 'Edited', evaluation: 'batch', updated: h(2), totalProfiles: 10 },
            { id: 'a2', name: 'Empty', evaluation: 'batch', updated: h(100), totalProfiles: 0 },
            { id: 'a3', name: 'Streaming edited', evaluation: 'streaming', updated: h(2), totalProfiles: 5 }
        ],
        segmentJobs: [{ segmentIds: ['a1', 'a2', 'a3'], status: 'SUCCEEDED', updated: h(20) }],
        mergePolicies: [{ id: 'm1', name: 'Custom', default: false }]
    });
    const ids = out.findings.map((f) => f.id);
    assert.ok(ids.includes('dataset-failing-d1'));
    assert.ok(ids.includes('dataset-lastfailed-d2'));
    assert.ok(ids.includes('schema-orphan-s3'));
    assert.ok(ids.includes('flow-failing-f1'));
    assert.ok(!ids.includes('flow-failing-f2'), 'disabled flows are not flagged');
    assert.ok(ids.includes('audience-edited-a1'));
    assert.ok(!ids.includes('audience-edited-a3'), 'streaming audiences evaluate continuously');
    assert.ok(ids.includes('audience-empty-a2'));
    assert.ok(ids.includes('merge-no-default'));
    assert.equal(out.findings[0].severity, 'high');
    assert.ok(out.score < 100 && out.score >= 0);
});

test('audit of a clean sandbox scores 100', () => {
    const out = runAudit({
        now: NOW,
        datasets: [{ id: 'd1', name: 'Orders', schema: 's1', profileEnabled: true }],
        schemas: [{ id: 's1', title: 'Orders' }],
        batches: [{ id: 'b1', status: 'success', created: h(1), datasetId: 'd1' }],
        flows: [], flowRuns: [], audiences: [], segmentJobs: [],
        mergePolicies: [{ id: 'm1', name: 'Default', default: true }]
    });
    assert.deepEqual(out.findings, []);
    assert.equal(out.score, 100);
});

test('audit tolerates missing sections', () => {
    const out = runAudit({});
    assert.equal(out.score, 100);
});
