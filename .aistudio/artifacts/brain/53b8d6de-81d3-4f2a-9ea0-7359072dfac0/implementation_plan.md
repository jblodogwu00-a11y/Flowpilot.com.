# Live Multi-Channel Message Delivery & Real-Time Gateway Automation Plan

This plan ensures that all automated workflows, auto-responders, chatbots, campaigns, and manual messages created in FlowPilot go live in real-time to your leads across **Email**, **WhatsApp**, and **SMS** via your connected gateways.

---

## 1. Overview of the Live Messaging Architecture

FlowPilot already possesses a unified multi-channel messaging engine that routes messages between:
1. **Visual Automation Workflows**: Real-time action nodes (`send_email`, `send_whatsapp`, `send_sms`) with step delays, conditions, and dynamic personalization (`{{first_name}}`, `{{company}}`, `{{list_name}}`).
2. **Auto-Responders**: Instant keyword-based replies triggered when an inbound message or webhook arrives.
3. **Conversational WhatsApp Chatbots**: Keyword-triggered menu workflows and immediate live responses.
4. **Broadcast Campaigns**: List-targeted multi-channel email, SMS, and WhatsApp broadcasts.
5. **Direct 1-on-1 Inbox**: Immediate live replies sent to customer threads.

When you connect your gateway credentials, messages are delivered directly through the live provider APIs into the lead's real inbox, phone, or WhatsApp chat.

---

## 2. Channel Gateways Supported

### A. Email Gateways
- **Google Workspace Gmail API (OAuth Direct)**: Sends directly from your authenticated Google Workspace / Gmail account.
- **Resend Transactional Email API**: Direct REST API integration with verified custom sender domains (`re_...`).
- **SendGrid Email API**: Production high-volume email delivery with API key authentication (`SG...`).
- **Custom SMTP (Nodemailer)**: Universal support for Postmark, AWS SES, Mailgun, Brevo, or custom SMTP servers (Host, Port, User, Password, TLS/SSL).
- **FlowPilot Verified Relay**: Built-in verified delivery relay fallback for instant prototyping without upfront API configuration.

### B. WhatsApp Gateways
- **Meta WhatsApp Business Cloud API**: Direct official Meta Cloud API delivery using Phone Number ID and System User Access Token.
- **Twilio WhatsApp Business Gateway**: Direct Twilio WhatsApp sandbox and production numbers (`whatsapp:+14155238886` or registered business numbers).
- **UltraMsg / Evolution Gateway**: QR-code linked WhatsApp web instance API for direct phone-paired automation.
- **Direct WhatsApp Bridge (`wa.me`)**: 1-click launch bridge for immediate operator-to-lead verification.

### C. SMS Gateways
- **Twilio Programmable SMS**: High-deliverability carrier SMS worldwide using Account SID, Auth Token, and Twilio sender numbers or Alphanumeric Sender IDs.
- **Termii Carrier SMS**: High-delivery SMS across Africa and emerging markets with registered Sender IDs.
- **Africa's Talking SMS**: Direct telco gateway across Kenya, Nigeria, Uganda, and regional telcos.
- **FlowPilot Carrier Relay**: Built-in verified carrier relay fallback.

---

## 3. Real-Time Automation Execution Flow

1. **Lead Arrival Trigger**:
   - A visitor submits a Lead Magnet, Landing Page form, or Popup (`/p/:slug` or embedded widget).
   - An external CRM or ad form sends a `POST /api/leads/capture` webhook.
   - A contact is imported via CSV or added manually in the Contacts CRM.
2. **Contact & List Alignment**:
   - The contact is saved in the workspace database under the target Contact List.
   - List Kill Switch tags are evaluated (if the contact already holds an opt-out tag like `Purchased_Course` or `unsubscribed`, follow-up sequences are safely bypassed).
3. **Instant Automated Execution**:
   - For zero-delay steps: The action node executes immediately via `POST /api/messages/deliver`.
   - The message body is personalized with the lead's real name, company, email/phone, and a 1-click unsubscribe URL.
   - The connected gateway API executes the HTTP request to Meta, Twilio, Resend, SendGrid, or SMTP.
   - A `MessageDeliveryReceipt` is generated, logging the carrier provider, timestamp, status (`delivered` or `dispatched_relay`), and receipt ID.
4. **Delayed Step Scheduling**:
   - For steps with wait timers (e.g., wait 2 hours or send tomorrow at 9 AM), jobs are enqueued in the background scheduler (`/api/scheduler/enqueue`).
   - The background scheduler continuously evaluates due jobs and dispatches them in real-time through the connected gateway when the delay elapses.

---

## 4. Key Enhancements to Be Implemented

### Phase 1: Gateway Connectivity & Live Verification Center
- Add an interactive **"Live Gateway Connection & Test Hub"** accessible in both **Workspace Settings** and within the **Automations** and **Auto-Responders** builders.
- Allow operators to:
  - Toggle between provider modes for Email, WhatsApp, and SMS.
  - Input API keys, tokens, and sender IDs (stored securely in the encrypted workspace profile).
  - Check live connection status with a single "Test Gateway Connection" button.
  - Send an instant **Live Test Dispatch** to their own email, WhatsApp, or phone number to verify real delivery.

### Phase 2: Automation & Auto-Responder Live Dispatch Assurance
- Guarantee that all active automations trigger real-time dispatch upon new lead creation (both from public capture pages and manual CRM entries).
- Add a visible **"Live Delivery Indicator"** on each workflow node (showing which connected gateway will fire: e.g., `Meta Cloud API`, `Resend`, `Twilio SMS`).
- Provide a 1-click **"Run Live Test to My Phone/Email"** button in the Workflow Canvas header and Auto-Responder modal so operators can test the exact lead experience before enrolling their audience.

### Phase 3: Outbound Delivery Receipts & Activity Audit Log
- Enhance the Delivery Receipts table in Automations (`Queue & Dispatches` tab) and Inbox so every live outgoing message displays:
  - Lead recipient (email or phone)
  - Selected channel (WhatsApp, Email, SMS)
  - Provider used (`Meta WhatsApp Cloud API`, `Twilio SMS`, `Google Workspace Gmail`, etc.)
  - Real timestamp and delivery receipt confirmation ID
  - Direct message preview and unsubscribe/tracking link
- Ensure real-time inbox thread synchronisation so all sent automated messages appear in the lead's chat thread.

---

## 5. Verification & Acceptance Criteria
- Run TypeScript compilation checks (`npx tsc --noEmit`) to ensure clean typing.
- Test sending a live test email via the connected provider.
- Test sending a live test WhatsApp and SMS message.
- Verify that creating an automation with an action node automatically triggers the dispatch upon lead enrollment.
- Confirm that auto-responder keywords trigger instant live replies.
