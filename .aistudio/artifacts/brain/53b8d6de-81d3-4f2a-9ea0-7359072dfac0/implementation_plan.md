# Production Go-Live & Launch Readiness Architecture

This plan completes the final production-readiness pillars required to take the omnichannel marketing, CRM, and automation platform live: public shareable lead capture & funnel pages with external webhook ingestion, global unsubscribe & `STOP` opt-out suppression enforcement across all channels, real-time email open and link click tracking endpoints, and per-user sender identity selection inside Broadcasts and Automations.

## User Review & Critical Decisions

> [!IMPORTANT]
> All four production-readiness pillars confirmed in your answers are included in this specification with zero feature pruning:

- **Confirmed Decision 1 — Full Launch-Readiness Scope**: Build all four pillars: (1) Public shareable pages and live form webhook endpoint, (2) Auto unsubscribe links and `STOP` opt-out enforcement, (3) Live email open and link click tracking endpoints, and (4) Sender identity selector in Broadcasts and Automations.
- **Confirmed Decision 2 — Automatic Public Lead Ingestion Flow**: When an external visitor submits a public landing page, sales funnel step, or embedded HTML form, the platform will automatically create/update the lead in the CRM, assign them to the target Contact List, and immediately trigger all active Automations and Auto Responders linked to that list.
- **Confirmed Decision 3 — Global Multi-Channel Suppression**: When a contact clicks an unsubscribe link (`{{unsubscribe_url}}`) or replies `STOP` / `UNSUBSCRIBE`, the platform enforces global suppression across all channels (`consentStatus: 'unsubscribed'` plus `'unsubscribed'` / `'suppressed'` tags), blocking outbound Broadcasts, Automations, and Auto Responders from messaging that contact until they explicitly re-opt in.

---

## 1. Overview & Core Concept

- **What It Does**: Transforms the studio into a complete end-to-end production SaaS platform where external leads can visit shareable public URLs or submit embedded forms on external websites, enter automated multi-channel sequences dispatched from the user's chosen sender identity, track real-time email opens and link clicks, and honor one-click unsubscribes and inbound `STOP` keywords automatically.
- **Target Audience / Persona**: Creators, agencies, coaches, and growth operators running live multi-channel acquisition funnels, newsletters, and WhatsApp/SMS automation pipelines.
- **Key Value**: Closes the loop between external traffic acquisition (public pages & embedded forms), compliant multi-identity message delivery, and verifiable engagement telemetry (opens, clicks, and opt-outs).

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Public Shareable Lead Capture & Funnel View (`?capture=<assetId>` & `?funnel=<funnelId>`)**:
     - Operators can click **Open Public Live Link** or **Copy Shareable URL** on any Landing Page, Lead Form, or Sales Funnel.
     - Opening the shareable URL renders a distraction-free, full-viewport public landing page or multi-step funnel without the internal workspace sidebar.
     - When a visitor submits the form (or posts from an external website to `/api/leads/capture`), their submission is queued and synced into the workspace CRM, enrolled in the linked Contact List, and triggers active list Automations and Auto Responders in real time.
  2. **Per-User Sender Identity Selection in Broadcasts & Automations**:
     - Inside the **Broadcast Composer** and **Automation Message Node Editor**, operators see a **Send From Identity** selector populated with all of their saved account identities for the chosen channel (WhatsApp Business numbers, Email addresses, SMS Sender IDs), defaulting to their starred primary identity.
  3. **One-Click Unsubscribe Page (`?unsubscribe=<emailOrPhone>`) & Inbound `STOP` Enforcement**:
     - Every outbound email/message resolves `{{unsubscribe_url}}` to a live one-click unsubscribe URL.
     - Clicking the link opens a clean confirmation view and records a global opt-out event; replying `STOP`, `UNSUBSCRIBE`, or `CANCEL` via inbound webhook automatically flips the contact to `unsubscribed`, halts active scheduled jobs for that contact, and logs the compliance event.
  4. **Live Open & Click Tracking Telemetry (`/api/track/open`, `/api/track/click`)**:
     - Outbound emails automatically include a 1x1 tracking pixel URL and tracked link wrappers (plus a one-click **Test Open / Click Event** trigger in Campaign and Automation telemetry drawers), syncing real-time open and click counts back to the workspace campaigns and contact engagement history.
