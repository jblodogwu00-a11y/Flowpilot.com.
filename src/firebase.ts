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

const app = initializeApp(firebaseConfig);
export const db = getFirestore(
  app,
  firebaseConfig.firestoreDatabaseId || 'ai-studio-53b8d6de-81d3-4f2a-9ea0-7359072dfac0'
);
export const auth = getAuth(app);

export const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
];

export const googleProvider = new GoogleAuthProvider();
SCOPES.forEach((scope) => {
  googleProvider.addScope(scope);
});

export const firebaseProjectId = firebaseConfig.projectId;

// In-memory cache for Google Workspace (Gmail) OAuth access token.
// Never persisted to localStorage or sessionStorage.
let isSigningIn = false;
let cachedAccessToken: string | null = null;
let connectedGmailEmail: string | null = null;
const gmailTokenListeners = new Set<(state: { connected: boolean; email: string | null }) => void>();

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
        cachedAccessToken = null;
        notifyGmailTokenListeners();
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      connectedGmailEmail = null;
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
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
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

export async function signInWithGoogle(): Promise<User> {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      cachedAccessToken = credential.accessToken;
      connectedGmailEmail = result.user.email || null;
      notifyGmailTokenListeners();
    }
    return result.user;
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
    SCOPES.forEach((s) => provider.addScope(s));
    provider.setCustomParameters({ prompt: 'consent' });
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
  const result = await signInWithEmailAndPassword(auth, email.trim(), password);
  return result.user;
}

export async function signUpWithEmail(
  fullName: string,
  email: string,
  password: string
): Promise<User> {
  const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
  if (fullName.trim()) {
    await updateProfile(result.user, { displayName: fullName.trim() });
  }
  try {
    await sendEmailVerification(result.user);
  } catch (err) {
    console.warn('Verification email dispatch notice:', err);
  }
  return result.user;
}

export async function reloadUserSession(): Promise<User | null> {
  if (!auth.currentUser) return null;
  await auth.currentUser.reload();
  await auth.currentUser.getIdToken(true);
  return auth.currentUser;
}

export async function logOutUser(): Promise<void> {
  cachedAccessToken = null;
  connectedGmailEmail = null;
  notifyGmailTokenListeners();
  await signOut(auth);
}

export async function triggerPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

export async function triggerEmailVerification(user: User): Promise<void> {
  await sendEmailVerification(user);
}

