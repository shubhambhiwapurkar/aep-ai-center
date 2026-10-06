import { useEffect, useState } from 'react';
import Icon from '../components/Icon.jsx';
import Markdown from '../components/Markdown.jsx';
import { isConfigured } from '../lib/llm.js';
import { load, save } from '../lib/storage.js';
import { attentionItems, briefing, computeHealth, explainFailure, fetchVitals, hourlyBuckets, isConnected } from '../lib/vitals.js';

const fmt = (n) => (n === null || n === undefined ? '-' : Number(n).toLocaleString());
const timeOf = (iso) => (iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '');
const ago = (ms) => {
    if (!ms) return '';
    const m = Math.round((Date.now() - ms) / 60000);
    return m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`;
};

export default function Home({ settings, ctx, go }) {
    const [vitals, setVitals] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [brief, setBrief] = useState(null);
    const [briefBusy, setBriefBusy] = useState(false);

    const refresh = async () => {
        setLoading(true);
        setError('');
        try {
            const v = await fetchVitals(settings.backendUrl);
            setVitals(v);
            save('lastVitals', v);
        } catch (e) {
            setError(e.message === 'Failed to fetch' ? `Can't reach the backend at ${settings.backendUrl}.` : e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load('lastVitals', null).then((v) => v && setVitals(v));
        load('lastBriefing', null).then((b) => b && setBrief(b));
        refresh();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [settings.backendUrl]);

    const connected = isConnected(vitals);
    const health = computeHealth(vitals);
    const items = attentionItems(vitals, ctx);
    const llm = isConfigured(settings);

    const runBriefing = async () => {
        setBriefBusy(true);
        try {
            const text = await briefing(settings, ctx, vitals);
            const b = { text, at: new Date().toISOString() };
            setBrief(b);
            save('lastBriefing', b);
        } catch (e) {
            setBrief({ text: `⚠ ${e.message}`, at: new Date().toISOString() });
        } finally {
            setBriefBusy(false);
        }
    };

    return (
        <div className="home">
            <div className="home-head">
                <h1 className="page-title">AI Center</h1>
                <span className={`status-light ${connected ? 'positive' : error ? 'negative' : ''}`}>
                    {connected ? `Connected · ${vitals.sandbox}` : error ? 'Backend offline' : vitals ? 'Not connected to AEP' : 'Checking…'}
                </span>
                {vitals?.fetchedAt && <span className="meta">Updated {timeOf(vitals.fetchedAt)}{error ? ' (cached)' : ''}</span>}
                <div className="spacer" />
                <button onClick={refresh} disabled={loading}><Icon name="refresh" size={16} />{loading ? 'Refreshing…' : 'Refresh'}</button>
            </div>

            {(error || (vitals && !connected)) && (
                <div className="banner notice">
                    <Icon name="alert" />
                    <div>
                        <strong>{error || `AEP connection failed: ${vitals?.connection?.data?.error || vitals?.connection?.error || 'unknown error'}`}</strong>
                        <div className="small">
                            Vitals come from the AEP AI Center backend using your Adobe Developer Console server-to-server credentials:
                            {' '}<code>cd backend &amp;&amp; npm start</code> with <code>CLIENT_ID</code>, <code>CLIENT_SECRET</code>, <code>API_KEY</code>, <code>IMS_ORG</code>, <code>SANDBOX_NAME</code> in <code>backend/.env</code>.
                            {' '}Journeys, Designer and Ask work without it.
                        </div>
                    </div>
                </div>
            )}

            {connected && <HealthCard health={health} />}
            {connected && <Kpis vitals={vitals} />}
            {connected && <IngestionChart vitals={vitals} />}
            {connected && <Attention items={items} settings={settings} ctx={ctx} llm={llm} />}

            {connected && (
                <section className="card">
                    <div className="row between">
                        <h3><Icon name="sparkle" size={16} /> AI briefing</h3>
                        <button className="primary" disabled={!llm || briefBusy} onClick={runBriefing}>{briefBusy ? 'Analyzing…' : brief ? 'Regenerate' : 'Generate briefing'}</button>
                    </div>
                    {!llm && <div className="small muted">Add an LLM key in <button className="link" onClick={() => go('settings')}>Settings</button> to get a plain-language briefing with root causes and owners.</div>}
                    {brief && <div className="small muted">Generated {new Date(brief.at).toLocaleString()} · counts and error codes only were sent</div>}
                    {brief && <Markdown>{brief.text}</Markdown>}
                </section>
            )}

            <div className="section-title">Tools</div>
            <div className="actions-grid">
                <button className="action-tile" onClick={() => go('journey')}><Icon name="journey" /><strong>Build a journey</strong><span>Skeleton from a brief, validated, with a build guide</span></button>
                <button className="action-tile" onClick={() => go('designer')}><Icon name="designer" /><strong>Design an implementation</strong><span>Sources + dictionary → schemas, identities, audiences</span></button>
                <button className="action-tile" onClick={() => go('assistant')}><Icon name="chat" /><strong>Ask AEP AI</strong><span>Answers grounded in your sandbox metadata</span></button>
                <button className="action-tile" onClick={() => go('context')}><Icon name="context" /><strong>Sandbox context</strong><span>{ctx.updatedAt ? `${ctx.schemas.length} schemas · ${ctx.audiences.length} audiences` : 'Sync schemas, audiences, events'}</span></button>
            </div>
        </div>
    );
}

