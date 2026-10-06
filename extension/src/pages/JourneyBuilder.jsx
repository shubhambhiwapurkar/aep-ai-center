import { useEffect, useMemo, useState } from 'react';
import { ReactFlow, Background, Controls, Handle, Position } from '@xyflow/react';
import { ACTIVITIES, CATEGORIES, ENTRY_TYPES, MESSAGE_TYPES } from '../journey/catalog.js';
import {
    addPath, buildGuide, byId, createNode, insertAfter, layoutJourney, normalizeJourney,
    removeNode, removePath, successors, updateNode, validateJourney
} from '../journey/model.js';
import { TEMPLATES } from '../journey/templates.js';
import { explainJourney, generateJourney } from '../journey/ai.js';
import { AJO_ADAPTER_READY, analyzeAjoSample, toAjoClipboard } from '../journey/ajoAdapter.js';
import { isConfigured } from '../lib/llm.js';
import { describeHits } from '../lib/pii.js';
import { download, load, readFile, save } from '../lib/storage.js';
import Markdown from '../components/Markdown.jsx';

const blankJourney = () => {
    const start = createNode('unitaryEvent', { label: 'Entry event' });
    return normalizeJourney({ name: 'New journey', entry: start.id, nodes: [start] });
};

function JourneyNode({ data }) {
    const def = ACTIVITIES[data.node.type];
    return (
        <div className={`jnode ${data.selected ? 'selected' : ''} ${data.level || ''}`} style={{ borderLeftColor: def.color }}>
            <Handle type="target" position={Position.Top} />
            <div className="jnode-type">{def.label}</div>
            {data.node.type !== 'end' && <div className="jnode-label">{data.node.label}</div>}
            {data.level && <span className={`badge ${data.level}`}>{data.level === 'error' ? '!' : '?'}</span>}
            <Handle type="source" position={Position.Bottom} />
        </div>
    );
}
const nodeTypes = { journey: JourneyNode };

async function copyText(text) {
    await navigator.clipboard.writeText(text);
}

