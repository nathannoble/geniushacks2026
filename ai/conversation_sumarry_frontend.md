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
