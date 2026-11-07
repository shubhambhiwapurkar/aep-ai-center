import { useCallback, useEffect, useMemo, useState } from 'react';
import { load, save } from './lib/storage.js';
import { DEFAULT_SETTINGS, isConfigured } from './lib/llm.js';
import { emptyContext, loadContexts, saveContexts } from './lib/context.js';
import { applyPolicy, loadManagedPolicy } from './lib/managed.js';
import { describePage } from './lib/aepPage.js';
import { usePageContext } from './hooks/usePageContext.js';
import Icon from './components/Icon.jsx';
import CommandPalette from './components/CommandPalette.jsx';
import Home from './pages/Home.jsx';
import Explore from './pages/Explore.jsx';
import Tools from './pages/Tools.jsx';
import JourneyBuilder from './pages/JourneyBuilder.jsx';
import SolutionDesigner from './pages/SolutionDesigner.jsx';
import Assistant from './pages/Assistant.jsx';
import ContextPage from './pages/ContextPage.jsx';
import Settings from './pages/Settings.jsx';

const TABS = [
    { id: 'home', label: 'AI Center', icon: 'home' },
    { id: 'explore', label: 'Explore', icon: 'search' },
    { id: 'tools', label: 'Tools', icon: 'tools' },
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
    const [userSettings, setUserSettings] = useState(null);
    const [policy, setPolicy] = useState(null);
    const [contexts, setContexts] = useState(null);
    const [paletteOpen, setPaletteOpen] = useState(false);
    const [exploreFocus, setExploreFocus] = useState(null);
    const [toolsTab, setToolsTab] = useState(null);
    const page = usePageContext();

    useEffect(() => {
        load('settings', DEFAULT_SETTINGS).then((s) => setUserSettings({ ...DEFAULT_SETTINGS, ...s }));
        loadManagedPolicy().then(setPolicy);
        loadContexts().then(setContexts);
        // Admins can change policy while the panel is open
        const onChange = (_changes, area) => area === 'managed' && loadManagedPolicy().then(setPolicy);
        if (typeof chrome !== 'undefined') chrome.storage?.onChanged?.addListener(onChange);
        return () => {
            if (typeof chrome !== 'undefined') chrome.storage?.onChanged?.removeListener(onChange);
        };
    }, []);

    useEffect(() => {
        window.location.hash = tab;
    }, [tab]);

    // Ctrl/Cmd+K opens the palette from anywhere in the panel
    useEffect(() => {
        const onKey = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setPaletteOpen((o) => !o);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    const managed = useMemo(() => (userSettings && policy ? applyPolicy(userSettings, policy) : null), [userSettings, policy]);
    const settings = managed?.settings;

    const updateSettings = useCallback((next) => {
        // Never persist policy-managed values as the user's own
        const own = { ...next };
        for (const k of managed?.locked || []) own[k] = userSettings[k];
        delete own.aiDisabled;
        setUserSettings(own);
        save('settings', own);
    }, [managed, userSettings]);

    const updateContexts = useCallback((next) => {
        setContexts(next);
        saveContexts(next);
    }, []);

    const openEntity = useCallback((type, id) => {
        setExploreFocus({ type, id, at: Date.now() });
        setTab('explore');
    }, []);

    const commands = useMemo(() => [
        ...TABS.map((t) => ({ id: `tab-${t.id}`, label: `Go to ${t.label}`, icon: t.icon, run: () => setTab(t.id) })),
        { id: 'audit', label: 'Run sandbox audit', hint: 'Tools', icon: 'tools', run: () => { setToolsTab('audit'); setTab('tools'); } },
        { id: 'fields', label: 'Find a field', hint: 'Tools · which XDM path holds…', icon: 'tools', run: () => { setToolsTab('fields'); setTab('tools'); } },
        { id: 'sql', label: 'Lint a SQL query', hint: 'Tools · Query Service', icon: 'tools', run: () => { setToolsTab('sql'); setTab('tools'); } },
        { id: 'size', label: 'Estimate audience size', hint: 'Tools · PQL', icon: 'tools', run: () => { setToolsTab('size'); setTab('tools'); } },
        ...(page?.entity ? [{ id: 'page', label: 'Explain what is on this page', hint: describePage(page), icon: 'page', run: () => openEntity(page.entity.type, page.entity.id) }] : [])
    ], [page, openEntity]);

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

    // Which sandbox backend calls target: the one open in AEP (if following), else the context's.
    const sandbox = (settings.followPageSandbox !== false && page?.sandbox) || ctx.sandbox || undefined;

    const openInTab = () => {
        const url = typeof chrome !== 'undefined' && chrome.runtime?.getURL ? chrome.runtime.getURL(`sidepanel.html#${tab}`) : `#${tab}`;
        if (typeof chrome !== 'undefined' && chrome.tabs?.create) chrome.tabs.create({ url });
        else window.open(url, '_blank');
    };

    const llmReady = isConfigured(settings) && !settings.aiDisabled;
    const aiTabs = ['designer', 'assistant'];
    const props = { settings, ctx, sandbox, page };

    return (
        <div className="app">
            <header className="topbar">
                <div className="brand"><img src="icon.png" alt="" />AEP AI Center</div>
                {policy?.orgName && <span className="org-badge" title="Managed by your organization">{policy.orgName}</span>}
                <div className="spacer" />
                {page && (
                    <button className={`page-chip ${page.entity ? 'has-entity' : ''}`} title={page.entity ? 'Show details for the object open in AEP' : 'Sandbox open in the active tab'}
                        onClick={() => (page.entity ? openEntity(page.entity.type, page.entity.id) : setTab('explore'))}>
                        <Icon name="page" size={14} />{describePage(page)}
                    </button>
                )}
                <button className="icon-btn" title="Command palette (Ctrl+K)" onClick={() => setPaletteOpen(true)}><Icon name="search" /></button>
                <label className="ctx-picker" title="Active sandbox context">
                    <select aria-label="Sandbox context" value={contexts.activeIndex} onChange={(e) => updateContexts({ ...contexts, activeIndex: Number(e.target.value) })}>
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
                            {t.id === 'settings' && !llmReady && !settings.aiDisabled && <span className="dot" title="LLM not configured" />}
                        </button>
                    ))}
                </nav>
                <main className="content">
                    {settings.aiDisabled && aiTabs.includes(tab) && (
                        <div className="banner notice"><Icon name="alert" /><span>AI features are turned off by your organization's policy.</span></div>
                    )}
                    {!settings.aiDisabled && !llmReady && aiTabs.includes(tab) && (
                        <div className="banner notice">
                            <Icon name="alert" />
                            <span>This tab needs your own LLM key. <button className="link" onClick={() => setTab('settings')}>Open Settings</button></span>
                        </div>
                    )}
                    {tab === 'home' && <Home {...props} go={setTab} openEntity={openEntity} />}
                    {tab === 'explore' && <Explore {...props} focus={exploreFocus} />}
                    {tab === 'tools' && <Tools {...props} initial={toolsTab} key={toolsTab || 'tools'} openEntity={openEntity} />}
                    {tab === 'journey' && <JourneyBuilder settings={settings} ctx={ctx} />}
                    {tab === 'designer' && <SolutionDesigner settings={settings} ctx={ctx} />}
                    {tab === 'assistant' && <Assistant settings={settings} ctx={ctx} />}
                    {tab === 'context' && <ContextPage settings={settings} ctx={ctx} setCtx={setCtx} addCtx={addCtx} removeCtx={removeCtx} />}
                    {tab === 'settings' && <Settings settings={settings} locked={managed.locked} policy={policy} onChange={updateSettings} />}
                </main>
            </div>
            <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} commands={commands} settings={settings} sandbox={sandbox} onOpenEntity={openEntity} />
        </div>
    );
}
