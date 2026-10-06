# AEP AI Center 🚀

**AEP AI Center** is a next-generation intelligent monitoring and management platform for Adobe Experience Platform. It combines a powerful Command Center dashboard with an AI Copilot that proactively monitors system health, diagnoses issues, and executes complex tasks via natural language.

Instead of forcing you to navigate through dozens of different screens to find a single field or figure out why an upload failed, it uses Generative AI and Real-time Monitoring to give you one single "Command Center."
Here is exactly what the solution does in plain English:
1. The "Single Source of Truth" (Health Matrix)
AEP Problem: You have to check Identity, Ingestion, and Web SDK statuses separately.
The Solution: It pulls all these live statuses into one screen. It’s like a car dashboard—if anything is wrong with the "engine" (AEP services), you see a light immediately.
2. The "AEP Interpreter" (Data Intelligence)
AEP Problem: AEP field names are often long and technical (e.g., _mycompany.loyalty.points_balance).
The Solution: The AI reads your entire Data Dictionary. You can just ask it, "Check loyalty points for this user," and it knows exactly which technical field you're talking about without you having to look it up.
3. The "Plain English" Debugger (Post-Mortems)
AEP Problem: Error codes in AEP batches can be cryptic.
The Solution: The app fetches the error, asks the AI to analyze it, and tells you: "Your file failed because 'Date' was written as MM/DD instead of YYYY/MM."
4. The "Natural Language" Segmenter
AEP Problem: Building complex audience segments usually requires technical training.
The Solution: You chat with the AI. You say, "Give me a list of high-value customers from New York," and it builds the logic for you instantly.
5. Multi-Sandbox Control
AEP Problem: Switching between 'Dev', 'Staging', and 'Production' sandboxes in the official UI takes many clicks.
The Solution: It has a "Hot-Switch" feature in the top corner. You can jump between environments or even compare them side-by-side to see what's different.
In short: It’s an "Easy Mode" for AEP that lets you manage your platform by talking to it instead of clicking through it.

