import { useEffect, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import EntityDetail from '../components/EntityDetail.jsx';
import { backendFetch } from '../lib/backend.js';
import { ENTITY_LABELS, describePage } from '../lib/aepPage.js';

const TYPES = [
    { id: 'dataset', label: 'Datasets' },
    { id: 'schema', label: 'Schemas' },
    { id: 'audience', label: 'Audiences' },
    { id: 'flow', label: 'Dataflows' },
    { id: 'namespace', label: 'Identities' },
    { id: 'mergePolicy', label: 'Merge policies' }
];

/**
 * Search everything in the sandbox by name or id, and see what the open AEP page is about.
 * `focus` ({ type, id } or { query }) comes from the command palette or the Home screen.
 */
export default function Explore({ settings, ctx, sandbox, page, focus }) {
    const [query, setQuery] = useState('');
    const [types, setTypes] = useState([]);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState(null);
    const inputRef = useRef(null);

    useEffect(() => {
        if (focus?.type && focus?.id) setSelected({ type: focus.type, id: focus.id });
        if (focus?.query !== undefined) setQuery(focus.query);
    }, [focus]);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    useEffect(() => {
        if (!query.trim()) {
            setResult(null);
            setError('');
            return undefined;
        }
        const ctrl = new AbortController();
        const t = setTimeout(async () => {
            setLoading(true);
            try {
                const params = new URLSearchParams({ q: query, limit: '40', ...(types.length ? { types: types.join(',') } : {}) });
                setResult(await backendFetch(settings, `/api/ext/search?${params}`, { sandbox, signal: ctrl.signal }));
                setError('');
            } catch (e) {
                if (e.name !== 'AbortError') setError(e.message);
            } finally {
                setLoading(false);
            }
        }, 220);
        return () => {
            clearTimeout(t);
            ctrl.abort();
        };
    }, [query, types, settings, sandbox]);

    const toggle = (id) => setTypes(types.includes(id) ? types.filter((t) => t !== id) : [...types, id]);
    const open = (type, id) => setSelected({ type, id });
    const pageEntity = page?.entity;

    return (
        <div className="explore">
            <h1 className="page-title">Explore</h1>

            {pageEntity && !(selected && selected.id === pageEntity.id) && (
                <button className="onpage" onClick={() => open(pageEntity.type, pageEntity.id)}>
                    <Icon name="page" size={16} />
                    <span><strong>On this page:</strong> {describePage(page)}</span>
                    <span className="small muted">Show details</span>
                </button>
            )}

            <div className="searchbox">
                <Icon name="search" size={16} />
                <input ref={inputRef} value={query} placeholder="Search datasets, schemas, audiences, dataflows… by name or id" onChange={(e) => setQuery(e.target.value)} />
                {loading && <span className="small muted">…</span>}
            </div>
            <div className="chips">
                {TYPES.map((t) => (
                    <button key={t.id} className={`chip ${types.includes(t.id) ? 'on' : ''}`} onClick={() => toggle(t.id)}>
                        {t.label}{result?.counts?.[t.id] !== undefined ? ` · ${result.counts[t.id]}` : ''}
                    </button>
                ))}
            </div>

            {error && <div className="banner notice"><Icon name="alert" /><span>{error}</span></div>}
            {result?.warnings?.length > 0 && <div className="small muted">Partially indexed: {result.warnings.join('; ')}</div>}

            <div className="explore-grid">
                {(result?.results?.length > 0 || query) && (
                    <ul className="results">
                        {result?.results?.map((r) => (
                            <li key={`${r.type}-${r.id}`}>
                                <button className={`result ${selected?.id === r.id ? 'active' : ''}`} onClick={() => open(r.type, r.id)}>
                                    <span className={`type-dot t-${r.type}`} />
                                    <span className="result-text">
                                        <strong>{r.name}</strong>
                                        <span className="small muted">{ENTITY_LABELS[r.type]}{r.subtitle ? ` · ${r.subtitle}` : ''}</span>
                                    </span>
                                </button>
                            </li>
                        ))}
                        {result && !result.results?.length && !loading && <li className="small muted empty">No matches in sandbox {result.sandbox}.</li>}
                    </ul>
                )}
                {selected && (
                    <EntityDetail settings={settings} ctx={ctx} sandbox={sandbox} type={selected.type} id={selected.id} onOpen={open} />
                )}
            </div>

            {!query && !selected && (
                <div className="small muted">
                    Tip: press <kbd>Ctrl</kbd> <kbd>K</kbd> (<kbd>⌘</kbd> <kbd>K</kbd> on Mac) anywhere in the panel to jump straight to an object or a tool.
                    Searches cover names and ids only, read through your backend. Nothing is sent to an LLM unless you click Explain.
                </div>
            )}
        </div>
    );
}
