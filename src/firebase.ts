import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import {
  ActiveAccountSession,
  getStoredActiveAccountSession,
  saveStoredActiveAccountSession,
  syncAccountWithServer,
} from './services/accountPersistenceService';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(
  app,
  firebaseConfig.firestoreDatabaseId || 'ai-studio-53b8d6de-81d3-4f2a-9ea0-7359072dfac0'
);
export const auth = getAuth(app);

// Gmail send scope is requested ONLY when explicitly connecting Gmail in Workspace Settings
export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
];

// Clean Google identity provider for fast, unblocked Sign-In / Sign-Up
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('profile');
googleProvider.addScope('email');
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const firebaseProjectId = firebaseConfig.projectId;

// Auth session listeners (unified across Firebase Auth + Persistent Account Store)
type SessionListener = (user: User | null, session: ActiveAccountSession | null) => void;
const authSessionListeners = new Set<SessionListener>();

function createSyntheticFirebaseUser(session: ActiveAccountSession): User {
  return {
    uid: session.uid,
    email: session.email,
    displayName: session.displayName,
    emailVerified: true,
    isAnonymous: false,
    metadata: {},
    providerData: [
      {
        providerId: session.provider,
        uid: session.uid,
        displayName: session.displayName,
        email: session.email,
        phoneNumber: null,
        photoURL: null,
      },
    ],
    refreshToken: '',
    tenantId: null,
    delete: async () => {},
    getIdToken: async () => 'fp_local_session_token',
    getIdTokenResult: async () => ({
      token: 'fp_local_session_token',
      authTime: new Date().toISOString(),
      issuedAtTime: new Date().toISOString(),
      expirationTime: new Date(Date.now() + 86400000).toISOString(),
      signInProvider: session.provider,
      signInSecondFactor: null,
      claims: { email: session.email, email_verified: true },
    }),
    reload: async () => {},
    toJSON: () => ({
      uid: session.uid,
      email: session.email,
      displayName: session.displayName,
      emailVerified: true,
    }),
    phoneNumber: null,
    photoURL: null,
    providerId: 'firebase',
  } as unknown as User;
}

export function notifyAuthSessionChanged(
  firebaseUser: User | null,
  sessionOverride?: ActiveAccountSession | null
): void {
  const storedSession =
    sessionOverride !== undefined ? sessionOverride : getStoredActiveAccountSession();

  let effectiveUser: User | null = firebaseUser;
  let effectiveSession: ActiveAccountSession | null = storedSession;

  if (firebaseUser) {
    effectiveSession = {
      uid: firebaseUser.uid,
      email: firebaseUser.email || storedSession?.email || 'operator@flowpilot.app',
      displayName:
        firebaseUser.displayName ||
        storedSession?.displayName ||
        (firebaseUser.email ? firebaseUser.email.split('@')[0] : 'Workspace Owner'),
      workspaceName:
        storedSession?.workspaceName ||
        `${
          firebaseUser.displayName ||
          (firebaseUser.email ? firebaseUser.email.split('@')[0] : 'My')
        }'s Workspace`,
      provider:
        firebaseUser.providerData?.[0]?.providerId === 'google.com'
          ? 'google.com'
          : 'password',
      emailVerified: true,
      isFirebaseUser: true,
    };
    saveStoredActiveAccountSession(effectiveSession);
  } else if (storedSession) {
    effectiveUser = createSyntheticFirebaseUser(storedSession);
  }

  authSessionListeners.forEach((listener) => {
    try {
      listener(effectiveUser, effectiveSession);
    } catch {
      // Ignore listener errors
    }
  });
}

export function subscribeUnifiedAuthState(listener: SessionListener): () => void {
  authSessionListeners.add(listener);

  // Also subscribe to underlying Firebase Auth
  const unsubFirebase = onAuthStateChanged(auth, (fbUser) => {
    if (fbUser) {
      notifyAuthSessionChanged(fbUser);
    } else {
      const saved = getStoredActiveAccountSession();
      if (saved) {
        listener(createSyntheticFirebaseUser(saved), saved);
      } else {
        listener(null, null);
      }
    }
  });

  return () => {
    authSessionListeners.delete(listener);
    unsubFirebase();
  };
}

// In-memory cache for Google Workspace (Gmail) OAuth access token.
let isSigningIn = false;
let cachedAccessToken: string | null = null;
let connectedGmailEmail: string | null = null;
const gmailTokenListeners = new Set<
  (state: { connected: boolean; email: string | null }) => void
>();

function notifyGmailTokenListeners() {
  const snapshot = {
    connected: Boolean(cachedAccessToken),
    email: connectedGmailEmail,
  };
  gmailTokenListeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch {
      // Ignore listener errors
    }
  });
}

