# RecoverAI — Autonomous AI Agent for Failed Payment Recovery

> **Built for Razorpay's AI Intern Buildathon — Track 3: AI Revenue Recovery**

RecoverAI is an intelligent, autonomous payment recovery agent that diagnoses *why* a payment failed and orchestrates the optimal recovery path — whether that is an immediate retry, an exponential delayed retry, a localized customer notification, human escalation, or a deliberate stop. 

Instead of blindly retrying every failure (which burns gateway fees, annoys customers, and risks bank blacklisting), RecoverAI couples **LLM-driven diagnosis** with a **deterministic policy safety engine**, backed by a real-time event-driven dashboard and scientific A/B benchmarking.

---

## 📑 Table of Contents

- [The Problem](#-the-problem)
- [The RecoverAI Solution](#-the-recoverai-solution)
- [Core Architecture & Principles](#-core-architecture--principles)
- [Key Features](#-key-features)
- [Deterministic Policy Engine](#-deterministic-policy-engine)
- [AI vs. Baseline Experiment Framework](#-ai-vs-baseline-experiment-framework)
- [Data Model & Schema](#-data-model--schema)
- [API Reference](#-api-reference)
- [Tech Stack](#-tech-stack)
- [Directory Structure](#-directory-structure)
- [Getting Started & Local Setup](#-getting-started--local-setup)
- [Live Demo Walkthrough](#-live-demo-walkthrough)

---

## 🚨 The Problem

Traditional payment recovery mechanisms are rigid, dumb, and brute-force:
1. **Blind Retries**: When a payment fails, traditional systems retry 3–4 times automatically regardless of failure reason.
2. **Wasted Cost & Bank Flagging**: Retrying hard declines (lost/stolen cards, invalid accounts) has a 0% success rate while incurring payment gateway failure penalties and increasing risk score with card networks.
3. **Customer Friction**: Retrying an expired card or insufficient-funds account without notifying the customer creates repeated invisible failures without giving the customer a chance to fix it.
4. **Lack of Explainability**: Operations teams have no visibility into *why* a retry happened or why recovery failed.

---

## 💡 The RecoverAI Solution

RecoverAI transforms payment recovery into a **Diagnosis-Then-Action** pipeline:

```
[ Failed Payment Event ]
          │
          ▼
  ┌───────────────┐
  │  AI Diagnosis │ ─── Gemini evaluates failure category, customer LTV, risk & history
  └───────┬───────┘
          │ (Proposes Action + Reasoning + Hinglish Message)
          ▼
  ┌───────────────┐
  │ Policy Engine │ ─── Deterministic safety rules validate, throttle, or override
  └───────┬───────┘
          │ (Approved / Enforced Strategy)
          ▼
  ┌───────────────┐
  │ Execution Hub │ ─── Retries / Multi-channel Notification / Escalation / Stop
  └───────┬───────┘
          │
          ▼
  ┌───────────────┐
  │  Audit Trail  │ ─── State transitions, decisions, and audit events saved to Postgres
  └───────────────┘
```

### Core Design Principle: *LLM Proposes, Policy Engine Disposes*
* **Gemini LLM**: Acts as an intuitive diagnostic strategist — evaluates nuanced customer context, failure codes, and formulates recovery approaches alongside rejected alternatives and personalized communication.
* **Policy Engine**: Acts as the deterministic guardrail — guarantees that hard business rules (rate limits, value thresholds, retry caps) can **never** be bypassed by hallucination or stochastic variance.

---

## 🌟 Key Features

### 1. 🧠 Intelligent LLM Diagnosis Engine
- **Failure Categorization**:
  - **Transient / Technical** (`network_error`, `bank_timeout`, `temporary_decline`): Safe for autonomous exponential/delayed retry.
  - **Customer Action Required** (`insufficient_funds`, `expired_card`): Requires customer intervention; triggers notification path.
  - **Terminal / Non-Recoverable** (`hard_decline`): Non-recoverable; immediately terminates to prevent unnecessary costs.
- **Alternatives Evaluation**: Forces the model to evaluate and explain why at least two alternative strategies were rejected.
- **Hinglish Customer Communication**: Dynamically writes natural, polite Hinglish messages (e.g., *"Aapka payment bank timeout ki wajah se complete nahi ho paya..."*) for notifications and escalations.

### 2. 🛡️ 7-Point Deterministic Policy Engine
Every recommendation must pass through a strict rule evaluation before execution:
- **Max Retries Check**: Hard cap of 3 retry attempts per transaction.
- **Hard Decline Guard**: Immediately stops non-recoverable failures.
- **Expired Card Guard**: Blocks automated bank retries; mandates customer notification.
- **Recovery Window**: Discontinues recovery actions after 7 days from initial failure.
- **Minimum Retry Interval**: Enforces a 30-minute cooling interval between retries to avoid gateway spamming.
- **High-Value Threshold**: Automatically escalates transactions $> ₹5,000$ (500,000 paise) for human review.
- **Notification Rate Limiting**: Caps notifications at 2 per 24-hour window to protect customer experience.

### 3. 📊 Real-Time Operations Dashboard & Recovery Inbox
- **Recovery Inbox**: Live table displaying real-time payments, failure categories, AI recommendations, and recovery states.
- **Interactive Recovery Stepper**: 5-step visual tracking (`Payment Failed` → `AI Recommendation` → `Policy Check` → `Recovery` → `Outcome`).
- **Customer Risk & LTV Intelligence**: Visual risk scoring (Low, Medium, High) derived from customer lifetime value and historical transaction success rate.
- **Side-by-Side Transparency**: AI reasoning panel with confidence metrics displayed alongside policy checks and audit trails.
- **Live Activity Feed**: WebSocket-powered live ticker displaying recovery completions, escalations, and decisions as they happen.
- **System Health Monitor**: Live popover displaying connectivity health for the Backend API, PostgreSQL Database, and Gemini AI.

### 4. 🧪 Scientific A/B Experimentation Engine
- Simulates identical failure batches through two parallel tracks:
  - **RecoverAI Arm**: Full diagnostic + policy-controlled recovery loop.
  - **Baseline Arm**: Traditional 3x naive retry strategy.
- Computes **Cost-Adjusted Net Value Recovered**:
  $$\text{Net Value} = \text{Revenue Recovered} - (\text{Retry Attempts} \times \text{Cost}_{\text{attempt}} + \text{Notifications} \times \text{Cost}_{\text{notify}})$$
- Highlights **Attempt Efficiency** (3–4x fewer attempts per payment) and incremental revenue recovery.
- Single-click **Text/Report Export** for offline business analysis.

---

## 🏛️ System Architecture

```mermaid
flowchart TD
    subgraph Ingestion
        WH[POST /webhooks/payment-failed]
        SIM[POST /payments/simulate-failure]
    end

    subgraph Core_Agent [RecoverAI Engine]
        RA[Recovery Agent\nrecoveryAgent.js]
        GEMINI[Google Gemini API\ngemini-2.5-flash]
        PE[Policy Engine\npolicyEngine.js]
        EXEC[Action Execution\nagentTools.js & recoveryService.js]
    end

    subgraph Data_Layer [Neon PostgreSQL]
        DB[(Prisma ORM\nPayments, Customers, Decisions,\nPolicyChecks, AuditLogs)]
    end

    subgraph Realtime_UI [Frontend Dashboard]
        WS[Socket.io Server]
        UI[React + Vite + Tailwind Dashboard]
    end

    WH --> RA
    SIM --> RA
    RA <-->|Prompt & JSON Response| GEMINI
    RA -->|Proposed Action| PE
    PE -->|Approved / Overridden Action| EXEC
    EXEC --> DB
    RA --> DB
    EXEC -->|Emit State Changes| WS
    WS --> UI
    UI -->|REST Queries / Manual Actions| Ingestion
```

---

## 🗄️ Data Model & Schema

RecoverAI uses Prisma with PostgreSQL:

| Model | Purpose | Key Fields |
|---|---|---|
| **`Customer`** | Historical customer profile & value | `name`, `email`, `successCount`, `failCount`, `ltv` |
| **`Payment`** | Failed transaction details | `amount`, `currency`, `status`, `failureReason`, `retryCount`, `notificationCount` |
| **`AgentDecision`** | LLM diagnostic output & rationale | `failureType`, `recoverabilityScore`, `strategy`, `confidence`, `reasoning`, `customerMessage`, `alternativesConsidered` |
| **`PolicyCheck`** | Deterministic rule verification | `ruleName`, `passed`, `reason`, `decisionId` |
| **`RecoveryAttempt`**| Individual retry executions | `scheduledAt`, `executedAt`, `outcome`, `paymentId` |
| **`AgentState`** | Lifecycle state tracker | `currentState` (`ANALYZING`, `DECISION_MADE`, `ACTION_SCHEDULED`, `COMPLETED`, etc.) |
| **`AuditLog`** | Immutable chronological event log | `event`, `details`, `timestamp`, `paymentId` |

---

## 🔌 API Reference

### Webhooks & Ingestion
- `POST /webhooks/payment-failed` — Gateway webhook endpoint for failed payment events.
- `POST /payments/simulate-failure` — Simulates a failure on a random or type-specific payment.
- `POST /payments/:id/simulate-failure` — Re-triggers simulation on a specific payment scenario.

### Recovery Execution & Inspection
- `POST /payments/:id/recovery/execute` — Triggers execution of a scheduled recovery attempt.
- `GET /payments` — Retrieves payments list (supports `?status=` and `?notified=true` filters).
- `GET /payments/:id` — Full audit trail for a single payment (decisions, policy checks, attempts, logs).
- `GET /dashboard/stats` — High-level metrics (total payments, recovered, escalated, failed, recovery rate).

### Experiments & System Health
- `POST /experiments/run` — Runs a batch simulation comparing RecoverAI against naive baseline.
- `GET /experiments/latest` — Fetches the results of the most recent experiment batch.
- `GET /health` — Returns status of backend server, database connection, and Gemini API.

---

## 💻 Tech Stack

- **Backend**: Node.js, Express 5, Socket.io
- **Database & ORM**: PostgreSQL (Neon Serverless), Prisma ORM
- **AI / LLM**: Google Gemini API (`gemini-2.5-flash` / `@google/genai`) with Structured Outputs
- **Frontend**: React 19, Vite, Tailwind CSS v4, React Router 7, Axios
- **Real-time**: WebSockets via Socket.io-client

---

## 📁 Directory Structure

```
RecoverAI/
├── README.md
├── backend/
│   ├── package.json
│   ├── prisma/
│   │   ├── schema.prisma           # Database schema definition
│   │   └── seed.js                 # Seed script with hero customer personas
│   └── src/
│       ├── server.js               # Express server & WebSocket setup
│       ├── agents/
│       │   ├── prompts.js          # System prompts with Hinglish message spec
│       │   ├── recoveryAgent.js    # Gemini LLM orchestration
│       │   └── agentTools.js       # Action handlers & DB loggers
│       ├── recovery/
│       │   ├── policyEngine.js     # 7 deterministic safety rules
│       │   ├── recoveryService.js  # Execution runner for retries
│       │   ├── simulator.js        # Realistic payment outcome simulator
│       │   └── experimentService.js# RecoverAI vs Baseline A/B runner
│       └── webhooks/
│           └── paymentWebhook.js   # Ingestion entry point
└── frontend/
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── App.jsx                 # Routes & Layout shell
        ├── api/payments.js         # Axios client & API handlers
        ├── components/
        │   ├── ActivityFeed.jsx    # Real-time WebSocket activity ticker
        │   ├── CustomerRiskPanel.jsx # LTV & risk tier breakdown
        │   ├── DashboardStats.jsx  # Overview metrics cards
        │   ├── DiagnosisPanel.jsx  # AI recommendation & alternatives
        │   ├── PolicyChecksPanel.jsx# Policy engine rule results
        │   ├── RecoveryStepper.jsx # 5-step visual lifecycle progress
        │   ├── SystemHealth.jsx    # Live infrastructure status popover
        │   └── Timeline.jsx        # Chronological audit log
        └── pages/
            ├── PaymentsListPage.jsx # Recovery Inbox table & simulator
            ├── PaymentDetailPage.jsx# Deep-dive payment audit view
            └── ExperimentResultsPage.jsx # A/B benchmark visualizer
```

---

## 🚀 Getting Started & Local Setup

### Prerequisites
- **Node.js**: v18.0.0 or later
- **PostgreSQL**: Local PostgreSQL or a free [Neon](https://neon.tech) serverless database
- **Gemini API Key**: Obtainable from [Google AI Studio](https://aistudio.google.com/)

---

### 1. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Create environment configuration
# Create backend/.env with:
# DATABASE_URL="postgresql://user:password@host/neondb?sslmode=require"
# GEMINI_API_KEY="your-gemini-api-key"
# PORT=5000
# FRONTEND_URL="http://localhost:5173"

# Generate Prisma client and migrate schema
npx prisma generate
npx prisma db push

# Seed database with sample transactions & hero personas
npm run seed

# Start the backend server
npm run dev
```
*Backend server will start on `http://localhost:5000`.*

---

### 2. Frontend Setup

```bash
# Open a new terminal and navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Create environment configuration
# Create frontend/.env with:
# VITE_API_URL=http://localhost:5000

# Start the Vite development server
npm run dev
```
*Frontend application will be accessible at `http://localhost:5173`.*

---

## 🎬 Live Demo Walkthrough

1. **Explore the Recovery Inbox (`/`)**:
   - View seeded payments categorized by status (`Failed`, `Recovered`, `Escalated`, `Stopped`).
   - Check the **System Health** indicator at the top right to verify all services are operational.
2. **Simulate a Payment Failure**:
   - Click **"Simulate Failure"** to inject a targeted failure (e.g. `insufficient_funds` or `network_error`).
   - Or click **"Simulate Batch (8x)"** to trigger multiple concurrent payment recovery lifecycles.
   - Watch the **Live Activity Feed** stream decisions and outcomes in real time.
3. **Inspect the Payment Audit Trail (`/payments/:id`)**:
   - Observe the **Recovery Stepper** showing progress through diagnostic and policy phases.
   - Read the **AI Recommendation** explaining the strategy, confidence score, rejected alternatives, and custom **Hinglish customer notification**.
   - Check the **Policy Engine** checks showing deterministic safety rule validations.
   - Review the full chronological **Audit Timeline**.
4. **Run the A/B Experiment (`/experiments`)**:
   - Click **"Run Experiment"** to test 40 payments through RecoverAI vs. Naive Baseline.
   - Compare **Net Value Recovered**, **Recovery Rate**, and **Average Attempts per Payment**.
   - Click **"Export Summary"** to download the benchmark report.

---

## ⚖️ License

Distributed under the MIT License. Built with ❤️ for Razorpay's AI Intern Buildathon.