# FlowPilot Studio — Authentication, Dual-Sync Data Persistence & Multi-Channel Messaging Engine Plan

This plan resolves all issues preventing Manual Email/Password and Google sign-up/sign-in from authenticating and saving user data, implements dual-sync persistence across Cloud Firestore and persistent account storage, and ensures every messaging module (Inbox, Broadcasts, Automations, Auto Responders, and WhatsApp Bots) dispatches reliably.

## User Review & Confirmed Decisions

> [!IMPORTANT]
> All three architectural decisions below have been confirmed and will govern the implementation:

- **Confirmed Decision 1 — Instant Access & Save for Both Manual and Google Auth**:
  - Both Manual Email/Password sign-up/sign-in and Google OAuth sign-in immediately activate the user's authenticated workspace without blocking on email verification links.
  - Decouple sensitive Gmail send scopes from initial Google account login so Google Sign-In/Sign-Up popups never get blocked by unverified OAuth scope prompts (while keeping dedicated Gmail OAuth connection available inside Workspace Settings).
  - Include seamless account credential fallback so if a Firebase project has not yet toggled Email/Password in the console, manual sign-up and sign-in still create and authenticate persistent user accounts immediately.
- **Confirmed Decision 2 — Dual-Sync Persistence (Cloud Firestore + Local & Server Account Backup)**:
  - Every user mutation (Contacts, Contact Lists, Automations, Auto Responders, Broadcasts, Pages & Forms, WhatsApp Bots, Inbox Threads, Tasks, Workspace Settings, and Sender Identities) writes to Cloud Firestore when authenticated **and** mirrors instantaneously to per-account local and server-backed storage (`/api/accounts/state`).
  - Eliminate undefined-field payload crashes in Firestore writes and update security rules so authenticated manual and Google users can read and write all workspace collections without permission denials.
- **Confirmed Decision 3 — Live Multi-Channel Dispatch with Built-In Relay Fallback**:
  - All outbound and automated messages across Email, WhatsApp, and SMS attempt live provider delivery first (Gmail OAuth, Resend, SendGrid, Meta Cloud API, Twilio, Termii) using the user's selected sender identity, and automatically fall back to the built-in real-time relay with verifiable delivery receipts if external API credentials are not yet configured.

---

## 1. Overview & Core Concept

- **What It Does**: Provides frictionless Manual (Email/Password) and Google account creation and sign-in, guarantees zero data loss across page reloads or sessions for every workspace entity, and powers a unified multi-channel messaging engine across Email, WhatsApp, and SMS.
- **Target Audience / Persona**: Creators, agencies, coaches, and operators who need their CRM contacts, audience lists, visual workflows, broadcasts, and sender identities saved reliably under their account while dispatching real multi-channel campaigns.
- **Key Value**: Users can sign up or sign in within seconds via Email/Password or Google, create or import contacts, configure sender identities, and run live broadcasts, automations, auto responders, and bots with 100% persistence.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Frictionless Manual & Google Sign-Up / Sign-In**:
     - Clicking **Create Free Account** or **Sign In** opens the authentication modal.
     - Signing up with Full Name, Business/Workspace Name, Email, and Password—or clicking **Continue with Google**—immediately logs the user into their personalized workspace, persists their session, and loads their saved CRM & messaging state.
  2. **Instant Dual-Sync Data Saving**:
     - Adding or importing contacts, creating contact lists with Kill Switch tags, saving visual automation graphs, configuring auto responders, publishing capture pages/forms, or adding sender identities immediately saves to both Cloud Firestore and persistent account storage.
     - Refreshing the browser or signing out and signing back in restores the exact workspace state, lists, contacts, workflows, and sender identities.
  3. **End-to-End Multi-Channel Messaging Engine**:
     - Operators select their active sender identity (Email address, WhatsApp Business number, or SMS Sender ID) in **Workspace Settings**, **Broadcasts**, **Automations**, **Auto Responders**, **WhatsApp Bots**, and **Unified Inbox**.
     - Every dispatch routes through the unified server engine (`/api/messages/dispatch`), logs a verifiable delivery receipt with provider status and timestamp, and respects List Kill Switch rules and Global Unsubscribe/STOP suppression.
- **Visual Identity & Theme**:
  - Maintains the established 60-30-10 architectural palette (60% Anti-Glare Off-White `#F8FAFC` / Deep Slate `#090D16` in Dark Mode, 30% Crisp White `#FFFFFF` / Navy `#0F172A` structural containers with `1px solid` hairline borders, and 10% Cobalt Blue `#2563EB` & Emerald `#047857` action accents).
  - Uses `Plus Jakarta Sans` for display headings, `DM Sans` for scannable controls, and `JetBrains Mono` (`tabular-nums`) for delivery receipts, counters, and timestamps.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Decoupling Account Login from Sensitive Gmail Scopes & Removing the `emailVerified` Write Gate**
  - *Chosen Approach*: Use standard Google identity scopes (`profile`, `email`) for `signInWithGoogle` account login, allow any authenticated user (`request.auth != null`) to read/write their own isolated tenant records in Firestore, and provide a built-in persistent account authenticator when Firebase Email/Password is not enabled in the cloud console.
  - *Why*: Previously, manual Email/Password users had `emailVerified === false` upon sign-up, which caused the app to ignore their authenticated state and blocked all Firestore reads/writes. Additionally, requesting `gmail.send` during basic Google login could trigger OAuth popup blocks.
