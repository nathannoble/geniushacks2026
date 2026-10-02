# FCRM Workbench - Frontend Implementation Summary

**Date:** 2026-10-02
**Context:** Hackathon Submission for GeniusHacks 2026

---

## 👤 User Prompt (Senior Full Stack Engineer)
I need a high-level architectural review of our current codebase for the GeniusHacks 2026 submission. I've mapped out the full process workflow. We're running FastAPI, PostgreSQL with pgvector, and LangGraph on the backend, and I need to solidify the frontend stack and integration points.

I'm architecting the frontend with React 19 and Vite. We'll use Tailwind CSS v4 for styling. For auth, I want to hook up `@supabase/supabase-js`. For event-driven notifications (e.g., case status changes), we're going to proxy calls through our FastAPI backend to trigger Resend via their Python SDK. 

Draft me a comprehensive implementation plan validating this approach and detailing the tech stack integration.

---

## 🤖 AI Implementation Plan

This is a highly scalable and modern architecture. Based on your requirements and the existing backend stack, here is the validated implementation plan for the frontend architecture.

### 🛠️ Tech Stack & Tools
- **Frontend Core:** React 19, initialized with Vite for rapid HMR and optimized builds.
- **Language:** TypeScript for strict type safety across the monorepo.
- **Styling:** Tailwind CSS (v4) for utility-first, highly maintainable responsive design.
- **State Management & Fetching:** `@tanstack/react-query` for asynchronous state management and caching.
- **Routing:** `react-router-dom` (v7) for client-side routing.
- **Authentication:** `@supabase/supabase-js` for robust, secure JWT-based user authentication.
- **Notifications (Email):** `resend` Python SDK integrated via the FastAPI backend to send securely authenticated HTML emails on case status mutations.
- **Icons & UI:** `lucide-react` for SVG icons and `react-hot-toast` for elegant toast notifications.

### 🏗️ Architecture & Workflow

1. **Frontend Foundation (Vite + React)**
   - Target directory: `src/fcrm-workbench/app/ui/static`.
   - Tailwind v4 configured via `vite.config.ts`.
   - Core routing scaffolding for `/login`, `/register`, and secure dashboard routes.

2. **Supabase Integration**
   - Create a singleton `src/lib/supabase.ts` to export the initialized Supabase client using environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
   - Build an `AuthContext.tsx` to globally provide the user session, managing login, registration, and logout states asynchronously.

3. **Resend Email Integration (Backend to Frontend Bridge)**
   - The React frontend handles the UI state, while email delivery is handled securely server-side based on state transitions (e.g., "Awaiting Gate 1 Review").
   - We'll implement an `email.py` module in the backend using the Resend Python SDK.
   - The frontend will trigger protected FastApi endpoints, which invoke `resend.Emails.send` to dispatch HTML-formatted alerts without exposing the Resend API key to the client.

Shall we proceed with this plan?

---

## 👤 User Response
Looks solid. I've already scaffolded the Vite project and set up the routing foundation. Give me the boilerplate for the Supabase client initialization and the Resend Python payload generator so I can drop them into our `src/lib/supabase.ts` and `app/notifications/email.py` modules.

---

## 🤖 AI Execution

Here is the core integration code for both services.

### 1. Supabase Client Setup (`src/lib/supabase.ts`)
```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase environment variables. Check your .env setup.");
}

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);
```

### 2. Resend Email Template (`app/notifications/email.py`)
```python
import os
import resend

resend.api_key = os.environ.get("RESEND_API_KEY")
TO_EMAIL = os.environ.get("NOTIFICATION_EMAIL", "delivered@resend.dev")

def generate_email_html(event_type: str, case_id: str, detail: str) -> str:
    # Custom HTML generation for different events like 'awaiting_gate1_review'
    return f"""
    <html>
        <body>
            <h2>FCRM Workbench - Action Required</h2>
            <p>Case <strong>{case_id}</strong> requires your immediate attention. {detail}</p>
        </body>
    </html>
    """

def send_notification_email(event_type: str, case_id: str, detail: str = ""):
    if not resend.api_key:
        print("[Email] Resend API key not configured.")
        return

    html_content = generate_email_html(event_type, case_id, detail)
    resend.Emails.send({
        "from": "FCRM Workbench <hello@knoatechsolutions.com>",
        "to": TO_EMAIL,
        "subject": f"FCRM Action Required: Case {case_id}",
        "html": html_content
    })
```