- **Visual Identity & Theme**:
  - *Aesthetic Direction*: High-craft SaaS operational workspace paired with editorial-grade public landing page layouts.
  - *Color Palette & Mood*: Disciplined 60-30-10 color allocation — 60% neutral canvas (`#F8FAFC` light / `#090D16` dark), 30% structural surfaces (`#FFFFFF` / `#111827` with `1px solid` hairline borders), and 10% semantic accent budget (`#10B981` emerald for live delivery and opt-in states, `#F59E0B` amber for scheduled/warning states, `#E11D48` rose for global suppression/opt-out states).
  - *Typography & Hierarchy*: `Plus Jakarta Sans` for display headings and navigation structure, `DM Sans` for body copy, and `JetBrains Mono` (`tabular-nums`) for all delivery counters, open/click rates, and webhook timestamps.
  - *Component Styling & Layout*: Single-elevation surfaces with clean hairline dividers, unboxed metadata separated by middle dots (`·`), and single-line action controls (`whitespace-nowrap shrink-0`).
- **Interactive Feedback & Motion**:
  - Instant copy-to-clipboard confirmation on shareable public links and embed snippets, live toast notifications when external leads or tracking events arrive, and immediate visual badge updates when a contact is globally suppressed.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Server-Backed Inbound Lead & Tracking Queue with Authenticated Workspace Sync**
  - *Chosen Approach*: Expose public CORS-enabled endpoints (`/api/leads/capture`, `/api/track/open`, `/api/track/click`, `/api/unsubscribe`) on the Express server that accept unauthenticated external visitor requests, validate and sanitize payloads, and stream them to the active workspace client via a consumable synchronization loop (matching the pattern used for `/api/webhooks/inbound`) so the authenticated client writes to Firestore under strict owner security rules.
  - *Why*: Firestore security rules strictly require `request.auth.uid == ownerId` to protect PII. Buffering external public form submissions, tracking pixels, and unsubscribe clicks through the backend API and syncing them via the authenticated workspace session preserves zero-trust Firestore security while supporting real external traffic and embedded HTML forms.
  - *Alternatives Considered*: Opening Firestore collections to unauthenticated public writes was rejected because it violates PII isolation and exposes the database to poisoning attacks.
