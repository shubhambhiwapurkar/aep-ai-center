/**
 * Journey skeleton model - a small, tool-independent graph:
 *
 * {
 *   name, description,
 *   entry: '<node id>',
 *   nodes: [
 *     { id, type, label, config: {...}, next: '<id>' }                      // linear activity
 *     { id, type, label, config: {...}, paths: [{ label, expression, otherwise?, timeout?, next }] } // branching
 *   ]
 * }
 *
 * The AJO paste format is produced from this by ajoAdapter.js.
 */
import { ACTIVITIES, ENTRY_TYPES, MESSAGE_TYPES, MAX_ACTIVITIES, MAX_WAIT_DAYS } from './catalog.js';

let counter = 0;
export function newId(type = 'node') {
    counter += 1;
    return `${type}_${Date.now().toString(36)}${counter.toString(36)}`;
}

function defaultConfig(type) {
    const cfg = {};
    for (const f of ACTIVITIES[type]?.fields || []) if (f.default !== undefined) cfg[f.key] = f.default;
    return cfg;
}

export function createNode(type, overrides = {}) {
    const def = ACTIVITIES[type];
    if (!def) throw new Error(`Unknown activity type "${type}"`);
    const node = { id: newId(type), type, label: def.label, config: defaultConfig(type), ...overrides };
    node.config = { ...defaultConfig(type), ...(overrides.config || {}) };
    if (def.branching && !node.paths) {
        node.paths = type === 'condition'
            ? [{ label: 'Path 1', expression: '', next: null }, { label: 'Other cases', otherwise: true, next: null }]
            : [{ label: type === 'reaction' ? 'Clicked' : 'Event received', next: null }, { label: 'Timeout', timeout: true, next: null }];
    }
    if (!def.branching && type !== 'end' && node.next === undefined) node.next = null;
    return node;
}

export const byId = (journey) => new Map(journey.nodes.map((n) => [n.id, n]));

export function successors(node) {
    if (!node) return [];
    if (node.paths) return node.paths.map((p) => p.next).filter(Boolean);
    return node.next ? [node.next] : [];
}

/**
 * Clean up anything a template, import or LLM produced: unique ids, known types,
 * every open path closed with an End node.
 */
export function normalizeJourney(raw) {
    if (!raw || !Array.isArray(raw.nodes)) throw new Error('Journey JSON must have a "nodes" array.');
    const nodes = [];
    const seen = new Set();
    for (const n of raw.nodes) {
        if (!n || !ACTIVITIES[n.type]) throw new Error(`Unknown activity type "${n?.type}" - allowed: ${Object.keys(ACTIVITIES).join(', ')}`);
        let id = String(n.id || newId(n.type));
        if (seen.has(id)) id = newId(n.type);
        seen.add(id);
        const def = ACTIVITIES[n.type];
        const node = { id, type: n.type, label: n.label || def.label, config: { ...defaultConfig(n.type), ...(n.config || {}) } };
        if (def.branching) {
            node.paths = (n.paths?.length ? n.paths : createNode(n.type).paths).map((p) => ({ ...p, next: p.next || null }));
        } else if (n.type !== 'end') {
            node.next = n.next || null;
        }
        nodes.push(node);
    }
    const journey = {
        name: raw.name || 'Untitled journey',
        description: raw.description || '',
        entry: raw.entry && nodes.some((n) => n.id === raw.entry) ? raw.entry : nodes.find((n) => ENTRY_TYPES.includes(n.type))?.id || nodes[0]?.id,
        nodes
    };
    return closeOpenPaths(journey);
}

/** Point every dangling next/path at a fresh End node. */
export function closeOpenPaths(journey) {
    const ids = new Set(journey.nodes.map((n) => n.id));
    const extra = [];
    const end = () => {
        const e = createNode('end');
        extra.push(e);
        return e.id;
    };
    const nodes = journey.nodes.map((n) => {
        if (n.type === 'end') return n;
        if (n.paths) return { ...n, paths: n.paths.map((p) => (p.next && ids.has(p.next) ? p : { ...p, next: end() })) };
        return n.next && ids.has(n.next) ? n : { ...n, next: end() };
    });
    return { ...journey, nodes: [...nodes, ...extra] };
}

