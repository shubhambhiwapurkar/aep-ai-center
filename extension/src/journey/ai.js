/**
 * Natural language → journey skeleton. The LLM only sees the brief plus sandbox metadata
 * (event names, audience names/rules, field paths) - never profile data.
 */
import { chat, extractJson } from '../lib/llm.js';
import { contextToPrompt } from '../lib/context.js';
import { ACTIVITIES } from './catalog.js';
import { normalizeJourney } from './model.js';

function activitySpec() {
    return Object.entries(ACTIVITIES).map(([type, def]) => {
        const fields = def.fields.map((f) => `${f.key}${f.required ? '*' : ''}${f.options ? `(${f.options.join('|')})` : ''}`).join(', ');
        return `- ${type} [${def.category}]${def.branching ? ' BRANCHING' : ''}: ${def.what} config: {${fields}}`;
    }).join('\n');
}

const SYSTEM = (ctx) => `You are a senior Adobe Journey Optimizer architect. You design journey SKELETONS (structure, logic, timing, channels) - not creative copy.

Return ONLY a JSON object with this shape:
{
  "name": string,
  "description": string,
  "entry": "<id of the entry node>",
  "nodes": [
    { "id": string, "type": <activity type>, "label": string, "config": {...}, "next": "<id>" },          // non-branching
    { "id": string, "type": "condition"|"reaction"|"eventWait", "label": string, "config": {...},
      "paths": [ { "label": string, "expression"?: string, "percent"?: number, "otherwise"?: true, "timeout"?: true, "next": "<id>" } ] },
    { "id": string, "type": "end", "label": "End" }
  ],
  "assumptions": [string]
}

ACTIVITY TYPES (* = required config):
${activitySpec()}

RULES:
- Exactly one entry activity, first in the flow. No cycles. Every path ends in an "end" node.
- Use EXACT event, audience, custom action and field names from the sandbox context when they fit. If something needed is missing, invent a clear camelCase name and list it in "assumptions".
- Condition expressions: short, readable, using field paths from the context (e.g. loyalty.tier = "gold"). Data-source conditions always include an "otherwise" path; percentage splits use "percent" and total 100.
- reaction.config.toMessage must be the id of an earlier email/push/sms/inApp node. Give reactions and eventWaits a timeout path.
- Put a wait between consecutive messages. Waits max 29 days. Max 50 activities.
- For message nodes, "brief" is a one-line content brief for the content team - no copy, no personal data.

${contextToPrompt(ctx)}`;

/**
 * @returns {Promise<{ journey: object, assumptions: string[], redactions: object }>}
 */
export async function generateJourney(settings, ctx, brief, current = null) {
    const messages = [{
        role: 'user',
        content: current
            ? `Here is the current journey JSON:\n${JSON.stringify(current)}\n\nChange it as follows: ${brief}`
            : `Design a journey for this brief: ${brief}`
    }];
    const { text, redactions } = await chat(settings, { system: SYSTEM(ctx), messages });
    const raw = extractJson(text);
    return { journey: normalizeJourney(raw), assumptions: raw.assumptions || [], redactions };
}

/** Ask the LLM to explain a journey in plain language (training mode). */
export async function explainJourney(settings, ctx, journey) {
    const { text } = await chat(settings, {
        system: `You explain Adobe Journey Optimizer journeys to people new to AJO. Be concrete and short. Use markdown headings and bullets.\n\n${contextToPrompt(ctx, { maxChars: 8000 })}`,
        messages: [{
            role: 'user',
            content: `Explain this journey: who enters, what happens on each path and why, what must be configured in AEP/AJO before it can go live (events, audiences, surfaces, datasets, consent), and the top risks.\n\n${JSON.stringify(journey)}`
        }]
    });
    return text;
}
