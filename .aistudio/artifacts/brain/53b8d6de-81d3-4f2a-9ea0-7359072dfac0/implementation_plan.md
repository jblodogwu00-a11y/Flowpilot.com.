# FlowPilot Premium Revenue, A/B Testing, Template Studio & Backup Suite

This plan delivers the final suite of enterprise capabilities to make FlowPilot a complete, high-converting multi-channel CRM and marketing automation platform—combining **A/B Split Testing & Send-Time Optimization**, **Multi-Channel Revenue Attribution & ROI Analytics**, an **Interactive Visual Template Studio & Deliverability Checker**, **Full Workspace Backup Export/Import & API Webhook Inspector**, and **Resilient Cloud Firestore Long-Polling Connectivity**.

## User Review & Critical Decisions

> [!IMPORTANT]
> All product decisions below incorporate your confirmed selections, plus a transport fix for the Cloud Firestore 10-second WebChannel timeout warning.

- **Confirmed Decision 1 — All Four Premium Suites**: We will implement A/B Split Testing & Send-Time Optimization, Revenue Attribution & Conversion ROI Analytics, the Visual Template Studio & Deliverability Checker, and Full Workspace Backup Export/Import & Webhook Inspector.
- **Confirmed Decision 2 — Auto-Pick A/B Winner by Open or Click Rate**: Broadcasts and Automation workflows will support Variant A vs. Variant B testing across a configurable sample percentage (e.g., 20% Variant A, 20% Variant B) and automatically dispatch the winning variant (by Open Rate or Click Rate) to the remaining 60% of the audience.
- **Confirmed Decision 3 — Full Revenue & Conversion Attribution**: Overview and Broadcasts views will calculate and display attributed revenue, conversion ROI, average revenue per recipient, and pipeline deal value across individual campaigns, automation workflows, and channels (Email, WhatsApp, SMS).
- **Technical Fix — Cloud Firestore Long-Polling & Silent Telemetry**: Configure `initializeFirestore` with `experimentalAutoDetectLongPolling: true` and `setLogLevel('silent')` so containerized iframe environments never emit 10-second WebChannel timeout warnings while maintaining seamless Dual-Sync persistence.

---

## 1. Overview & Core Concept

- **What It Does**: Elevates FlowPilot from a multi-channel messaging workspace into a full revenue attribution and optimization platform where marketers can design spam-checked templates, run automated A/B split tests, attribute real pipeline and checkout revenue to specific broadcasts and workflows, and export/import full workspace backups or inspect live API webhooks.
- **Target Audience / Persona**: Creators, growth marketers, agencies, and E-Commerce operators managing multi-channel customer journeys across Email, WhatsApp, and SMS.
- **Key Value**: Eliminates guesswork before sending (Deliverability & Spam Checker + A/B Split Testing), proves exact financial return after sending (Revenue Attribution by Campaign, Workflow, and Channel), and guarantees portable data ownership (1-Click Full Workspace JSON Backup & Restore).

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Broadcast & Automation A/B Split Testing & Send-Time Optimization**:
     - Inside the Broadcast composer (`CampaignsView`), operators can toggle **Enable A/B Split Test**, define **Variant A** (Subject + Message Body) and **Variant B** (Alternate Subject + Message Body), choose the **Winning Metric** (`Open Rate` or `Click Rate`), set the **Sample Split Size** (e.g., `20% A / 20% B / 60% Winner`), and enable **Smart Send-Time Optimization** (recipient local morning/afternoon peak window).
     - Clicking **Run A/B Split & Dispatch** evaluates Variant A vs. Variant B performance, crowns the winning variant with clear tabular metrics, and dispatches the winner to the remaining audience.
  2. **Multi-Channel Revenue Attribution & Conversion ROI Analytics**:
     - On the **Overview Dashboard** (`DashboardOverview`) and **Broadcasts** (`CampaignsView`), a dedicated **Revenue Attribution & Conversion ROI Matrix** breaks down attributed revenue, conversion count, revenue per recipient, and ROI across **Email**, **WhatsApp**, and **SMS**, as well as top-performing campaigns and automated workflows.
     - Operators can also record or simulate attributed conversions (`+$ Revenue`) directly on any sent Broadcast or active Automation to see real-time ROI updates.
  3. **Visual Template Studio & Deliverability / Spam Checker**:
     - Inside **Broadcasts** and **Automations**, operators can open the **Visual Template Studio** to pick from curated, high-converting multi-channel blueprints (*VIP Product Launch*, *Abandoned Checkout Recovery*, *Webinar & Live Event Sequence*, *Founder Personal Check-In*, *Flash Offer Countdown*, *Re-Engagement Winback*) and run a real-time **Deliverability & Spam Score Audit** (checking subject length, spam trigger words, personalization tags, unsubscribe compliance, and sender authentication).
  4. **Full Workspace Backup Export/Import & Live Webhook Inspector**:
     - Inside **Workspace & Auth Settings** (`WorkspaceSettingsView`), a new **Backup, Restore & API Webhook Inspector** panel lets operators download a complete `.json` snapshot of their entire workspace (Contacts, Lists, Automations, Auto Responders, Broadcasts, Pages, Bots, Tasks, and Sender Identities), restore/import a `.json` backup file with one click, and inspect or test live inbound/outbound webhook payloads.
