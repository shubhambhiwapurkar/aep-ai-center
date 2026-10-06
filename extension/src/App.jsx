import { useCallback, useEffect, useState } from 'react';
import { load, save } from './lib/storage.js';
import { DEFAULT_SETTINGS, isConfigured } from './lib/llm.js';
import { emptyContext, loadContexts, saveContexts } from './lib/context.js';
import JourneyBuilder from './pages/JourneyBuilder.jsx';
import SolutionDesigner from './pages/SolutionDesigner.jsx';
import Assistant from './pages/Assistant.jsx';
import ContextPage from './pages/ContextPage.jsx';
import Settings from './pages/Settings.jsx';

const TABS = [
    { id: 'journey', label: 'Journeys' },
    { id: 'designer', label: 'Designer' },
    { id: 'assistant', label: 'Ask' },
    { id: 'context', label: 'Context' },
    { id: 'settings', label: 'Settings' }
];

const initialTab = () => {
    const hash = window.location.hash.replace('#', '');
    return TABS.some((t) => t.id === hash) ? hash : 'journey';
};

export default function App() {
    const [tab, setTab] = useState(initialTab);
    const [settings, setSettings] = useState(null);
    const [contexts, setContexts] = useState(null);

    useEffect(() => {
        load('settings', DEFAULT_SETTINGS).then((s) => setSettings({ ...DEFAULT_SETTINGS, ...s }));
        loadContexts().then(setContexts);
    }, []);

    useEffect(() => {
        window.location.hash = tab;
    }, [tab]);

    const updateSettings = useCallback((next) => {
        setSettings(next);
        save('settings', next);
    }, []);

    const updateContexts = useCallback((next) => {
        setContexts(next);
        saveContexts(next);
    }, []);

    if (!settings || !contexts) return <div className="loading">Loading…</div>;

    const ctx = contexts.items[contexts.activeIndex] || contexts.items[0];
    const setCtx = (nextCtx) => {
        const items = contexts.items.map((c, i) => (i === contexts.activeIndex ? nextCtx : c));
        updateContexts({ ...contexts, items });
    };
    const addCtx = (newCtx = emptyContext(`Sandbox ${contexts.items.length + 1}`)) => {
        updateContexts({ activeIndex: contexts.items.length, items: [...contexts.items, newCtx] });
    };
    const removeCtx = () => {
        if (contexts.items.length === 1) return updateContexts({ activeIndex: 0, items: [emptyContext()] });
        const items = contexts.items.filter((_, i) => i !== contexts.activeIndex);
        updateContexts({ activeIndex: 0, items });
    };

    const openInTab = () => {
        const url = typeof chrome !== 'undefined' && chrome.runtime?.getURL ? chrome.runtime.getURL(`sidepanel.html#${tab}`) : `#${tab}`;
        if (typeof chrome !== 'undefined' && chrome.tabs?.create) chrome.tabs.create({ url });
        else window.open(url, '_blank');
    };

    const llmReady = isConfigured(settings);

    return (
        <div className="app">
            <header className="topbar">
                <div className="brand">AEP AI Center</div>
                <select
                    className="ctx-select"
                    title="Active sandbox context"
                    value={contexts.activeIndex}
                    onChange={(e) => updateContexts({ ...contexts, activeIndex: Number(e.target.value) })}
                >
                    {contexts.items.map((c, i) => <option key={i} value={i}>{c.name}</option>)}
                </select>
                <button className="icon-btn" title="Open in a full tab" onClick={openInTab}>⤢</button>
            </header>
            <nav className="tabs">
                {TABS.map((t) => (
                    <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
                        {t.label}
                        {t.id === 'settings' && !llmReady && <span className="dot" title="LLM not configured" />}
                    </button>
                ))}
            </nav>
            <main className="content">
                {!llmReady && tab !== 'settings' && tab !== 'context' && (
                    <div className="banner">
                        AI features need your own LLM key. <button className="link" onClick={() => setTab('settings')}>Open Settings</button> - templates, the editor and the build guide work without it.
                    </div>
                )}
                {tab === 'journey' && <JourneyBuilder settings={settings} ctx={ctx} />}
                {tab === 'designer' && <SolutionDesigner settings={settings} ctx={ctx} />}
                {tab === 'assistant' && <Assistant settings={settings} ctx={ctx} />}
                {tab === 'context' && <ContextPage settings={settings} ctx={ctx} setCtx={setCtx} addCtx={addCtx} removeCtx={removeCtx} />}
                {tab === 'settings' && <Settings settings={settings} onChange={updateSettings} />}
            </main>
        </div>
    );
}