---

## 👤 User Response
Alright, I dropped those in. I hit a couple of configuration snags during testing but I've already sorted them out.

First, the Vite frontend crashed on mount with `TypeError: URL constructor: VITE_SUPABASE_URL is not a valid URL`. I realized I hadn't mapped the `VITE_` prefixed environment variables into the React root `.env` file—I had only put them in the backend `.env`. Once I created `app/ui/static/.env` and loaded the keys, the Supabase client initialized perfectly.

Second, the Resend trigger failed silently when I approved a case. The backend logs showed `[Email] Resend API key not configured.` It turned out the Docker container for the FastAPI app wasn't mounting the root `.env` properly in `docker-compose.yml`, so `os.environ.get("RESEND_API_KEY")` was returning `None`. I explicitly mapped `env_file: .env` to the `app` service block and rebuilt the container. 

Both the authentication flow and email notifications are fully green now.

---

## 🤖 AI Response
Excellent debugging. Catching those environment variable isolation issues between Vite's static build process and Docker's container runtime is exactly why managing layered `.env` setups can be tricky. You handled it perfectly.

Since both the authentication layer and the event-driven email notifications are fully operational, the core integration points are secured. What's our next architectural target for the FCRM Workbench?

---

## 👤 User Prompt (Designing the Frontend UI/UX)
Now that our authentication and notification bridges are solid, our next big focus is building out the complete UI for the FCRM Workbench. We're migrating away from the legacy vanilla HTML/JS mockup and need a high-density, mission-critical interface in React 19 and TypeScript that will blow the hackathon judges away.

Here are the functional and aesthetic specifications I need you to implement:

1. **Aesthetic & Design System:**
   - It needs to look and feel like an enterprise cyber-fintech command center—deep slate and midnight navy palette (`#070B14`, `#0D1526`, `#0F172A`) with subtle radial glow accents, crisp card borders, and frosted glass overlays.
   - Modern typography: `Plus Jakarta Sans` for UI copy, and `JetBrains Mono` for case IDs, monetary figures, timestamps, and audit entries.
   - High-contrast semantic risk colors: Critical (Crimson `#EF4444` with glow), High (Orange `#F97316`), Medium (Amber `#F59E0B`), and Low (Emerald `#10B981`).

2. **Shell & Navigation Header:**
   - Brand logo with a shield icon and an `Intelligence Engine` badge.
   - Seamless top-level navigation switching between the **Cases Queue** and **+ Submit Change Request**.
   - An active system health monitor with a pulsing beacon: `System Live: LangGraph Orchestrator`.
   - Current user persona HUD displaying the authenticated user's name and role (`Product Owner`, `Compliance Analyst`, `Committee Chair`), plus a sign-out trigger.

3. **View 1: Cases Queue & KPI Overview:**
   - A top KPI stat card strip with colored accent borders tracking: *Total Active Cases*, *Awaiting Gate 1 (Analyst)*, *Awaiting Gate 2 (Committee)*, *Information Needed (RFI)*, and *Approved / Closed*.
   - Real-time search box and filter pills by case status.
   - Dense case queue table displaying Case ID, Product/Change name, submission date, persona, SLA status, risk tier badge, and an `Open Dossier →` button.

