import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAepUrl, describePage } from '../src/lib/aepPage.js';
import { lintSql, stripSql } from '../src/lib/sqlLint.js';
import { findFields, expandQuery } from '../src/lib/fieldFinder.js';
import { applyPolicy } from '../src/lib/managed.js';
import { backendHeaders, backendBase } from '../src/lib/backend.js';

const BASE = 'https://experience.adobe.com/#/@acme/sname:dev-eu';

test('AEP URL: dataset, sandbox and org', () => {
    const p = parseAepUrl(`${BASE}/platform/dataset/browse/64a1f0c2e5b7d1001c3e9a77`);
    assert.equal(p.org, 'acme');
    assert.equal(p.sandbox, 'dev-eu');
    assert.equal(p.app, 'platform');
    assert.deepEqual(p.entity, { type: 'dataset', id: '64a1f0c2e5b7d1001c3e9a77' });
    assert.equal(describePage(p), 'Dataset · dev-eu');
});

test('AEP URL: audiences, flows, journeys, schemas, batches', () => {
    const uuid = '0b5c7d2e-3f4a-4b6c-8d9e-0f1a2b3c4d5e';
    assert.deepEqual(parseAepUrl(`${BASE}/platform/segment/edit/${uuid}`).entity, { type: 'audience', id: uuid });
    assert.deepEqual(parseAepUrl(`${BASE}/platform/audience/details/${uuid}?tab=overview`).entity, { type: 'audience', id: uuid });
    assert.deepEqual(parseAepUrl(`${BASE}/platform/source/dataflows/${uuid}/activity`).entity, { type: 'flow', id: uuid });
    assert.deepEqual(parseAepUrl(`${BASE}/journey-optimizer/journeys/journey/${uuid}`).entity, { type: 'journey', id: uuid });
    assert.deepEqual(parseAepUrl(`${BASE}/platform/schema/edit/_acme.schemas.8f3a2c1d9e`).entity, { type: 'schema', id: '_acme.schemas.8f3a2c1d9e' });
    const encoded = encodeURIComponent('https://ns.adobe.com/acme/schemas/8f3a2c1d9e');
    assert.deepEqual(parseAepUrl(`${BASE}/platform/schema/edit/${encoded}`).entity, { type: 'schema', id: 'https://ns.adobe.com/acme/schemas/8f3a2c1d9e' });
    assert.deepEqual(parseAepUrl(`${BASE}/platform/dataset/activity/batches/01HQ3V9Z8K7M6N5P4R3S2T1V0W`).entity, { type: 'batch', id: '01HQ3V9Z8K7M6N5P4R3S2T1V0W' });
});

test('AEP URL: list pages, other sites and profile privacy', () => {
    const list = parseAepUrl(`${BASE}/platform/dataset/browse`);
    assert.equal(list.entity, null);
    assert.equal(list.areaLabel, 'Datasets');
    assert.equal(parseAepUrl('https://example.com/#/@acme/sname:dev/platform/dataset/browse/64a1f0c2e5b7d1001c3e9a77'), null);
    assert.equal(parseAepUrl('not a url'), null);
    // Profile URLs can contain identity values; they must never be captured.
    const prof = parseAepUrl(`${BASE}/platform/profile/browse/Email/jane%40example.com`);
    assert.equal(prof.entity, null);
    assert.equal(prof.private, true);
    const ecid = parseAepUrl(`${BASE}/platform/profile/detail/0b5c7d2e-3f4a-4b6c-8d9e-0f1a2b3c4d5e`);
    assert.equal(ecid.entity, null);
});

const ids = (sql) => lintSql(sql).map((i) => i.id);