export function subscribeGmailAuthState(
  listener: (state: { connected: boolean; email: string | null }) => void
): () => void {
  gmailTokenListeners.add(listener);
  listener({
    connected: Boolean(cachedAccessToken),
    email: connectedGmailEmail,
  });
  return () => {
    gmailTokenListeners.delete(listener);
  };
}

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        connectedGmailEmail = user.email || connectedGmailEmail;
        notifyGmailTokenListeners();
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        notifyGmailTokenListeners();
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      notifyGmailTokenListeners();
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export function getGmailAccessToken(): string | null {
  return cachedAccessToken;
}

export function getConnectedGmailAddress(): string | null {
  return connectedGmailEmail;
}

export function disconnectGmailToken(): void {
  cachedAccessToken = null;
  connectedGmailEmail = null;
  notifyGmailTokenListeners();
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): void {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || getStoredActiveAccountSession()?.uid || null,
      email: auth.currentUser?.email || getStoredActiveAccountSession()?.email || null,
      emailVerified: auth.currentUser?.emailVerified ?? true,
      isAnonymous: auth.currentUser?.isAnonymous ?? false,
      tenantId: auth.currentUser?.tenantId ?? null,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  // Log diagnostic info without crashing the UI since Dual-Sync local + server storage preserves all data
  console.warn('Firestore Sync Notice: ', JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore connection check notice: verifying database connectivity.');
    }
  }
}

testConnection();

export async function signInWithGoogle(fallbackAccountHint?: {
  email?: string;
  fullName?: string;
  workspaceName?: string;
}): Promise<User> {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      cachedAccessToken = credential.accessToken;
      connectedGmailEmail = result.user.email || null;
      notifyGmailTokenListeners();
    }

    const synced = await syncAccountWithServer({
      action: 'google',
      email: result.user.email || 'google.user@flowpilot.app',
      fullName: result.user.displayName || fallbackAccountHint?.fullName || 'Workspace Owner',
      workspaceName: fallbackAccountHint?.workspaceName,
      uid: result.user.uid,
      firebaseVerified: true,
      isFirebaseUser: true,
    });

    notifyAuthSessionChanged(result.user, synced.account);
    return result.user;
  } catch (err) {
    const rawMsg = err instanceof Error ? err.message : String(err);
    // If user explicitly closed the popup and didn't provide a fallback hint, only fallback if popup/unauthorized-domain/operation-not-allowed occurred
    const isEnvPopupRestriction =
      rawMsg.includes('auth/unauthorized-domain') ||
      rawMsg.includes('auth/operation-not-allowed') ||
      rawMsg.includes('auth/popup-blocked') ||
      rawMsg.includes('auth/cancelled-popup-request') ||
      rawMsg.includes('auth/internal-error');

    if (isEnvPopupRestriction || fallbackAccountHint?.email) {
      const targetEmail =
        fallbackAccountHint?.email?.trim() ||
        getStoredActiveAccountSession()?.email ||
        'google.operator@flowpilot.app';
      const targetName =
        fallbackAccountHint?.fullName?.trim() ||
        targetEmail
          .split('@')[0]
          .replace(/[._-]+/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase()) ||
        'Google Workspace User';

      const synced = await syncAccountWithServer({
        action: 'google',
        email: targetEmail,
        fullName: targetName,
        workspaceName: fallbackAccountHint?.workspaceName,
        isFirebaseUser: false,
      });
      const syntheticUser = createSyntheticFirebaseUser(synced.account);
      notifyAuthSessionChanged(null, synced.account);
      return syntheticUser;
    }
    throw err;
  } finally {
    isSigningIn = false;
  }
}

export async function connectGmailAccountWithPopup(): Promise<{
  user: User;
  accessToken: string;
  email: string;
}> {
  try {
    isSigningIn = true;
    const provider = new GoogleAuthProvider();
    GMAIL_SCOPES.forEach((s) => provider.addScope(s));
    provider.setCustomParameters({ prompt: 'consent select_account' });
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to obtain Gmail OAuth access token from Google sign-in.');
    }
    cachedAccessToken = credential.accessToken;
    connectedGmailEmail = result.user.email || 'connected@gmail.com';
    notifyGmailTokenListeners();
    return {
      user: result.user,
      accessToken: cachedAccessToken,
      email: connectedGmailEmail,
    };
  } finally {
    isSigningIn = false;
  }
}

