import { useEffect, useState } from 'react';
import Icon from './Icon.jsx';
import Markdown from './Markdown.jsx';
import { backendFetch } from '../lib/backend.js';
import { ENTITY_LABELS, RESOLVABLE } from '../lib/aepPage.js';
import { chat, isConfigured } from '../lib/llm.js';
import { contextToPrompt } from '../lib/context.js';

const when = (v) => {
    if (!v) return '-';
    const d = new Date(typeof v === 'number' ? v : Date.parse(v));
    return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString();
};
const statusLevel = (s) => {
    const x = String(s || '').toLowerCase();
    if (['success', 'succeeded', 'enabled', 'active'].includes(x)) return 'positive';
    if (['failed', 'failure', 'error'].includes(x)) return 'negative';
    if (['processing', 'running', 'queued', 'loading', 'staging', 'inprogress'].includes(x)) return 'notice';
    return '';
};

/** Summary of one AEP object from /api/ext/entity, with an AI explanation on request. */
export default function EntityDetail({ settings, ctx, sandbox, type, id, onOpen }) {
    const [state, setState] = useState({ loading: true });
    const [explain, setExplain] = useState('');
    const [busy, setBusy] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        setExplain('');
        if (!RESOLVABLE.includes(type)) {
            setState({ loading: false, unsupported: true });
            return undefined;
        }
        const ctrl = new AbortController();
        setState({ loading: true });
        backendFetch(settings, `/api/ext/entity/${type}/${encodeURIComponent(id)}`, { sandbox, signal: ctrl.signal })
            .then((r) => setState({ loading: false, entity: r.entity, sandbox: r.sandbox }))
            .catch((e) => e.name !== 'AbortError' && setState({ loading: false, error: e.message }));
        return () => ctrl.abort();
    }, [settings, sandbox, type, id]);

    const e = state.entity;

    const runExplain = async () => {
        setBusy(true);
        try {
            const { text } = await chat(settings, {
                system: `You are a senior Adobe Experience Platform consultant. A practitioner is looking at one object in the AEP UI. Using only the metadata provided, explain in short markdown:
1. What this object is and what it is used for here.
2. Its health right now (call out failures, empty audiences, disabled flows) and the likely cause of any error codes.
3. Concrete next steps with the exact AEP UI path.
Do not invent numbers.

${contextToPrompt(ctx, { maxChars: 8000 })}`,
                messages: [{ role: 'user', content: JSON.stringify(e) }],
                maxTokens: 1800
            });
            setExplain(text);
        } catch (err) {
            setExplain(`⚠ ${err.message}`);
        } finally {
            setBusy(false);
        }
    };

    const copyId = async () => {
        try {
            await navigator.clipboard.writeText(id);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
        } catch {
            // clipboard blocked
        }
    };

    return (
        <section className="card entity">
            <div className="row between">
                <span className="entity-type">{ENTITY_LABELS[type] || type}</span>
                <div className="row">
                    <button className="quiet small-btn" onClick={copyId} title="Copy id"><Icon name="copy" size={14} />{copied ? 'Copied' : 'Copy id'}</button>
                </div>
            </div>
            <h3 className="entity-name">{e?.name || id}</h3>
            {e?.description && <div className="small muted">{e.description}</div>}

            {state.loading && <div className="small muted">Loading…</div>}
            {state.error && <div className="notice">{state.error}</div>}
            {state.unsupported && (
                <div className="small muted">
                    {type === 'journey' ? 'Journey details come from Journey Optimizer, which the backend does not read yet. Use the Journeys tab to design or review a journey skeleton.' : 'No details available for this type.'}
                </div>
            )}

            {e && <Facts entity={e} onOpen={onOpen} />}

            {e && (
                <div className="row wrap">
                    <button className="primary" disabled={!isConfigured(settings) || settings.aiDisabled || busy} onClick={runExplain}>
                        <Icon name="sparkle" size={14} />{busy ? 'Thinking…' : 'Explain & check health'}
                    </button>
                    <span className="small muted">Sends this metadata only, after PII redaction.</span>
                </div>
            )}
            {explain && <Markdown>{explain}</Markdown>}
        </section>
    );
}

