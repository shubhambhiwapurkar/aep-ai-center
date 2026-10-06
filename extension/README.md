# AEP AI Center - Chrome side panel

A side panel for Adobe Experience Platform, RTCDP and Journey Optimizer practitioners. It works with
**metadata only** and keeps everything on your machine.

| Tab | What it does |
|-----|--------------|
| **Journeys** | Build journey skeletons (entry, waits, conditions, reactions, channels, custom actions) from templates, a plain-language brief, or by hand. Live validation against AJO rules and your sandbox. Training-mode build guide, AI explanation, JSON export. |
| **Designer** | Wizard: business goals → data sources → data dictionary → channels & governance → full implementation plan (identity strategy, XDM schemas, datasets, connectors, merge policies, audiences, destinations, journeys, monitoring) plus a step-by-step training checklist for a dev sandbox and a versionable JSON manifest. |
| **Ask** | Chat about AEP/RTCDP/AJO grounded in your sandbox context and the Adobe page you have open. |
| **Context** | The technical shape of a sandbox: schemas + field paths, identity namespaces, audience rules, datasets, dataflows, merge policies, journey events, custom actions, data dictionary. Sync from the backend, edit by hand, or import/export as a JSON file. |
| **Settings** | Bring your own LLM: Anthropic Claude, any OpenAI-compatible endpoint (OpenAI, Azure OpenAI, Ollama, LM Studio) or Google Gemini. |

## Data handling

- No profile lookups, no batch previews, no query results - only structure.
- Context, drafts and your API key live in `chrome.storage.local`. "Save to my machine" writes a JSON file you can keep in your own drive or Git.
- Every prompt passes a PII guard that redacts emails, phone numbers, card numbers, IPs and ECIDs before it leaves the browser.
- Prompts go straight from the browser to the LLM provider you configured. There is no AEP AI Center cloud service.

## Install (developer mode)

```bash
cd extension
npm install
npm run build          # or: npm run dev  (rebuilds on change)
```

1. Open `chrome://extensions`, enable **Developer mode**.
2. **Load unpacked** → pick `extension/dist`.
3. Click the toolbar icon to open the side panel (⤢ opens it in a full tab for bigger journeys).
4. **Settings** → choose a provider, model and key → **Save & test**.

### Sandbox metadata (optional)

**Context → Sync from backend** reads metadata through the backend in this repo, which uses your
Adobe Developer Console server-to-server (OAuth) credentials:

```bash
cd backend && npm install && npm start   # needs backend/.env, see the root README
```

It calls `GET /api/context/metadata` and `GET /api/context/schema-fields?id=…`, which return only
names, field paths, types and rules. Without the backend you can import a context file or fill in
events, actions and the data dictionary by hand.

## Journey → AJO canvas

The **Copy for AJO canvas** button is disabled until the paste format is calibrated. AJO's
clipboard format for copied activities is not publicly documented, so it has to be mapped from real
samples:

1. In AJO, open a journey that uses the activity types you care about, select its activities, copy.
2. In **Journeys → Export → Calibrate AJO format**, paste and click **Analyze**.
3. **Download shape** - this keeps only keys and activity type names (no names, ids, expressions or
   values), so it is safe to share. Those shapes are what `src/journey/ajoAdapter.js` gets built from.

Until then, use **Copy skeleton JSON** / **Download** and the **Build guide**, which walks through
building the journey in the AJO UI step by step.

## Development

```bash
npm test     # journey model, validator, PII guard, CSV parsing, AJO shape tool
npm run build
```

| Path | Purpose |
|------|---------|
| `src/journey/catalog.js` | AJO activities: fields, what/why/how-in-AJO/pitfalls (drives editor, validator and training mode) |
| `src/journey/model.js` | Journey graph: normalize, validate, layout, edit operations, build guide |
| `src/journey/templates.js` | Starter journeys |
| `src/journey/ai.js` | Brief → skeleton, plain-language explanations |
| `src/journey/ajoAdapter.js` | AJO paste format (calibration tool; mapping pending samples) |
| `src/designer/ai.js` | Implementation plan, manifest and checklist extraction |
| `src/lib/llm.js` | Multi-provider LLM client |
| `src/lib/pii.js` | Redaction applied to every prompt |
| `src/lib/context.js` | Sandbox context model, backend sync, CSV dictionary import |
