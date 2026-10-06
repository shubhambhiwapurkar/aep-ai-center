import { useEffect, useState } from 'react';
import { extractBuildSteps, generateManifest, generateReport } from '../designer/ai.js';
import { parseDataDictionaryCsv } from '../lib/context.js';
import { isConfigured } from '../lib/llm.js';
import { describeHits } from '../lib/pii.js';
import { download, load, readFile, save } from '../lib/storage.js';
import Markdown from '../components/Markdown.jsx';

const USE_CASES = ['Welcome / onboarding', 'Abandoned cart / browse', 'Loyalty & rewards', 'Win-back / churn', 'Cross-sell / upsell',
    'Transactional notifications', 'Paid media activation', 'Web / app personalization', 'Account-based (B2B)'];
const SOURCE_KINDS = ['CRM', 'E-commerce platform', 'Website (Web SDK)', 'Mobile app (Mobile SDK)', 'POS / stores', 'Email service provider',
    'Data warehouse', 'Cloud storage files', 'Call center', 'Loyalty platform', 'Consent / CMP', 'Other'];
const DATA_KINDS = ['Profile attributes', 'Behavioural events', 'Lookup / reference', 'Consent'];
const FREQUENCIES = ['Real-time / streaming', 'Hourly', 'Daily', 'Weekly', 'One-time backfill'];
const CHANNELS = ['Email', 'SMS', 'Push', 'In-app', 'Web', 'Paid media', 'Call center', 'Direct mail'];
const REGULATIONS = ['GDPR', 'CCPA/CPRA', 'HIPAA', 'LGPD', 'PDPA'];
const PRODUCTS = ['RTCDP', 'Journey Optimizer', 'Customer Journey Analytics', 'Target', 'Analytics'];

const blankSource = () => ({ name: '', kind: SOURCE_KINDS[0], dataKind: DATA_KINDS[0], frequency: FREQUENCIES[2], identifiers: '', notes: '' });
const blankDesign = () => ({
    client: '', industry: '', goals: '', useCases: [], otherUseCases: '',
    sources: [blankSource()], dictionary: [],
    channels: ['Email'], destinations: '', regulations: [], consentNotes: '', sandboxes: 'dev, stage, prod',
    experience: 'New to AEP', products: ['RTCDP', 'Journey Optimizer']
});

const STEPS = ['Business', 'Data sources', 'Data dictionary', 'Activation & governance', 'Plan'];

const toggle = (list, v) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