function Facts({ entity: e, onOpen }) {
    const rows = [];
    const add = (k, v) => v !== undefined && v !== null && v !== '' && rows.push([k, v]);
    add('Id', <code className="wrap-code">{e.id}</code>);
    add('State', e.state || e.status ? <span className={`status-light ${statusLevel(e.state || e.status)}`}>{e.state || e.status}</span> : null);
    add('Evaluation', e.evaluation);
    add('Profiles', typeof e.totalProfiles === 'number' ? e.totalProfiles.toLocaleString() : null);
    add('Last evaluation', e.lastEvaluation ? `${e.lastEvaluation.status} · ${when(e.lastEvaluation.updated)}` : null);
    add('Profile', e.profileEnabled !== undefined ? (e.profileEnabled ? 'Enabled' : 'Not enabled') : null);
    add('Class', e.class ? e.class.split('/').pop() : null);
    add('Fields', e.fieldCount);
    add('Schema', e.schema ? <button className="link" onClick={() => onOpen?.('schema', e.schema.id)}>{e.schema.title || e.schema.id}</button> : null);
    add('Dataset', e.datasetId ? <button className="link" onClick={() => onOpen?.('dataset', e.datasetId)}>{e.datasetId}</button> : null);
    add('Records', e.records !== null && e.records !== undefined ? `${Number(e.records).toLocaleString()}${e.failedRecords ? ` (${Number(e.failedRecords).toLocaleString()} failed)` : ''}` : null);
    add('Identity type', e.idType);
    add('Merge', e.attributeMerge ? `${e.attributeMerge} · graph ${e.identityGraph}` : null);
    add('Labels', e.labels?.length ? e.labels.join(', ') : null);
    add('Created', e.created ? when(e.created) : null);
    add('Updated', e.updated ? when(e.updated) : null);

    return (
        <>
            <dl className="facts">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
            {e.rule && <><div className="section-title">Rule (PQL)</div><pre className="code">{e.rule}</pre></>}
            {e.errors?.length > 0 && <Errors errors={e.errors} />}
            {e.datasets?.length > 0 && (
                <>
                    <div className="section-title">Datasets using this schema</div>
                    <ul className="list">{e.datasets.map((d) => <li key={d.id}><button className="link" onClick={() => onOpen?.('dataset', d.id)}>{d.name}</button></li>)}</ul>
                </>
            )}
            {e.recentBatches?.length > 0 && (
                <>
                    <div className="section-title">Recent batches</div>
                    <table className="table">
                        <thead><tr><th>Status</th><th>When</th><th>Records</th></tr></thead>
                        <tbody>{e.recentBatches.map((b) => (
                            <tr key={b.id} className="clickable" onClick={() => onOpen?.('batch', b.id)} title={b.errors?.map((x) => `${x.code}: ${x.message}`).join('\n')}>
                                <td><span className={`status-light ${statusLevel(b.status)}`}>{b.status}</span></td>
                                <td>{when(b.created)}</td>
                                <td>{b.records === null || b.records === undefined ? "-" : Number(b.records).toLocaleString()}{b.failedRecords ? ` / ${Number(b.failedRecords).toLocaleString()} failed` : ""}</td>
                            </tr>
                        ))}</tbody>
                    </table>
                </>
            )}
            {e.recentRuns?.length > 0 && (
                <>
                    <div className="section-title">Recent runs</div>
                    <table className="table">
                        <thead><tr><th>State</th><th>When</th><th>Read / failed</th></tr></thead>
                        <tbody>{e.recentRuns.map((r) => (
                            <tr key={r.id} title={r.errors?.map((x) => `${x.code}: ${x.message}`).join('\n')}>
                                <td><span className={`status-light ${statusLevel(r.state)}`}>{r.state}</span></td>
                                <td>{when(r.createdAt)}</td>
                                <td>{r.recordsRead ?? '-'} / {r.recordsFailed ?? '-'}</td>
                            </tr>
                        ))}</tbody>
                    </table>
                </>
            )}
        </>
    );
}

function Errors({ errors }) {
    return (
        <>
            <div className="section-title">Errors</div>
            {errors.map((x, i) => <div key={i} className="small"><code>{x.code || 'error'}</code> {x.message}</div>)}
        </>
    );
}
