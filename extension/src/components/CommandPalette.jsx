import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { backendFetch } from '../lib/backend.js';
import { ENTITY_LABELS } from '../lib/aepPage.js';

/**
 * Ctrl/⌘+K palette: jump to a tab or tool, or to any object in the sandbox.
 * `commands` are static [{ id, label, hint, icon, run }]; objects come from /api/ext/search.
 */
export default function CommandPalette({ open, onClose, commands, settings, sandbox, onOpenEntity }) {
    const [q, setQ] = useState('');
    const [remote, setRemote] = useState([]);
    const [active, setActive] = useState(0);
    const [note, setNote] = useState('');
    const inputRef = useRef(null);

    useEffect(() => {
        if (open) {
            setQ('');
            setRemote([]);
            setActive(0);
            setNote('');
            setTimeout(() => inputRef.current?.focus(), 0);
        }
    }, [open]);

    useEffect(() => {
        if (!open || q.trim().length < 2) {
            setRemote([]);
            return undefined;
        }
        const ctrl = new AbortController();
        const t = setTimeout(() => {
            backendFetch(settings, `/api/ext/search?${new URLSearchParams({ q, limit: '8' })}`, { sandbox, signal: ctrl.signal })
                .then((r) => { setRemote(r.results || []); setNote(''); })
                .catch((e) => e.name !== 'AbortError' && setNote(e.kind === 'offline' ? 'Backend offline - object search unavailable' : e.message));
        }, 180);
        return () => {
            clearTimeout(t);
            ctrl.abort();
        };
    }, [q, open, settings, sandbox]);

    const items = useMemo(() => {
        const needle = q.trim().toLowerCase();
        const cmds = commands
            .filter((c) => !needle || `${c.label} ${c.hint || ''}`.toLowerCase().includes(needle))
            .map((c) => ({ key: `cmd-${c.id}`, label: c.label, hint: c.hint, icon: c.icon, run: c.run }));
        const objs = remote.map((r) => ({
            key: `obj-${r.type}-${r.id}`,
            label: r.name,
            hint: `${ENTITY_LABELS[r.type]}${r.subtitle ? ` · ${r.subtitle}` : ''}`,
            icon: 'search',
            run: () => onOpenEntity(r.type, r.id)
        }));
        return [...cmds.slice(0, needle ? 6 : 12), ...objs];
    }, [q, commands, remote, onOpenEntity]);

    useEffect(() => {
        if (active >= items.length) setActive(Math.max(0, items.length - 1));
    }, [items, active]);

    if (!open) return null;

    const choose = (item) => {
        if (!item) return;
        onClose();
        item.run();
    };

    const onKey = (e) => {
        if (e.key === 'Escape') onClose();
        else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(items.length - 1, a + 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
        else if (e.key === 'Enter') { e.preventDefault(); choose(items[active]); }
    };

    return (
        <div className="palette-backdrop" onMouseDown={onClose}>
            <div className="palette" role="dialog" aria-label="Command palette" onMouseDown={(e) => e.stopPropagation()}>
                <div className="searchbox">
                    <Icon name="search" size={16} />
                    <input ref={inputRef} autoFocus value={q} placeholder="Jump to a tool, or search datasets, schemas, audiences…" onChange={(e) => { setQ(e.target.value); setActive(0); }} onKeyDown={onKey} />
                    <kbd>Esc</kbd>
                </div>
                <ul className="palette-list" role="listbox">
                    {items.map((it, i) => (
                        <li key={it.key} role="option" aria-selected={i === active}>
                            <button className={i === active ? 'active' : ''} onMouseEnter={() => setActive(i)} onClick={() => choose(it)}>
                                <Icon name={it.icon || 'search'} size={16} />
                                <span className="result-text"><strong>{it.label}</strong>{it.hint && <span className="small muted">{it.hint}</span>}</span>
                            </button>
                        </li>
                    ))}
                    {items.length === 0 && <li className="small muted empty">Nothing matches “{q}”.</li>}
                </ul>
                {note && <div className="small muted palette-note">{note}</div>}
            </div>
        </div>
    );
}
