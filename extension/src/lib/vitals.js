/**
 * Sandbox vitals for the AI Center home screen. Data comes from the backend's
 * /api/context/vitals (counts, states and error codes - no record contents).
 */
import { chat } from './llm.js';
import { contextToPrompt } from './context.js';

export async function fetchVitals(backendUrl) {
    const base = backendUrl.replace(/\/+$/, '');
    const res = await fetch(`${base}/api/context/vitals`);
    if (!res.ok) throw new Error(`Backend returned ${res.status}`);
    return res.json();
}

const ok = (section) => (section?.ok ? section.data : null);

export function isConnected(v) {
    return Boolean(v?.connection?.ok && v.connection.data?.connected);
}

/**
 * 0-100 score: ingestion success rate weighs most, then failed dataflow runs,
 * then sections we could not read at all.
 */
export function computeHealth(v) {
    if (!isConnected(v)) return { score: null, level: 'unknown', label: 'Not connected', reasons: [] };
    let score = 100;
    const reasons = [];
    const ing = ok(v.ingestion);
    if (ing?.successRate !== null && ing?.successRate !== undefined && ing.successRate < 100) {
        score -= (100 - ing.successRate) * 0.6;
        reasons.push(`${ing.failed} of ${ing.success + ing.failed} batches failed in 24h`);
    }
    const flows = ok(v.dataflows);
    const failedRuns = flows?.runsByState?.failed || 0;
    if (flows?.runs && failedRuns) {
        score -= (failedRuns / flows.runs) * 100 * 0.3;
        reasons.push(`${failedRuns} of ${flows.runs} recent dataflow runs failed`);
    }
    const unreadable = ['ingestion', 'dataflows', 'profiles', 'audiences', 'schemas', 'datasets'].filter((k) => v[k] && !v[k].ok);
    if (unreadable.length) {
        score -= Math.min(20, unreadable.length * 5);
        reasons.push(`Could not read: ${unreadable.join(', ')}`);
    }
    score = Math.max(0, Math.min(100, Math.round(score)));
    const level = score >= 90 ? 'positive' : score >= 70 ? 'notice' : 'negative';
    const label = level === 'positive' ? 'Healthy' : level === 'notice' ? 'Needs attention' : 'Critical';
    return { score, level, label, reasons };
}

/** Failed batches and dataflow runs, newest first, with dataset/flow names from the context when known. */
export function attentionItems(v, ctx) {
    const datasetNames = new Map((ctx?.datasets || []).map((d) => [d.id, d.name]));
    const items = [];
    for (const b of ok(v?.ingestion)?.failures || []) {
        items.push({
            kind: 'batch',
            id: b.id,
            when: b.created,
            title: `Batch failed${b.datasetId ? ` · ${datasetNames.get(b.datasetId) || b.datasetId}` : ''}`,
            errors: b.errors || []
        });
    }
    for (const r of ok(v?.dataflows)?.failures || []) {
        items.push({
            kind: 'flow',
            id: r.id,
            when: typeof r.createdAt === 'number' ? r.createdAt : Date.parse(r.createdAt) || 0,
            title: `Dataflow run failed · ${r.flowName || r.flowId}`,
            errors: r.errors || []
        });
    }
    return items.sort((a, b) => (b.when || 0) - (a.when || 0));
}

/** 24 hourly buckets ending at `now`, filled from the backend timeline. */
export function hourlyBuckets(v, now = Date.now()) {
    const timeline = new Map((ok(v?.ingestion)?.timeline || []).map((t) => [t.hour, t]));
    const buckets = [];
    for (let i = 23; i >= 0; i--) {
        const d = new Date(now - i * 3600 * 1000);
        const key = d.toISOString().slice(0, 13);
        const t = timeline.get(key) || {};
        buckets.push({ hour: key, date: d, success: t.success || 0, failed: t.failed || 0, other: t.other || 0 });
    }
    return buckets;
}

function vitalsSummary(v, ctx) {
    const pick = (k) => (v[k]?.ok ? v[k].data : { unavailable: v[k]?.error });
    return JSON.stringify({
        sandbox: v.sandbox,
        connected: isConnected(v),
        health: computeHealth(v),
        ingestion24h: (({ failures, timeline, ...rest }) => ({ ...rest, failures: attentionItems(v, ctx).filter((i) => i.kind === 'batch').slice(0, 8) }))(pick('ingestion')),
        dataflows: (({ failures, ...rest }) => ({ ...rest, failures: attentionItems(v, ctx).filter((i) => i.kind === 'flow').slice(0, 8) }))(pick('dataflows')),
        profiles: pick('profiles'),
        audiences: pick('audiences'),
        schemas: pick('schemas'),
        datasets: pick('datasets')
    });
}

export async function briefing(settings, ctx, v) {
    const { text } = await chat(settings, {
        system: `You are the on-call Adobe Experience Platform operations lead. Write a short daily health briefing in markdown:
1. One-line status.
2. "What needs attention" - grouped by root cause, most urgent first, with the likely cause of each error code.
3. "Recommended actions" - concrete steps with the AEP UI path, and who usually owns them (data engineering, source system owner, marketing ops).
Be brief. Do not invent numbers that are not in the data.

${contextToPrompt(ctx, { maxChars: 6000 })}`,
        messages: [{ role: 'user', content: vitalsSummary(v, ctx) }],
        maxTokens: 2500
    });
    return text;
}

export async function explainFailure(settings, ctx, item) {
    const { text } = await chat(settings, {
        system: `You are an Adobe Experience Platform support engineer. Explain a failure to a practitioner: likely root cause, how to confirm it (exact AEP UI path or API), how to fix it, and how to prevent it. Short markdown.\n\n${contextToPrompt(ctx, { maxChars: 6000 })}`,
        messages: [{ role: 'user', content: JSON.stringify({ kind: item.kind, title: item.title, errors: item.errors }) }],
        maxTokens: 1500
    });
    return text;
}
