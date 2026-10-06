import { useEffect, useRef, useState } from 'react';
import { chat, isConfigured } from '../lib/llm.js';
import { contextToPrompt } from '../lib/context.js';
import { describeHits } from '../lib/pii.js';
import { load, save } from '../lib/storage.js';
import Markdown from '../components/Markdown.jsx';

const QUICK = [
    'Which identity should be primary for my profile schema and why?',
    'What do I need configured before I can build an abandoned-cart journey?',
    'Explain the difference between streaming, batch and edge audiences.',
    'Review my sandbox context and list gaps or risks.'
];

/** Which AEP/AJO area the active tab shows - derived from the URL path only. */
async function currentPage() {
    try {
        if (typeof chrome === 'undefined' || !chrome.tabs?.query) return null;
        const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        if (!tab?.url?.startsWith('https://experience.adobe.com/')) return null;
        const route = new URL(tab.url).hash.replace(/^#/, '').split('?')[0];
        return route || null;
    } catch {
        return null;
    }
}

export default function Assistant({ settings, ctx }) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [busy, setBusy] = useState(false);
    const [usePage, setUsePage] = useState(true);
    const endRef = useRef(null);

    useEffect(() => { load('assistantChat', []).then(setMessages); }, []);
    useEffect(() => {
        save('assistantChat', messages.slice(-40));
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const send = async (text) => {
        const q = (text ?? input).trim();
        if (!q || busy) return;
        setInput('');
        const next = [...messages, { role: 'user', content: q }];
        setMessages(next);
        setBusy(true);
        try {
            const page = usePage ? await currentPage() : null;
            const system = `You are an expert Adobe Experience Platform, RTCDP and Journey Optimizer consultant helping practitioners and new team members.
Answer concretely, with exact UI paths and object names. Explain the "why" briefly. Use markdown.
You only have the sandbox METADATA below - never ask for or invent customer/profile data.
${page ? `\nThe user currently has this Adobe Experience Cloud page open: ${page}\n` : ''}
${contextToPrompt(ctx)}`;
            const { text: answer, redactions } = await chat(settings, { system, messages: next.slice(-16) });
            const note = describeHits(redactions);
            setMessages([...next, { role: 'assistant', content: answer, note }]);
        } catch (e) {
            setMessages([...next, { role: 'assistant', content: `⚠ ${e.message}` }]);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="assistant">
            <div className="messages">
                {messages.length === 0 && (
                    <div className="card">
                        <p className="muted">Ask anything about AEP, RTCDP or AJO. Answers use your sandbox context (metadata only).</p>
                        {QUICK.map((q) => <button key={q} className="quick" disabled={!isConfigured(settings)} onClick={() => send(q)}>{q}</button>)}
                    </div>
                )}
                {messages.map((m, i) => (
                    <div key={i} className={`msg ${m.role}`}>
                        {m.role === 'assistant' ? <Markdown>{m.content}</Markdown> : m.content}
                        {m.note && <div className="muted small">{m.note}</div>}
                    </div>
                ))}
                {busy && <div className="msg assistant muted">Thinking…</div>}
                <div ref={endRef} />
            </div>
            <div className="composer">
                <label className="small"><input type="checkbox" checked={usePage} onChange={(e) => setUsePage(e.target.checked)} /> Use the Adobe page I have open</label>
                <div className="row">
                    <textarea rows={2} value={input} placeholder="Ask…" onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
                    <button className="primary" disabled={busy || !isConfigured(settings)} onClick={() => send()}>Send</button>
                </div>
                {messages.length > 0 && <button className="link small" onClick={() => setMessages([])}>Clear chat</button>}
            </div>
        </div>
    );
}