/** Depth-first order from the entry - the order a person builds the journey in. */
export function buildOrder(journey) {
    const map = byId(journey);
    const order = [];
    const visited = new Set();
    const visit = (id) => {
        if (!id || visited.has(id) || !map.has(id)) return;
        visited.add(id);
        order.push(map.get(id));
        successors(map.get(id)).forEach(visit);
    };
    visit(journey.entry);
    return order;
}

function hasCycle(journey) {
    const map = byId(journey);
    const state = new Map(); // 1 = visiting, 2 = done
    const dfs = (id) => {
        if (state.get(id) === 1) return true;
        if (state.get(id) === 2 || !map.has(id)) return false;
        state.set(id, 1);
        for (const s of successors(map.get(id))) if (dfs(s)) return true;
        state.set(id, 2);
        return false;
    };
    return dfs(journey.entry);
}

/** Ancestors of a node (every node that can reach it). */
function ancestors(journey, targetId) {
    const parents = new Map();
    for (const n of journey.nodes) for (const s of successors(n)) {
        if (!parents.has(s)) parents.set(s, []);
        parents.get(s).push(n.id);
    }
    const out = new Set();
    const stack = [...(parents.get(targetId) || [])];
    while (stack.length) {
        const id = stack.pop();
        if (out.has(id)) continue;
        out.add(id);
        stack.push(...(parents.get(id) || []));
    }
    return out;
}

/**
 * Check a journey against AJO rules and the loaded sandbox context.
 * @returns {{ level: 'error'|'warning'|'info', nodeId?: string, message: string }[]}
 */
export function validateJourney(journey, ctx) {
    const issues = [];
    const add = (level, message, nodeId) => issues.push({ level, message, nodeId });
    const map = byId(journey);

    if (!journey.nodes.length) {
        add('error', 'The journey is empty - add an entry activity.');
        return issues;
    }
    const entry = map.get(journey.entry);
    if (!entry || !ENTRY_TYPES.includes(entry.type)) add('error', 'The journey must start with an entry activity (event, read audience or audience qualification).', entry?.id);

    const entries = journey.nodes.filter((n) => ENTRY_TYPES.includes(n.type));
    if (entries.length > 1) entries.slice(1).forEach((n) => add('error', 'Only one entry activity is allowed per journey.', n.id));

    if (hasCycle(journey)) add('error', 'The journey loops back on itself. AJO journeys cannot contain cycles - use a Jump to another journey instead.');

    const reachable = new Set(buildOrder(journey).map((n) => n.id));
    journey.nodes.filter((n) => !reachable.has(n.id)).forEach((n) => add('warning', `"${n.label}" is not connected to the journey.`, n.id));

    const activityCount = journey.nodes.filter((n) => n.type !== 'end').length;
    if (activityCount > MAX_ACTIVITIES) add('error', `${activityCount} activities - AJO allows at most ${MAX_ACTIVITIES} per journey. Split it with a Jump.`);

    const eventNames = new Set((ctx?.journeyEvents || []).map((e) => e.name.toLowerCase()));
    const audienceNames = new Set((ctx?.audiences || []).map((a) => a.name.toLowerCase()));
    const actionNames = new Set((ctx?.customActions || []).map((a) => a.name.toLowerCase()));
    const audienceEval = new Map((ctx?.audiences || []).map((a) => [a.name.toLowerCase(), a.evaluation]));

    for (const n of journey.nodes) {
        const def = ACTIVITIES[n.type];
        for (const f of def.fields) {
            if (f.required && !String(n.config?.[f.key] ?? '').trim()) add('error', `"${n.label}": ${f.label} is required.`, n.id);
        }
        const ev = n.config?.eventName?.toLowerCase();
        if (ev && eventNames.size && !eventNames.has(ev)) add('warning', `Event "${n.config.eventName}" is not in your sandbox context - create it under Configurations → Events.`, n.id);
        const aud = n.config?.audienceName?.toLowerCase();
        if (aud && audienceNames.size && !audienceNames.has(aud)) add('warning', `Audience "${n.config.audienceName}" was not found in the sandbox context.`, n.id);
        if (n.type === 'audienceQualification' && aud && audienceEval.get(aud) === 'batch') {
            add('warning', `"${n.config.audienceName}" is a batch audience - qualification will fire for everyone at once after the daily run. Prefer a streaming audience.`, n.id);
        }
        const act = n.config?.actionName?.toLowerCase();
        if (act && actionNames.size && !actionNames.has(act)) add('warning', `Custom action "${n.config.actionName}" is not configured in the sandbox context.`, n.id);

        if (n.type === 'wait') {
            const days = n.config.unit === 'days' ? Number(n.config.amount) : n.config.unit === 'hours' ? Number(n.config.amount) / 24 : Number(n.config.amount) / 1440;
            if (days > MAX_WAIT_DAYS) add('error', `Wait of ${days} days exceeds the ${MAX_WAIT_DAYS}-day maximum.`, n.id);
        }
        if (n.type === 'condition' && n.config.kind !== 'percentage split' && !n.paths?.some((p) => p.otherwise)) {
            add('warning', `"${n.label}" has no "other cases" path - people matching no branch will leave the journey.`, n.id);
        }
        if (n.type === 'condition' && n.config.kind === 'percentage split') {
            const total = (n.paths || []).reduce((s, p) => s + (Number(p.percent) || 0), 0);
            if (total !== 100) add('error', `Percentage split paths add up to ${total}%, they must total 100%.`, n.id);
        }
        if (n.type === 'condition' && n.config.kind === 'data source') {
            (n.paths || []).filter((p) => !p.otherwise && !String(p.expression || '').trim())
                .forEach((p) => add('warning', `"${n.label}" → "${p.label}" has no expression yet.`, n.id));
        }
        if ((n.type === 'reaction' || n.type === 'eventWait') && !n.paths?.some((p) => p.timeout)) {
            add('warning', `"${n.label}" has no timeout path - people who never react stay until the journey timeout.`, n.id);
        }
        if (n.type === 'reaction') {
            const target = map.get(n.config.toMessage);
            if (!target || !MESSAGE_TYPES.includes(target.type)) add('error', `"${n.label}" must react to an email/push/SMS/in-app activity.`, n.id);
            else if (!ancestors(journey, n.id).has(target.id)) add('error', `"${n.label}" reacts to "${target.label}", which comes after it.`, n.id);
        }
        if (MESSAGE_TYPES.includes(n.type)) {
            const nextNode = map.get(n.next);
            if (nextNode && MESSAGE_TYPES.includes(nextNode.type)) add('warning', `"${n.label}" is followed immediately by another message - add a Wait to avoid back-to-back sends.`, n.id);
        }
        if (n.type === 'unitaryEvent' && n.config.reentrance === 'allowed') add('info', 'Re-entrance with no wait: people re-enter every time the event fires.', n.id);
    }
    if (!journey.nodes.some((n) => MESSAGE_TYPES.includes(n.type) || n.type === 'customAction' || n.type === 'updateProfile')) {
        add('info', 'The journey has no actions yet.');
    }
    return issues;
}

