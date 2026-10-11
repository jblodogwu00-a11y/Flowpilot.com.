import React, { useState } from 'react';
import {
  X,
  Mail,
  Lock,
  User as UserIcon,
  Briefcase,
  Eye,
  EyeOff,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  KeyRound,
} from 'lucide-react';
import {
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  triggerPasswordReset,
  firebaseProjectId,
} from '../firebase';
import { FlowPilotLogo } from './FlowPilotLogo';

export type AuthModalMode = 'signin' | 'signup' | 'forgot';

interface AuthModalProps {
  isOpen: boolean;
  initialMode?: AuthModalMode;
  onClose: () => void;
  onAuthSuccess: (options?: {
    fullName?: string;
    workspaceName?: string;
    email?: string;
  }) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialMode = 'signin',
  onClose,
  onAuthSuccess,
}) => {
  const [mode, setMode] = useState<AuthModalMode>(initialMode);
  const [fullName, setFullName] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [needsProviderEnablement, setNeedsProviderEnablement] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setErrorMsg(null);
      setSuccessMsg(null);
      setNeedsProviderEnablement(false);
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const formatFirebaseAuthError = (err: unknown): string => {
    const raw = err instanceof Error ? err.message : String(err);
    if (raw.includes('auth/operation-not-allowed')) {
      setNeedsProviderEnablement(true);
      return 'Email/Password authentication is not yet enabled in your Firebase project console.';
    }
    if (raw.includes('auth/invalid-credential') || raw.includes('auth/wrong-password') || raw.includes('auth/user-not-found')) {
      return 'Invalid email or password. Please verify your credentials or reset your password.';
    }
    if (raw.includes('auth/email-already-in-use')) {
      return 'An account with this email already exists. Please sign in or reset your password.';
    }
    if (raw.includes('auth/weak-password')) {
      return 'Password must be at least 6 characters long.';
    }
    if (raw.includes('auth/invalid-email')) {
      return 'Please enter a valid email address.';
    }
    if (raw.includes('auth/popup-closed-by-user')) {
      return 'Google sign-in popup was closed before completing authentication.';
    }
    return raw;
  };

  const handleManualSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setNeedsProviderEnablement(false);

    if (!email.trim() || !password) {
      setErrorMsg('Please enter both your email address and password.');
      return;
    }

    setIsLoading(true);
    try {
      await signInWithEmail(email, password);
      onAuthSuccess({ email: email.trim() });
      onClose();
    } catch (err) {
      setErrorMsg(formatFirebaseAuthError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setNeedsProviderEnablement(false);

    if (!fullName.trim()) {
      setErrorMsg('Please enter your full name.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      await signUpWithEmail(fullName, email, password);
      onAuthSuccess({
        fullName: fullName.trim(),
        workspaceName: workspaceName.trim() || `${fullName.trim()}'s Workspace`,
        email: email.trim(),
      });
      onClose();
    } catch (err) {
      setErrorMsg(formatFirebaseAuthError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setNeedsProviderEnablement(false);

    if (!email.trim() || !email.includes('@')) {
      setErrorMsg('Please enter the email address associated with your account.');
      return;
    }

    setIsLoading(true);
    try {
      await triggerPasswordReset(email);
      setSuccessMsg(
        `Password reset instructions have been sent to ${email.trim()}. Check your inbox and spam folder.`
      );
    } catch (err) {
      setErrorMsg(formatFirebaseAuthError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setNeedsProviderEnablement(false);
    setIsLoading(true);
    try {
      const user = await signInWithGoogle();
      onAuthSuccess({
        fullName: user.displayName || undefined,
        email: user.email || undefined,
      });
      onClose();
    } catch (err) {
      setErrorMsg(formatFirebaseAuthError(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl max-h-[92vh] overflow-y-auto">
        {/* Two-Color Slate Ink & Emerald Modal Header */}
        <div className="px-7 py-5 bg-[#0F172A] text-white flex items-center justify-between">
          <div className="flex items-center">
            <FlowPilotLogo variant="dark" size="md" />
            <span aria-hidden="true" className="mx-2.5 text-slate-500">
              ·
            </span>
            <span className="text-sm font-semibold text-emerald-400">
              100% Free Forever
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-300 hover:text-white rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switcher Tabs (Sign In / Sign Up) */}
        {mode !== 'forgot' && (
          <div className="px-7 pt-6">
            <div className="grid grid-cols-2 gap-1.5 p-1.5 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className={`py-2.5 text-sm font-bold rounded-lg transition-colors cursor-pointer ${
                  mode === 'signin'
                    ? 'bg-[#0F172A] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className={`py-2.5 text-sm font-bold rounded-lg transition-colors cursor-pointer ${
                  mode === 'signup'
                    ? 'bg-[#0F172A] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                Create Free Account
              </button>
            </div>
          </div>
        )}

        <div className="p-7 space-y-5">
          {/* Heading */}
          <div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-950">
              {mode === 'signin'
                ? 'Sign in to your workspace'
                : mode === 'signup'
                ? 'Create your FlowPilot account'
                : 'Reset your password'}
            </h2>
            <p className="text-sm text-slate-600 mt-1.5">
              {mode === 'signin'
                ? 'Access your CRM contacts, visual automations, and omnichannel broadcasts.'
                : mode === 'signup'
                ? 'No credit card, no trials, and no subscription fees—ever.'
                : 'Enter your email address and we will send you a password reset link.'}
            </p>
          </div>

          {/* Error Notice */}
          {errorMsg && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl space-y-2 text-sm text-red-900">
              <div className="flex items-start gap-2.5 font-semibold">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
              {needsProviderEnablement && (
                <div className="pl-7 space-y-1.5 text-xs text-red-800 leading-relaxed border-t border-red-200/70 pt-2">
                  <div className="font-bold">
                    How to enable Email/Password in Firebase Console:
                  </div>
                  <ol className="list-decimal pl-4 space-y-0.5">
                    <li>
                      Open{' '}
                      <a
                        href={`https://console.firebase.google.com/project/${firebaseProjectId}/authentication/providers`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline font-bold"
                      >
                        Firebase Console → Authentication → Sign-in method
                      </a>
                    </li>
                    <li>Click <strong>Email/Password</strong>, toggle <strong>Enable</strong>, and click <strong>Save</strong>.</li>
                  </ol>
                </div>
              )}
            </div>
          )}

          {/* Success Notice */}
          {successMsg && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-sm text-emerald-900">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* 1. MANUAL SIGN IN FORM */}
          {mode === 'signin' && (
            <form onSubmit={handleManualSignIn} className="space-y-4 text-sm">
              <div>
                <label className="block font-semibold text-slate-800 mb-1.5">
                  Email Address *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@studio.io"
                    className="w-full pl-10 pr-4 py-3 text-base bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-emerald-700"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-semibold text-slate-800">Password *</label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    className="text-emerald-800 hover:underline font-bold cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full pl-10 pr-11 py-3 text-base bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-emerald-700"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 px-5 text-base font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-colors inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <span>{isLoading ? 'Signing in...' : 'Sign In with Email'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* 2. MANUAL SIGN UP FORM */}
          {mode === 'signup' && (
            <form onSubmit={handleManualSignUp} className="space-y-4 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-semibold text-slate-800 mb-1.5">
                    Full Name *
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      maxLength={100}
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Elena Vance"
                      className="w-full pl-10 pr-3.5 py-2.5 text-base bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-emerald-700"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-800 mb-1.5">
                    Business / Studio Name
                  </label>
                  <div className="relative">
                    <Briefcase className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      maxLength={100}
                      value={workspaceName}
                      onChange={(e) => setWorkspaceName(e.target.value)}
                      placeholder="Studio Sovereign"
                      className="w-full pl-10 pr-3.5 py-2.5 text-base bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-emerald-700"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-800 mb-1.5">
                  Work Email Address *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    maxLength={150}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="elena@studiosovereign.io"
                    className="w-full pl-10 pr-4 py-2.5 text-base bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-emerald-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-semibold text-slate-800 mb-1.5">
                    Password (min 6 chars) *
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Create password"
                      className="w-full pl-10 pr-8 py-2.5 text-base bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-emerald-700"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-800 mb-1.5">
                    Confirm Password *
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat password"
                      className="w-full pl-10 pr-8 py-2.5 text-base bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-emerald-700"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 px-5 text-base font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-colors inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <span>
                  {isLoading ? 'Creating Account...' : 'Create Free Account & Workspace'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* 3. FORGOTTEN PASSWORD FORM */}
          {mode === 'forgot' && (
            <form onSubmit={handleForgotPassword} className="space-y-4 text-sm">
              <div>
                <label className="block font-semibold text-slate-800 mb-1.5">
                  Account Email Address *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your registered email"
                    className="w-full pl-10 pr-4 py-3 text-base bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-emerald-700"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 px-5 text-base font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-colors inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <KeyRound className="w-4 h-4" />
                <span>{isLoading ? 'Sending Reset Link...' : 'Send Password Reset Email'}</span>
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className="text-sm font-bold text-slate-700 hover:text-slate-950 cursor-pointer"
                >
                  ← Back to Sign In
                </button>
              </div>
            </form>
          )}

          {/* Divider + Google OAuth Button */}
          {mode !== 'forgot' && (
            <>
              <div className="relative flex py-1.5 items-center">
                <div className="grow border-t border-slate-200" />
                <span className="shrink mx-3 text-xs text-slate-500 font-semibold">
                  or continue with Google
                </span>
                <div className="grow border-t border-slate-200" />
              </div>

              <button
                type="button"
                onClick={handleGoogleAuth}
                disabled={isLoading}
                className="w-full py-3 px-4 text-sm font-bold text-slate-900 bg-[#FAF8F5] border border-slate-300 hover:bg-slate-100 rounded-xl transition-colors flex items-center justify-center gap-3 cursor-pointer disabled:opacity-60"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.79-.07-1.54-.19-2.27h-11.3v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12.255 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96h-3.98v3.09C3.515 21.3 7.565 24 12.255 24Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.525 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62h-3.98a11.86 11.86 0 0 0 0 10.76l3.98-3.09Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12.255 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C18.205 1.19 15.495 0 12.255 0c-4.69 0-8.74 2.7-10.71 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96Z"
                  />
                </svg>
                <span>
                  {mode === 'signup' ? 'Sign Up with Google' : 'Continue with Google'}
                </span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
