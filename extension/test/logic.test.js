import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    addPath, buildGuide, buildOrder, byId, insertAfter, layoutJourney, normalizeJourney,
    removeNode, removePath, validateJourney
} from '../src/journey/model.js';
import { TEMPLATES } from '../src/journey/templates.js';
import { analyzeAjoSample, shapeOf } from '../src/journey/ajoAdapter.js';
import { redact } from '../src/lib/pii.js';
import { contextToPrompt, emptyContext, mergeSnapshot, parseCsv, parseDataDictionaryCsv } from '../src/lib/context.js';
import { extractJson } from '../src/lib/llm.js';
import { extractBuildSteps } from '../src/designer/ai.js';

const errorsOf = (j, ctx) => validateJourney(j, ctx).filter((i) => i.level === 'error');

test('every template normalizes and has no validation errors', () => {
    for (const t of TEMPLATES) {
        const j = normalizeJourney(t.journey);
        assert.deepEqual(errorsOf(j), [], `${t.id}: ${JSON.stringify(errorsOf(j))}`);
        assert.equal(buildOrder(j).length, j.nodes.length, `${t.id} has unreachable nodes`);
        assert.ok(buildGuide(j).length >= 3);
        const pos = layoutJourney(j);
        assert.equal(Object.keys(pos).length, j.nodes.length);
    }
});

test('normalize closes dangling paths with End nodes and rejects unknown types', () => {
    const j = normalizeJourney({ nodes: [{ id: 'a', type: 'unitaryEvent', config: { eventName: 'x' } }] });
    assert.equal(j.entry, 'a');
    assert.equal(byId(j).get(byId(j).get('a').next).type, 'end');
    assert.throws(() => normalizeJourney({ nodes: [{ type: 'teleport' }] }), /Unknown activity type/);
});

test('validator catches cycles, bad splits, missing entry and reactions to later messages', () => {
    const cyc = normalizeJourney({
        entry: 'a',
        nodes: [
            { id: 'a', type: 'unitaryEvent', config: { eventName: 'e' }, next: 'b' },
            { id: 'b', type: 'wait', next: 'a' }
        ]
    });
    assert.ok(errorsOf(cyc).some((e) => /loops back/.test(e.message)));

    const split = normalizeJourney({
        entry: 'a',
        nodes: [
            { id: 'a', type: 'readAudience', config: { audienceName: 'x' }, next: 's' },
            { id: 's', type: 'condition', config: { kind: 'percentage split' }, paths: [{ label: 'A', percent: 60 }, { label: 'B', percent: 30 }] }
        ]
    });
    assert.ok(errorsOf(split).some((e) => /100%/.test(e.message)));

    const noEntry = normalizeJourney({ nodes: [{ id: 'w', type: 'wait' }] });
    assert.ok(errorsOf(noEntry).some((e) => /entry activity/.test(e.message)));

    const reactLater = normalizeJourney({
        entry: 'a',
        nodes: [
            { id: 'a', type: 'unitaryEvent', config: { eventName: 'e' }, next: 'r' },
            { id: 'r', type: 'reaction', config: { toMessage: 'm' }, paths: [{ label: 'Clicked', next: 'm' }, { label: 'Timeout', timeout: true }] },
            { id: 'm', type: 'email', config: { message: 'x' } }
        ]
    });
    assert.ok(errorsOf(reactLater).some((e) => /comes after it/.test(e.message)));
});