/** Simple tidy-tree layout for React Flow: x by branch, y by depth. */
export function layoutJourney(journey, { dx = 230, dy = 110 } = {}) {
    const map = byId(journey);
    const pos = {};
    const placed = new Set();
    let nextColumn = 0;
    const place = (id, depth) => {
        if (!id || placed.has(id) || !map.has(id)) return null;
        placed.add(id);
        const kids = successors(map.get(id)).filter((k) => !placed.has(k));
        let xs = kids.map((k) => place(k, depth + 1)).filter((x) => x !== null);
        let x;
        if (!xs.length) x = nextColumn++;
        else x = (Math.min(...xs) + Math.max(...xs)) / 2;
        pos[id] = { x: x * dx, y: depth * dy };
        return x;
    };
    place(journey.entry, 0);
    journey.nodes.filter((n) => !placed.has(n.id)).forEach((n, i) => {
        pos[n.id] = { x: (nextColumn + 1 + (i % 3)) * dx, y: Math.floor(i / 3) * dy };
    });
    return pos;
}

// ---------- editing operations (all return a new journey) ----------

export function updateNode(journey, id, patch) {
    return { ...journey, nodes: journey.nodes.map((n) => (n.id === id ? { ...n, ...patch, config: { ...n.config, ...(patch.config || {}) } } : n)) };
}

/**
 * Insert a new activity after `afterId` (on path `pathIndex` for branching nodes).
 * The new node takes over whatever came next.
 */
