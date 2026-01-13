# AEP AI Center (Enterprise Monitoring Agent)

**AEP AI Center** is a next-generation "Full Agent" system for Adobe Experience Platform. It transforms the traditional monitoring dashboard into an intelligent Command Center where an AI Copilot proactively monitors system health, diagnoses ingestion failures, and executes complex tasks via natural language.

---

## 🚀 Features

*   **AI Command Center**: Daily briefings, real-time alerts, and system health matrix.
*   **Intelligent Agent**: 50+ tools covering Datasets, Batches, Segments, Flows, and Identity.
*   **Forensic Analysis**: Auto-diagnose batch failures and row-level errors.
*   **Natural Language Control**: "Show me failed batches", "Analyze segment definition", "Check platform health".
*   **Advanced Analyitcs**: Visual Data Prep, SQL Query Editor, and Segment Population analysis.

---

## 🛠️ Setup & Installation

### Prerequisites
*   Node.js (v18+)
*   Adobe Experience Platform Access (Sandbox Name, Tenant ID)
*   Google Gemini API Key (or OpenAI/Azure equivalent)

### Environment Variables
Create a `.env` file in the `backend` directory:
```env
PORT=3001
# Adobe Credentials
IMS_ORG_ID=your_org_id
API_KEY=your_api_key
ACCESS_TOKEN=your_access_token
SANDBOX_NAME=your_sandbox
TENANT_ID=your_tenant_id

# AI Provider
LLM_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_key
GEMINI_MODEL=gemini-1.5-pro
```

### Installation
```bash
# Clone the repository
git clone https://github.com/shubhambhiwapurkar/aep-ai-center.git
cd aep-ai-center

# Install dependencies
npm run install:all
```

### Running the Application
Open two terminal windows:

**Backend (Port 3001)**
```bash
cd backend
npm start
```

**Frontend (Port 5173)**
```bash
cd frontend
npm run dev
```

Visit the application at: `http://localhost:5173`

---

## 🗺️ Technical Roadmap: Advanced Features

The following roadmap outlines the implementation of three critical advanced capabilities: **Segment Verification**, **Profile Health**, and **AI Context Extraction**.

### Feature 1: "True Count" Segment Verification
**Goal**: Verify the estimated segment count from the Segmentation Service against the actual Data Lake data using Query Service (SQL).

**Process Map:**
1.  **Identify the Target Segment**:
    *   UI: User selects a Segment.
    *   API: `GET /data/core/ups/segment/definitions/:SEGMENT_ID` (Extract ID and Name).
2.  **Locate Profile Snapshot**:
    *   Find the "Profile Snapshot Export" dataset in Catalog.
    *   API: `GET /data/foundation/catalog/dataSets?name=Profile Snapshot Export`.
    *   Extract: Table Name (e.g., `profile_snapshot_export_123`).
3.  **Construct Verification Query**:
    *   SQL Logic:
        ```sql
        SELECT count(1) as actual_count
        FROM profile_snapshot_export_123
        WHERE segmentMembership.ups.['<SEGMENT_ID>'].status = 'existing'
        ```
4.  **Execute & Poll**:
    *   Submit: `POST /data/foundation/query/queries`
    *   Poll: `GET /data/foundation/query/queries/:queryId`
5.  **Comparison UI**: Display "Estimated Count" vs "Actual Data Lake Count".

### Feature 2: System-Wide Profile Health Check
**Goal**: Get a definitive count of profiles and distribution without expensive SQL.

**Process Map:**
1.  **Fetch Sample Status**:
    *   Use Preview API for fast counts.
    *   API: `GET /data/core/ups/previewsamplestatus` (Returns `totalProfileCount`).
2.  **Fetch Distribution Reports**:
    *   By Namespace: `GET /data/core/ups/previewsamplestatus/report/namespace`
    *   By Dataset: `GET /data/core/ups/previewsamplestatus/report/dataset`
3.  **"Orphaned Profile" Check (Advanced)**:
    *   Identify profiles with no recent activity (high count = optimize identity graph alert).
    *   SQL:
        ```sql
        SELECT count(1)
        FROM profile_snapshot_table
        WHERE timestamp < date_sub(current_date(), 90)
        ```

### Feature 3: The AEP Extractor & Data Dictionary (AI Context Builder)
**Goal**: Create a flattened, human-readable "Dictionary" of every attribute to prevent AI hallucinations.

#### 1. Schema Stitching Logic (Backend)
Traverse the Schema Registry to build a complete map.
*   **Step A**: Find Union Schema (meta:class = `XDM Individual Profile`).
*   **Step B**: Fetch Full Schema with `Accept: application/vnd.adobe.xed-full+json; version=1`.
*   **Step C**: Recursive Field Extraction ("Stitcher").
    *   Iterate properties.
    *   Resolve `$ref` (Mixins/Field Groups) by fetching `GET /schemaregistry/tenant/mixins/:ID`.
    *   Flatten paths (e.g., `_tenant.loyalty.tier`).

#### 2. Attribute Mapping & Metadata Enrichment
Extract metadata for the AI:
*   `title`: Human readable name.
*   `description`: Functional description.
*   `type`: Data type (string, int, etc.).
*   `meta:enum`: Allowed values (critical for filtering).

#### 3. Generating "Profile Snapshot" Dictionary
To support SQL generation:
*   Get Dataset Schema from the Snapshot Dataset.
*   Run the Stitcher on that specific schema ID.

#### 4. The Final Output (AI Context Object)
Example JSON structure for the Vector Database:
```json
[
  {
    "path": "person.name.firstName",
    "sql_column": "person.name.firstName",
    "type": "string",
    "description": "The customer's first name given at registration.",
    "source_field_group": "Demographic Details"
  },
  {
    "path": "loyalty.status",
    "sql_column": "work.loyalty.status",
    "type": "enum",
    "allowed_values": ["Gold", "Silver", "Bronze"],
    "description": "Current loyalty tier calculated daily."
  }
]
```

**Usage Flow:**
1.  User: "Show me count of Gold members."
2.  Agent searches Vector DB for "Gold members" -> matches `loyalty.status` ('Gold').
3.  Retrieves SQL column `work.loyalty.status`.
4.  Generates: `SELECT count(1) FROM profile_snapshot WHERE work.loyalty.status = 'Gold'`.