![Platform](https://img.shields.io/badge/Platform-Adobe%20Experience%20Platform-red)
![AI](https://img.shields.io/badge/AI-Gemini%202.0%20Flash-blue)
![React](https://img.shields.io/badge/Frontend-React%20+%20Vite-61DAFB)
![Node](https://img.shields.io/badge/Backend-Node.js%20+%20Express-339933)

---

## ✨ Key Features

### 🎯 Command Center Dashboard
- **Real-time System Health** - Live connection status, uptime monitoring, and service health matrix
- **Unified Observability** - Integrated metrics, logs, and trace monitoring in a single view
- **Daily AI Briefings** - Automated system health analysis with AI-generated insights
- **Smart Alerts** - Proactive issue detection with actionable recommendations
- **Data Heartbeat** - 24-hour activity visualization with success/failure tracking

### 🤖 AI Copilot Agent
- **50+ Integrated Tools** - Complete coverage of Datasets, Batches, Segments, Flows, Identity, and more
- **Natural Language Control** - "Show me failed batches", "Create a segment for females over 30", "Analyze platform health"
- **Thinking Indicators** - See what the agent is processing in real-time
- **Chat History Recall** - Save and load previous conversations
- **Auto/Safe Modes** - Control whether agent executes actions automatically

### 📊 Data Management
- **Batch Monitor** - Track ingestion batches with auto-analysis for failures
- **Data Ingestion** - File upload with preview, validation, and full pagination support for thousands of datasets
- **Data Flows** - Flow management with destination dry-run validation
- **Data Lineage** - Interactive visualization of data flow from sources to destinations
- **Data Prep** - Visual field mapping and transformation builder

### 🔍 Analytics & Queries
- **Query Service** - SQL editor with syntax highlighting and AI optimization suggestions
- **Schema Registry** - Browse schemas, field groups, classes with full XDM support
- **Segment Builder** - Create and analyze segments with population verification
- **Profile Lookup** - Real-time profile search with merge policy management

### 🛡️ Governance & Security
- **Policy Management** - Data labels and marketing action policies
- **Privacy Jobs** - GDPR/CCPA compliance job monitoring
- **Audit Log** - Complete activity tracking with filters
- **Sandbox Management** - Multi-sandbox support with comparison tools

### 🎨 Modern UI/UX
- **Dark/Light Mode** - Full theme support with smooth transitions
- **Responsive Design** - Works on desktop and tablet
- **Glassmorphism Design** - Modern, premium aesthetic
- **Markdown Support** - Rich formatting in AI responses

---

## 🧩 Chrome Side Panel (new)

The [`extension/`](extension/README.md) folder contains a Chrome side panel that works next to the Adobe UI:

- **Journey skeleton builder**: templates, plain-language brief → journey, live validation against AJO rules, step-by-step build guide (training mode), JSON export
- **Solution designer wizard**: data sources + data dictionary → full RTCDP/AJO implementation plan, dev-sandbox training checklist, versionable JSON manifest
- **Ask**: an AEP/AJO assistant grounded in your sandbox metadata
- **Metadata only, local only**: no profile data, PII redaction on every prompt, bring your own LLM (Claude, OpenAI/Azure/Ollama, Gemini)

See [extension/README.md](extension/README.md) to install it.

---

## 🛠️ Setup & Installation

### Prerequisites
- **Node.js** v18+ (v20+ recommended)
- **Adobe Experience Platform** access (Sandbox, Tenant ID, API credentials)
- **Google AI Studio API Key** for Gemini

### Get Your API Keys

#### Adobe Experience Platform
1. Go to [Adobe Developer Console](https://developer.adobe.com/console)
2. Create a new project with Experience Platform API
3. Generate OAuth credentials (API Key, Client Secret, Technical Account)

#### Google Gemini API
1. Visit [Google AI Studio](https://aistudio.google.com/)
2. Click "Get API Key" → Create API key
3. Copy the key for your `.env` file

### Environment Variables

Create a `.env` file in the `backend` directory:

```env
PORT=3001

# ═══════════════════════════════════════════════════════════
# Adobe Experience Platform Credentials
# Get these from Adobe Developer Console
# ═══════════════════════════════════════════════════════════
IMS_ORG_ID=your_ims_org_id@AdobeOrg
API_KEY=your_adobe_api_key
ACCESS_TOKEN=your_access_token
SANDBOX_NAME=your_sandbox_name
TENANT_ID=_yourtenant


or


CLIENT_ID=
CLIENT_SECRET=
API_KEY=
IMS_ORG=
SANDBOX_NAME=
IMS_URL=
PLATFORM_URL=
SCOPES=
PORT=3001



# ═══════════════════════════════════════════════════════════
# AI Provider Configuration
# Get your API key from: https://aistudio.google.com/
# ═══════════════════════════════════════════════════════════
LLM_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_api_key_from_ai_studio
GEMINI_MODEL=gemini-3-pro

# Optional: Alternative Models
# GEMINI_MODEL=gemini-2.0-flash-lite (faster, less capable)
# GEMINI_MODEL=gemini-3-pro (most capable, slower)
```

### Installation

```bash
# Clone the repository
git clone https://github.com/shubhambhiwapurkar/aep-ai-center.git
cd aep-ai-center

# Install all dependencies (backend + frontend)
npm run install:all
```

### Running the Application

Open two terminal windows:

**Terminal 1 - Backend (Port 3001)**
```bash
cd backend
npm start
```

**Terminal 2 - Frontend (Port 5173)**
```bash
cd frontend
npm run dev
```

🌐 Open **http://localhost:5173** in your browser

---

## � Project Structure

```
aep-ai-center/
├── backend/
│   ├── src/
│   │   ├── agent/           # AI Agent logic
│   │   │   ├── agent.service.js
│   │   │   ├── llm.service.js    # Gemini integration
│   │   │   └── tools/            # 50+ agent tools
│   │   ├── routes/
│   │   │   └── api.routes.js     # All API endpoints
│   │   └── services/             # AEP API services
│   │       ├── batch.service.js
│   │       ├── schema.service.js
│   │       ├── segment.service.js
│   │       ├── chat.service.js   # Chat history
│   │       └── ...
│   └── data/
│       └── chat_history.json     # Conversation storage
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Shell.jsx         # Main layout
│   │   │   ├── AgentPanel.jsx    # AI Copilot UI
│   │   │   └── SharedComponents.jsx
│   │   ├── pages/                # Feature pages
│   │   │   ├── Dashboard.jsx
│   │   │   ├── BatchMonitor.jsx
│   │   │   ├── Segments.jsx
│   │   │   ├── DataLineage.jsx
│   │   │   └── ...
│   │   └── services/
│   │       ├── api.js            # AEP API calls
│   │       └── agent-api.js      # Agent API calls
│   └── index.html
│
└── README.md
```

---

## 🤖 AI Agent Capabilities

### Available Tools (50+)

| Category | Tools |
|----------|-------|
| **Batches** | List, get details, get stats, preview data, analyze failures |
| **Datasets** | List, get details, get files, get labels, get batches |
| **Schemas** | List, get details, get field groups, export, generate dictionary |
| **Segments** | List, create, get definition, estimate population, verify count |
| **Flows** | List, get runs, get specs, get connections, dry-run validation |
| **Identity** | Get namespaces, lookup XID, get cluster members, get history |
| **Profiles** | Lookup by identity, get merge policies, check orphaned profiles |
| **Queries** | Execute SQL, get templates, explain query, AI optimization |
| **Governance** | Get policies, get labels, check marketing actions |
| **Platform** | Get sandbox info, compare sandboxes, system health check |

### Example Prompts

```
"Show me all failed batches from yesterday"
"Create a segment for customers over 30 who are female"
"What's causing ingestion failures?"
"Analyze the loyalty schema and show me the field structure"
"Run a health check on the platform"
"Compare prod and dev sandboxes"
"Optimize this SQL query for better performance"
```

---

## 📸 Screenshots

| Dashboard | AI Agent |
|-----------|----------|
| Command Center with real-time health monitoring | AI Copilot with thinking indicators |

| Data Lineage | Batch Monitor |
|--------------|---------------|
| Interactive flow visualization | Auto-analysis for failures |

---

## 🔧 API Endpoints

### Core APIs
| Endpoint | Description |
|----------|-------------|
| `GET /api/connection` | Check AEP connection status |
| `GET /api/dashboard/summary` | Full dashboard metrics |
| `POST /api/agent/chat` | Send message to AI agent |
| `GET /api/agent/schema-context` | Get schema fields for AI context |

### Chat History
| Endpoint | Description |
|----------|-------------|
| `GET /api/chat/conversations` | List all saved conversations |
| `GET /api/chat/conversations/:id` | Get specific conversation |
| `PUT /api/chat/conversations/:id` | Save/update conversation |
| `DELETE /api/chat/conversations/:id` | Delete conversation |

---

## 🚀 Roadmap

- [ ] Vector database for schema embeddings
- [ ] Multi-model AI support (GPT-4, Claude)
- [ ] Real-time streaming responses
- [ ] Collaborative multi-user sessions
- [ ] Webhook integrations
- [ ] Custom dashboard widgets

---

## 📝 License

Distributed under the **MIT License**. 
Copyright (c) 2024 **Shubham Bhiwapurkar**.

---

## 🤝 Contributing

Contributions are welcome! Please open an issue or submit a pull request.

---

**Built with ❤️ for Adobe Experience Platform users**
