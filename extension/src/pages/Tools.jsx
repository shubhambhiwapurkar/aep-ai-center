import { useMemo, useState } from 'react';
import Icon from '../components/Icon.jsx';
import Markdown from '../components/Markdown.jsx';
import { lintSql } from '../lib/sqlLint.js';
import { findFields } from '../lib/fieldFinder.js';
import { backendFetch } from '../lib/backend.js';
import { chat, isConfigured } from '../lib/llm.js';
import { contextToPrompt } from '../lib/context.js';
import { ENTITY_LABELS } from '../lib/aepPage.js';

const SUBTABS = [
    { id: 'audit', label: 'Sandbox audit' },
    { id: 'fields', label: 'Field finder' },
    { id: 'sql', label: 'SQL linter' },
    { id: 'size', label: 'Audience size' }
];

export default function Tools({ settings, ctx, sandbox, openEntity, initial }) {
    const [tab, setTab] = useState(initial || 'audit');
    return (
        <div className="tools">
            <h1 className="page-title">Tools</h1>
            <div className="subtabs">
                {SUBTABS.map((t) => <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>{t.label}</button>)}
            </div>
            {tab === 'audit' && <Audit settings={settings} ctx={ctx} sandbox={sandbox} openEntity={openEntity} />}
            {tab === 'fields' && <FieldFinder ctx={ctx} />}
            {tab === 'sql' && <SqlLinter settings={settings} ctx={ctx} />}
            {tab === 'size' && <AudienceSize settings={settings} ctx={ctx} sandbox={sandbox} />}
        </div>
    );
}

const SEV = { high: 'error', medium: 'warning', low: 'info', error: 'error', warning: 'warning', info: 'info' };

function Audit({ settings, ctx, sandbox, openEntity }) {
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [plan, setPlan] = useState('');
    const [planBusy, setPlanBusy] = useState(false);

    const run = async () => {
        setBusy(true);
        setError('');
        setPlan('');
        try {
            setData(await backendFetch(settings, '/api/ext/audit', { sandbox }));
        } catch (e) {
            setError(e.message);
        } finally {
            setBusy(false);
        }
    };

    const makePlan = async () => {
        setPlanBusy(true);
        try {
            const { text } = await chat(settings, {
                system: `You are an Adobe Experience Platform architect. Turn audit findings into a prioritised remediation plan in short markdown: group by owner (data engineering, marketing ops, platform admin), most urgent first, each with the exact AEP UI path. Do not invent findings.\n\n${contextToPrompt(ctx, { maxChars: 5000 })}`,
                messages: [{ role: 'user', content: JSON.stringify({ sandbox: data.sandbox, score: data.score, findings: data.findings.slice(0, 40).map(({ fix, ...f }) => f) }) }],
                maxTokens: 2000
            });
            setPlan(text);
        } catch (e) {
            setPlan(`⚠ ${e.message}`);
        } finally {
            setPlanBusy(false);
        }
    };

    return (
        <section className="card">
            <div className="row between">
                <h3>Sandbox hygiene audit</h3>
                <button className="primary" onClick={run} disabled={busy}><Icon name="refresh" size={14} />{busy ? 'Auditing…' : data ? 'Re-run' : 'Run audit'}</button>
            </div>
            <div className="small muted">Checks failing datasets and dataflows, audiences edited after their last evaluation, empty audiences, orphan schemas and merge policy setup. Reads metadata only.</div>
            {error && <div className="notice">{error}</div>}
            {data && (
                <>
                    <div className="row wrap">
                        <span className="health-score small-score">{data.score}<small>/100</small></span>
                        <span className="pill error">{data.summary.high} high</span>
                        <span className="pill warning">{data.summary.medium} medium</span>
                        <span className="pill info">{data.summary.low} low</span>
                        <span className="small muted">Sandbox {data.sandbox}</span>
                    </div>
                    {data.warnings?.length > 0 && <div className="small muted">Could not read: {data.warnings.join('; ')}</div>}
                    {data.findings.length === 0 && <span className="status-light positive">No findings. Nice and tidy.</span>}
                    <ul className="findings">
                        {data.findings.map((f) => (
                            <li key={f.id}>
                                <div className="row between">
                                    <span><span className={`pill ${SEV[f.severity]}`}>{f.severity}</span> <strong>{f.title}</strong></span>
                                    <span className="small muted">{f.category}</span>
                                </div>
                                <div className="small">{f.detail}</div>
                                <div className="small fix"><Icon name="check" size={12} /> {f.fix}</div>
                                {f.entity && (
                                    <button className="link small" onClick={() => openEntity(f.entity.type, f.entity.id)}>
                                        Open {ENTITY_LABELS[f.entity.type]?.toLowerCase()} “{f.entity.name}”
                                    </button>
                                )}
                            </li>
                        ))}
                    </ul>
                    {data.findings.length > 0 && (
                        <div className="row">
                            <button disabled={!isConfigured(settings) || settings.aiDisabled || planBusy} onClick={makePlan}>
                                <Icon name="sparkle" size={14} />{planBusy ? 'Planning…' : 'Build remediation plan'}
                            </button>
                        </div>
                    )}
                    {plan && <Markdown>{plan}</Markdown>}
                </>
            )}
        </section>
    );
}

