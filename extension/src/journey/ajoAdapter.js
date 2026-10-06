/**
 * AJO canvas paste adapter.
 *
 * Goal: turn our skeleton (model.js) into the JSON the AJO canvas accepts when you copy
 * activities from one journey and paste them into another.
 *
 * That clipboard format is not publicly documented, so the mapping is built from real
 * samples. The calibration tool below takes a journey copied from AJO and reduces it to its
 * *shape* (keys, activity type names, value types) - no names, ids, expressions or other
 * values - so it is safe to share with whoever finishes the mapping.
 */

/** Flip to true once toAjoClipboard() is implemented against verified samples. */
export const AJO_ADAPTER_READY = false;

export function toAjoClipboard() {
    throw new Error('The AJO paste format is not calibrated yet. Use "Calibrate AJO format" to capture a sample shape, and use the build guide meanwhile.');
}

// Keys whose string values are structural (activity kinds), not customer/config data.
const STRUCTURAL_KEYS = new Set(['type', 'nodetype', 'kind', 'activitytype', 'nodekind', 'category', 'subtype', 'actiontype', 'eventtype']);

/** Replace every value with its type, keeping keys and activity-kind strings. */
export function shapeOf(value, key = '', depth = 0) {
    if (depth > 12) return '…';
    if (Array.isArray(value)) {
        if (!value.length) return [];
        // Merge the shapes of up to 5 items so different activity kinds show up
        const shapes = value.slice(0, 5).map((v) => shapeOf(v, key, depth + 1));
        const unique = [...new Map(shapes.map((s) => [JSON.stringify(s), s])).values()];
        return value.length > 5 ? [...unique, `…${value.length - 5} more`] : unique;
    }
    if (value && typeof value === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(value)) out[k] = shapeOf(v, k, depth + 1);
        return out;
    }
    if (typeof value === 'string' && STRUCTURAL_KEYS.has(key.toLowerCase()) && value.length < 60 && /^[\w.:-]+$/.test(value)) {
        return `"${value}"`;
    }
    return value === null ? 'null' : typeof value;
}

/** Summarise a pasted AJO sample: its shape plus the activity kinds found in it. */
export function analyzeAjoSample(text) {
    let json;
    try {
        json = JSON.parse(text);
    } catch {
        throw new Error('That is not valid JSON. In AJO, select the activities on the canvas, copy them, and paste here.');
    }
    const kinds = {};
    const walk = (v, key = '') => {
        if (Array.isArray(v)) v.forEach((x) => walk(x, key));
        else if (v && typeof v === 'object') Object.entries(v).forEach(([k, x]) => walk(x, k));
        else if (typeof v === 'string' && STRUCTURAL_KEYS.has(key.toLowerCase())) kinds[`${key}=${v}`] = (kinds[`${key}=${v}`] || 0) + 1;
    };
    walk(json);
    return { shape: shapeOf(json), kinds };
}