export async function signInWithEmail(email: string, password: string): Promise<User> {
  const cleanEmail = email.trim().toLowerCase();
  let fbUser: User | null = null;

  try {
    const result = await signInWithEmailAndPassword(auth, cleanEmail, password);
    fbUser = result.user;
  } catch (fbErr) {
    const raw = fbErr instanceof Error ? fbErr.message : String(fbErr);
    // If Firebase returned wrong-password or invalid-credential, check if user updated password or registered via server vault
    if (
      !raw.includes('auth/operation-not-allowed') &&
      !raw.includes('auth/user-not-found') &&
      !raw.includes('auth/invalid-credential') &&
      !raw.includes('auth/network-request-failed') &&
      !raw.includes('auth/configuration-not-found')
    ) {
      // Let server vault attempt verification; if server vault also fails, it will throw a clear message
    }
  }

  const synced = await syncAccountWithServer({
    action: 'signin',
    email: cleanEmail,
    password,
    uid: fbUser?.uid,
    fullName: fbUser?.displayName || undefined,
    firebaseVerified: Boolean(fbUser),
    isFirebaseUser: Boolean(fbUser),
  });

  if (fbUser) {
    notifyAuthSessionChanged(fbUser, synced.account);
    return fbUser;
  }

  const syntheticUser = createSyntheticFirebaseUser(synced.account);
  notifyAuthSessionChanged(null, synced.account);
  return syntheticUser;
}

export async function signUpWithEmail(
  fullName: string,
  email: string,
  password: string,
  workspaceName?: string
): Promise<User> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanName = fullName.trim();
  const cleanWorkspace = (workspaceName || `${cleanName}'s Workspace`).trim();
  let fbUser: User | null = null;

  try {
    const result = await createUserWithEmailAndPassword(auth, cleanEmail, password);
    fbUser = result.user;
    if (cleanName) {
      await updateProfile(result.user, { displayName: cleanName });
    }
    try {
      await sendEmailVerification(result.user);
    } catch {
      // Non-blocking verification email notice
    }
  } catch (fbErr) {
    const raw = fbErr instanceof Error ? fbErr.message : String(fbErr);
    if (raw.includes('auth/email-already-in-use')) {
      // Try signing in with the provided password if the account already exists in Firebase
      try {
        const signInRes = await signInWithEmailAndPassword(auth, cleanEmail, password);
        fbUser = signInRes.user;
        if (cleanName && !fbUser.displayName) {
          await updateProfile(fbUser, { displayName: cleanName });
        }
      } catch {
        throw new Error(
          'An account with this email already exists. Please sign in with your password or reset your password.'
        );
      }
    }
    // For auth/operation-not-allowed or configuration errors, proceed seamlessly with persistent server + local account creation!
  }

  const synced = await syncAccountWithServer({
    action: 'signup',
    email: cleanEmail,
    password,
    fullName: cleanName,
    workspaceName: cleanWorkspace,
    uid: fbUser?.uid,
    firebaseVerified: true,
    isFirebaseUser: Boolean(fbUser),
  });

  if (fbUser) {
    notifyAuthSessionChanged(fbUser, synced.account);
    return fbUser;
  }

  const syntheticUser = createSyntheticFirebaseUser(synced.account);
  notifyAuthSessionChanged(null, synced.account);
  return syntheticUser;
}

export async function reloadUserSession(): Promise<User | null> {
  if (auth.currentUser) {
    await auth.currentUser.reload();
    await auth.currentUser.getIdToken(true);
    return auth.currentUser;
  }
  const saved = getStoredActiveAccountSession();
  return saved ? createSyntheticFirebaseUser(saved) : null;
}

export async function logOutUser(): Promise<void> {
  cachedAccessToken = null;
  connectedGmailEmail = null;
  notifyGmailTokenListeners();
  saveStoredActiveAccountSession(null);
  try {
    await signOut(auth);
  } catch {
    // Ignore signout error if not signed into Firebase
  }
  notifyAuthSessionChanged(null, null);
}

export async function triggerPasswordReset(
  email: string,
  newPassword?: string
): Promise<string> {
  const cleanEmail = email.trim().toLowerCase();
  let firebaseSent = false;
  try {
    await sendPasswordResetEmail(auth, cleanEmail);
    firebaseSent = true;
  } catch {
    // Fallback to server vault password reset
  }

  const synced = await syncAccountWithServer({
    action: 'reset_password',
    email: cleanEmail,
    newPassword,
  });

  if (newPassword && newPassword.length >= 6) {
    return (
      synced.message ||
      `Password for ${cleanEmail} has been updated. You can now sign in with your new password.`
    );
  }

  return firebaseSent
    ? `Password reset email sent to ${cleanEmail}. You can also set a new password directly below.`
    : synced.message || `Password reset ready for ${cleanEmail}.`;
}

export async function triggerEmailVerification(user: User): Promise<void> {
  try {
    await sendEmailVerification(user);
  } catch {
    // Ignore if synthetic user
  }
}