function FieldFinder({ ctx }) {
    const [q, setQ] = useState('');
    const results = useMemo(() => findFields(ctx, q), [ctx, q]);
    const fieldCount = (ctx.schemas || []).reduce((n, s) => n + (s.fields?.length || 0), 0) + (ctx.dataDictionary?.length || 0);
    const [copied, setCopied] = useState('');
    const copy = async (p) => {
        try {
            await navigator.clipboard.writeText(p);
            setCopied(p);
            setTimeout(() => setCopied(''), 1200);
        } catch {
            // ignore
        }
    };
    return (
        <section className="card">
            <h3>Which field holds…?</h3>
            <input value={q} placeholder="e.g. loyalty points, email, consent, zip code" onChange={(e) => setQ(e.target.value)} autoFocus />
            {fieldCount === 0 && <div className="notice">No fields loaded yet. Go to Context → Sync, then click “Load fields” on the schemas you care about (or import a data dictionary CSV).</div>}
            {fieldCount > 0 && !q && <div className="small muted">Searching {fieldCount.toLocaleString()} fields from your sandbox context. Runs locally.</div>}
            {q && results.length === 0 && fieldCount > 0 && <div className="small muted">No field matches “{q}”. Try a different word, or load fields for more schemas.</div>}
            {results.length > 0 && (
                <table className="table">
                    <thead><tr><th>Field path</th><th>Type</th><th>From</th></tr></thead>
                    <tbody>{results.map((f) => (
                        <tr key={`${f.path}|${f.source}`} className="clickable" onClick={() => copy(f.path)} title="Click to copy the path">
                            <td><code className="wrap-code">{f.path}</code>{copied === f.path && <span className="small ok"> copied</span>}{f.title && f.title !== f.path ? <div className="small muted">{f.title}{f.enum ? ` · ${f.enum.slice(0, 6).join(' | ')}` : ''}</div> : null}</td>
                            <td className="small">{f.type || '-'}</td>
                            <td className="small">{f.source}</td>
                        </tr>
                    ))}</tbody>
                </table>
            )}
        </section>
    );
}

