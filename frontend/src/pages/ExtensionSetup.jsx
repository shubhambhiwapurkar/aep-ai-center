import { useEffect, useMemo, useState } from 'react';
import { BACKEND_URL, getApiToken, setApiToken, getExtensionStatus, getExtensionWhoami } from '../services/api';
import { CopyButton } from '../components/SharedComponents';

/**
 * Chrome extension hub: connection status, API token for this web app, install steps for
 * individuals, and a Chrome Enterprise policy generator for IT rollouts.
 */
export default function ExtensionSetup() {
    const [status, setStatus] = useState(null);
    const [who, setWho] = useState(null);
    const [error, setError] = useState('');
    const [token, setToken] = useState(getApiToken());
    const [saved, setSaved] = useState(false);
    const [policy, setPolicy] = useState({
        orgName: '',
        supportUrl: '',
        backendUrl: BACKEND_URL,
        includeToken: false,
        backendToken: '',
        provider: '',
        allowedProviders: [],
        disableAi: false,
        followPageSandbox: true
    });

    const check = async () => {
        let s = null;
        try {
            s = await getExtensionStatus();
        } catch (e) {
            setStatus(null);
            setWho(null);
            setError(`${e.message}. Is the backend running at ${BACKEND_URL}?`);
            return;
        }
        setStatus(s);
        try {
            setWho(await getExtensionWhoami());
            setError('');
        } catch (e) {
            setWho(null);
            setError(e.message);
        }
    };

    useEffect(() => {
        // Initial status probe; all state updates happen after the awaited request.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        check();
    }, []);

    const saveToken = () => {
        setApiToken(token.trim());
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
        check();
    };

    const policyJson = useMemo(() => {
        const p = {};
        if (policy.orgName) p.orgName = { Value: policy.orgName };
        if (policy.supportUrl) p.supportUrl = { Value: policy.supportUrl };
        if (policy.backendUrl) p.backendUrl = { Value: policy.backendUrl };
        if (policy.includeToken && policy.backendToken) p.backendToken = { Value: policy.backendToken };
        if (policy.provider) p.provider = { Value: policy.provider };
        if (policy.allowedProviders.length) p.allowedProviders = { Value: policy.allowedProviders };
        if (policy.disableAi) p.disableAi = { Value: true };
        p.followPageSandbox = { Value: policy.followPageSandbox };
        return JSON.stringify(p, null, 2);
    }, [policy]);

    const set = (patch) => setPolicy({ ...policy, ...patch });
    const toggleProvider = (id) => set({ allowedProviders: policy.allowedProviders.includes(id) ? policy.allowedProviders.filter((x) => x !== id) : [...policy.allowedProviders, id] });

    const connected = who?.connection?.connected;

    return (
        <div className="page-container ext-setup">
            <div className="page-header">
                <h1>🧩 Chrome Extension</h1>
                <p>AEP AI Center in a side panel next to Adobe Experience Platform and Journey Optimizer. It recognises the page you are on, finds any object, audits the sandbox and designs journeys. It reads metadata only, through this backend.</p>
            </div>

            <section className="ext-card">
                <div className="ext-row between">
                    <h2>Connection</h2>
                    <button className="btn btn-secondary" onClick={check}>Re-check</button>
                </div>
                <div className="ext-grid">
                    <Stat label="Backend" ok={Boolean(status)} value={status ? `v${status.version} at ${BACKEND_URL}` : 'Unreachable'} />
                    <Stat label="API token" ok={!status?.tokenRequired || Boolean(who)} value={!status ? '-' : status.tokenRequired ? (who ? 'Required · accepted' : 'Required · missing or wrong') : 'Not required (set API_TOKEN to require one)'} warn={status && !status.tokenRequired} />
                    <Stat label="Adobe Experience Platform" ok={connected} value={who ? (connected ? `Connected · sandbox ${who.sandbox}` : `Auth failed: ${who.connection?.error || 'check backend/.env'}`) : '-'} />
                </div>
                {error && <div className="ext-alert">{error}</div>}
            </section>

            <section className="ext-card">
                <h2>API token for this web app</h2>
                <p className="ext-muted">Only needed when the backend sets <code>API_TOKEN</code>. Stored in this browser's local storage and sent as a bearer token.</p>
                <div className="ext-row">
                    <input className="ext-input" type="password" autoComplete="off" value={token} placeholder="API token" onChange={(e) => setToken(e.target.value)} />
                    <button className="btn btn-primary" onClick={saveToken}>{saved ? 'Saved' : 'Save'}</button>
                </div>
            </section>

            <section className="ext-card">
                <h2>Install for yourself</h2>
                <ol className="ext-steps">
                    <li>Build it: <code>cd extension &amp;&amp; npm install &amp;&amp; npm run build</code></li>
                    <li>Open <code>chrome://extensions</code>, switch on <strong>Developer mode</strong>, click <strong>Load unpacked</strong> and pick <code>extension/dist</code>.</li>
                    <li>Click the toolbar icon (or press <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>A</kbd>) to open the side panel.</li>
                    <li>In the panel: <strong>Settings → AEP AI Center backend</strong>. Enter <code>{BACKEND_URL}</code>{status?.tokenRequired ? ' and the API token' : ''}, then <strong>Save &amp; test connection</strong>.</li>
                    <li>Optional: add your own LLM key (Claude, Azure OpenAI/OpenAI, Gemini or a local model) for explanations, briefings and journey drafting.</li>
                </ol>
                <p className="ext-muted">Lock the backend to your extension: set <code>ALLOWED_EXTENSION_IDS</code> in <code>backend/.env</code> to the id shown on <code>chrome://extensions</code>.</p>
            </section>

            <section className="ext-card">
                <h2>Roll out to your organization</h2>
                <p className="ext-muted">Push settings to every user with Chrome Enterprise. In the Google Admin console: <strong>Devices → Chrome → Apps &amp; extensions → Users &amp; browsers</strong>, add the extension, then paste this into <strong>Policy for extensions</strong>. Managed values are locked in the extension's Settings.</p>
                <div className="ext-form">
                    <label>Organization name<input className="ext-input" value={policy.orgName} onChange={(e) => set({ orgName: e.target.value })} placeholder="Acme Marketing Ops" /></label>
                    <label>Support URL<input className="ext-input" value={policy.supportUrl} onChange={(e) => set({ supportUrl: e.target.value })} placeholder="https://wiki.acme.com/aep-ai-center" /></label>
                    <label>Backend URL<input className="ext-input" value={policy.backendUrl} onChange={(e) => set({ backendUrl: e.target.value })} /></label>
                    <label>Default LLM provider
                        <select className="ext-input" value={policy.provider} onChange={(e) => set({ provider: e.target.value })}>
                            <option value="">Let users choose</option>
                            <option value="anthropic">Anthropic Claude</option>
                            <option value="openai">OpenAI-compatible / Azure OpenAI</option>
                            <option value="gemini">Google Gemini</option>
                        </select>
                    </label>
                    <div className="ext-checks">
                        <span>Allowed providers</span>
                        {[['anthropic', 'Claude'], ['openai', 'OpenAI / Azure'], ['gemini', 'Gemini']].map(([id, label]) => (
                            <label key={id}><input type="checkbox" checked={policy.allowedProviders.includes(id)} onChange={() => toggleProvider(id)} /> {label}</label>
                        ))}
                    </div>
                    <div className="ext-checks">
                        <label><input type="checkbox" checked={policy.followPageSandbox} onChange={(e) => set({ followPageSandbox: e.target.checked })} /> Follow the sandbox open in AEP</label>
                        <label><input type="checkbox" checked={policy.disableAi} onChange={(e) => set({ disableAi: e.target.checked })} /> Turn off AI features</label>
                        <label><input type="checkbox" checked={policy.includeToken} onChange={(e) => set({ includeToken: e.target.checked })} /> Include the backend API token</label>
                    </div>
                    {policy.includeToken && <label>Backend API token<input className="ext-input" type="password" value={policy.backendToken} onChange={(e) => set({ backendToken: e.target.value })} /></label>}
                </div>
                <div className="ext-row between">
                    <strong>Policy JSON</strong>
                    <CopyButton text={policyJson} label="Copy JSON" />
                </div>
                <pre className="ext-code">{policyJson}</pre>
                <p className="ext-muted">Windows (GPO/registry) and macOS (configuration profile) use the same keys under <code>3rdparty\extensions\&lt;extension id&gt;\policy</code>. The full schema ships in <code>extension/public/managed_schema.json</code>.</p>
            </section>
        </div>
    );
}

function Stat({ label, value, ok, warn }) {
    const color = ok ? (warn ? 'var(--accent-yellow)' : 'var(--accent-green)') : 'var(--accent-red)';
    return (
        <div className="ext-stat">
            <span className="ext-muted">{label}</span>
            <span><span className="ext-dot" style={{ background: color }} />{value}</span>
        </div>
    );
}
