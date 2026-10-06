import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attentionItems, computeHealth, hourlyBuckets, isConnected } from '../src/lib/vitals.js';

const now = Date.parse('2026-10-06T12:30:00Z');
const vitals = (over = {}) => ({
    sandbox: 'dev',
    connection: { ok: true, data: { connected: true } },
    ingestion: { ok: true, data: { total: 100, success: 90, failed: 10, successRate: 90, timeline: [{ hour: '2026-10-06T12', success: 5, failed: 1, other: 0 }, { hour: '2026-10-01T00', success: 99, failed: 0 }], failures: [{ id: 'b1', datasetId: 'd1', created: now - 3600e3, errors: [{ code: 'INGEST-1212', message: 'Missing required field' }] }] } },
    dataflows: { ok: true, data: { runs: 20, runsByState: { failed: 2, success: 18 }, failures: [{ id: 'r1', flowName: 'CRM daily', createdAt: new Date(now - 60e3).toISOString(), errors: [] }] } },
    profiles: { ok: true, data: {} },
    audiences: { ok: true, data: {} },
    schemas: { ok: true, data: {} },
    datasets: { ok: true, data: {} },
    ...over
});

test('health score weighs ingestion, dataflow failures and unreadable sections', () => {
    const h = computeHealth(vitals());
    // 100 - 10*0.6 - 10*0.3 = 91
    assert.equal(h.score, 91);
    assert.equal(h.level, 'positive');
    assert.equal(h.reasons.length, 2);

    const worse = computeHealth(vitals({ profiles: { ok: false, error: '403' }, audiences: { ok: false, error: '403' } }));
    assert.equal(worse.score, 81);
    assert.equal(worse.level, 'notice');
    assert.match(worse.reasons.at(-1), /profiles, audiences/);

    const clean = computeHealth(vitals({ ingestion: { ok: true, data: { successRate: null } }, dataflows: { ok: true, data: { runs: 0 } } }));
    assert.equal(clean.score, 100);
    assert.equal(clean.label, 'Healthy');
});

test('not connected yields no score', () => {
    const v = vitals({ connection: { ok: true, data: { connected: false, error: '401' } } });
    assert.equal(isConnected(v), false);
    assert.equal(computeHealth(v).score, null);
    assert.equal(computeHealth(null).label, 'Not connected');
});

test('attention items merge batches and runs, newest first, with dataset names from context', () => {
    const items = attentionItems(vitals(), { datasets: [{ id: 'd1', name: 'CRM Profiles' }] });
    assert.deepEqual(items.map((i) => i.kind), ['flow', 'batch']);
    assert.equal(items[1].title, 'Batch failed · CRM Profiles');
    assert.equal(items[1].errors[0].code, 'INGEST-1212');
});

test('hourly buckets cover exactly the last 24 hours', () => {
    const b = hourlyBuckets(vitals(), now);
    assert.equal(b.length, 24);
    assert.equal(b.at(-1).hour, '2026-10-06T12');
    assert.equal(b.at(-1).success, 5);
    assert.equal(b.reduce((s, x) => s + x.success, 0), 5, 'data older than 24h is excluded');
});
