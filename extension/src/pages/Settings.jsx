import { useState } from 'react';
import { PROVIDERS, chat, ensureHostPermissions } from '../lib/llm.js';
import { checkBackend } from '../lib/backend.js';

export default function Settings({ settings, locked = new Set(), policy = {}, onChange }) {
    const [draft, setDraft] = useState(settings);
    const [status, setStatus] = useState('');
    const [backendStatus, setBackendStatus] = useState(null);
    const set = (patch) => setDraft({ ...draft, ...patch });
    const isLocked = (k) => locked.has(k);
    const lockNote = (k) => isLocked(k) && <span className="managed">Managed by your organization</span>;
    const providers = Object.entries(PROVIDERS).filter(([k]) => !policy.allowedProviders?.length || policy.allowedProviders.includes(k));

    const persist = async () => {
        // Custom endpoints (Azure, self-hosted, remote backend) need the user to grant that host
        const hosts = [draft.backendUrl, draft.provider === 'openai' ? draft.baseUrl : null].filter(Boolean);
        if (!(await ensureHostPermissions(hosts))) {
            setStatus(`Access to ${hosts.join(', ')} was not granted.`);
            return false;
        }
        onChange(draft);
        return true;
    };

    const test = async () => {
        if (!(await persist())) return;
        setStatus('Testing…');
        try {
            const { text } = await chat(draft, { system: 'Reply with exactly: OK', messages: [{ role: 'user', content: 'ping' }], maxTokens: 20 });
            setStatus(`Connected ✓ (${text.trim().slice(0, 40)})`);
        } catch (e) {
            setStatus(`Failed: ${e.message}`);
        }
    };

    const testBackend = async () => {
        if (!(await persist())) return;
        setBackendStatus({ pending: true });
        setBackendStatus(await checkBackend(draft));
    };

    return (
        <div className="settings">
            {policy?.orgName && (
                <div className="banner">
                    <span>Some settings are managed by <strong>{policy.orgName}</strong>.{policy.supportUrl && <> Need help? <a href={policy.supportUrl} target="_blank" rel="noreferrer">Contact support</a>.</>}</span>
                </div>
            )}

            <section className="card">
                <h3>LLM provider</h3>
                {settings.aiDisabled ? (
                    <div className="notice">AI features are turned off by your organization. Explore, Tools (except AI rewrites), Context and Journeys still work.</div>
                ) : (
                    <>
                        <label className="field">Provider {lockNote('provider')}
                            <select disabled={isLocked('provider')} value={draft.provider} onChange={(e) => set({ provider: e.target.value, model: PROVIDERS[e.target.value].defaultModel })}>
                                {providers.map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}
                            </select>
                        </label>
                        {PROVIDERS[draft.provider]?.needsBaseUrl && (
                            <label className="field">Base URL {lockNote('baseUrl')}
                                <input disabled={isLocked('baseUrl')} value={draft.baseUrl} onChange={(e) => set({ baseUrl: e.target.value })} />
                                <span className="muted small">OpenAI: https://api.openai.com/v1 · Azure: https://&lt;res&gt;.openai.azure.com/openai/deployments/&lt;deployment&gt;?api-version=… · Ollama: http://localhost:11434/v1</span>
                            </label>
                        )}
                        <label className="field">Model {lockNote('model')}<input disabled={isLocked('model')} value={draft.model} placeholder="model id" onChange={(e) => set({ model: e.target.value })} /></label>
                        <label className="field">API key {lockNote('apiKey')}<input disabled={isLocked('apiKey')} type="password" value={isLocked('apiKey') ? '••••••••' : draft.apiKey} autoComplete="off" onChange={(e) => set({ apiKey: e.target.value })} /></label>
                        <div className="row">
                            <button className="primary" onClick={async () => (await persist()) && setStatus('Saved.')}>Save</button>
                            <button onClick={test}>Save & test</button>
                        </div>
                        {status && <div className="notice">{status}</div>}
                    </>
                )}
            </section>

            <section className="card">
                <h3>AEP AI Center backend</h3>
                <p className="muted small">Powers the home screen, Explore, the sandbox audit and Context → Sync, using your Adobe Developer Console server-to-server credentials (see backend/.env). The extension never holds your Adobe client secret.</p>
                <label className="field">URL {lockNote('backendUrl')}<input disabled={isLocked('backendUrl')} value={draft.backendUrl} onChange={(e) => set({ backendUrl: e.target.value })} /></label>
                <label className="field">API token {lockNote('backendToken')}
                    <input disabled={isLocked('backendToken')} type="password" autoComplete="off" value={isLocked('backendToken') ? '••••••••' : (draft.backendToken || '')} placeholder="Only if the backend sets API_TOKEN" onChange={(e) => set({ backendToken: e.target.value })} />
                </label>
                <label className="row small">
                    <input type="checkbox" disabled={isLocked('followPageSandbox')} checked={draft.followPageSandbox !== false} onChange={(e) => set({ followPageSandbox: e.target.checked })} />
                    Follow the sandbox open in the AEP tab (otherwise use the sandbox set on the active context)
                </label>
                <div className="row">
                    <button className="primary" onClick={async () => (await persist()) && setBackendStatus({ saved: true })}>Save</button>
                    <button onClick={testBackend}>Save & test connection</button>
                </div>
                {backendStatus?.pending && <div className="notice">Checking…</div>}
                {backendStatus?.saved && <div className="notice">Saved.</div>}
                {backendStatus && 'ok' in backendStatus && (
                    backendStatus.ok ? (
                        <div className="notice">
                            <span className={`status-light ${backendStatus.connected ? 'positive' : 'notice'}`}>
                                Backend v{backendStatus.version} reachable{backendStatus.tokenRequired ? ' · token accepted' : ''} · sandbox {backendStatus.sandbox} · {backendStatus.connected ? 'connected to AEP' : `AEP auth failed: ${backendStatus.connection?.error || 'check backend/.env'}`}
                            </span>
                        </div>
                    ) : <div className="notice"><span className="status-light negative">{backendStatus.message}</span></div>
                )}
            </section>

            <section className="card">
                <h3>Data handling</h3>
                <ul className="small">
                    <li>Your API key and all context stay in this browser (chrome.storage.local). There is no AEP AI Center cloud.</li>
                    <li>Only metadata is used: schemas, field paths, identity namespaces, audience rules, journey structure, object names, states and error codes. There are no profile lookups.</li>
                    <li>The page awareness feature reads only the address of the active Adobe tab to find the sandbox and object id. Profile and identity pages are ignored because their addresses can contain identity values.</li>
                    <li>Everything sent to the LLM is scanned and emails, phone numbers, card numbers, IPs and ECIDs are redacted first.</li>
                    <li>Prompts go directly to the provider you choose, under your agreement with them. Use Azure OpenAI or a local model if data must stay in your tenant.</li>
                </ul>
            </section>

            <section className="card">
                <h3>Keyboard</h3>
                <ul className="small">
                    <li><kbd>Ctrl</kbd> <kbd>K</kbd> / <kbd>⌘</kbd> <kbd>K</kbd> inside the panel: command palette.</li>
                    <li><kbd>Alt</kbd> <kbd>Shift</kbd> <kbd>A</kbd>: open the panel from any tab (change it at chrome://extensions/shortcuts).</li>
                </ul>
            </section>
        </div>
    );
}
