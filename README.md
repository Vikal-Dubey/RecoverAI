# RecoverAI — AI Agent for Failed Payment Recovery

Built for Razorpay's AI Intern Buildathon — **Track 3: AI Revenue Recovery**

RecoverAI is an AI-driven payment recovery agent that detects failed or dropped payments, diagnoses *why* they failed, and decides the smartest recovery action — retry now, retry after a delay, notify the customer, escalate to a human, or stop — instead of blindly retrying every failure the way traditional systems do. Every decision is backed by an LLM's reasoning and validated against a deterministic policy engine, with a full audit trail persisted for transparency.

---

## The Problem

When a payment fails — card declined, insufficient funds, bank timeout, expired card, network drop — most systems respond the same way regardless of *why* it failed: retry a few times and give up. This wastes attempts on unrecoverable failures (a hard decline will never succeed no matter how many times you retry), annoys customers with pointless retries on issues only they can fix (an expired card needs a new card, not another attempt), and under-uses cheap, effective interventions (a simple notification often resolves insufficient-funds failures faster and cheaper than repeated bank calls).

RecoverAI treats recovery as a *diagnosis-then-action* problem: classify the failure, reason about the best response given the payment and customer's history, validate that response against hard business rules, then act.

---

## Architecture

```
┌─────────────────┐
│  Payment Failed  │  (webhook or simulated event)
└────────┬─────────┘
         ▼
┌─────────────────────┐      ┌──────────────────────┐
│   Recovery Agent      │────▶│   Gemini API           │
│  (recoveryAgent.js)   │◀────│  (diagnosis + strategy)│
└────────┬─────────────┘      └──────────────────────┘
         ▼
┌─────────────────────┐
│   Policy Engine        │  (deterministic rule checks —
│  (policyEngine.js)     │   max retries, hard decline,
└────────┬─────────────┘   expired card, high value,
         ▼                  retry interval, notification
┌─────────────────────┐    limits, recovery window)
│   Action Execution     │
│  (agentTools.js)       │  retry / notify / escalate / stop
└────────┬─────────────┘
         ▼
┌─────────────────────┐
│  Audit Trail (Postgres)│  AgentDecision → PolicyCheck →
│                        │  RecoveryAttempt → AuditLog
└────────┬─────────────┘
         ▼
┌─────────────────────┐
│  Recovery Inbox (UI)   │  React dashboard — AI reasoning
│                        │  + policy checks side by side
└─────────────────────┘
```

**Design principle:** the LLM proposes, the policy engine disposes. Gemini analyzes the payment and suggests a strategy with reasoning, but a deterministic rules layer has final authority — this keeps the system safe and auditable even if the model's judgment is imperfect, and makes every action explainable in plain business terms ("expired card requires customer action", "amount exceeds high-value threshold, escalate to human") rather than an opaque model output.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js, Express |
| Database | PostgreSQL (Neon, serverless) via Prisma ORM |
| AI | Google Gemini API (`gemini-3.6-flash`), structured JSON output |
| Real-time | Socket.io |
| Frontend | React (Vite), Tailwind CSS, React Router, Axios |
| Auth-ready patterns | JWT via HTTP-only cookies (reused from prior projects, not yet wired into this app) |

---

## Data Model

- **Payment** — the failed transaction: amount, method, failure reason, retry/notification counters, status
- **Customer** — success/fail history and lifetime value, used as context for the AI's diagnosis
- **AgentDecision** — one row per AI diagnosis: failure type, recoverability score, chosen strategy, confidence, reasoning, alternatives considered
- **PolicyCheck** — one row per deterministic rule evaluated against a decision (7 rules: max retries, hard decline, expired card, recovery window, min retry interval, high value, notification limit)
- **RecoveryAttempt** — a scheduled/executed retry and its outcome
- **AgentState** — the payment's current position in its recovery lifecycle (`ANALYZING` → `DECISION_MADE` → `POLICY_CHECKED` → `ACTION_SCHEDULED`/`COMPLETED`/`ESCALATED`/`STOPPED`)
- **AuditLog** — a flat, timestamped event log of everything that happened to a payment (retry succeeded/failed, customer notified, escalated, stopped)

Together, `AgentDecision` + `PolicyCheck` + `RecoveryAttempt` + `AuditLog` form the complete audit trail the dashboard renders per payment.

---

## How a Decision Is Made

1. **Diagnosis** — Gemini receives the payment's details, the customer's payment history, and prior recovery attempts. It classifies the failure and proposes an action (`retry_now`, `retry_delayed`, `notify_customer`, `escalate`, or `stop`), with a confidence score and reasoning, after explicitly considering and rejecting at least two alternative strategies.

   Failure types are explicitly categorized in the system prompt to avoid ambiguous classification:
   - **Transient/technical** (`network_error`, `bank_timeout`, `temporary_decline`) — safe to retry automatically
   - **Customer-action-required** (`insufficient_funds`, `expired_card`) — retrying blindly won't help; notify instead
   - **Terminal** (`hard_decline`) — non-recoverable; stop

