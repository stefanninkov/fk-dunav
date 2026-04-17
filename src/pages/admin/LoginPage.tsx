import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithEmailLink,
} from 'firebase/auth';
import { FirebaseError } from 'firebase/app';

import { auth } from '@/lib/firebase';
import { sr } from '@/i18n/sr';
import { useAuthStore } from '@/stores/useAuthStore';

const EMAIL_FOR_SIGN_IN_KEY = 'fk-dunav:email-for-sign-in';

const schema = z.object({
  email: z.string().email(sr.common.required),
});

type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const navigate = useNavigate();
  const uid = useAuthStore((s) => s.uid);
  const role = useAuthStore((s) => s.role);

  const [sent, setSent] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  // Already signed in and has a role — go to dashboard.
  useEffect(() => {
    if (uid && role) navigate('/admin', { replace: true });
  }, [uid, role, navigate]);

  // Completing a sign-in from an email link.
  useEffect(() => {
    async function finishSignIn() {
      if (!isSignInWithEmailLink(auth, window.location.href)) return;
      setFinishing(true);
      setError(null);
      try {
        let email = window.localStorage.getItem(EMAIL_FOR_SIGN_IN_KEY);
        if (!email) {
          email = window.prompt(sr.admin.login.emailMismatch) ?? '';
        }
        if (!email) {
          setError(sr.admin.login.emailMismatch);
          return;
        }
        await signInWithEmailLink(auth, email, window.location.href);
        window.localStorage.removeItem(EMAIL_FOR_SIGN_IN_KEY);
        // onAuthStateChanged in AppRoot will populate the store; the redirect
        // above handles navigation.
      } catch (e) {
        const code = e instanceof FirebaseError ? e.code : 'unknown';
        setError(
          code === 'auth/invalid-action-code' || code === 'auth/expired-action-code'
            ? sr.admin.login.invalidLink
            : sr.admin.login.noAccess,
        );
      } finally {
        setFinishing(false);
      }
    }
    void finishSignIn();
  }, []);

  async function onSubmit({ email }: FormValues) {
    setError(null);
    try {
      // Continue URL must match an Authorized Domain in Firebase Auth and
      // include the full path under the Vite base (/fk-dunav/ on GH Pages).
      const continueUrl = `${window.location.origin}${import.meta.env.BASE_URL}admin/login`;
      await sendSignInLinkToEmail(auth, email, {
        url: continueUrl,
        handleCodeInApp: true,
      });
      window.localStorage.setItem(EMAIL_FOR_SIGN_IN_KEY, email);
      setSent(true);
    } catch (e) {
      const code = e instanceof FirebaseError ? e.code : 'unknown';
      setError(
        code === 'auth/invalid-email'
          ? sr.common.required
          : `${sr.admin.login.noAccess} (${code})`,
      );
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-0 px-page-x">
      <div className="w-full max-w-md rounded-lg bg-surface-1 p-6 shadow-card">
        <div className="mb-6 flex items-center gap-3">
          <img src="/assets/logo.svg" alt={sr.brand.name} className="h-12 w-12" />
          <div className="flex flex-col">
            <h1 className="font-display text-xl font-700">{sr.admin.login.title}</h1>
            <p className="text-sm text-ink-tertiary">{sr.brand.name}</p>
          </div>
        </div>

        {finishing ? (
          <p className="text-sm text-ink-secondary">{sr.admin.login.finishing}</p>
        ) : sent ? (
          <p className="rounded-md bg-success-soft px-4 py-3 text-sm text-success">
            {sr.admin.login.sent}
          </p>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-500 text-ink-secondary">
                {sr.admin.login.emailLabel}
              </span>
              <input
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder={sr.admin.login.emailPlaceholder}
                className="h-touch rounded-md border border-surface-4 bg-surface-2 px-3 text-ink-primary outline-none focus:border-brand-500"
                {...register('email')}
              />
              {errors.email ? (
                <span className="text-xs text-danger">{errors.email.message}</span>
              ) : null}
            </label>

            {error ? (
              <p className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">{error}</p>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="h-touch rounded-md bg-brand-600 px-4 font-600 text-ink-primary transition-colors hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? sr.common.loading : sr.admin.login.submit}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
