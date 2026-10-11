# Email-Only Verification Security & Premium Platform Suite

This plan enforces **strict email-only 6-digit verification code delivery** (ensuring the verification code is never shown on the platform UI or exposed in client API payloads, and is sent exclusively to the user's email inbox) alongside the four confirmed premium capabilities: **A/B Split Testing & Send-Time Optimization**, **Multi-Channel Revenue Attribution & Conversion ROI Analytics**, **Visual Template Studio & Deliverability Checker**, and **Full Workspace Backup Export/Import & Webhook Inspector**.

## User Review & Critical Decisions

> [!IMPORTANT]
> All decisions below reflect your confirmed choices from our clarification step.

- **Confirmed Decision 1 — Strict Email-Only Verification Code (Zero Platform Exposure)**:
  - The 6-digit verification code is generated and stored exclusively on the backend server (`.data/accounts_store.json`) and dispatched only to the user's email address via the Multi-Provider Email Engine (Gmail OAuth, Resend API, SendGrid API, and SMTP).
  - The `/api/accounts/auth` response payload will **never** return the 6-digit code or email body to the browser, and `AuthModal` will **never** render the code on the screen—the user must check their email inbox and enter the 6-digit code to verify and activate their account.
- **Confirmed Decision 2 — Multi-Provider Outbound Verification Email**:
  - The server will deliver verification emails through the active email gateway (Gmail OAuth, Resend API, SendGrid API, Custom SMTP / Nodemailer transport, or configured workspace email connector) and allow users or admins to configure SMTP/API credentials seamlessly.
- **Confirmed Decision 3 — Complete Premium Platform Suite Included**:
  - **A/B Split Testing & Send-Time Optimization**: Auto-pick winning variant (`Variant A` vs. `Variant B`) by Open Rate or Click Rate and dispatch to the remaining audience.
  - **Revenue Attribution & Conversion ROI Analytics**: Track attributed revenue, conversions, revenue per recipient, and ROI across every campaign, automation workflow, and channel (Email, WhatsApp, SMS).
  - **Visual Template Studio & Deliverability Checker**: Pre-built conversion templates with a live 0–100 spam and deliverability auditor.
  - **Full Workspace Backup Export/Import & Webhook Inspector**: 1-click `.json` workspace backup download and restore, plus a live API/webhook payload inspector in Workspace Settings.

---

## 1. Overview & Core Concept

- **What It Does**: Secures account registration so every new user must verify ownership of their email inbox via a confidential 6-digit verification code delivered strictly by email, while equipping the workspace with enterprise A/B split testing, revenue attribution analytics, a visual template & deliverability studio, and full workspace backup/restore.
- **Target Audience / Persona**: Growth marketers, creators, agencies, and E-Commerce teams running multi-channel customer acquisition and retention across Email, WhatsApp, and SMS.
- **Key Value**: True inbox ownership verification on sign-up, higher inbox placement and open rates through deliverability auditing and A/B split testing, and transparent revenue ROI across every channel.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Confidential Email-Only 6-Digit Verification Flow (`AuthModal` & `server.ts`)**:
     - When a user submits **Create Free Account** (or attempts to sign in to an unverified account), the backend generates a confidential 6-digit code, stores its hash/value strictly on the server with a 15-minute expiration, and dispatches the formatted HTML + plain-text verification email to the user's email address.
     - The modal transitions to **Verify Your Email Address**, showing only the masked/target email address (`We sent a 6-digit verification code to your email inbox. Please check your inbox or spam folder and enter the code below`), a 6-digit numeric input, a **Verify Code & Activate Account** button, and a **Resend Code to Email** action—with **zero** code preview on the platform.
  2. **Broadcast A/B Split Testing & Smart Send-Time Optimization (`CampaignsView`)**:
     - Operators can toggle **Enable A/B Split Test**, craft **Variant A** and **Variant B** (subject lines and message bodies), select the **Winning Criterion** (`Highest Open Rate` or `Highest Click Rate`), set the **Test Sample %** (e.g., `20% Variant A · 20% Variant B · 60% Auto-Winner`), and enable **Smart Send-Time Optimization** (`Recipient Local 9:00 AM Peak` or `Immediate`).
  3. **Visual Template Studio & Deliverability / Spam Score Checker (`CampaignsView`)**:
     - Operators can browse curated multi-channel templates (*Product Launch Sequence*, *Abandoned Cart Recovery*, *VIP Webinar Invitation*, *Founder Personal Check-In*, *Winback Offer*) and inspect a live **Deliverability & Compliance Score (0–100)** that audits subject length, spam trigger words, personalization variables (`{{first_name}}`), unsubscribe compliance (`{{unsubscribe_url}}`), and sender domain authentication.
  4. **Multi-Channel Revenue Attribution & Conversion ROI Analytics (`DashboardOverview` & `CampaignsView`)**:
     - Displays attributed revenue, conversion count, revenue-per-recipient (`RPR`), and channel ROI across **Email**, **WhatsApp**, and **SMS**, alongside per-campaign and per-workflow revenue leaderboards and a 1-click **Record Attributed Conversion** action.
  5. **Full Workspace Backup Export/Import & Webhook Inspector (`WorkspaceSettingsView`)**:
     - Operators can export their entire workspace snapshot as a portable `.json` backup file, upload a `.json` backup file to restore all CRM contacts, lists, workflows, broadcasts, and settings in one click, and inspect live inbound/outbound webhook events.
- **Visual Identity & Theme**:
  - *Aesthetic Direction*: High-contrast SaaS workspace following the 60-30-10 color allocation (`#F8FAFC` / `#090D16` canvas, `#FFFFFF` / `#0F172A` single-elevation surfaces with `1px` borders, `#047857` emerald and `#2563EB` cobalt action accents).
  - *Typography*: `Plus Jakarta Sans` / `Outfit` for headings, clean body copy, and `JetBrains Mono` (`font-mono tabular-nums`) for all financial attribution metrics, A/B split ratios, and deliverability scores.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Server-Only Verification Code Storage & Validation**
  - *Chosen Approach*: Keep `verificationCode` exclusively inside `serverAccountsByEmail` on the Express backend and strip `code` and `body` from all HTTP responses.
  - *Why*: Guarantees that the verification code can only be obtained from the recipient's email inbox, never from the platform UI, local storage, or browser DevTools network tab.
- **Decision 2: Multi-Provider Email Dispatch with Nodemailer SMTP + API Support**
  - *Chosen Approach*: Support Gmail OAuth (`gmail.users.messages.send`), Resend API, SendGrid API, and standard SMTP (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`) in `server.ts` as well as workspace-configured email gateway credentials.
  - *Why*: Ensures verification and broadcast emails are delivered straight to the recipient's inbox across any configured email provider.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:
```
┌────────────────────────────────────────────────────────────────────────────┐
│                   FlowPilot Workspace Application (App.tsx)                │
├──────────────────────┬───────────────────────────┬─────────────────────────┤
│       AuthModal      │  Dashboard & Broadcasts   │  WorkspaceSettingsView  │
│  ┌────────────────┐  │  ┌─────────────────────┐  │  ┌───────────────────┐  │
│  │ Strict 6-Digit │  │  │ A/B Split Test &    │  │  │ 1-Click JSON      │  │
│  │ Code Input     │  │  │ Auto-Winner Engine  │  │  │ Workspace Backup  │  │
│  │ (Zero UI Code  │  │  ├─────────────────────┤  │  │ Export & Restore  │  │
│  │  Exposure)     │  │  │ Template Studio &   │  │  ├───────────────────┤  │
│  └───────┬────────┘  │  │ Deliverability      │  │  │ Live Webhook &    │  │
│          │           │  │ Score Auditor       │  │  │ SMTP / API Email  │  │
│          │           │  ├─────────────────────┤  │  │ Gateway Config    │  │
│          │           │  │ Revenue Attribution │  │  └─────────┬─────────┘  │
│          │           │  │ & Channel ROI Grid  │  │            │            │
└──────────┼───────────┴────────────┬──────────────┴────────────┼────────────┘
           ▼                        ▼                           ▼
┌────────────────────────────────────────────────────────────────────────────┐
│   Express Backend Vault & Multi-Provider Email Engine (server.ts)          │
│   • POST /api/accounts/auth (signup / verify_code / resend_code)           │
│     -> Sends 6-digit code ONLY to user's email (Gmail/Resend/SendGrid/SMTP)│
│     -> Never returns code in JSON response                                 │
│   • POST /api/accounts/state & Backup Import/Export Sync                   │
└────────────────────────────────────────────────────────────────────────────┘
```

- **Data Model & State**:
  - **Confidential Verification Payload**: `VerificationEmailDispatchInfo` on the client is sanitized to `{ to: string; subject: string; providerUsed: string; status: string; sentAt: string }` (no `code` or `body` fields).
  - **Campaign A/B & Revenue Attribution Fields**: Campaigns and workflows track attributed revenue, conversions, A/B variant definitions, winning metric (`open_rate` | `click_rate`), and smart send-time preferences, persisted across LocalStorage, Server Storage (`.data/workspaces_store.json`), and Cloud Firestore.