test('SQL lint: classic anti-patterns', () => {
    const bad = ids('SELECT * FROM web_events ORDER BY timestamp');
    for (const id of ['select-star', 'no-time-filter', 'order-no-limit']) assert.ok(bad.includes(id), `${id} in ${bad}`);
    assert.ok(ids("SELECT a FROM t WHERE date(timestamp) = '2026-01-01' LIMIT 5").includes('fn-on-timestamp'));
    assert.ok(ids('SELECT count(distinct id) FROM t WHERE timestamp > now()').includes('count-distinct'));
    assert.ok(ids('SELECT a.x FROM a, b').includes('cartesian'));
    assert.ok(ids('SELECT a.x FROM a JOIN b LIMIT 1').includes('join-no-on'));
    assert.ok(ids("SELECT identityMap['Email'] FROM t WHERE timestamp > now() LIMIT 1").includes('identitymap-array'));
    assert.ok(ids("CREATE TABLE x AS SELECT a FROM t WHERE timestamp > now()").includes('ctas-no-schema'));
    assert.ok(ids('DROP TABLE x').includes('destructive'));
    assert.ok(ids('SELECT _acme.loyalty-tier FROM t WHERE timestamp > now() LIMIT 1').includes('unquoted-hyphen'));
});

test('SQL lint: good queries stay quiet', () => {
    const good = "SELECT web.webPageDetails.name, count(1) AS views FROM web_events WHERE timestamp >= now() - INTERVAL '7' DAY GROUP BY 1";
    assert.deepEqual(ids(good), []);
    assert.deepEqual(ids("SELECT _acme.\"loyalty-tier\" FROM profile_snapshot_export LIMIT 10"), []);
    assert.deepEqual(ids("SELECT a FROM t WHERE timestamp > now() AND note = 'select * from x' LIMIT 1 -- order by"), []);
    assert.deepEqual(lintSql(''), []);
    assert.ok(!stripSql("x = 'DROP TABLE y'").includes('DROP'));
});

test('field finder ranks the right XDM paths', () => {
    const ctx = {
        schemas: [{
            title: 'Loyalty Profile',
            fields: [
                { path: '_acme.loyalty.pointsBalance', type: 'integer', title: 'Points balance' },
                { path: '_acme.loyalty.tier', type: 'string', title: 'Tier', enum: ['gold', 'silver'] },
                { path: 'personalEmail.address', type: 'string', title: 'Address' },
                { path: 'homeAddress.postalCode', type: 'string', title: 'Postal code' }
            ]
        }],
        dataDictionary: [{ field: 'crm_loyalty_points', type: 'int', description: 'Loyalty points from CRM', source: 'CRM' }]
    };
    assert.equal(findFields(ctx, 'loyalty points')[0].path, '_acme.loyalty.pointsBalance');
    assert.equal(findFields(ctx, 'tier')[0].path, '_acme.loyalty.tier');
    assert.equal(findFields(ctx, 'email')[0].path, 'personalEmail.address');
    assert.equal(findFields(ctx, 'zip')[0].path, 'homeAddress.postalCode');
    assert.ok(findFields(ctx, 'loyalty points').some((f) => f.kind === 'dictionary'));
    assert.deepEqual(findFields(ctx, 'xyzzy'), []);
    assert.deepEqual(expandQuery('')[0], undefined);
});

test('enterprise policy locks and overrides settings', () => {
    const user = { provider: 'openai', model: 'x', backendUrl: 'http://localhost:3001', apiKey: '' };
    const { settings, locked } = applyPolicy(user, { backendUrl: 'https://aep-ai.acme.internal', allowedProviders: ['anthropic'] });
    assert.equal(settings.backendUrl, 'https://aep-ai.acme.internal');
    assert.ok(locked.has('backendUrl'));
    assert.equal(settings.provider, 'anthropic');
    assert.equal(applyPolicy(user, { disableAi: true }).settings.aiDisabled, true);
    assert.deepEqual(applyPolicy(user, {}).settings, user);
});

test('backend client headers', () => {
    assert.equal(backendBase({ backendUrl: 'http://x:1///' }), 'http://x:1');
    const h = backendHeaders({ backendToken: 't' }, 'dev');
    assert.equal(h.Authorization, 'Bearer t');
    assert.equal(h['x-sandbox-name'], 'dev');
    assert.equal(backendHeaders({}, '').Authorization, undefined);
});