function HealthCard({ health }) {
    const color = { positive: 'var(--positive)', notice: 'var(--notice)', negative: 'var(--negative)' }[health.level];
    return (
        <section className="card">
            <div className="health">
                <div className="health-score">{health.score}<small>/100</small></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <span className={`status-light ${health.level}`}><strong>{health.label}</strong></span>
                    <div className="meter" role="meter" aria-valuenow={health.score} aria-valuemin={0} aria-valuemax={100} aria-label="Health score">
                        <div style={{ width: `${health.score}%`, background: color }} />
                    </div>
                    <div className="small muted">{health.reasons.length ? health.reasons.join(' · ') : 'No failures in the last 24 hours.'}</div>
                </div>
            </div>
        </section>
    );
}

function Kpis({ vitals }) {
    const d = (k) => (vitals[k]?.ok ? vitals[k].data : null);
    const ing = d('ingestion');
    const flows = d('dataflows');
    const failedRuns = flows?.runsByState?.failed || 0;
    const tiles = [
        { label: 'Ingestion success · 24h', value: ing?.successRate === null || ing?.successRate === undefined ? '-' : `${ing.successRate}%`, sub: ing ? `${fmt(ing.total)} batches · ${fmt(ing.records)} records` : 'unavailable', bad: ing?.successRate !== null && ing?.successRate < 95 },
        { label: 'Failed batches · 24h', value: fmt(ing?.failed), sub: ing ? `${fmt(ing.failedRecords)} failed records` : 'unavailable', bad: ing?.failed > 0 },
        { label: 'Dataflows', value: flows ? `${fmt(flows.enabled)}/${fmt(flows.total)}` : '-', sub: flows ? `${failedRuns} failed of ${fmt(flows.runs)} recent runs` : 'unavailable', bad: failedRuns > 0 },
        { label: 'Profiles', value: fmt(d('profiles')?.totalProfiles), sub: d('profiles') ? `${fmt(d('profiles').mergePolicies)} merge policies` : 'unavailable' },
        { label: 'Audiences', value: fmt(d('audiences')?.total), sub: d('audiences') ? `${fmt(d('audiences').evaluationJobs)} evaluation jobs` : 'unavailable' },
        { label: 'Schemas · Datasets', value: `${fmt(d('schemas')?.tenantSchemas)} · ${fmt(d('datasets')?.total)}`, sub: d('datasets') ? `${fmt(d('datasets').profileEnabled)} datasets profile-enabled` : 'unavailable' }
    ];
    return (
        <div className="kpis">
            {tiles.map((t) => (
                <div key={t.label} className={`kpi ${t.bad ? 'bad' : ''}`}>
                    <span className="kpi-label">{t.label}</span>
                    <span className="kpi-value">{t.value}</span>
                    <span className="kpi-sub">{t.sub}</span>
                </div>
            ))}
        </div>
    );
}