test('validator warns about names missing from the sandbox context and batch qualification', () => {
    const ctx = { ...emptyContext(), journeyEvents: [{ name: 'accountCreated' }], audiences: [{ name: 'VIP customers', evaluation: 'batch' }] };
    const j = normalizeJourney(TEMPLATES.find((t) => t.id === 'vip').journey);
    const warnings = validateJourney(j, ctx).filter((i) => i.level === 'warning').map((i) => i.message).join('\n');
    assert.match(warnings, /batch audience/);
    const cart = normalizeJourney(TEMPLATES.find((t) => t.id === 'cart').journey);
    assert.match(validateJourney(cart, ctx).map((i) => i.message).join('\n'), /cartAbandoned" is not in your sandbox context/);
});

test('insert, remove and path editing keep the graph connected', () => {
    let j = normalizeJourney(TEMPLATES[0].journey);
    const before = j.nodes.length;
    j = insertAfter(j, 'email1', 'wait');
    const inserted = byId(j).get(byId(j).get('email1').next);
    assert.equal(inserted.type, 'wait');
    assert.equal(inserted.next, 'react1');
    assert.equal(j.nodes.length, before + 1);

    j = removeNode(j, inserted.id);
    assert.equal(byId(j).get('email1').next, 'react1');

    j = removeNode(j, j.entry);
    assert.ok(byId(j).has('start'), 'entry cannot be removed');

    let c = normalizeJourney(TEMPLATES.find((t) => t.id === 'cart').journey);
    c = addPath(c, 'vip');
    assert.equal(byId(c).get('vip').paths.length, 3);
    assert.ok(byId(c).get('vip').paths.at(-1).otherwise, 'fallback path stays last');
    c = removePath(c, 'vip', 1);
    assert.equal(byId(c).get('vip').paths.length, 2);
    assert.equal(buildOrder(c).length, c.nodes.length, 'orphans removed');

    // inserting after a branch keeps the displaced target on the new node
    c = insertAfter(c, 'vip', 'wait', 0);
    const w = byId(c).get(byId(c).get('vip').paths[0].next);
    assert.equal(w.type, 'wait');
    assert.equal(w.next, 'email2');
});

test('PII redaction removes contact data but keeps dates, ids and field paths', () => {
    const { text, hits } = redact('Mail jane.doe@acme.com or +1 (415) 555-0134; ECID 12345678901234567890123456789012345678; card 4111 1111 1111 1111; ip 10.0.0.12');
    assert.doesNotMatch(text, /jane|555-0134|4111|10\.0\.0\.12|12345678901234567890/);
    assert.equal(hits.email, 1);
    assert.equal(hits.phone, 1);
    assert.equal(hits.ecid, 1);
    const safe = 'Launch 2026-10-06 12:30, audience 3f2a1c4e-1111-2222-3333-444455556666, field person.birthDate, wait 29 days, v1.2.3';
    assert.equal(redact(safe).text, safe);
});

test('CSV and data dictionary parsing keeps metadata and drops value columns', () => {
    assert.deepEqual(parseCsv('a,b\n"x, y","he said ""hi"""\r\n'), [['a', 'b'], ['x, y', 'he said "hi"']]);
    const { fields, dropped } = parseDataDictionaryCsv('Field Name,Data Type,Description,Source System,Sample Value\nemail,string,Primary email,CRM,a@b.com\nloyalty_tier,string,Tier,Loyalty,gold\n');
    assert.equal(fields.length, 2);
    assert.deepEqual(fields[0], { field: 'email', type: 'string', description: 'Primary email', source: 'CRM' });
    assert.deepEqual(dropped, ['sample value']);
    assert.ok(!JSON.stringify(fields).includes('a@b.com'));
});

test('mergeSnapshot keeps loaded schema fields and reports failed sections', () => {
    const ctx = { ...emptyContext(), schemas: [{ id: 's1', title: 'Profile', fields: [{ path: 'a', type: 'string' }] }], journeyEvents: [{ name: 'e' }] };
    const snap = {
        sandbox: 'dev',
        schemas: { ok: true, data: [{ id: 's1', title: 'Profile' }, { id: 's2', title: 'Events' }] },
        audiences: { ok: false, error: '403' }
    };
    const { ctx: merged, warnings } = mergeSnapshot(ctx, snap);
    assert.equal(merged.schemas[0].fields.length, 1);
    assert.equal(merged.schemas.length, 2);
    assert.equal(merged.journeyEvents.length, 1);
    assert.deepEqual(warnings, ['audiences: 403']);
    assert.match(contextToPrompt(merged), /Fields of "Profile"/);
});

test('AJO sample analysis strips values but keeps structure and activity kinds', () => {
    const sample = JSON.stringify({ activities: [{ type: 'email', name: 'Spring sale', config: { subject: 'Hi Jane', ids: [1, 2] } }, { nodeType: 'wait', duration: 'P1D' }] });
    const { shape, kinds } = analyzeAjoSample(sample);
    const s = JSON.stringify(shape);
    assert.doesNotMatch(s, /Spring sale|Hi Jane|P1D/);
    assert.match(s, /"\\"email\\""/);
    assert.deepEqual(kinds, { 'type=email': 1, 'nodeType=wait': 1 });
    assert.equal(shapeOf(null), 'null');
    assert.throws(() => analyzeAjoSample('not json'), /not valid JSON/);
});

test('extractJson and build-step extraction handle typical model output', () => {
    assert.deepEqual(extractJson('Sure!\n```json\n{"a":[1,{"b":2}]}\n```\nDone'), { a: [1, { b: 2 }] });
    assert.deepEqual(extractJson('{"x":1}'), { x: 1 });
    const md = '## Datasets\n- [ ] not a step\n## Build steps\n- [ ] **Create namespace** - why\n  - [x] **Create schema** - why\n## Risks\n- [ ] nope';
    assert.deepEqual(extractBuildSteps(md), ['**Create namespace** - why', '**Create schema** - why']);
});