- **Decision 2: Dual-Sync Storage Engine (Firestore + Per-User Local & Server State)**
  - *Chosen Approach*: Synchronize all 12 workspace collections (`workspace`, `privateProfile`, `members`, `contacts`, `lists`, `automations`, `autoResponders`, `inboxThreads`, `campaigns`, `assets`, `chatbots`, `tasks`, `activities`) to both Firestore and a per-user persistent snapshot in `localStorage` and `/api/accounts/state`.
  - *Why*: Guarantees that even if a cloud write experiences network latency or rule propagation delay, the user's data is saved immediately and restored faithfully on every login and page refresh.
- **Decision 3: Strict Payload Sanitization Before Firestore Mutations**
  - *Chosen Approach*: Strip `undefined` properties and normalize all fields to match schema boundaries before calling Firestore `setDoc` / `updateDoc`.
  - *Why*: Prevents Firebase SDK runtime errors (`Unsupported field value: undefined`) when optional fields like `company`, `dealTitle`, or `customFields` are omitted during contact or campaign creation.

---

## 4. Technical Architecture & Data Strategy

### Architecture & Data Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                     AUTHENTICATION & SESSION LAYER                           │
│  ┌─────────────────────────┐   ┌──────────────────────┐   ┌───────────────┐  │
│  │ Manual Email / Password │   │ Google Sign-In Popup │   │ Gmail OAuth   │  │
│  │ (Firebase Auth + Server │   │ (Standard Profile &  │   │ Connector     │  │
│  │  / Local Account Vault) │   │  Email Identity)     │   │ (gmail.send)  │  │
│  └────────────┬────────────┘   └──────────┬───────────┘   └───────┬───────┘  │
└───────────────┼───────────────────────────┼───────────────────────┼──────────┘
                │                           │                       │
                ▼                           ▼                       │
┌───────────────────────────────────────────────────────────────┐   │
│                DUAL-SYNC WORKSPACE DATA ENGINE                │   │
│  • Active User Session (UID, Email, Display Name, Workspace)  │   │
│  • Payload Sanitizer (Strips undefined & enforces maxLengths) │   │
│  ┌─────────────────────────────┬───────────────────────────┐  │   │
│  │ Cloud Firestore Sync        │ Instant Account Snapshot  │  │   │
│  │ (Real-time onSnapshot +     │ (Per-UID localStorage +   │  │   │
│  │  Owner-Isolated Rules)      │  /api/accounts/state)     │  │   │
│  └─────────────────────────────┴───────────────────────────┘  │   │
└───────────────────────────────┬───────────────────────────────┘   │
                                │                                   │
                                ▼                                   ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                  UNIFIED MULTI-CHANNEL MESSAGING ENGINE                      │
│  ┌────────────┐ ┌────────────┐ ┌─────────────┐ ┌───────────────┐ ┌────────┐  │
│  │   Inbox    │ │ Broadcasts │ │ Automations │ │Auto Responders│ │  Bots  │  │
│  └─────┬──────┘ └─────┬──────┘ └──────┬──────┘ └───────┬───────┘ └───┬────┘  │
│        └──────────────┴───────────────┼────────────────┴─────────────┘       │
│                                       ▼                                      │
│        ┌────────────────────────────────────────────────────────────┐        │
│        │ Server Dispatch Router (/api/messages/dispatch)            │        │
│        │ • Global Unsubscribe / STOP & List Kill Switch Gate        │        │
│        │ • Per-User Sender Identity Resolution (overrideFrom)       │        │
│        │ • Live Providers: Gmail OAuth, Resend, SendGrid,           │        │
│        │   Meta WhatsApp Cloud API, Twilio, Termii + Built-in Relay │        │
│        └────────────────────────────────────────────────────────────┘        │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Interactive Component & State Mapping

- **Authentication Modal & Session Recovery**:
  - `signUpWithEmail` and `signInWithEmail` authenticate via Firebase Auth; if the Firebase project returns `auth/operation-not-allowed` or network errors, the account is seamlessly registered/authenticated against the persistent account store (`/api/accounts/auth` + `localStorage`) so manual sign-up and sign-in always succeed.
  - `signInWithGoogle` uses clean Google identity sign-in (`GoogleAuthProvider` without sensitive scopes) and falls back gracefully if popups are blocked by browser/iframe settings.
  - Active user sessions persist across page reloads and hydrate the user's saved workspace, contacts, lists, automations, broadcasts, auto responders, pages/forms, bots, and sender identities.
- **Dual-Sync CRUD Handlers**:
  - Every create, update, and delete handler in the workspace updates React state immediately, persists the user's snapshot to per-account storage (`localStorage` + `/api/accounts/state`), and writes sanitized payloads to Cloud Firestore.
- **Unified Messaging Engine Verification**:
  - Syncs per-user gateway credentials and sender identities (`UserMessagingIdentity`) between the client and `/api/gateway/config` on login and profile update.
  - Ensures Inbox replies, Broadcast dispatches, Visual Automation workflow runs (immediate and delayed server scheduler jobs), Auto Responders, and WhatsApp Keyword Bots all resolve personalization tokens (`{{first_name}}`, `{{unsubscribe_url}}`), enforce Kill Switch / Global Suppression rules, and return real delivery receipts.
