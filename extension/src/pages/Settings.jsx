import { useState } from 'react';
import { PROVIDERS, chat, ensureHostPermissions } from '../lib/llm.js';

export default function Settings({ settings, onChange }) {
    const [draft, setDraft] = useState(settings);
    const [status, setStatus] = useState('');
    const set = (patch) => setDraft({ ...draft, ...patch });

    const persist = async () => {
        // Custom endpoints (Azure, self-hosted) need the user to grant that host
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

    return (
        <div className="settings">
            <section className="card">
                <h3>LLM provider</h3>
                <label className="field">Provider
                    <select value={draft.provider} onChange={(e) => set({ provider: e.target.value, model: PROVIDERS[e.target.value].defaultModel })}>
                        {Object.entries(PROVIDERS).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}
                    </select>
                </label>
                {PROVIDERS[draft.provider].needsBaseUrl && (
                    <label className="field">Base URL
                        <input value={draft.baseUrl} onChange={(e) => set({ baseUrl: e.target.value })} />
                        <span className="muted small">OpenAI: https://api.openai.com/v1 · Azure: https://&lt;res&gt;.openai.azure.com/openai/deployments/&lt;deployment&gt;?api-version=… · Ollama: http://localhost:11434/v1</span>
                    </label>
                )}
                <label className="field">Model<input value={draft.model} placeholder="model id" onChange={(e) => set({ model: e.target.value })} /></label>
                <label className="field">API key<input type="password" value={draft.apiKey} autoComplete="off" onChange={(e) => set({ apiKey: e.target.value })} /></label>
                <div className="row">
                    <button className="primary" onClick={async () => (await persist()) && setStatus('Saved.')}>Save</button>
                    <button onClick={test}>Save & test</button>
                </div>
                {status && <div className="notice">{status}</div>}
            </section>

            <section className="card">
                <h3>AEP AI Center backend</h3>
                <label className="field">URL<input value={draft.backendUrl} onChange={(e) => set({ backendUrl: e.target.value })} /></label>
                <p className="muted small">Optional. Used by Context → Sync to read sandbox metadata with your server-to-server credentials (see backend/.env).</p>
            </section>

            <section className="card">
                <h3>Data handling</h3>
                <ul className="small">
                    <li>Your API key and all context stay in this browser (chrome.storage.local). There is no AEP AI Center cloud.</li>
                    <li>Only metadata is used: schemas, field paths, identity namespaces, audience rules, journey structure. There are no profile lookups.</li>
                    <li>Everything sent to the LLM is scanned and emails, phone numbers, card numbers, IPs and ECIDs are redacted first.</li>
                    <li>Prompts go directly to the provider you choose, under your agreement with them. Use Azure OpenAI or a local model if data must stay in your tenant.</li>
                </ul>
            </section>
        </div>
    );
}