export default function JourneyBuilder({ settings, ctx }) {
    const [journey, setJourney] = useState(null);
    const [selected, setSelected] = useState(null);
    const [panel, setPanel] = useState('inspect');
    const [brief, setBrief] = useState('');
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState('');
    const [assumptions, setAssumptions] = useState([]);
    const [explanation, setExplanation] = useState('');
    const [done, setDone] = useState({});
    const [saved, setSaved] = useState([]);

    useEffect(() => {
        load('journeyDraft', null).then((j) => setJourney(j || normalizeJourney(TEMPLATES[0].journey)));
        load('savedJourneys', []).then(setSaved);
    }, []);
    useEffect(() => {
        if (journey) save('journeyDraft', journey);
    }, [journey]);

    const issues = useMemo(() => (journey ? validateJourney(journey, ctx) : []), [journey, ctx]);
    const guide = useMemo(() => (journey ? buildGuide(journey) : []), [journey]);

    const { nodes, edges } = useMemo(() => {
        if (!journey) return { nodes: [], edges: [] };
        const pos = layoutJourney(journey);
        const levelFor = (id) => issues.find((i) => i.nodeId === id && i.level === 'error') ? 'error'
            : issues.find((i) => i.nodeId === id && i.level === 'warning') ? 'warning' : '';
        const rfNodes = journey.nodes.map((n) => ({
            id: n.id,
            type: 'journey',
            position: pos[n.id] || { x: 0, y: 0 },
            data: { node: n, selected: n.id === selected, level: levelFor(n.id) }
        }));
        const rfEdges = [];
        for (const n of journey.nodes) {
            if (n.paths) n.paths.forEach((p, i) => p.next && rfEdges.push({
                id: `${n.id}-${i}`, source: n.id, target: p.next, label: p.percent ? `${p.label} (${p.percent}%)` : p.label,
                className: p.timeout || p.otherwise ? 'edge-alt' : ''
            }));
            else if (n.next) rfEdges.push({ id: `${n.id}-n`, source: n.id, target: n.next });
        }
        return { nodes: rfNodes, edges: rfEdges };
    }, [journey, selected, issues]);

    if (!journey) return <div className="loading">Loading…</div>;

    const map = byId(journey);
    const node = map.get(selected);
    const errors = issues.filter((i) => i.level === 'error').length;
    const warnings = issues.filter((i) => i.level === 'warning').length;

    const replaceJourney = (j, msg = '') => {
        setJourney(j);
        setSelected(j.entry);
        setDone({});
        setExplanation('');
        setNotice(msg);
    };

    const runAi = async (refine) => {
        if (!brief.trim()) return;
        setBusy(true);
        setNotice('');
        try {
            const res = await generateJourney(settings, ctx, brief, refine ? journey : null);
            replaceJourney(res.journey, describeHits(res.redactions));
            setAssumptions(res.assumptions);
            setPanel(res.assumptions.length ? 'issues' : 'inspect');
        } catch (e) {
            setNotice(`AI error: ${e.message}`);
        } finally {
            setBusy(false);
        }
    };

    const runExplain = async () => {
        setBusy(true);
        try {
            setExplanation(await explainJourney(settings, ctx, journey));
        } catch (e) {
            setExplanation(`AI error: ${e.message}`);
        } finally {
            setBusy(false);
        }
    };

    const importJson = async (file) => {
        try {
            replaceJourney(normalizeJourney(JSON.parse(await readFile(file))), `Imported ${file.name}`);
        } catch (e) {
            setNotice(`Import failed: ${e.message}`);
        }
    };

    const saveCopy = () => {
        const next = [{ savedAt: new Date().toISOString(), journey }, ...saved.filter((s) => s.journey.name !== journey.name)].slice(0, 30);
        setSaved(next);
        save('savedJourneys', next);
        setNotice(`Saved "${journey.name}" in this browser.`);
    };

    return (
        <div className="journey">
            <section className="card">
                <div className="row wrap">
                    <select value="" onChange={(e) => {
                        const t = TEMPLATES.find((x) => x.id === e.target.value);
                        if (t) replaceJourney(normalizeJourney(t.journey), `Loaded template: ${t.name}`);
                    }}>
                        <option value="">Start from template…</option>
                        {TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.name} - {t.summary}</option>)}
                    </select>
                    {saved.length > 0 && (
                        <select value="" onChange={(e) => {
                            const s = saved[Number(e.target.value)];
                            if (s) replaceJourney(normalizeJourney(s.journey), `Opened "${s.journey.name}"`);
                        }}>
                            <option value="">Open saved…</option>
                            {saved.map((s, i) => <option key={i} value={i}>{s.journey.name}</option>)}
                        </select>
                    )}
                    <button onClick={() => replaceJourney(blankJourney(), 'Blank journey')}>New</button>
                    <label className="btn">Import<input type="file" accept=".json" hidden onChange={(e) => e.target.files[0] && importJson(e.target.files[0])} /></label>
                    <button onClick={saveCopy}>Save</button>
                </div>
                <textarea
                    rows={2}
                    placeholder='Describe the journey, e.g. "Abandoned browse: product viewed but no cart in 2h → email, then push to app users who did not click; loyalty members get free shipping"'
                    value={brief}
                    onChange={(e) => setBrief(e.target.value)}
                />
                <div className="row">
                    <button className="primary" disabled={busy || !isConfigured(settings)} onClick={() => runAi(false)}>{busy ? 'Working…' : 'Generate skeleton'}</button>
                    <button disabled={busy || !isConfigured(settings)} onClick={() => runAi(true)}>Refine current</button>
                </div>
                {notice && <div className="notice">{notice}</div>}
            </section>

            <section className="card">
                <input className="title-input" value={journey.name} onChange={(e) => setJourney({ ...journey, name: e.target.value })} />
                <input className="muted-input" placeholder="Description" value={journey.description} onChange={(e) => setJourney({ ...journey, description: e.target.value })} />
                <div className="canvas">
                    <ReactFlow
                        key={`${journey.entry}-${journey.nodes.length}`}
                        nodes={nodes}
                        edges={edges}
                        nodeTypes={nodeTypes}
                        onNodeClick={(_, n) => { setSelected(n.id); setPanel('inspect'); }}
                        nodesDraggable={false}
                        nodesConnectable={false}
                        fitView
                        fitViewOptions={{ padding: 0.08 }}
                        minZoom={0.2}
                        proOptions={{ hideAttribution: true }}
                    >
                        <Background gap={16} />
                        <Controls showInteractive={false} />
                    </ReactFlow>
                </div>
            </section>

            <nav className="subtabs">
                <button className={panel === 'inspect' ? 'active' : ''} onClick={() => setPanel('inspect')}>Step</button>
                <button className={panel === 'guide' ? 'active' : ''} onClick={() => setPanel('guide')}>Build guide</button>
                <button className={panel === 'issues' ? 'active' : ''} onClick={() => setPanel('issues')}>
                    Checks {errors > 0 && <span className="pill error">{errors}</span>}{warnings > 0 && <span className="pill warning">{warnings}</span>}
                </button>
                <button className={panel === 'explain' ? 'active' : ''} onClick={() => setPanel('explain')}>Explain</button>
                <button className={panel === 'export' ? 'active' : ''} onClick={() => setPanel('export')}>Export</button>
            </nav>

            {panel === 'inspect' && (node
                ? <Inspector journey={journey} node={node} ctx={ctx} setJourney={setJourney} setSelected={setSelected} issues={issues.filter((i) => i.nodeId === node.id)} />
                : <div className="card muted">Click a step on the canvas to edit it and see what it does.</div>)}

            {panel === 'guide' && (
                <section className="card">
                    <p className="muted">Training mode: build this journey yourself in a dev sandbox. Tick steps as you go.</p>
                    <div className="progress"><div style={{ width: `${(Object.values(done).filter(Boolean).length / guide.length) * 100}%` }} /></div>
                    <ol className="guide">
                        {guide.map((s) => (
                            <li key={s.id} className={done[s.id] ? 'done' : ''}>
                                <label className="guide-title">
                                    <input type="checkbox" checked={Boolean(done[s.id])} onChange={(e) => setDone({ ...done, [s.id]: e.target.checked })} />
                                    {s.title}
                                </label>
                                <div className="guide-what">{s.what}{s.why ? ` ${s.why}` : ''}</div>
                                <ul>{s.how.map((h, i) => <li key={i}>{h}</li>)}</ul>
                                {s.pitfalls?.length > 0 && <div className="pitfall">⚠ {s.pitfalls.join(' ')}</div>}
                            </li>
                        ))}
                    </ol>
                    <button onClick={() => download(`${slug(journey.name)}-build-guide.md`, guideToMarkdown(journey, guide), 'text/markdown')}>Download guide (.md)</button>
                </section>
            )}

            {panel === 'issues' && (
                <section className="card">
                    {assumptions.length > 0 && (
                        <div className="assumptions">
                            <strong>AI assumptions to confirm</strong>
                            <ul>{assumptions.map((a, i) => <li key={i}>{a}</li>)}</ul>
                        </div>
                    )}
                    {issues.length === 0 && <p className="ok">No issues found. ✓</p>}
                    <ul className="issues">
                        {issues.map((i, k) => (
                            <li key={k} className={i.level} onClick={() => i.nodeId && (setSelected(i.nodeId), setPanel('inspect'))}>
                                <span className={`pill ${i.level}`}>{i.level}</span> {i.message}
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {panel === 'explain' && (
                <section className="card">
                    <button className="primary" disabled={busy || !isConfigured(settings)} onClick={runExplain}>{busy ? 'Explaining…' : 'Explain this journey in plain language'}</button>
                    {explanation && <Markdown>{explanation}</Markdown>}
                </section>
            )}

            {panel === 'export' && <ExportPanel journey={journey} />}
        </div>
    );
}

function FieldInput({ field, value, onChange, ctx, journey }) {
    const listId = `dl-${field.type}`;
    if (field.type === 'select') {
        return <select value={value ?? ''} onChange={(e) => onChange(e.target.value)}>{field.options.map((o) => <option key={o}>{o}</option>)}</select>;
    }
    if (field.type === 'number') return <input type="number" min="0" value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))} />;
    if (field.type === 'textarea') return <textarea rows={2} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;
    if (field.type === 'message') {
        return (
            <select value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
                <option value="">Pick a message…</option>
                {journey.nodes.filter((n) => MESSAGE_TYPES.includes(n.type)).map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
            </select>
        );
    }
    const options = {
        event: (ctx.journeyEvents || []).map((e) => e.name),
        audience: (ctx.audiences || []).map((a) => a.name),
        action: (ctx.customActions || []).map((a) => a.name),
        field: [...(ctx.schemas || []).flatMap((s) => (s.fields || []).map((f) => f.path)), ...(ctx.dataDictionary || []).map((f) => f.field)]
    }[field.type] || [];
    return (
        <>
            <input list={options.length ? listId : undefined} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
            {options.length > 0 && <datalist id={listId}>{[...new Set(options)].slice(0, 500).map((o) => <option key={o} value={o} />)}</datalist>}
        </>
    );
}

function Inspector({ journey, node, ctx, setJourney, setSelected, issues }) {
    const def = ACTIVITIES[node.type];
    const [addType, setAddType] = useState('wait');
    const [addPathIdx, setAddPathIdx] = useState(0);
    const set = (patch) => setJourney(updateNode(journey, node.id, patch));
    const setPathField = (i, key, value) => set({ paths: node.paths.map((p, k) => (k === i ? { ...p, [key]: value } : p)) });
    const insertable = Object.entries(ACTIVITIES).filter(([t]) => !ENTRY_TYPES.includes(t) && t !== 'end');

    return (
        <section className="card inspector">
            <div className="row between">
                <span className="type-chip" style={{ background: def.color }}>{CATEGORIES[def.category]} · {def.label}</span>
                {node.id !== journey.entry && node.type !== 'end' && (
                    <button className="danger" onClick={() => { setJourney(removeNode(journey, node.id)); setSelected(journey.entry); }}>Delete step</button>
                )}
            </div>

            {node.type !== 'end' && (
                <label className="field">Step name<input value={node.label} onChange={(e) => set({ label: e.target.value })} /></label>
            )}
            {ENTRY_TYPES.includes(node.type) && (
                <label className="field">Entry type
                    <select value={node.type} onChange={(e) => {
                        const fresh = createNode(e.target.value, { id: node.id, label: node.label, next: node.next });
                        setJourney({ ...journey, nodes: journey.nodes.map((n) => (n.id === node.id ? fresh : n)) });
                    }}>
                        {ENTRY_TYPES.map((t) => <option key={t} value={t}>{ACTIVITIES[t].label}</option>)}
                    </select>
                </label>
            )}
            {def.fields.map((f) => (
                <label key={f.key} className="field">{f.label}{f.required ? ' *' : ''}
                    <FieldInput field={f} value={node.config[f.key]} onChange={(v) => set({ config: { [f.key]: v } })} ctx={ctx} journey={journey} />
                </label>
            ))}

            {node.paths && (
                <div className="paths">
                    <div className="row between"><strong>Paths</strong>{node.type === 'condition' && <button onClick={() => setJourney(addPath(journey, node.id))}>+ Path</button>}</div>
                    {node.paths.map((p, i) => (
                        <div key={i} className="path">
                            <input value={p.label} onChange={(e) => setPathField(i, 'label', e.target.value)} />
                            {node.type === 'condition' && !p.otherwise && node.config.kind === 'percentage split' && (
                                <input type="number" className="narrow" value={p.percent ?? ''} placeholder="%" onChange={(e) => setPathField(i, 'percent', Number(e.target.value))} />
                            )}
                            {node.type === 'condition' && !p.otherwise && node.config.kind !== 'percentage split' && (
                                <input placeholder='Expression, e.g. loyalty.tier = "gold"' value={p.expression || ''} onChange={(e) => setPathField(i, 'expression', e.target.value)} />
                            )}
                            {p.otherwise && <span className="muted">fallback</span>}
                            {p.timeout && <span className="muted">timeout</span>}
                            {node.type === 'condition' && !p.otherwise && node.paths.length > 2 && (
                                <button className="icon-btn" title="Remove path" onClick={() => setJourney(removePath(journey, node.id, i))}>✕</button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {node.type !== 'end' && (
                <div className="row add-row">
                    <span>Add after:</span>
                    <select value={addType} onChange={(e) => setAddType(e.target.value)}>
                        {insertable.map(([t, d]) => <option key={t} value={t}>{d.label}</option>)}
                    </select>
                    {node.paths && (
                        <select value={addPathIdx} onChange={(e) => setAddPathIdx(Number(e.target.value))}>
                            {node.paths.map((p, i) => <option key={i} value={i}>on "{p.label}"</option>)}
                        </select>
                    )}
                    <button className="primary" onClick={() => {
                        const next = insertAfter(journey, node.id, addType, addPathIdx);
                        setJourney(next);
                        const parent = byId(next).get(node.id);
                        setSelected(node.paths ? parent.paths[addPathIdx].next : parent.next);
                    }}>Add</button>
                </div>
            )}

            {issues.length > 0 && <ul className="issues">{issues.map((i, k) => <li key={k} className={i.level}><span className={`pill ${i.level}`}>{i.level}</span> {i.message}</li>)}</ul>}

            <div className="explain-card">
                <div><strong>What it does:</strong> {def.what}</div>
                {def.why && <div><strong>Why:</strong> {def.why}</div>}
                {def.howInAjo.length > 0 && <div><strong>In AJO:</strong><ul>{def.howInAjo.map((h, i) => <li key={i}>{h}</li>)}</ul></div>}
                {def.pitfalls.length > 0 && <div className="pitfall">⚠ {def.pitfalls.join(' ')}</div>}
                <div className="muted small">Next: {successors(node).map((id) => byId(journey).get(id)?.label).join(', ') || '-'}</div>
            </div>
        </section>
    );
}

function ExportPanel({ journey }) {
    const [copied, setCopied] = useState('');
    const [sample, setSample] = useState('');
    const [analysis, setAnalysis] = useState(null);
    const [error, setError] = useState('');
    const json = JSON.stringify(journey, null, 2);

    const flash = (what) => {
        setCopied(what);
        setTimeout(() => setCopied(''), 1500);
    };

    return (
        <section className="card">
            <div className="row wrap">
                <button className="primary" disabled={!AJO_ADAPTER_READY} title={AJO_ADAPTER_READY ? '' : 'Needs calibration with a real AJO sample - see below'}
                    onClick={async () => { await copyText(JSON.stringify(toAjoClipboard(journey))); flash('ajo'); }}>
                    {copied === 'ajo' ? 'Copied ✓' : 'Copy for AJO canvas'}
                </button>
                <button onClick={async () => { await copyText(json); flash('json'); }}>{copied === 'json' ? 'Copied ✓' : 'Copy skeleton JSON'}</button>
                <button onClick={() => download(`${slug(journey.name)}.journey.json`, json)}>Download</button>
            </div>
            {!AJO_ADAPTER_READY && (
                <div className="calibrate">
                    <strong>Calibrate AJO paste format</strong>
                    <p className="muted small">
                        In AJO, open any journey, select its activities on the canvas, copy (Ctrl/Cmd+C) and paste below.
                        Only the <em>structure</em> is kept (keys and activity types) - names, ids, expressions and values are stripped, so the result is safe to share.
                    </p>
                    <textarea rows={4} value={sample} onChange={(e) => setSample(e.target.value)} placeholder="Paste copied AJO activities here" />
                    <div className="row">
                        <button onClick={() => {
                            try { setAnalysis(analyzeAjoSample(sample)); setError(''); setSample(''); } catch (e) { setError(e.message); }
                        }}>Analyze</button>
                        {analysis && <button onClick={() => download('ajo-format-shape.json', JSON.stringify(analysis, null, 2))}>Download shape</button>}
                    </div>
                    {error && <div className="notice">{error}</div>}
                    {analysis && (
                        <>
                            <div className="small">Activity kinds found: {Object.entries(analysis.kinds).map(([k, v]) => `${k} ×${v}`).join(', ') || 'none detected'}</div>
                            <pre className="code">{JSON.stringify(analysis.shape, null, 2).slice(0, 4000)}</pre>
                        </>
                    )}
                </div>
            )}
            <pre className="code">{json}</pre>
        </section>
    );
}

function slug(s) {
    return String(s || 'journey').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function guideToMarkdown(journey, guide) {
    return [`# Build guide: ${journey.name}`, '', journey.description, '',
        ...guide.flatMap((s, i) => [
            `## ${i + 1}. ${s.title}`, '', s.what + (s.why ? ` ${s.why}` : ''), '',
            ...s.how.map((h) => `- [ ] ${h}`),
            ...(s.pitfalls?.length ? ['', `> ⚠ ${s.pitfalls.join(' ')}`] : []), ''
        ])
    ].join('\n');
}
