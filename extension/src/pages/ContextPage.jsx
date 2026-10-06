import { useState } from 'react';
import { CONTEXT_VERSION, emptyContext, fetchFromBackend, fetchSchemaFields, mergeSnapshot, parseDataDictionaryCsv } from '../lib/context.js';
import { download, readFile } from '../lib/storage.js';

export default function ContextPage({ settings, ctx, setCtx, addCtx, removeCtx }) {
    const [busy, setBusy] = useState('');
    const [notice, setNotice] = useState('');
    const [newEvent, setNewEvent] = useState({ name: '', type: 'unitary', fields: '' });
    const [newAction, setNewAction] = useState({ name: '', description: '' });

    const set = (patch) => setCtx({ ...ctx, ...patch, updatedAt: new Date().toISOString() });

    const sync = async () => {
        setBusy('sync');
        setNotice('');
        try {
            const snap = await fetchFromBackend(settings.backendUrl, ctx.sandbox);
            const { ctx: merged, warnings } = mergeSnapshot(ctx, snap);
            setCtx(merged);
            setNotice(`Synced: ${merged.schemas.length} schemas, ${merged.audiences.length} audiences, ${merged.namespaces.length} namespaces, ${merged.datasets.length} datasets.${warnings.length ? ` Skipped: ${warnings.join('; ')}` : ''}`);
        } catch (e) {
            setNotice(`${e.message} - you can still import a context file or fill it in by hand.`);
        } finally {
            setBusy('');
        }
    };

    const loadFields = async (schema) => {
        setBusy(schema.id);
        try {
            const res = await fetchSchemaFields(settings.backendUrl, schema.altId || schema.id, ctx.sandbox);
            set({ schemas: ctx.schemas.map((s) => (s.id === schema.id ? { ...s, class: res.class, fields: res.fields } : s)) });
        } catch (e) {
            setNotice(e.message);
        } finally {
            setBusy('');
        }
    };

    const importFile = async (file) => {
        try {
            const data = JSON.parse(await readFile(file));
            if (!data.version || !Array.isArray(data.schemas)) throw new Error('Not an AEP AI Center context file.');
            addCtx({ ...emptyContext(), ...data, name: data.name || file.name });
            setNotice(`Imported "${data.name || file.name}" as a new context.`);
        } catch (e) {
            setNotice(`Import failed: ${e.message}`);
        }
    };

    const importDictionary = async (file) => {
        try {
            const { fields, dropped } = parseDataDictionaryCsv(await readFile(file));
            set({ dataDictionary: fields });
            setNotice(`Loaded ${fields.length} dictionary fields.${dropped.length ? ` Ignored value columns: ${dropped.join(', ')}.` : ''}`);
        } catch (e) {
            setNotice(e.message);
        }
    };

    return (
        <div className="context-page">
            <section className="card">
                <div className="row">
                    <input className="title-input" value={ctx.name} onChange={(e) => set({ name: e.target.value })} />
                </div>
                <label className="field">Sandbox name<input value={ctx.sandbox} placeholder="e.g. dev" onChange={(e) => set({ sandbox: e.target.value })} /></label>
                <div className="row wrap">
                    <button className="primary" disabled={Boolean(busy)} onClick={sync}>{busy === 'sync' ? 'Syncing…' : 'Sync from backend'}</button>
                    <button onClick={() => download(`${ctx.name.replace(/\W+/g, '-')}.aep-context.json`, JSON.stringify({ ...ctx, version: CONTEXT_VERSION }, null, 2))}>Save to my machine</button>
                    <label className="btn">Import<input type="file" accept=".json" hidden onChange={(e) => e.target.files[0] && importFile(e.target.files[0])} /></label>
                    <button onClick={() => addCtx()}>New</button>
                    <button className="danger" onClick={() => confirm(`Delete context "${ctx.name}" from this browser?`) && removeCtx()}>Delete</button>
                </div>
                <p className="muted small">
                    Context is the technical shape of a sandbox - schemas, field paths, identities, audience rules, events. No profile data.
                    It stays in this browser; "Save to my machine" writes a JSON file you can keep in your own drive or Git.
                    Sync uses the AEP AI Center backend at {settings.backendUrl}.
                    {ctx.updatedAt && ` Last updated ${new Date(ctx.updatedAt).toLocaleString()}.`}
                </p>
                {notice && <div className="notice">{notice}</div>}
            </section>

            <section className="card">
                <h3>Journey events ({ctx.journeyEvents.length})</h3>
                <p className="muted small">AJO event configurations have no public API - add the ones your journeys use.</p>
                {ctx.journeyEvents.map((e, i) => (
                    <div key={i} className="row item">
                        <span><strong>{e.name}</strong> <span className="muted">[{e.type}]</span> {e.fields}</span>
                        <button className="icon-btn" onClick={() => set({ journeyEvents: ctx.journeyEvents.filter((_, k) => k !== i) })}>✕</button>
                    </div>
                ))}
                <div className="row wrap">
                    <input placeholder="Event name" value={newEvent.name} onChange={(e) => setNewEvent({ ...newEvent, name: e.target.value })} />
                    <select value={newEvent.type} onChange={(e) => setNewEvent({ ...newEvent, type: e.target.value })}><option>unitary</option><option>business</option></select>
                    <input placeholder="Key fields (comma separated)" value={newEvent.fields} onChange={(e) => setNewEvent({ ...newEvent, fields: e.target.value })} />
                    <button disabled={!newEvent.name.trim()} onClick={() => { set({ journeyEvents: [...ctx.journeyEvents, { ...newEvent, name: newEvent.name.trim() }] }); setNewEvent({ name: '', type: 'unitary', fields: '' }); }}>Add</button>
                </div>
            </section>

            <section className="card">
                <h3>Custom actions ({ctx.customActions.length})</h3>
                {ctx.customActions.map((a, i) => (
                    <div key={i} className="row item">
                        <span><strong>{a.name}</strong> {a.description}</span>
                        <button className="icon-btn" onClick={() => set({ customActions: ctx.customActions.filter((_, k) => k !== i) })}>✕</button>
                    </div>
                ))}
                <div className="row wrap">
                    <input placeholder="Action name" value={newAction.name} onChange={(e) => setNewAction({ ...newAction, name: e.target.value })} />
                    <input placeholder="What it calls" value={newAction.description} onChange={(e) => setNewAction({ ...newAction, description: e.target.value })} />
                    <button disabled={!newAction.name.trim()} onClick={() => { set({ customActions: [...ctx.customActions, { ...newAction, name: newAction.name.trim() }] }); setNewAction({ name: '', description: '' }); }}>Add</button>
                </div>
                <label className="field">Channels configured<input value={ctx.channels.join(', ')} onChange={(e) => set({ channels: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} /></label>
            </section>

            <section className="card">
                <h3>Data dictionary ({ctx.dataDictionary.length})</h3>
                <label className="btn">Upload CSV<input type="file" accept=".csv,text/csv" hidden onChange={(e) => e.target.files[0] && importDictionary(e.target.files[0])} /></label>
                {ctx.dataDictionary.length > 0 && <button className="link" onClick={() => set({ dataDictionary: [] })}>Clear</button>}
            </section>

            <section className="card">
                <h3>Schemas ({ctx.schemas.length})</h3>
                <p className="muted small">Load fields for the schemas your journeys and audiences use - field paths feed conditions and the AI.</p>
                <ul className="list">
                    {ctx.schemas.slice(0, 200).map((s) => (
                        <li key={s.id} className="row between">
                            <span>{s.title}{s.fields ? <span className="muted"> · {s.fields.length} fields</span> : ''}</span>
                            {!s.fields && <button disabled={Boolean(busy)} onClick={() => loadFields(s)}>{busy === s.id ? '…' : 'Load fields'}</button>}
                        </li>
                    ))}
                </ul>
            </section>

            <Summary title="Audiences" items={ctx.audiences} fmt={(a) => `${a.name} · ${a.evaluation}`} />
            <Summary title="Identity namespaces" items={ctx.namespaces} fmt={(n) => `${n.code} - ${n.name}`} />
            <Summary title="Datasets" items={ctx.datasets} fmt={(d) => `${d.name}${d.profileEnabled ? ' · profile' : ''}`} />
            <Summary title="Source dataflows" items={ctx.flows} fmt={(f) => `${f.name} · ${f.state}`} />
            <Summary title="Merge policies" items={ctx.mergePolicies} fmt={(m) => `${m.name}${m.default ? ' · default' : ''}`} />

            <section className="card">
                <h3>Notes for the AI</h3>
                <textarea rows={3} value={ctx.notes} placeholder="Naming conventions, brand rules for journeys, quiet hours, frequency caps…" onChange={(e) => set({ notes: e.target.value })} />
            </section>
        </div>
    );
}

function Summary({ title, items, fmt }) {
    const [open, setOpen] = useState(false);
    if (!items?.length) return null;
    return (
        <section className="card">
            <h3 className="clickable" onClick={() => setOpen(!open)}>{open ? '▾' : '▸'} {title} ({items.length})</h3>
            {open && <ul className="list">{items.slice(0, 300).map((x, i) => <li key={i}>{fmt(x)}</li>)}</ul>}
        </section>
    );
}