- **Decision 2: Global Cross-Channel Suppression Gate inside the Delivery Service**
  - *Chosen Approach*: Enforce a central pre-dispatch suppression check inside `deliverChannelMessage` and Broadcast/Automation runners so any contact whose `consentStatus === 'unsubscribed'` or whose address/phone is on the global suppression list is blocked before hitting external provider APIs (except when an operator explicitly sends a manual 1-to-1 transactional reply if permitted, though per your confirmed choice we enforce strict global suppression across all channels).
  - *Why*: Guarantees compliance across Broadcasts, Automations, Auto Responders, and Bots from a single source of truth.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### Architecture & Component Diagram

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│                     PUBLIC VISITORS & EXTERNAL RECIPIENTS                         │
│  ┌─────────────────────────┐  ┌─────────────────────────┐  ┌───────────────────┐  │
│  │ Public Landing / Funnel │  │ Live Email Open & Click │  │ One-Click Unsub & │  │
│  │ (?capture / ?funnel) &  │  │ Tracking Endpoints      │  │ Inbound STOP      │  │
│  │ Embedded HTML Forms     │  │ /api/track/open & click │  │ /api/unsubscribe  │  │
│  └────────────┬────────────┘  └────────────┬────────────┘  └─────────┬─────────┘  │
└───────────────┼───────────────────────────┼─────────────────────────┼────────────┘
                │ POST /api/leads/capture   │ GET /api/track/*        │ POST/GET
                ▼                           ▼                         ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│                         EXPRESS BACKEND (server.ts)                               │
│  • Public Lead Capture Queue (/api/leads/capture) with CORS for external embeds   │
│  • Open (1x1 GIF) & Click Redirect Tracker (/api/track/open, /api/track/click)    │
│  • Global Unsubscribe & STOP Keyword Processor (/api/unsubscribe, /api/webhooks)  │
│  • Multi-Provider Dispatch Engine + Per-User Sender Identity Override             │
└───────────────────────────────────────────┬───────────────────────────────────────┘
                                            │ Consumable Event Sync (4s Poll)
                                            ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│                    AUTHENTICATED WORKSPACE CLIENT (React + Firestore)             │
│  ┌─────────────────────────┐  ┌─────────────────────────┐  ┌───────────────────┐  │
│  │ CaptureAssetsView &     │  │ CampaignsView &         │  │ Global Compliance │  │
│  │ PublicPageRenderer      │  │ AutomationsView         │  │ & Suppression Gate│  │
│  │ • Auto-create CRM Lead  │  │ • Per-User Identity     │  │ • Marks Contact   │  │
│  │ • Assign Target List    │  │   Selector Dropdown     │  │   Unsubscribed    │  │
│  │ • Trigger Active Flows  │  │ • Live Open/Click Sync  │  │ • Ejects Jobs     │  │
│  └─────────────────────────┘  └─────────────────────────┘  └───────────────────┘  │
└───────────────────────────────────────────────────────────────────────────────────┘
```

### Data Model & State

- **Public Lead Capture Event**: `{ id, assetId, assetName, targetList, fullName, email, phone, company, customTags, automationIdToTrigger, createdAt, consumed }`
- **Tracking & Compliance Event**: `{ id, type: 'open' | 'click' | 'unsubscribe', campaignId, automationId, recipient, targetUrl, reason, createdAt, consumed }`
- **WorkflowNode & Campaign Sender Identity Override**: Extend `WorkflowNode.config` and `Campaign` dispatch state with optional `senderIdentityId?: string` and `overrideFromIdentity?: string` so any saved `UserMessagingIdentity` can be selected per Broadcast or Automation step.

### Interactive Component & State Mapping

1. **Public Shareable Lead Capture & Funnel Renderer**:
   - Reads URL query parameters (`?capture=<assetId>`, `?funnel=<funnelId>`, or `?unsubscribe=<recipient>`) on boot or via an in-app **Launch Public View** mode switcher.
   - Submitting the public form posts to `/api/leads/capture`, displays the configured confirmation state or advances to the next funnel step, creates the contact in the target Contact List, and triggers active list Automations and Auto Responders.
   - Updates embedded HTML form snippets in Lead Capture Studio so they post directly to `${window.location.origin}/api/leads/capture`.
2. **Sender Identity Selector in Broadcasts & Automations**:
   - In **Broadcasts**, adds a **Send From Identity** dropdown above the message editor that lists all saved `UserMessagingIdentity` records matching the active channel (`email`, `whatsapp`, `sms`) and passes `overrideFromIdentity` into both live test sends and full campaign dispatches.
   - In **Automations**, adds a **Send From Identity** dropdown inside the Message Action Node configuration panel (`send_email`, `send_whatsapp`, `send_sms`) and persists `senderIdentityId` / `overrideFromIdentity` in `node.config`, passing it to `deliverChannelMessage` and `enqueueScheduledAutomationJobs`.
3. **Global Suppression & Auto-Unsubscribe Enforcement**:
   - Replaces `{{unsubscribe_url}}` in all outbound messages with `${window.location.origin}/?unsubscribe=${encodeURIComponent(recipient)}&campaignId=${encodeURIComponent(campaignId)}`.
   - When an unsubscribe event or inbound `STOP` / `UNSUBSCRIBE` webhook arrives, automatically updates matching contacts to `consentStatus: 'unsubscribed'`, adds `'unsubscribed'` and `'suppressed'` tags, increments the campaign's `unsubscribedCount`, cancels any queued/waiting server scheduler jobs for that contact, and blocks future `deliverChannelMessage` calls to that contact across all channels.
4. **Live Open & Click Tracking Synchronization**:
   - Exposes `GET /api/track/open` (returns a transparent `1x1` GIF and records an open event) and `GET /api/track/click` (records a click event and redirects to the target URL).
   - Polls and consumes tracking events in the workspace, automatically incrementing `openedCount` and `clickedCount` on the corresponding `Campaign` and appending `'opened_email'` / `'clicked_link'` engagement tags on the `Contact` so downstream Automation condition nodes (`opened_email`, `clicked_link`) evaluate accurately in real time.
