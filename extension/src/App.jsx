import { useCallback, useEffect, useState } from 'react';
import { load, save } from './lib/storage.js';
import { DEFAULT_SETTINGS, isConfigured } from './lib/llm.js';
import { emptyContext, loadContexts, saveContexts } from './lib/context.js';
import Icon from './components/Icon.jsx';
import Home from './pages/Home.jsx';
import JourneyBuilder from './pages/JourneyBuilder.jsx';
import SolutionDesigner from './pages/SolutionDesigner.jsx';
import Assistant from './pages/Assistant.jsx';
import ContextPage from './pages/ContextPage.jsx';
import Settings from './pages/Settings.jsx';

const TABS = [
    { id: 'home', label: 'AI Center', icon: 'home' },
    { id: 'journey', label: 'Journeys', icon: 'journey' },
    { id: 'designer', label: 'Designer', icon: 'designer' },
    { id: 'assistant', label: 'Ask', icon: 'chat' },
    { id: 'context', label: 'Context', icon: 'context' },
    { id: 'settings', label: 'Settings', icon: 'settings' }
];

const initialTab = () => {
    const hash = window.location.hash.replace('#', '');
    return TABS.some((t) => t.id === hash) ? hash : 'home';
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
    const aiTabs = ['designer', 'assistant'];

    return (
        <div className="app">
            <header className="topbar">
                <div className="brand"><img src="icon.png" alt="" />AEP AI Center</div>
                <div className="spacer" />
                <label className="ctx-picker" title="Active sandbox context">
                    <span>Sandbox</span>
                    <select value={contexts.activeIndex} onChange={(e) => updateContexts({ ...contexts, activeIndex: Number(e.target.value) })}>
                        {contexts.items.map((c, i) => <option key={i} value={i}>{c.name}</option>)}
                    </select>
                </label>
                <button className="icon-btn" title="Open in a full tab" onClick={openInTab}><Icon name="expand" /></button>
            </header>
            <div className="body">
                <nav className="nav">
                    {TABS.map((t) => (
                        <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)} title={t.label}>
                            <Icon name={t.icon} />
                            <span className="label">{t.label}</span>
                            {t.id === 'settings' && !llmReady && <span className="dot" title="LLM not configured" />}
                        </button>
                    ))}
                </nav>
                <main className="content">
                    {!llmReady && aiTabs.includes(tab) && (
                        <div className="banner notice">
                            <Icon name="alert" />
                            <span>This tab needs your own LLM key. <button className="link" onClick={() => setTab('settings')}>Open Settings</button></span>
                        </div>
                    )}
                    {tab === 'home' && <Home settings={settings} ctx={ctx} go={setTab} />}
                    {tab === 'journey' && <JourneyBuilder settings={settings} ctx={ctx} />}
                    {tab === 'designer' && <SolutionDesigner settings={settings} ctx={ctx} />}
                    {tab === 'assistant' && <Assistant settings={settings} ctx={ctx} />}
                    {tab === 'context' && <ContextPage settings={settings} ctx={ctx} setCtx={setCtx} addCtx={addCtx} removeCtx={removeCtx} />}
                    {tab === 'settings' && <Settings settings={settings} onChange={updateSettings} />}
                </main>
            </div>
        </div>
    );
}