function SqlLinter({ settings, ctx }) {
    const [sql, setSql] = useState("SELECT *\nFROM web_events\nORDER BY timestamp");
    const issues = useMemo(() => lintSql(sql), [sql]);
    const [rewrite, setRewrite] = useState('');
    const [busy, setBusy] = useState(false);

    const fix = async () => {
        setBusy(true);
        try {
            const { text } = await chat(settings, {
                system: `You are an Adobe Experience Platform Query Service expert. Rewrite the user's SQL to fix the listed issues while keeping its intent. Return the SQL in one \`\`\`sql block, then 2-4 bullets on what changed. Use only fields that appear in the query or the context.\n\n${contextToPrompt(ctx, { maxChars: 8000 })}`,
                messages: [{ role: 'user', content: `Issues:\n${issues.map((i) => `- ${i.title}: ${i.fix}`).join('\n')}\n\nSQL:\n${sql}` }],
                maxTokens: 1500
            });
            setRewrite(text);
        } catch (e) {
            setRewrite(`⚠ ${e.message}`);
        } finally {
            setBusy(false);
        }
    };

    return (
        <section className="card">
            <h3>Query Service SQL linter</h3>
            <textarea className="code-input" rows={8} value={sql} spellCheck={false} onChange={(e) => { setSql(e.target.value); setRewrite(''); }} />
            {issues.length === 0 && sql.trim() && <span className="status-light positive">No problems found</span>}
            <ul className="findings">
                {issues.map((i) => (
                    <li key={i.id}>
                        <span><span className={`pill ${SEV[i.severity]}`}>{i.severity}</span> <strong>{i.title}</strong></span>
                        <div className="small">{i.detail}</div>
                        <div className="small fix"><Icon name="check" size={12} /> {i.fix}</div>
                    </li>
                ))}
            </ul>
            {issues.length > 0 && (
                <div className="row wrap">
                    <button disabled={!isConfigured(settings) || settings.aiDisabled || busy} onClick={fix}><Icon name="sparkle" size={14} />{busy ? 'Rewriting…' : 'Rewrite with AI'}</button>
                    <span className="small muted">Linting runs locally. Rewrite sends the SQL text (after PII redaction).</span>
                </div>
            )}
            {rewrite && <Markdown>{rewrite}</Markdown>}
        </section>
    );
}

function AudienceSize({ settings, ctx, sandbox }) {
    const [pql, setPql] = useState('');
    const [mergePolicyId, setMergePolicyId] = useState('');
    const [res, setRes] = useState(null);
    const [busy, setBusy] = useState(false);
    const run = async () => {
        setBusy(true);
        setRes(null);
        try {
            setRes(await backendFetch(settings, '/api/ext/estimate', { sandbox, method: 'POST', body: { expression: pql, ...(mergePolicyId ? { mergePolicyId } : {}) } }));
        } catch (e) {
            setRes({ error: e.message });
        } finally {
            setBusy(false);
        }
    };
    return (
        <section className="card">
            <h3>Estimate audience size</h3>
            <div className="small muted">Paste a PQL rule (from the audience builder's code view, the Journeys tab, or an existing audience) to get an estimated profile count before you save or activate it. Counts only, no sample profiles.</div>
            <textarea className="code-input" rows={5} value={pql} spellCheck={false} placeholder={'person.gender = "female" and homeAddress.city = "New York"'} onChange={(e) => setPql(e.target.value)} />
            {ctx.audiences?.length > 0 && (
                <label className="field">Or start from an audience in your context
                    <select value="" onChange={(e) => { const a = ctx.audiences.find((x) => x.id === e.target.value); if (a?.rule) setPql(a.rule); }}>
                        <option value="">Choose…</option>
                        {ctx.audiences.filter((a) => a.rule).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                </label>
            )}
            {ctx.mergePolicies?.length > 0 && (
                <label className="field">Merge policy
                    <select value={mergePolicyId} onChange={(e) => setMergePolicyId(e.target.value)}>
                        <option value="">Default</option>
                        {ctx.mergePolicies.map((m) => <option key={m.id} value={m.id}>{m.name}{m.default ? ' (default)' : ''}</option>)}
                    </select>
                </label>
            )}
            <div className="row"><button className="primary" disabled={!pql.trim() || busy} onClick={run}>{busy ? 'Estimating… (up to 25s)' : 'Estimate'}</button></div>
            {res?.error && <div className="notice">{res.error}</div>}
            {res && !res.error && (
                <div className="kpis">
                    <div className="kpi"><span className="kpi-label">Estimated profiles</span><span className="kpi-value">{res.estimatedSize === null || res.estimatedSize === undefined ? '-' : Number(res.estimatedSize).toLocaleString()}</span><span className="kpi-sub">{res.timedOut ? 'Still running - try again in a moment' : res.state}</span></div>
                    <div className="kpi"><span className="kpi-label">Confidence</span><span className="kpi-value">{res.confidenceInterval || '-'}</span><span className="kpi-sub">{res.profilesReadSoFar ? `${Number(res.profilesReadSoFar).toLocaleString()} profiles sampled` : ''}</span></div>
                </div>
            )}
        </section>
    );
}