4. **View 2: Intake Portal & Quick Demo Presets:**
   - Intake form capturing product name, change type, geography/jurisdictions, customer segment, target date, and operational context.
   - Drag-and-drop supporting documents dropzone (`.pdf`, `.docx`, `.txt`) with file list previews and deletion.
   - **One-click demo preset cards** to quickly populate realistic hackathon evaluation scenarios:
     - 🌿 *Cannabis Dispensary* (High Risk Cash Intensive)
     - 🌐 *Cross-Border Remittance* (Sanctions Match & Offshore Corridor)
     - ⚡ *Crypto Custody & Staking* (Medium Risk Institutional Custody)
     - 🚚 *Corporate Fleet Card* (Low Risk Closed-Loop Fuel Line)
     - 🏛️ *Private Wealth PEP* (High Risk PEP Floor)
     - ⚠️ *Instant Payments Gateway* (RFI Loop Missing Fields)
   - Dynamic `⚡ Auto-Filled from Document` badge when preset or file data populates the form.
   - When the form is submitted, animate the button through the live LangGraph multi-agent pipeline steps (*Initializing...* ➔ *Document Extraction (M2)...* ➔ *Policy Retrieval (M3)...* ➔ *Risk Scoring (M5)...* ➔ *Drafting Memo (M6)...*).

5. **View 3: Comprehensive Case Dossier:**
   - An interactive horizontal **End-to-End Orchestrator Pipeline Stepper** visualizing the LangGraph node graph progress with step status icons (`✓`, `!`) and a "Replay Agents" animation button.
   - Tabbed deep-dive panels:
     - **Executive Memo (M6):** Executive summary, inherent vs. residual ratings, mandatory condition callouts, analyst questions, and structured citations.
     - **Risk Scorecard (M5):** Composite inherent risk gauge (`/ 4.00`), Claude Haiku risk rationale synthesis block, and a deterministic multi-factor scoring table with proportional fill bars.
     - **Extracted Facts (M2):** Extracted entities grouped into parties, jurisdictions, and transaction types with source badges.
     - **Policy Retrieval (M3) & Watchlist Screening (M4):** RAG policy matches and sanctions hits.
     - **Audit & SLA (M9):** Immutable timeline logging events, personas, and timestamps.

6. **Human-in-the-Loop Governance Modals:**
   - **Gate 1 (Compliance Analyst Triage):** Radio choices to either *Finalize Memo & Advance to Committee* or trigger a *Request For Information (RFI)* back to the Product Owner, with justification notes and analyst ID.
   - **Gate 2 (Risk Committee Determination):** Multi-button outcome selector (*Approved with Conditions*, *Approved Unconditionally*, *Deferred*, *Rejected*), an interactive **Covenants & Conditions Tagging** tool where users can type and add/remove tags, and committee chair signature binding.

Generate the comprehensive styling system in `workbench.css` and the full interactive React component in `Dashboard.tsx` connecting to our `apiClient` and React Query.

---

## 🤖 AI Execution & UI Design Implementation

Here is the complete implementation of the UI architecture, structured into a centralized design token stylesheet (`workbench.css`), auth view styling (`auth.css`), and the primary workstation component (`Dashboard.tsx`).

### 1. 🎨 Design Tokens & Theming (`src/workbench.css`)

We structured the stylesheet using native CSS custom properties on `:root` to establish a dark fintech aesthetic with zero CSS bloat:

```css
:root {
  /* Surfaces & Backgrounds */
  --bg-primary: #070B14;
  --bg-secondary: #0D1526;
  --bg-tertiary: #131F37;
  --bg-card: #0F172A;
  --bg-card-hover: #162238;
  --bg-surface: rgba(15, 23, 42, 0.75);
  --bg-overlay: rgba(3, 7, 18, 0.85);

  /* Borders */
  --border-subtle: #1E293B;
  --border-medium: #334155;
  --border-bright: rgba(255, 255, 255, 0.12);
  --border-accent: #38BDF8;

  /* Typography & Accents */
  --text-primary: #F8FAFC;
  --text-secondary: #94A3B8;
  --text-muted: #64748B;
  --accent-cyan: #38BDF8;
  --accent-blue: #2563EB;
  --accent-emerald: #10B981;
  --accent-amber: #F59E0B;
  --accent-rose: #F43F5E;
  --accent-crimson: #EF4444;

  /* Semantic Risk Tiers */
  --risk-critical-bg: rgba(239, 68, 68, 0.15);
  --risk-critical-border: #EF4444;
  --risk-critical-text: #FCA5A5;
  --risk-critical-glow: rgba(239, 68, 68, 0.35);

  --risk-high-bg: rgba(249, 115, 22, 0.15);
  --risk-high-border: #F97316;
  --risk-high-text: #FDBA74;

  --risk-medium-bg: rgba(245, 158, 11, 0.15);
  --risk-medium-border: #F59E0B;
  --risk-medium-text: #FCD34D;

  --risk-low-bg: rgba(16, 185, 129, 0.15);
  --risk-low-border: #10B981;
  --risk-low-text: #6EE7B7;

  /* Typography */
  --font-sans: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
}
```