export default function SolutionDesigner({ settings, ctx }) {
    const [d, setD] = useState(null);
    const [step, setStep] = useState(0);
    const [report, setReport] = useState('');
    const [checked, setChecked] = useState({});
    const [busy, setBusy] = useState('');
    const [notice, setNotice] = useState('');

    useEffect(() => {
        load('designerDraft', null).then((saved) => {
            setD(saved?.design || blankDesign());
            setReport(saved?.report || '');
            setChecked(saved?.checked || {});
        });
    }, []);
    useEffect(() => {
        if (d) save('designerDraft', { design: d, report, checked });
    }, [d, report, checked]);

    if (!d) return <div className="loading">Loading…</div>;
    const set = (patch) => setD({ ...d, ...patch });
    const setSource = (i, patch) => set({ sources: d.sources.map((s, k) => (k === i ? { ...s, ...patch } : s)) });
    const steps = extractBuildSteps(report);

    const run = async () => {
        setBusy('report');
        setNotice('');
        try {
            const res = await generateReport(settings, ctx, d);
            setReport(res.text);
            setChecked({});
            setNotice(describeHits(res.redactions));
        } catch (e) {
            setNotice(`AI error: ${e.message}`);
        } finally {
            setBusy('');
        }
    };

    const runManifest = async () => {
        setBusy('manifest');
        try {
            const { manifest } = await generateManifest(settings, ctx, d, report);
            download(`${(d.client || 'aep').toLowerCase().replace(/\W+/g, '-')}-implementation-manifest.json`, JSON.stringify(manifest, null, 2));
            setNotice('Manifest downloaded - commit it to Git to version the design and replay it per sandbox.');
        } catch (e) {
            setNotice(`AI error: ${e.message}`);
        } finally {
            setBusy('');
        }
    };

    const uploadDictionary = async (file) => {
        try {
            const { fields, dropped } = parseDataDictionaryCsv(await readFile(file));
            set({ dictionary: fields });
            setNotice(`Loaded ${fields.length} fields.${dropped.length ? ` Ignored value columns: ${dropped.join(', ')}.` : ''}`);
        } catch (e) {
            setNotice(e.message);
        }
    };

    return (
        <div className="designer">
            <ol className="stepper">
                {STEPS.map((s, i) => (
                    <li key={s} className={i === step ? 'active' : i < step ? 'done' : ''} onClick={() => setStep(i)}>{i + 1}. {s}</li>
                ))}
            </ol>

            {step === 0 && (
                <section className="card">
                    <label className="field">Client / brand<input value={d.client} onChange={(e) => set({ client: e.target.value })} /></label>
                    <label className="field">Industry<input value={d.industry} placeholder="Retail, banking, telco, travel…" onChange={(e) => set({ industry: e.target.value })} /></label>
                    <label className="field">Business goals<textarea rows={3} value={d.goals} placeholder="e.g. lift repeat purchase 10%, unify online + store customers, cut paid-media waste" onChange={(e) => set({ goals: e.target.value })} /></label>
                    <div className="field">Use cases
                        <div className="chips">{USE_CASES.map((u) => <button key={u} className={d.useCases.includes(u) ? 'chip on' : 'chip'} onClick={() => set({ useCases: toggle(d.useCases, u) })}>{u}</button>)}</div>
                    </div>
                    <label className="field">Other use cases<input value={d.otherUseCases} onChange={(e) => set({ otherUseCases: e.target.value })} /></label>
                    <div className="field">Products licensed
                        <div className="chips">{PRODUCTS.map((p) => <button key={p} className={d.products.includes(p) ? 'chip on' : 'chip'} onClick={() => set({ products: toggle(d.products, p) })}>{p}</button>)}</div>
                    </div>
                </section>
            )}

            {step === 1 && (
                <section className="card">
                    <p className="muted small">List every system that holds customer data. Names and identifiers only - no actual records.</p>
                    {d.sources.map((s, i) => (
                        <div key={i} className="source">
                            <div className="row">
                                <input placeholder="System name (e.g. Salesforce CRM)" value={s.name} onChange={(e) => setSource(i, { name: e.target.value })} />
                                <button className="icon-btn" title="Remove" onClick={() => set({ sources: d.sources.filter((_, k) => k !== i) })}>✕</button>
                            </div>
                            <div className="row wrap">
                                <select value={s.kind} onChange={(e) => setSource(i, { kind: e.target.value })}>{SOURCE_KINDS.map((k) => <option key={k}>{k}</option>)}</select>
                                <select value={s.dataKind} onChange={(e) => setSource(i, { dataKind: e.target.value })}>{DATA_KINDS.map((k) => <option key={k}>{k}</option>)}</select>
                                <select value={s.frequency} onChange={(e) => setSource(i, { frequency: e.target.value })}>{FREQUENCIES.map((k) => <option key={k}>{k}</option>)}</select>
                            </div>
                            <input placeholder="Identifiers available (e.g. email, crmId, loyaltyId, ECID)" value={s.identifiers} onChange={(e) => setSource(i, { identifiers: e.target.value })} />
                            <input placeholder="Notes (volume, tech, owner team)" value={s.notes} onChange={(e) => setSource(i, { notes: e.target.value })} />
                        </div>
                    ))}
                    <button onClick={() => set({ sources: [...d.sources, blankSource()] })}>+ Add source</button>
                </section>
            )}

            {step === 2 && (
                <section className="card">
                    <p className="muted small">
                        Upload the data dictionary as CSV with columns like <code>field, type, description, source</code>.
                        Sample/example/value columns are ignored automatically.
                    </p>
                    <label className="btn">Upload CSV<input type="file" accept=".csv,text/csv" hidden onChange={(e) => e.target.files[0] && uploadDictionary(e.target.files[0])} /></label>
                    {ctx.dataDictionary?.length > 0 && d.dictionary.length === 0 && (
                        <button onClick={() => set({ dictionary: ctx.dataDictionary })}>Use dictionary from context ({ctx.dataDictionary.length})</button>
                    )}
                    {d.dictionary.length > 0 && (
                        <>
                            <div className="small">{d.dictionary.length} fields loaded. <button className="link" onClick={() => set({ dictionary: [] })}>Clear</button></div>
                            <table className="table">
                                <thead><tr><th>Field</th><th>Type</th><th>Source</th></tr></thead>
                                <tbody>{d.dictionary.slice(0, 50).map((f, i) => <tr key={i}><td>{f.field}</td><td>{f.type}</td><td>{f.source}</td></tr>)}</tbody>
                            </table>
                            {d.dictionary.length > 50 && <div className="muted small">…and {d.dictionary.length - 50} more</div>}
                        </>
                    )}
                </section>
            )}

            {step === 3 && (
                <section className="card">
                    <div className="field">Channels
                        <div className="chips">{CHANNELS.map((c) => <button key={c} className={d.channels.includes(c) ? 'chip on' : 'chip'} onClick={() => set({ channels: toggle(d.channels, c) })}>{c}</button>)}</div>
                    </div>
                    <label className="field">Destinations<input value={d.destinations} placeholder="Meta, Google Ads, Salesforce Marketing Cloud, S3 export…" onChange={(e) => set({ destinations: e.target.value })} /></label>
                    <div className="field">Regulations
                        <div className="chips">{REGULATIONS.map((r) => <button key={r} className={d.regulations.includes(r) ? 'chip on' : 'chip'} onClick={() => set({ regulations: toggle(d.regulations, r) })}>{r}</button>)}</div>
                    </div>
                    <label className="field">Consent notes<input value={d.consentNotes} placeholder="Where consent lives, opt-in model, regions" onChange={(e) => set({ consentNotes: e.target.value })} /></label>
                    <label className="field">Sandboxes<input value={d.sandboxes} onChange={(e) => set({ sandboxes: e.target.value })} /></label>
                    <label className="field">Team experience
                        <select value={d.experience} onChange={(e) => set({ experience: e.target.value })}>
                            {['New to AEP', 'Some AEP experience', 'Experienced AEP team'].map((x) => <option key={x}>{x}</option>)}
                        </select>
                    </label>
                </section>
            )}

            {step === 4 && (
                <section className="card">
                    <div className="row wrap">
                        <button className="primary" disabled={Boolean(busy) || !isConfigured(settings)} onClick={run}>{busy === 'report' ? 'Designing… (can take a minute)' : report ? 'Regenerate plan' : 'Generate implementation plan'}</button>
                        {report && <button disabled={Boolean(busy)} onClick={runManifest}>{busy === 'manifest' ? 'Building…' : 'Manifest (JSON)'}</button>}
                        {report && <button onClick={() => download(`${(d.client || 'aep').toLowerCase().replace(/\W+/g, '-')}-implementation-plan.md`, report, 'text/markdown')}>Download .md</button>}
                        {report && <button onClick={() => navigator.clipboard.writeText(report)}>Copy</button>}
                    </div>
                    <p className="muted small">Uses the active sandbox context ({ctx.name}) so existing schemas, namespaces and audiences are reused.</p>
                    {steps.length > 0 && (
                        <div className="checklist">
                            <strong>Training checklist - build it yourself in dev ({Object.values(checked).filter(Boolean).length}/{steps.length})</strong>
                            <div className="progress"><div style={{ width: `${(Object.values(checked).filter(Boolean).length / steps.length) * 100}%` }} /></div>
                            {steps.map((s, i) => (
                                <label key={i} className={checked[i] ? 'done' : ''}>
                                    <input type="checkbox" checked={Boolean(checked[i])} onChange={(e) => setChecked({ ...checked, [i]: e.target.checked })} />
                                    <Markdown>{s}</Markdown>
                                </label>
                            ))}
                        </div>
                    )}
                    {report && <Markdown>{report}</Markdown>}
                </section>
            )}

            {notice && <div className="notice">{notice}</div>}
            <div className="row between">
                <button disabled={step === 0} onClick={() => setStep(step - 1)}>Back</button>
                <button className="link" onClick={() => { if (confirm('Clear this design?')) { setD(blankDesign()); setReport(''); setChecked({}); setStep(0); } }}>Reset</button>
                <button className="primary" disabled={step === STEPS.length - 1} onClick={() => setStep(step + 1)}>Next</button>
            </div>
        </div>
    );
}
