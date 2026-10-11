import {
  Workspace,
  UserPrivateProfile,
  WorkspaceMember,
  Contact,
  AudienceList,
  Automation,
  AutoResponder,
  InboxThread,
  Campaign,
  CaptureAsset,
  ChatbotFlow,
  TaskItem,
  ActivityLog,
  generateSafeId,
} from '../types';

export interface WorkspaceSnapshot {
  workspace: Workspace;
  privateProfile: UserPrivateProfile;
  members: WorkspaceMember[];
  contacts: Contact[];
  lists: AudienceList[];
  automations: Automation[];
  autoResponders: AutoResponder[];
  inboxThreads: InboxThread[];
  campaigns: Campaign[];
  assets: CaptureAsset[];
  chatbots: ChatbotFlow[];
  tasks: TaskItem[];
  activities: ActivityLog[];
  updatedAt?: string;
}

export interface ActiveAccountSession {
  uid: string;
  email: string;
  displayName: string;
  workspaceName: string;
  provider: 'password' | 'google.com';
  emailVerified: boolean;
  isFirebaseUser: boolean;
}

const ACTIVE_SESSION_KEY = 'fp_active_account_session_v1';
const LOCAL_ACCOUNTS_REGISTRY_KEY = 'fp_local_accounts_registry_v1';
const WORKSPACE_SNAPSHOT_PREFIX = 'fp_workspace_state_v1_';

interface LocalRegistryAccount {
  uid: string;
  email: string;
  displayName: string;
  workspaceName: string;
  password: string;
  provider: 'password' | 'google.com';
  emailVerified: boolean;
  createdAt: string;
}

