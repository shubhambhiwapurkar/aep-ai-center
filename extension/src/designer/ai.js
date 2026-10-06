/**
 * Solution designer: turns a client's business + data inventory into an implementation plan
 * for AEP / RTCDP / AJO. Only metadata is sent (system names, field names/types, goals).
 */
import { chat, extractJson } from '../lib/llm.js';
import { contextToPrompt } from '../lib/context.js';

export const BUILD_STEPS_HEADING = 'Build steps';

function describeInputs(d) {
    const sources = d.sources.filter((s) => s.name.trim()).map((s) =>
        `- ${s.name} | system: ${s.kind} | data: ${s.dataKind} | frequency: ${s.frequency} | identifiers: ${s.identifiers || 'unknown'}${s.notes ? ` | notes: ${s.notes}` : ''}`
    ).join('\n') || '- (none listed)';
    const dict = d.dictionary.slice(0, 400).map((f) =>
        `- ${f.field}${f.type ? ` (${f.type})` : ''}${f.source ? ` [${f.source}]` : ''}${f.description ? `: ${f.description}` : ''}`
    ).join('\n');
    return `CLIENT: ${d.client || 'n/a'} | industry: ${d.industry || 'n/a'}
BUSINESS GOALS: ${d.goals || 'n/a'}
USE CASES: ${[...d.useCases, d.otherUseCases].filter(Boolean).join('; ') || 'n/a'}

DATA SOURCES:
${sources}

DATA DICTIONARY (${d.dictionary.length} fields${d.dictionary.length > 400 ? ', first 400 shown' : ''}):
${dict || '- (not provided)'}

CHANNELS: ${d.channels.join(', ') || 'n/a'}
DESTINATIONS / ACTIVATION: ${d.destinations || 'n/a'}
GOVERNANCE & CONSENT: ${[...d.regulations, d.consentNotes].filter(Boolean).join('; ') || 'n/a'}
SANDBOXES: ${d.sandboxes || 'n/a'}
TEAM EXPERIENCE: ${d.experience}
PRODUCTS LICENSED: ${d.products.join(', ') || 'n/a'}`;
}

export async function generateReport(settings, ctx, d) {
    const system = `You are a principal Adobe Experience Platform solution architect (RTCDP, AJO, Customer Journey Analytics).
Produce a complete, practical implementation design as markdown. Be specific: real AEP object names, XDM classes and standard field groups, connector names from the AEP sources catalog, identity namespaces, merge policy settings. Prefer standard Adobe field groups over custom fields; put custom fields under the tenant namespace.
If something is unknown, state the assumption explicitly instead of asking.

Use exactly these sections (## headings):
## Executive summary
## Architecture overview  (a mermaid flowchart: sources → datasets → identity/profile → audiences → destinations/journeys)
## Identity strategy  (namespaces, primary identity per schema, graph linking rules, what links to what)
## XDM schemas  (one table per schema: field path | type | field group | identity? | source field)
## Datasets  (name, schema, profile-enabled?, identity-enabled?)
## Source connectors & dataflows  (per source: AEP connector, frequency, mapping notes, backfill)
## Profile & merge policies  (how a unified profile is formed, precedence, TTL/experience event expiry)
## Data governance & consent  (labels, policies, consent field group, regional notes)
## Audiences  (name, logic in plain English + PQL sketch, evaluation: streaming/batch/edge)
## Destinations & activation
## Journeys & campaigns  (per use case: entry, key steps, channels)
## Monitoring & alerting  (what to watch upstream/downstream, alert subscriptions, owners)
## ${BUILD_STEPS_HEADING}
   Ordered for a DEV sandbox, written for someone new to AEP. Each step as a markdown task line:
   "- [ ] **<step title>** - what it does and why. *Where:* <exact UI path>"
## Risks & open questions

Existing sandbox objects (reuse them where they fit, say so explicitly):
${contextToPrompt(ctx, { maxChars: 12000 })}`;

    return chat(settings, {
        system,
        messages: [{ role: 'user', content: describeInputs(d) }],
        maxTokens: 16000
    });
}

/**
 * Machine-readable manifest of everything to create - the artifact to version in Git and
 * replay into other sandboxes (dev → stage → prod).
 */
export async function generateManifest(settings, ctx, d, report) {
    const system = `You convert an AEP implementation design into a machine-readable manifest. Return ONLY JSON:
{
  "manifestVersion": 1,
  "client": string,
  "namespaces": [{ "code": string, "name": string, "type": "Cross-device"|"Device"|"Email"|"Phone"|"Non-people", "custom": boolean }],
  "fieldGroups": [{ "title": string, "class": string, "fields": [{ "path": string, "type": string, "title": string, "description"?: string }] }],
  "schemas": [{ "title": string, "class": "profile"|"experienceevent"|"lookup"|string, "fieldGroups": [string], "primaryIdentity": { "path": string, "namespace": string }, "otherIdentities": [{ "path": string, "namespace": string }], "profileEnabled": boolean }],
  "datasets": [{ "name": string, "schema": string, "profileEnabled": boolean }],
  "sources": [{ "name": string, "connector": string, "dataset": string, "frequency": string }],
  "mergePolicies": [{ "name": string, "default": boolean, "idStitching": "pdg"|"none", "attributeMerge": "timestampOrdered"|"dataSetPrecedence" }],
  "audiences": [{ "name": string, "description": string, "pql": string, "evaluation": "streaming"|"batch"|"edge" }],
  "destinations": [{ "name": string, "audiences": [string] }],
  "journeys": [{ "name": string, "entry": string, "summary": string }]
}`;
    const { text, redactions } = await chat(settings, {
        system,
        messages: [{ role: 'user', content: `${describeInputs(d)}\n\nDESIGN:\n${report}` }],
        maxTokens: 16000
    });
    const manifest = extractJson(text);
    manifest.generatedAt = new Date().toISOString();
    if (ctx?.sandbox) manifest.designedAgainstSandbox = ctx.sandbox;
    return { manifest, redactions };
}

/** Pull the "- [ ] ..." lines under the build steps heading into a checklist. */
export function extractBuildSteps(markdown) {
    if (!markdown) return [];
    const lines = markdown.split('\n');
    const start = lines.findIndex((l) => /^##\s+/.test(l) && l.toLowerCase().includes(BUILD_STEPS_HEADING.toLowerCase()));
    if (start === -1) return [];
    const steps = [];
    for (let i = start + 1; i < lines.length; i++) {
        if (/^##\s+/.test(lines[i])) break;
        const m = lines[i].match(/^\s*[-*]\s*\[[ xX]\]\s*(.+)$/);
        if (m) steps.push(m[1].trim());
    }
    return steps;
}
