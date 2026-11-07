import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

// Config is read at import time, so set the environment first.
process.env.API_TOKEN = 'test-token-123';
process.env.SANDBOX_NAME = 'prod';
process.env.ALLOWED_ORIGINS = 'https://aep.acme.internal';
process.env.ALLOWED_EXTENSION_IDS = '';

const { default: app } = await import('../src/index.js');
const { isOriginAllowed } = await import('../src/middleware/security.js');
const { runWithSandbox, getSandboxName, isValidSandboxName } = await import('../src/config/config.js');

let server;
let base;
before(async () => {
    server = app.listen(0, '127.0.0.1');
    await new Promise((r) => server.once('listening', r));
    base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const auth = { Authorization: 'Bearer test-token-123' };

test('origin allowlist', () => {
    const cfg = { allowedOrigins: ['https://aep.acme.internal'], allowedExtensionIds: [] };
    assert.ok(isOriginAllowed(undefined, cfg));
    assert.ok(isOriginAllowed('http://localhost:5173', cfg));
    assert.ok(isOriginAllowed('http://127.0.0.1:3000', cfg));
    assert.ok(isOriginAllowed('chrome-extension://abcdefghijklmnopabcdefghijklmnop', cfg));
    assert.ok(isOriginAllowed('https://aep.acme.internal', cfg));
    assert.ok(!isOriginAllowed('https://evil.example', cfg));
    assert.ok(!isOriginAllowed('http://localhost.evil.example', cfg));
    const pinned = { allowedOrigins: [], allowedExtensionIds: ['abcdefghijklmnopabcdefghijklmnop'] };
    assert.ok(isOriginAllowed('chrome-extension://abcdefghijklmnopabcdefghijklmnop', pinned));
    assert.ok(!isOriginAllowed('chrome-extension://ppppppppppppppppppppppppppppppppp'.slice(0, 51), pinned));
});

test('public endpoints work without a token', async () => {
    const s = await (await fetch(`${base}/api/ext/status`)).json();
    assert.equal(s.tokenRequired, true);
    assert.equal((await fetch(`${base}/health`)).status, 200);
});

test('API requires the token', async () => {
    assert.equal((await fetch(`${base}/api/sandbox/current`)).status, 401);
    assert.equal((await fetch(`${base}/api/sandbox/current`, { headers: { Authorization: 'Bearer wrong' } })).status, 401);
    const ok = await fetch(`${base}/api/sandbox/current`, { headers: { 'x-aep-ai-center-token': 'test-token-123' } });
    assert.equal(ok.status, 200);
});

test('foreign browser origins are rejected before auth', async () => {
    const r = await fetch(`${base}/api/sandbox/current`, { headers: { ...auth, Origin: 'https://evil.example' } });
    assert.equal(r.status, 403);
});

test('per-request sandbox header is honoured without changing the default', async () => {
    const r = await (await fetch(`${base}/api/sandbox/current`, { headers: { ...auth, 'x-sandbox-name': 'dev-2' } })).json();
    assert.equal(r.sandbox, 'dev-2');
    assert.equal(r.default, 'prod');
    const d = await (await fetch(`${base}/api/sandbox/current`, { headers: auth })).json();
    assert.equal(d.sandbox, 'prod');
});

test('invalid sandbox names are ignored or rejected', async () => {
    const r = await (await fetch(`${base}/api/sandbox/current`, { headers: { ...auth, 'x-sandbox-name': '../etc' } })).json();
    assert.equal(r.sandbox, 'prod');
    const sw = await fetch(`${base}/api/sandbox/switch`, { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ sandbox: 'a b' }) });
    assert.equal(sw.status, 400);
});

test('entity route validates type and id', async () => {
    assert.equal((await fetch(`${base}/api/ext/entity/journey/abc`, { headers: auth })).status, 400);
    assert.equal((await fetch(`${base}/api/ext/entity/dataset/${encodeURIComponent('a b')}`, { headers: auth })).status, 400);
});

test('segment preview needs an expression', async () => {
    const r = await fetch(`${base}/api/segment-preview`, { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(r.status, 400);
});

test('AsyncLocalStorage keeps concurrent sandboxes apart', async () => {
    const seen = await Promise.all(['dev-a', 'dev-b', 'dev-c'].map((s) => runWithSandbox(s, async () => {
        await new Promise((r) => setTimeout(r, 5));
        return getSandboxName();
    })));
    assert.deepEqual(seen, ['dev-a', 'dev-b', 'dev-c']);
    assert.equal(getSandboxName(), 'prod');
    assert.ok(isValidSandboxName('my-dev-01'));
    assert.ok(!isValidSandboxName('../x'));
});
