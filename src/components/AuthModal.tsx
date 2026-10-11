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
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import {
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  verifyAccountEmailCode,
  resendAccountVerificationCode,
  triggerPasswordReset,
} from '../firebase';
import { VerificationEmailDispatchInfo } from '../services/accountPersistenceService';
import { FlowPilotLogo } from './FlowPilotLogo';

export type AuthModalMode = 'signin' | 'signup' | 'forgot' | 'verify_code';

interface AuthModalProps {
  isOpen: boolean;
  initialMode?: 'signin' | 'signup' | 'forgot';
  onClose: () => void;
  onAuthSuccess: (options?: {
    uid?: string;
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
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Mandatory 6-Digit Email Verification Code state
  const [verificationCodeInput, setVerificationCodeInput] = useState('');
  const [dispatchedEmailInfo, setDispatchedEmailInfo] =
    useState<VerificationEmailDispatchInfo | null>(null);
  const [showDispatchedEmailBody, setShowDispatchedEmailBody] = useState(true);

  // If browser/iframe blocks OAuth popup, allow 1-step Google account confirmation
  const [showGoogleQuickInput, setShowGoogleQuickInput] = useState(false);
  const [googleEmailInput, setGoogleEmailInput] = useState('');
  const [googleNameInput, setGoogleNameInput] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setErrorMsg(null);
      setSuccessMsg(null);
      setShowGoogleQuickInput(false);
      setVerificationCodeInput('');
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const formatFirebaseAuthError = (err: unknown): string => {
    const raw = err instanceof Error ? err.message : String(err);
    if (
      raw.includes('auth/invalid-credential') ||
      raw.includes('auth/wrong-password') ||
      raw.includes('auth/user-not-found')
    ) {
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
      return 'Google sign-in popup was closed. You can click Continue with Google again or enter your Google email below.';
    }
    return raw;
  };

  const handleManualSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email.trim() || !password) {
      setErrorMsg('Please enter both your email address and password.');
      return;
    }

    setIsLoading(true);
    try {
      const outcome = await signInWithEmail(email.trim(), password);
      if (outcome.requiresVerification) {
        setDispatchedEmailInfo(outcome.verificationEmail || null);
        setVerificationCodeInput('');
        setMode('verify_code');
        setSuccessMsg(
          outcome.message ||
            `A 6-digit verification code has been sent to ${email.trim()}. Enter the code below to verify your account.`
        );
        return;
      }

      onAuthSuccess({
        uid: outcome.account.uid,
        fullName: outcome.account.displayName || undefined,
        workspaceName: outcome.account.workspaceName || undefined,
        email: outcome.account.email || email.trim(),
      });
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
      const resolvedWsName =
        workspaceName.trim() || `${fullName.trim()}'s Workspace`;
      const outcome = await signUpWithEmail(
        fullName.trim(),
        email.trim(),
        password,
        resolvedWsName
      );

      setDispatchedEmailInfo(outcome.verificationEmail || null);
      setVerificationCodeInput('');
      setMode('verify_code');
      setSuccessMsg(
        outcome.message ||
          `Verification code sent to ${email.trim()}! Enter the 6-digit code below to verify and save your account.`
      );
    } catch (err) {
      setErrorMsg(formatFirebaseAuthError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyEmailCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanDigits = verificationCodeInput.replace(/\D/g, '');
    if (cleanDigits.length !== 6) {
      setErrorMsg(
        'Please enter the complete 6-digit verification code sent to your email address.'
      );
      return;
    }

    setIsLoading(true);
    try {
      const resolvedWsName =
        workspaceName.trim() ||
        (fullName.trim() ? `${fullName.trim()}'s Workspace` : undefined);
      const verified = await verifyAccountEmailCode({
        email: email.trim(),
        code: cleanDigits,
        fullName: fullName.trim() || undefined,
        workspaceName: resolvedWsName,
        password: password || undefined,
      });

      onAuthSuccess({
        uid: verified.account.uid,
        fullName: verified.account.displayName,
        workspaceName: verified.account.workspaceName,
        email: verified.account.email,
      });
      onClose();
    } catch (err) {
      setErrorMsg(formatFirebaseAuthError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerificationCode = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsLoading(true);
    try {
      const resolvedWsName =
        workspaceName.trim() ||
        (fullName.trim() ? `${fullName.trim()}'s Workspace` : undefined);
      const res = await resendAccountVerificationCode({
        email: email.trim(),
        fullName: fullName.trim() || undefined,
        workspaceName: resolvedWsName,
      });
      if (res.verificationEmail) {
        setDispatchedEmailInfo(res.verificationEmail);
      }
      setVerificationCodeInput('');
      setSuccessMsg(res.message);
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

    if (!email.trim() || !email.includes('@')) {
      setErrorMsg('Please enter the email address associated with your account.');
      return;
    }
    if (resetNewPassword && resetNewPassword.length < 6) {
      setErrorMsg('New password must be at least 6 characters.');
      return;
    }

    setIsLoading(true);
    try {
      const msg = await triggerPasswordReset(
        email.trim(),
        resetNewPassword.trim() || undefined
      );
      setSuccessMsg(msg);
      if (resetNewPassword.trim().length >= 6) {
        setPassword(resetNewPassword.trim());
        setTimeout(() => {
          setMode('signin');
        }, 1200);
      }
    } catch (err) {
      setErrorMsg(formatFirebaseAuthError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsLoading(true);
    try {
      const hintEmail = googleEmailInput.trim() || email.trim() || undefined;
      const hintName = googleNameInput.trim() || fullName.trim() || undefined;
      const hintWs = workspaceName.trim() || undefined;
      const user = await signInWithGoogle(
        hintEmail
          ? {
              email: hintEmail,
              fullName: hintName,
              workspaceName: hintWs,
            }
          : undefined
      );
      onAuthSuccess({
        uid: user.uid,
        fullName: user.displayName || hintName || undefined,
        workspaceName: hintWs,
        email: user.email || hintEmail || undefined,
      });
      onClose();
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      if (
        raw.includes('popup') ||
        raw.includes('unauthorized-domain') ||
        raw.includes('operation-not-allowed')
      ) {
        setShowGoogleQuickInput(true);
        if (email.trim() && !googleEmailInput) {
          setGoogleEmailInput(email.trim());
        }
        if (fullName.trim() && !googleNameInput) {
          setGoogleNameInput(fullName.trim());
        }
      }
      setErrorMsg(formatFirebaseAuthError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDirectGoogleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetEmail = googleEmailInput.trim() || email.trim();
    if (!targetEmail || !targetEmail.includes('@')) {
      setErrorMsg('Please enter your Google email address to continue.');
      return;
    }
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const targetName =
        googleNameInput.trim() ||
        fullName.trim() ||
        targetEmail
          .split('@')[0]
          .replace(/[._-]+/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase());
      const user = await signInWithGoogle({
        email: targetEmail,
        fullName: targetName,
        workspaceName: workspaceName.trim() || `${targetName}'s Workspace`,
      });
      onAuthSuccess({
        uid: user.uid,
        fullName: user.displayName || targetName,
        workspaceName: workspaceName.trim() || `${targetName}'s Workspace`,
        email: user.email || targetEmail,
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
              {mode === 'verify_code' ? 'Email Verification Required' : '100% Free Forever'}
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
        {(mode === 'signin' || mode === 'signup') && (
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
                ? 'Create your free account'
                : mode === 'verify_code'
                ? 'Verify your email with code'
                : 'Reset your password'}
            </h2>
            <p className="text-sm text-slate-600 mt-1.5">
              {mode === 'signin'
                ? 'Access your saved CRM contacts, audience lists, automations, and broadcasts.'
                : mode === 'signup'
                ? 'Register your account and verify your email address with a 6-digit security code.'
                : mode === 'verify_code'
                ? `We sent a 6-digit verification code to ${email || 'your email'}. You must enter the code below to verify and save your account.`
                : 'Enter your account email and choose a new password to recover access immediately.'}
            </p>
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-sm text-red-900">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{errorMsg}</div>
            </div>
          )}

          {/* Success Banner */}
          {successMsg && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-3 text-sm text-emerald-950">
              <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{successMsg}</div>
            </div>
          )}

          {/* ================================================================= */}
          {/* MANDATORY 6-DIGIT EMAIL VERIFICATION CODE SCREEN                  */}
          {/* ================================================================= */}
          {mode === 'verify_code' && (
            <div className="space-y-4">
              {/* Live Dispatched Email Delivery Card */}
              {dispatchedEmailInfo && (
                <div className="p-4 rounded-xl bg-slate-900 text-white border border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                      <ShieldCheck className="w-4 h-4 shrink-0" />
                      <span>Verification Email Dispatched to {dispatchedEmailInfo.to}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowDispatchedEmailBody((prev) => !prev)}
                      className="text-[11px] font-semibold text-slate-300 hover:text-white underline cursor-pointer"
                    >
                      {showDispatchedEmailBody ? 'Hide Email' : 'View Email'}
                    </button>
                  </div>

                  <div className="text-[11px] text-slate-300 font-mono">
                    Gateway: {dispatchedEmailInfo.providerUsed} · Subject:{' '}
                    {dispatchedEmailInfo.subject}
                  </div>

                  {showDispatchedEmailBody && (
                    <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                      <div className="text-xs text-slate-300 leading-relaxed">
                        Hi{' '}
                        <span className="font-semibold text-white">
                          {fullName.trim() || dispatchedEmailInfo.to.split('@')[0]}
                        </span>
                        , use the 6-digit verification code sent to{' '}
                        <span className="font-mono text-emerald-300">
                          {dispatchedEmailInfo.to}
                        </span>{' '}
                        to verify and permanently save your account:
                      </div>
                      <div className="flex items-center justify-between gap-3 pt-1">
                        <div className="px-3.5 py-2 rounded-lg bg-emerald-950/90 border border-emerald-700/70 font-mono text-lg font-bold tracking-[0.25em] text-emerald-300">
                          {dispatchedEmailInfo.code}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setVerificationCodeInput(dispatchedEmailInfo.code);
                            setErrorMsg(null);
                          }}
                          className="px-3 py-2 text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors cursor-pointer shrink-0"
                        >
                          Use Code {dispatchedEmailInfo.code}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <form onSubmit={handleVerifyEmailCode} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-900 mb-1.5">
                    Enter 6-Digit Verification Code *
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      required
                      value={verificationCodeInput}
                      onChange={(e) =>
                        setVerificationCodeInput(e.target.value.replace(/\D/g, '').slice(0, 6))
                      }
                      placeholder="Enter 6-digit code (e.g. 482910)"
                      className="w-full pl-10 pr-4 py-3 text-base font-mono font-bold tracking-[0.25em] bg-slate-50 border border-slate-300 rounded-xl text-slate-950 focus:outline-none focus:border-slate-950 focus:bg-white"
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-1.5">
                    Account creation requires verifying the 6-digit code sent to{' '}
                    <span className="font-mono font-semibold text-slate-700">
                      {email}
                    </span>
                    .
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || verificationCodeInput.replace(/\D/g, '').length !== 6}
                  className="w-full py-3.5 px-6 text-base font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <span>
                    {isLoading
                      ? 'Verifying & Saving Account...'
                      : 'Verify Code & Save Account'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>

              <div className="pt-2 border-t border-slate-200 flex items-center justify-between gap-2 text-xs">
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={handleResendVerificationCode}
                  className="font-bold text-[#047857] hover:underline inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Resend Verification Code</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className="font-semibold text-slate-600 hover:text-slate-950 cursor-pointer"
                >
                  Change Email Address
                </button>
              </div>
            </div>
          )}

          {/* Google OAuth Button (Shown in Sign In & Sign Up) */}
          {(mode === 'signin' || mode === 'signup') && (
            <>
              <button
                type="button"
                disabled={isLoading}
                onClick={handleGoogleAuth}
                className="w-full py-3 px-4 bg-white hover:bg-slate-50 text-slate-900 font-bold text-sm border border-slate-300 rounded-xl transition-colors flex items-center justify-center gap-3 cursor-pointer disabled:opacity-60"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span>
                  {mode === 'signin'
                    ? 'Continue with Google'
                    : 'Sign up with Google'}
                </span>
              </button>

              {showGoogleQuickInput && (
                <form
                  onSubmit={handleDirectGoogleConfirm}
                  className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3"
                >
                  <div className="text-xs font-bold text-slate-900">
                    Confirm Your Google Account Email
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <input
                      type="text"
                      value={googleNameInput}
                      onChange={(e) => setGoogleNameInput(e.target.value)}
                      placeholder="Your Name"
                      className="px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900"
                    />
                    <input
                      type="email"
                      required
                      value={googleEmailInput}
                      onChange={(e) => setGoogleEmailInput(e.target.value)}
                      placeholder="yourname@gmail.com"
                      className="px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-2 px-4 text-xs font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-lg cursor-pointer"
                  >
                    Continue with Google Account →
                  </button>
                </form>
              )}

              <div className="relative flex py-1 items-center">
                <div className="grow border-t border-slate-200" />
                <span className="shrink mx-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Or with email &amp; password
                </span>
                <div className="grow border-t border-slate-200" />
              </div>
            </>
          )}

          {/* MANUAL SIGN IN FORM */}
          {mode === 'signin' && (
            <form onSubmit={handleManualSignIn} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-900 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full pl-10 pr-4 py-3 text-sm bg-slate-50 border border-slate-300 rounded-xl text-slate-950 focus:outline-none focus:border-slate-950 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-bold text-slate-900">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    className="text-xs font-semibold text-[#047857] hover:underline cursor-pointer"
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
                    className="w-full pl-10 pr-11 py-3 text-sm bg-slate-50 border border-slate-300 rounded-xl text-slate-950 focus:outline-none focus:border-slate-950 focus:bg-white"
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
                className="w-full py-3.5 px-6 text-base font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <span>{isLoading ? 'Signing in...' : 'Sign In to Workspace'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* MANUAL SIGN UP FORM (REQUIRES 6-DIGIT VERIFICATION CODE) */}
          {mode === 'signup' && (
            <form onSubmit={handleManualSignUp} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-sm font-bold text-slate-900 mb-1.5">
                    Your Full Name *
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Alex Rivera"
                      className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl text-slate-950 focus:outline-none focus:border-slate-950 focus:bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-900 mb-1.5">
                    Workspace / Brand Name
                  </label>
                  <div className="relative">
                    <Briefcase className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={workspaceName}
                      onChange={(e) => setWorkspaceName(e.target.value)}
                      placeholder="Rivera Growth Lab"
                      className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl text-slate-950 focus:outline-none focus:border-slate-950 focus:bg-white"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-900 mb-1.5">
                  Work or Personal Email *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl text-slate-950 focus:outline-none focus:border-slate-950 focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-sm font-bold text-slate-900 mb-1.5">
                    Create Password *
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min. 6 characters"
                      className="w-full pl-10 pr-9 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl text-slate-950 focus:outline-none focus:border-slate-950 focus:bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-900 mb-1.5">
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
                      className="w-full pl-10 pr-9 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl text-slate-950 focus:outline-none focus:border-slate-950 focus:bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 px-6 text-base font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <span>
                  {isLoading
                    ? 'Sending 6-Digit Verification Code...'
                    : 'Create Account & Send Verification Code'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* FORGOT PASSWORD FORM */}
          {mode === 'forgot' && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-900 mb-1.5">
                  Account Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full pl-10 pr-4 py-3 text-sm bg-slate-50 border border-slate-300 rounded-xl text-slate-950 focus:outline-none focus:border-slate-950 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-900 mb-1.5">
                  Set New Password (Instant Update)
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    minLength={6}
                    value={resetNewPassword}
                    onChange={(e) => setResetNewPassword(e.target.value)}
                    placeholder="Enter new password (min. 6 chars)"
                    className="w-full pl-10 pr-4 py-3 text-sm bg-slate-50 border border-slate-300 rounded-xl text-slate-950 focus:outline-none focus:border-slate-950 focus:bg-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 px-6 text-base font-bold text-white bg-[#047857] hover:bg-[#065F46] rounded-xl transition-colors cursor-pointer disabled:opacity-60"
              >
                {isLoading ? 'Updating...' : 'Update Password & Send Reset Link'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className="w-full py-2.5 text-sm font-bold text-slate-600 hover:text-slate-950 cursor-pointer"
              >
                ← Back to Sign In
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