export function buildDeterministicClientUid(email: string): string {
  const clean = (email || 'user@flowpilot.app').trim().toLowerCase();
  let hash = 2166136261;
  for (let i = 0; i < clean.length; i++) {
    hash ^= clean.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const hex = (hash >>> 0).toString(16).padStart(8, '0');
  const safeEmailSlug = clean.replace(/[^a-z0-9]/g, '_').slice(0, 28);
  return `usr_${safeEmailSlug}_${hex}`;
}

export function getStoredActiveAccountSession(): ActiveAccountSession | null {
  try {
    const raw = localStorage.getItem(ACTIVE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.uid && parsed.email) {
      return parsed as ActiveAccountSession;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveStoredActiveAccountSession(
  session: ActiveAccountSession | null
): void {
  try {
    if (!session) {
      localStorage.removeItem(ACTIVE_SESSION_KEY);
    } else {
      localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(session));
    }
  } catch {
    // Ignore storage errors
  }
}

function getLocalAccountsRegistry(): Record<string, LocalRegistryAccount> {
  try {
    const raw = localStorage.getItem(LOCAL_ACCOUNTS_REGISTRY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveLocalAccountsRegistry(
  registry: Record<string, LocalRegistryAccount>
): void {
  try {
    localStorage.setItem(LOCAL_ACCOUNTS_REGISTRY_KEY, JSON.stringify(registry));
  } catch {
    // Ignore storage errors
  }
}

export function buildStarterWorkspaceSnapshot(
  uid: string,
  email: string,
  displayName: string,
  workspaceName?: string
): WorkspaceSnapshot {
  const cleanName = (displayName || email.split('@')[0] || 'Workspace Owner')
    .trim()
    .slice(0, 100);
  const cleanEmail = (email || 'operator@flowpilot.app').trim().slice(0, 150);
  const cleanWsName = (
    workspaceName && workspaceName.trim()
      ? workspaceName.trim()
      : `${cleanName}'s Workspace`
  ).slice(0, 100);

  const tz =
    (typeof Intl !== 'undefined' &&
      Intl.DateTimeFormat().resolvedOptions().timeZone) ||
    'America/New_York';

  return {
    workspace: {
      id: uid,
      ownerId: uid,
      name: cleanWsName,
      category: 'creator',
      timezone: tz.slice(0, 64),
      currency: 'USD',
      senderName: cleanName,
      whatsappConnected: true,
      smsConnected: true,
      emailConnected: true,
      notifyNewLeads: true,
      notifyCampaigns: true,
    },
    privateProfile: {
      id: 'default',
      ownerId: uid,
      email: cleanEmail,
      replyToEmail: cleanEmail,
      phone: '',
      mailingAddress: '',
      whatsappPhoneId: '',
      smsSenderId: 'FLOWPILOT',
      emailProviderDomain: '',
      whatsappBusinessNumber: '',
      customDomainEmail: '',
      useCustomDomainEmail: false,
      messagingIdentitiesJson: JSON.stringify([
        {
          id: generateSafeId('id_em'),
          channel: 'email',
          label: `${cleanName} Primary Email`,
          value: cleanEmail,
          senderName: cleanName,
          replyToEmail: cleanEmail,
          providerType: 'gmail_oauth',
          verified: true,
          isDefault: true,
        },
      ]),
      gatewayConfigJson: '{}',
    },
    members: [
      {
        id: generateSafeId('mem'),
        workspaceId: uid,
        ownerId: uid,
        memberName: cleanName,
        memberEmail: cleanEmail,
        role: 'owner',
        status: 'active',
      },
    ],
    contacts: [],
    lists: [
      {
        id: generateSafeId('lst'),
        workspaceId: uid,
        ownerId: uid,
        name: 'General Contacts',
        description: 'Primary audience list for leads, subscribers, and customers.',
        category: 'newsletter',
        defaultConsent: 'opted_in',
        defaultTags: ['subscriber'],
        colorAccent: 'emerald',
        killSwitchEnabled: true,
        killSwitchTags: ['Purchased_Course'],
      },
    ],
    automations: [],
    autoResponders: [],
    inboxThreads: [],
    campaigns: [],
    assets: [],
    chatbots: [],
    tasks: [],
    activities: [],
    updatedAt: new Date().toISOString(),
  };
}

export function loadLocalWorkspaceSnapshot(
  uid: string,
  email?: string
): WorkspaceSnapshot | null {
  try {
    if (uid) {
      const rawByUid = localStorage.getItem(`${WORKSPACE_SNAPSHOT_PREFIX}${uid}`);
      if (rawByUid) {
        const parsed = JSON.parse(rawByUid);
        if (parsed && parsed.workspace) return parsed as WorkspaceSnapshot;
      }
    }
    if (email) {
      const emailKey = `${WORKSPACE_SNAPSHOT_PREFIX}email_${email
        .trim()
        .toLowerCase()}`;
      const rawByEmail = localStorage.getItem(emailKey);
      if (rawByEmail) {
        const parsed = JSON.parse(rawByEmail);
        if (parsed && parsed.workspace) return parsed as WorkspaceSnapshot;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function saveLocalWorkspaceSnapshot(
  uid: string,
  email: string,
  snapshot: WorkspaceSnapshot
): void {
  try {
    const payload = JSON.stringify({
      ...snapshot,
      updatedAt: new Date().toISOString(),
    });
    if (uid) {
      localStorage.setItem(`${WORKSPACE_SNAPSHOT_PREFIX}${uid}`, payload);
    }
    if (email) {
      const emailKey = `${WORKSPACE_SNAPSHOT_PREFIX}email_${email
        .trim()
        .toLowerCase()}`;
      localStorage.setItem(emailKey, payload);
    }
  } catch {
    // Ignore storage quota errors
  }
}

export async function fetchServerWorkspaceSnapshot(
  uid: string,
  email?: string
): Promise<WorkspaceSnapshot | null> {
  try {
    const params = new URLSearchParams();
    if (uid) params.set('uid', uid);
    if (email) params.set('email', email.trim().toLowerCase());
    const res = await fetch(`/api/accounts/state?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      if (data?.snapshot && data.snapshot.workspace) {
        return data.snapshot as WorkspaceSnapshot;
      }
    }
  } catch {
    // Fallback to local snapshot
  }
  return null;
}

export async function pushServerWorkspaceSnapshot(
  uid: string,
  email: string,
  snapshot: WorkspaceSnapshot
): Promise<void> {
  try {
    await fetch('/api/accounts/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uid,
        email: (email || '').trim().toLowerCase(),
        snapshot,
      }),
    });
  } catch {
    // Non-fatal if offline; localStorage snapshot is already saved
  }
}

export async function syncAccountWithServer(params: {
  action: 'signup' | 'signin' | 'google' | 'reset_password';
  email: string;
  password?: string;
  newPassword?: string;
  fullName?: string;
  workspaceName?: string;
  uid?: string;
  firebaseVerified?: boolean;
  isFirebaseUser?: boolean;
}): Promise<{
  account: ActiveAccountSession;
  snapshot: WorkspaceSnapshot | null;
  message?: string;
}> {
  const cleanEmail = params.email.trim().toLowerCase();
  const registry = getLocalAccountsRegistry();
  const localExisting = registry[cleanEmail];

  try {
    const res = await fetch('/api/accounts/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: params.action,
        email: cleanEmail,
        password: params.password,
        newPassword: params.newPassword,
        fullName: params.fullName,
        workspaceName: params.workspaceName,
        uid: params.uid || localExisting?.uid,
        firebaseVerified: params.firebaseVerified,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.ok === false) {
      throw new Error(data?.error || 'Authentication failed. Please check your credentials.');
    }

    if (params.action === 'reset_password') {
      if (params.newPassword && localExisting) {
        localExisting.password = params.newPassword;
        registry[cleanEmail] = localExisting;
        saveLocalAccountsRegistry(registry);
      }
      return {
        account: {
          uid: localExisting?.uid || buildDeterministicClientUid(cleanEmail),
          email: cleanEmail,
          displayName: localExisting?.displayName || cleanEmail.split('@')[0],
          workspaceName: localExisting?.workspaceName || 'My Workspace',
          provider: 'password',
          emailVerified: true,
          isFirebaseUser: false,
        },
        snapshot: null,
        message: data.message,
      };
    }

    const srvAcc = data.account;
    const session: ActiveAccountSession = {
      uid: srvAcc.uid || params.uid || buildDeterministicClientUid(cleanEmail),
      email: srvAcc.email || cleanEmail,
      displayName:
        srvAcc.displayName ||
        params.fullName ||
        localExisting?.displayName ||
        cleanEmail.split('@')[0],
      workspaceName:
        srvAcc.workspaceName ||
        params.workspaceName ||
        localExisting?.workspaceName ||
        `${srvAcc.displayName || 'My'}'s Workspace`,
      provider: srvAcc.provider || (params.action === 'google' ? 'google.com' : 'password'),
      emailVerified: true,
      isFirebaseUser: Boolean(params.isFirebaseUser),
    };

    registry[cleanEmail] = {
      uid: session.uid,
      email: session.email,
      displayName: session.displayName,
      workspaceName: session.workspaceName,
      password: params.password || localExisting?.password || '',
      provider: session.provider,
      emailVerified: true,
      createdAt: localExisting?.createdAt || new Date().toISOString(),
    };
    saveLocalAccountsRegistry(registry);
    saveStoredActiveAccountSession(session);

    const serverSnap = (data.snapshot as WorkspaceSnapshot) || null;
    const localSnap = loadLocalWorkspaceSnapshot(session.uid, session.email);
    const resolvedSnap = serverSnap || localSnap;
    if (resolvedSnap) {
      saveLocalWorkspaceSnapshot(session.uid, session.email, resolvedSnap);
    }

    return {
      account: session,
      snapshot: resolvedSnap,
    };
  } catch (err) {
    // If the error was an explicit 401/400 from the server, rethrow it
    if (
      err instanceof Error &&
      (err.message.includes('Invalid email or password') ||
        err.message.includes('Password must be') ||
        err.message.includes('valid email'))
    ) {
      throw err;
    }

    // Offline / local fallback using localStorage registry
    if (params.action === 'signin' && localExisting && localExisting.password) {
      if (
        params.password &&
        localExisting.password !== params.password &&
        !params.firebaseVerified
      ) {
        throw new Error(
          'Invalid email or password. Please verify your credentials or reset your password.'
        );
      }
    }

    const fallbackUid =
      params.uid || localExisting?.uid || buildDeterministicClientUid(cleanEmail);
    const fallbackName =
      params.fullName ||
      localExisting?.displayName ||
      cleanEmail
        .split('@')[0]
        .replace(/[._-]+/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase()) ||
      'Workspace Owner';
    const fallbackWs =
      params.workspaceName ||
      localExisting?.workspaceName ||
      `${fallbackName}'s Workspace`;

    const fallbackSession: ActiveAccountSession = {
      uid: fallbackUid,
      email: cleanEmail,
      displayName: fallbackName,
      workspaceName: fallbackWs,
      provider: params.action === 'google' ? 'google.com' : 'password',
      emailVerified: true,
      isFirebaseUser: Boolean(params.isFirebaseUser),
    };

    registry[cleanEmail] = {
      uid: fallbackSession.uid,
      email: fallbackSession.email,
      displayName: fallbackSession.displayName,
      workspaceName: fallbackSession.workspaceName,
      password: params.password || localExisting?.password || '',
      provider: fallbackSession.provider,
      emailVerified: true,
      createdAt: localExisting?.createdAt || new Date().toISOString(),
    };
    saveLocalAccountsRegistry(registry);
    saveStoredActiveAccountSession(fallbackSession);

    return {
      account: fallbackSession,
      snapshot: loadLocalWorkspaceSnapshot(fallbackSession.uid, fallbackSession.email),
    };
  }
}

/**
 * Strips `undefined` values from any object before writing to Firestore
 * so Firebase SDK never throws `Unsupported field value: undefined`.
 */
export function sanitizeFirestorePayload<T extends Record<string, unknown>>(
  raw: T
): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(raw)) {
    if (val === undefined) continue;
    if (typeof val === 'number' && Number.isNaN(val)) {
      clean[key] = 0;
      continue;
    }
    if (Array.isArray(val)) {
      clean[key] = val.filter((item) => item !== undefined);
      continue;
    }
    clean[key] = val;
  }
  return clean;
}