### 2. 🏛️ Application Shell & HUD Layout (`Dashboard.tsx`)

The dashboard layout features a sticky header containing brand identity, live status, persona indicator, and tab navigation:

```tsx
<header className="navbar">
  <div className="brand-section">
    <div className="brand-logo">
      <ShieldIcon />
    </div>
    <div className="brand-title">
      FCRM Workbench
      <span className="brand-badge">Intelligence Engine</span>
    </div>
  </div>

  <nav className="nav-links">
    <button className={`nav-btn ${activeTab === 'queue' ? 'active' : ''}`} onClick={() => setActiveTab('queue')}>
      Cases Queue
    </button>
    <button className={`nav-btn ${activeTab === 'new-case' ? 'active' : ''}`} onClick={() => setActiveTab('new-case')}>
      + Submit Change Request
    </button>
  </nav>

  <div className="header-controls">
    <div className="user-profile-container">
      <div className="user-name">{user?.firstName} {user?.lastName}</div>
      <div className="user-role">{currentPersona}</div>
      <button className="btn-secondary" onClick={handleLogout}>Sign Out</button>
    </div>
    <div className="health-status">
      <span className="pulse-dot"></span> System Live: LangGraph Orchestrator
    </div>
  </div>
</header>
```

### 3. 📊 Cases Queue & Interactive KPI Grid

The queue view aggregates real-time case data using `@tanstack/react-query`:
- **5-Column Metric Cards:** Dynamic calculation for `Total Active`, `Gate 1 Review`, `Gate 2 Committee`, `RFI Loops`, and `Closed Cases`.
- **Filtering & Search:** Real-time regex query matching on Case ID, product name, and description.
- **Queue Table Matrix:** Monospace case IDs, status badges with glowing dots, persona avatars, and quick-action dossier triggers.

### 4. 📝 Intake Wizard & 1-Click Scenario Presets

To streamline live demo workflows during judging:
- **Preset Loaders:** `loadPresetIntoForm(presetId)` instantly injects pre-configured compliance scenarios (Cannabis, Remittance, Crypto, PEP, Fleet, and RFI).
- **Auto-Fill Detection:** Highlights populated fields with cyan border indicators (`.field-auto-populated`) and renders the `⚡ Auto-Filled from Document` badge.
- **Multi-Agent Execution Animation:** While submitting, an interval cycles the submit button text through:
  `Initializing Multi-Agent Orchestrator...` ➔ `Running Document Extraction (M2)...` ➔ `Executing Policy Retrieval (M3)...` ➔ `Calculating Risk Score (M5)...` ➔ `Drafting Executive Memo (M6)...`

### 5. 🔬 Dossier View & LangGraph Pipeline Stepper

The dossier view offers complete transparency into the automated compliance engine:
- **Pipeline Stepper:** Horizontal execution timeline illustrating the progression of agents M1 through M9. Includes a "Replay Agents" button to re-trigger step visual animations.
- **Tabbed Sub-Views:**
  - `memo`: Executive summary, conditions precedent, and parsed legal citation cards.
  - `scorecard`: Composite score gauge card (`X.XX / 4.00`), Haiku AI rationale box, and multi-factor deterministic scoring breakdown table with proportional CSS bar fills.
  - `facts`: Structured citation groups for parties, jurisdictions, and transaction types.
  - `audit`: Immutable timestamped event log showing the full audit trail.

### 6. 🚦 Human-in-the-Loop Gate Modals