export function insertAfter(journey, afterId, type, pathIndex = 0) {
    const node = createNode(type);
    let displaced = null;
    const nodes = journey.nodes.map((n) => {
        if (n.id !== afterId) return n;
        if (n.paths) {
            const paths = n.paths.map((p, i) => {
                if (i !== pathIndex) return p;
                displaced = p.next;
                return { ...p, next: node.id };
            });
            return { ...n, paths };
        }
        displaced = n.next;
        return { ...n, next: node.id };
    });
    if (node.paths) node.paths[0].next = displaced;
    else if (type !== 'end') node.next = displaced;
    return closeOpenPaths({ ...journey, nodes: [...nodes, node] });
}

/** Remove a node; its parent is reconnected to its (first) successor. Orphans are cleaned up. */
export function removeNode(journey, id) {
    if (id === journey.entry) return journey;
    const map = byId(journey);
    const target = map.get(id);
    if (!target) return journey;
    const replacement = successors(target)[0] || null;
    const nodes = journey.nodes
        .filter((n) => n.id !== id)
        .map((n) => {
            if (n.paths) return { ...n, paths: n.paths.map((p) => (p.next === id ? { ...p, next: replacement } : p)) };
            return n.next === id ? { ...n, next: replacement } : n;
        });
    const cleaned = { ...journey, nodes };
    const reachable = new Set(buildOrder(cleaned).map((n) => n.id));
    return closeOpenPaths({ ...cleaned, nodes: cleaned.nodes.filter((n) => reachable.has(n.id)) });
}

export function addPath(journey, id) {
    const end = createNode('end');
    const nodes = journey.nodes.map((n) => {
        if (n.id !== id || !n.paths) return n;
        const fixed = n.paths.filter((p) => p.otherwise || p.timeout);
        const normal = n.paths.filter((p) => !p.otherwise && !p.timeout);
        return { ...n, paths: [...normal, { label: `Path ${normal.length + 1}`, expression: '', next: end.id }, ...fixed] };
    });
    return { ...journey, nodes: [...nodes, end] };
}

export function removePath(journey, id, pathIndex) {
    const nodes = journey.nodes.map((n) => {
        if (n.id !== id || !n.paths || n.paths.length <= 2) return n;
        return { ...n, paths: n.paths.filter((_, i) => i !== pathIndex) };
    });
    const cleaned = { ...journey, nodes };
    const reachable = new Set(buildOrder(cleaned).map((n) => n.id));
    return { ...cleaned, nodes: cleaned.nodes.filter((n) => reachable.has(n.id)) };
}

/**
 * Step-by-step build guide (training mode). One entry per activity in build order,
 * with the AJO UI steps and what the activity does.
 */
export function buildGuide(journey) {
    const map = byId(journey);
    const order = buildOrder(journey).filter((n) => n.type !== 'end');
    const steps = [{
        id: 'create',
        title: `Create the journey "${journey.name}"`,
        what: journey.description || 'A new journey in Journey Optimizer.',
        how: ['Journey Optimizer → Journey management → Journeys → Create journey.', `Name it "${journey.name}" and set the namespace used by your entry activity.`],
        pitfalls: []
    }];
    for (const n of order) {
        const def = ACTIVITIES[n.type];
        const cfg = Object.entries(n.config || {})
            .filter(([, v]) => v !== '' && v !== undefined && v !== null)
            .map(([k, v]) => `${def.fields.find((f) => f.key === k)?.label || k}: ${v}`);
        const branches = (n.paths || []).map((p) => {
            const target = map.get(p.next);
            return `Path "${p.label}"${p.expression ? ` when ${p.expression}` : ''}${p.percent ? ` (${p.percent}%)` : ''} → ${target ? target.label : 'End'}`;
        });
        steps.push({
            id: n.id,
            title: `${def.label}: ${n.label}`,
            what: def.what,
            why: def.why,
            how: [...def.howInAjo, ...(cfg.length ? [`Settings → ${cfg.join(' · ')}`] : []), ...branches],
            pitfalls: def.pitfalls
        });
    }
    steps.push({
        id: 'publish',
        title: 'Test and publish',
        what: 'Validate the journey with test profiles before going live.',
        how: ['Fix any alerts in the top-right alert panel.', 'Turn on Test mode and fire the entry with test profiles.', 'Publish when every path behaves as expected.'],
        pitfalls: ['Test mode only works with profiles flagged as test profiles.']
    });
    return steps;
}