2. **Policy validation** — the proposed action is checked against 7 deterministic rules (e.g., hard declines always stop regardless of what the AI suggests; high-value payments always escalate to a human rather than auto-retry; notifications are rate-limited to avoid spamming the customer). A "failed" check here usually means a rule correctly intervened, not a system error.

3. **Execution** — the approved action runs: a retry is scheduled, the customer is notified, the case is escalated, or recovery is stopped — each persisting its own audit trail entry.

---

## API Endpoints

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/webhooks/payment-failed` | Real gateway entry point — triggers the full agent loop for a payment |
| `POST` | `/payments/simulate-failure` | Dev/demo trigger — builds a gateway-shaped event for testing |
| `POST` | `/payments/:id/recovery/execute` | Executes a scheduled retry attempt; loops the agent again on failure if retries remain |
| `GET` | `/payments` | Lists payments for the dashboard table, optionally filtered by `?status=` |
| `GET` | `/payments/:id` | Full audit trail for one payment — decisions, policy checks, attempts, state, logs |
| `GET` | `/dashboard/stats` | Aggregate counts: total, recovered, escalated, failed, recovery rate |
| `POST` | `/experiments/run` | Runs the RecoverAI-vs-baseline batch experiment |

---

## The Experiment: RecoverAI vs. a Naive Baseline

To validate that the agent's decisions actually add value, `experimentService.js` runs the same batch of simulated payment failures through two arms:

- **RecoverAI** — full agent loop (diagnosis → policy → action)
- **Baseline** — blindly retries every failure up to 3 times, no diagnosis

Both arms see identical payment scenarios (same failure types, amounts, customers) so the comparison is fair. Each arm is scored on revenue recovered, recovery rate, average attempts per payment, and a **cost-adjusted net value** metric that accounts for the operational cost of each action:

```
netValueRecovered = revenueRecovered − (totalRetryAttempts × costPerAttempt + totalNotifications × costPerNotification)
```

This exists because raw ₹ recovered structurally favors brute-force retrying — a system that retries every payment blindly can "accidentally" recover revenue on transient failures the same way a smarter agent does, without being charged for the operational cost (gateway fees, bank-flagging risk, customer friction) of doing so. The net-value metric makes the comparison fair: RecoverAI consistently uses roughly 3–4x fewer attempts per payment than baseline, which matters even in runs where raw recovery rate is close between the two arms.

**A note on methodology:** results vary run-to-run because failure types are drawn randomly per batch, which shifts the mix of retryable vs. notify-only cases. A single 40-payment run is not a fully stable comparison — a fair final number should average several runs or use a larger sample size to let the failure-type distribution converge.

---

## Build Phases

### Backend
1. Payment model, customer model, and failure simulation
2. Gemini-based diagnosis agent with structured JSON output
3. Deterministic policy engine (7 safety/business rules)
4. Full audit trail persistence (`AgentDecision`, `PolicyCheck`, `RecoveryAttempt`, `AuditLog`, `AgentState`)
5. Webhook-driven execution loop, including automatic re-analysis on retry failure
6. Batch experiment framework comparing RecoverAI against a naive baseline
7. Payments-list endpoint with status filtering, for the dashboard
8. Cost-adjusted `netValueRecovered` metric for a fairer experiment comparison

### Frontend
1. Vite + React + Tailwind scaffold, routing shell, API client layer
2. Payments List ("Recovery Inbox") — filterable table with live status, AI action, and confidence per row, plus a "Simulate Failure" control for live demos
3. Payment Detail view — AI reasoning and policy engine checks shown side by side, with a chronological timeline of everything that happened to the payment
4. Dashboard overview — top-level recovery stats
5. Real-time updates via Socket.io — list and detail views update live as the agent processes payments, without manual refresh
6. Demo polish — loading/empty/error states, final visual pass

---

## Key Engineering Decisions Worth Noting

- **LLM proposes, rules dispose.** Keeping the policy engine deterministic and separate from the LLM means every action is explainable and safe by construction, even when the model's confidence or reasoning is off.
- **Explicit failure-type categorization in the prompt.** Early testing showed Gemini would misclassify `bank_timeout` as needing customer notification (its name sounds bank-side rather than transient) purely because the prompt gave no guidance beyond the bare string. Adding an explicit transient/customer-action/terminal categorization fixed this and meaningfully changed the experiment's outcome.
- **Simulating the notification channel.** The first experiment run showed RecoverAI apparently "losing" to the naive baseline — investigation revealed the simulator had no model for what happens after a customer is notified, so RecoverAI's smarter notify decisions were never credited with any chance of success. Adding a modeled self-resolution probability per failure type made the comparison fair.
- **Separating the experiment path from the live/webhook path.** Batch experiments intentionally skip full audit-trail persistence for speed and to avoid polluting demo data with test-run noise; the webhook path persists everything for the dashboard to display.

---

## Setup

**Backend**
```bash
cd backend
npm install
# configure .env with DATABASE_URL (Neon Postgres) and GEMINI_API_KEY
npx prisma generate
npm run dev
```

**Frontend**
```bash
cd frontend
npm install
# configure .env with VITE_API_URL=http://localhost:5000
npm run dev
```