function IngestionChart({ vitals }) {
    const [table, setTable] = useState(false);
    if (!vitals.ingestion?.ok) return null;
    const buckets = hourlyBuckets(vitals);
    const max = Math.max(1, ...buckets.map((b) => b.success + b.failed + b.other));
    const hourLabel = (d) => d.toLocaleTimeString([], { hour: '2-digit' });
    return (
        <section className="card">
            <div className="row between">
                <h3>Batch ingestion · last 24 hours</h3>
                <button className="link small" onClick={() => setTable(!table)}>{table ? 'Show chart' : 'Show table'}</button>
            </div>
            <div className="chart-legend">
                <span><i style={{ background: 'var(--chart-ok)' }} />Succeeded</span>
                <span><i style={{ background: 'var(--chart-bad)' }} />Failed</span>
                <span><i style={{ background: 'var(--gray-500)' }} />In progress / other</span>
            </div>
            {table ? (
                <table className="table">
                    <thead><tr><th>Hour</th><th>Succeeded</th><th>Failed</th><th>Other</th></tr></thead>
                    <tbody>{buckets.filter((b) => b.success + b.failed + b.other).map((b) => (
                        <tr key={b.hour}><td>{hourLabel(b.date)}</td><td>{b.success}</td><td>{b.failed}</td><td>{b.other}</td></tr>
                    ))}</tbody>
                </table>
            ) : (
                <>
                    <div className="bars" role="img" aria-label="Batches per hour, succeeded and failed">
                        {buckets.map((b) => {
                            const segs = [
                                { n: b.success, color: 'var(--chart-ok)' },
                                { n: b.failed, color: 'var(--chart-bad)' },
                                { n: b.other, color: 'var(--gray-500)' }
                            ].filter((s) => s.n > 0);
                            return (
                                <div key={b.hour} className="bar">
                                    {segs.map((s, i) => (
                                        <div key={i} className={`seg ${i === segs.length - 1 ? 'top' : ''}`} style={{ height: `${(s.n / max) * 100}%`, background: s.color }} />
                                    ))}
                                    <div className="tip">{hourLabel(b.date)} · {b.success} ok · {b.failed} failed{b.other ? ` · ${b.other} other` : ''}</div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="axis"><span>{hourLabel(buckets[0].date)}</span><span>{hourLabel(buckets[12].date)}</span><span>now</span></div>
                </>
            )}
        </section>
    );
}

function Attention({ items, settings, ctx, llm }) {
    const [open, setOpen] = useState({});
    const [busy, setBusy] = useState('');
    if (!items.length) {
        return (
            <section className="card">
                <h3>Needs attention</h3>
                <span className="status-light positive">No failed batches or dataflow runs</span>
            </section>
        );
    }
    const explain = async (item) => {
        setBusy(item.id);
        try {
            setOpen({ ...open, [item.id]: await explainFailure(settings, ctx, item) });
        } catch (e) {
            setOpen({ ...open, [item.id]: `⚠ ${e.message}` });
        } finally {
            setBusy('');
        }
    };
    return (
        <section className="card">
            <h3>Needs attention <span className="pill error">{items.length}</span></h3>
            <ul className="attention">
                {items.slice(0, 12).map((it) => (
                    <li key={`${it.kind}-${it.id}`}>
                        <div className="row between">
                            <span className="title"><span className="status-light negative" /> {it.title}</span>
                            <span className="small muted">{ago(it.when)}</span>
                        </div>
                        {it.errors.map((e, i) => <div key={i} className="small"><code>{e.code || 'error'}</code> {e.message}</div>)}
                        <div className="row">
                            <button className="quiet" disabled={!llm || busy === it.id} onClick={() => explain(it)}>
                                <Icon name="sparkle" size={14} />{busy === it.id ? 'Explaining…' : 'Explain & fix'}
                            </button>
                            <span className="small muted">{it.kind === 'batch' ? 'Batch' : 'Run'} {it.id}</span>
                        </div>
                        {open[it.id] && <Markdown>{open[it.id]}</Markdown>}
                    </li>
                ))}
            </ul>
        </section>
    );
}