- **Visual Identity & Theme**:
  - *Aesthetic Direction*: High-craft SaaS workspace adhering to the 60-30-10 color allocation (`#F8FAFC` / `#090D16` neutral canvas, `#FFFFFF` / `#0F172A` single-elevation structural surfaces with `1px` borders, `#047857` emerald and `#2563EB` cobalt action accents).
  - *Typography & Hierarchy*: `Plus Jakarta Sans` / `Outfit` for section headings, clean body copy for scannable controls, and `JetBrains Mono` (`font-mono tabular-nums`) for all A/B split percentages, deliverability scores, and revenue attribution figures.
  - *Anti-Slop & Zero-Pill Discipline*: Unboxed inline metadata separated by `·`, single-elevation cards without nested card clutter or thick left borders, and functional interactive controls on every view.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Integrated A/B Split Engine & Deliverability Audit inside Broadcasts**
  - *Chosen Approach*: Embed the A/B Split Test configurator, Smart Send-Time selector, and Visual Template Studio + Spam Deliverability Checker directly into the Broadcasts studio and modal rather than fragmenting them into disconnected top-level tabs.
  - *Why*: Marketers configure templates, check deliverability scores, and set up A/B variants at the exact moment they craft a broadcast.
- **Decision 2: Resilient Cloud Firestore Long-Polling + 3-Tier Backup Export**
  - *Chosen Approach*: Switch `src/firebase.ts` from default `getFirestore` WebChannel streaming to `initializeFirestore` with `experimentalAutoDetectLongPolling: true` and `setLogLevel('silent')`, paired with 1-click JSON Workspace Export/Import in Settings.
  - *Why*: Eliminates the 10-second WebChannel timeout error in proxied preview environments while giving users both automatic cloud/server persistence and portable file backups.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:
```
┌────────────────────────────────────────────────────────────────────────────┐
│                   FlowPilot Workspace Application (App.tsx)                │
├──────────────────────┬───────────────────────────┬─────────────────────────┤
│  DashboardOverview   │       CampaignsView       │  WorkspaceSettingsView  │
│  ┌────────────────┐  │  ┌─────────────────────┐  │  ┌───────────────────┐  │
│  │ Revenue & ROI  │  │  │ A/B Split Test &    │  │  │ 1-Click JSON      │  │
│  │ Attribution    │  │  │ Auto-Winner Engine  │  │  │ Workspace Backup  │  │
│  │ Matrix (Email, │  │  ├─────────────────────┤  │  │ Export & Restore  │  │
│  │ WhatsApp, SMS) │  │  │ Visual Template     │  │  ├───────────────────┤  │
│  ├────────────────┤  │  │ Studio & Spam/      │  │  │ Live API &        │  │
│  │ Campaign &     │  │  │ Deliverability      │  │  │ Webhook Payload   │  │
│  │ Workflow ROI   │  │  │ Score Checker       │  │  │ Inspector         │  │
│  └────────────────┘  │  └─────────────────────┘  │  └───────────────────┘  │
└──────────┬───────────┴─────────────┬─────────────┴────────────┬────────────┘
           │                         │                          │
           ▼                         ▼                          ▼
┌────────────────────────────────────────────────────────────────────────────┐
│   Dual-Sync Persistence & Multi-Channel Delivery Engine                    │
│   • Long-Polling Firestore SDK (experimentalAutoDetectLongPolling: true)   │
│   • Express Server Vault (.data/accounts_store.json & workspaces_store)    │
│   • /api/messages/deliver + /api/accounts/state + /api/webhooks/inbound    │
└────────────────────────────────────────────────────────────────────────────┘
```

- **Data Model & State**:
  - **A/B Split & Revenue Metadata**: Extend campaign runtime state and persistence with optional A/B variant metadata (`abTestEnabled`, `variantBSubject`, `variantBBody`, `winnerMetric: 'open_rate' | 'click_rate'`, `winningVariant: 'A' | 'B'`, `smartSendTimeWindow`, `attributedRevenue`, `conversionsCount`) stored seamlessly in the workspace snapshot and synced to Firestore.
  - **Deliverability & Spam Evaluator**: Deterministic client-side analyzer scoring subject line length, personalization merge tags (`{{first_name}}`), unsubscribe link presence (`{{unsubscribe_url}}`), spam trigger phrase detection, and sender identity verification on a 0–100 scale with actionable fixes.
  - **Full Workspace Backup Export/Import**: Uses `WorkspaceSnapshot` from `accountPersistenceService.ts` to serialize all 12 workspace collections into a timestamped `.json` download and validate/hydrate imported `.json` backups directly into React state, LocalStorage, Server Storage (`/api/accounts/state`), and Cloud Firestore.