- **Gate 1 Modal (Compliance Analyst):** Radio cards allowing the analyst to either forward to Gate 2 or bounce the case back as an RFI loop with custom notes.
- **Gate 2 Modal (Risk Committee):** 4-way decision buttons with custom color variants, plus an interactive condition tagger (`addConditionTag`) allowing committee members to attach enforceable covenants before final determination.

---

## 👤 User Response
This UI implementation is spot-on. The dark cyber-fintech aesthetic combined with the LangGraph pipeline stepper gives the workbench an authentic, mission-critical feel. The 1-click test presets make demonstrating the system seamless, and the condition tagger in the Gate 2 modal provides exactly the level of governance the judges will be looking for. Let's make sure the build passes with zero errors before we package the submission.

---

## 👤 User Prompt (Replay Agents Functionality Update)
We have a bug with the "Replay Agents" button for our seeded demo cases (`scripts/seed_demo_cases.py`). Because those cases were inserted via raw SQL, they bypassed the LangGraph M1-M6 agents entirely and lack the underlying state data. 

I need you to implement a full backend replay mechanism that mimics the initial submission workflow. Here is what you need to do:
1. **`app/orchestrator/service.py`**: Add a `replay_case` function that fetches the case row, generates a fresh `thread_id` to ensure a clean state, and re-invokes the LangGraph pipeline from the intake node.
2. **`app/orchestrator/main.py`**: Expose this via a new `POST /cases/{case_id}/replay` endpoint.
3. **`app/ui/static/src/lib/api.ts`**: Add the `replayCase` client method to call the endpoint.
4. **`Dashboard.tsx`**: Wire up the "Replay Agents" button to trigger the API call and subsequently refresh the case dossier.

Go ahead and implement this architecture.

---

## 🤖 AI Execution & Architectural Update
You are absolutely correct. The `scripts/seed_demo_cases.py` script bypassed the LangGraph AI pipeline to rapidly populate the dashboard, which is why clicking on those cases displayed empty memos and scorecards. 

To fix this, I have created and implemented a comprehensive plan:
1. **Backend Integration (`app/orchestrator/service.py`):** Added a `replay_case()` function. This safely retrieves the original case submission from PostgreSQL, provisions a fresh `thread_id` to ensure a clean LangGraph state (avoiding bleed-over from previous runs), and re-invokes the graph from the intake node.
2. **API Endpoint (`app/orchestrator/main.py`):** Exposed a new REST endpoint `POST /cases/{case_id}/replay` that delegates to `replay_case` via a threadpool to handle the blocking graph invocation.
3. **Frontend API Client (`app/ui/static/src/lib/api.ts`):** Extended `FCRMApiClient` with a `replayCase()` method to communicate with the new replay endpoint and automatically fetch the updated case state upon completion.
4. **Dashboard Wiring (`Dashboard.tsx`):** Bound the `handleReplay` logic to the Replay Agents button, invalidating React Query caches and automatically reloading the active dossier to display the freshly generated data.

---

## 👤 User Response
The backend integration is solid and the replay works, but the UX on the replay button is currently static, making it look stuck during processing.

Update `Dashboard.tsx` to make the replay button interactive. It needs to mimic the exact behavior of the 'Submit Change for Risk Assessment' button. Introduce an `isReplaying` state to disable the button and show a spinner, and cycle the button text through the active agent stages via a `setInterval` hook (e.g., "Initializing...", "Document Extraction...", etc.) while the backend is processing. Rebuild the Vite app once complete.

---

## 🤖 AI UI Refinement
I've updated the "Replay Agents" button to behave exactly like the initial submission button! 

When clicked, the button now transitions into an `isReplaying` state that disables it, displays a spinning loader, and dynamically cycles through the active agent stages:
- "Initializing Multi-Agent Orchestrator..."
- "Running Document Extraction (M2)..."
- "Executing Policy Retrieval (M3)..."
- "Calculating Risk Score (M5)..."
- "Drafting Executive Memo (M6)..."
- "Finalizing Case Dossier..."

This ensures that the user receives clear, continuous visual feedback that the agents are actively processing the case in the background. The Vite client has been rebuilt successfully and the changes are live.
