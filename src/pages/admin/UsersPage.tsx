import { useEffect, useState } from 'react';
import { onSnapshot, orderBy, query } from 'firebase/firestore';
import { Plus, Trash2 } from 'lucide-react';

import { invitesCol } from '@/lib/firestore/refs';
import type { Invite, InviteRole } from '@/lib/firestore/types';
import { sr } from '@/i18n/sr';
import { useAuthStore } from '@/stores/useAuthStore';
import {
  inviteUser,
  removeInvite,
  revokeInvite,
} from '@/features/users/inviteActions';

export function UsersPage() {
  const uid = useAuthStore((s) => s.uid);
  const role = useAuthStore((s) => s.role);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [email, setEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<InviteRole>('reporter');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (role !== 'admin') return;
    const unsub = onSnapshot(
      query(invitesCol(), orderBy('invitedAt', 'desc')),
      (snap) => setInvites(snap.docs.map((d) => d.data())),
      (e) => setError(e.message),
    );
    return unsub;
  }, [role]);

  async function invite() {
    if (!uid || !email.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await inviteUser(email.trim(), inviteRole, uid);
      setEmail('');
    } catch (e) {
      setError(e instanceof Error ? e.message : sr.common.errorGeneric);
    } finally {
      setBusy(false);
    }
  }

  if (role !== 'admin') {
    return (
      <section className="flex flex-col gap-3">
        <h1 className="font-display text-2xl font-700">{sr.admin.nav.users}</h1>
        <p className="rounded-md bg-surface-1 px-4 py-6 text-sm text-ink-secondary">
          Samo administratori mogu upravljati korisnicima.
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-2xl font-700">{sr.admin.nav.users}</h1>
        <p className="mt-1 text-sm text-ink-secondary">
          Pozivnice na email — čim se korisnik prvi put prijavi, dobija odgovarajuću ulogu
          (nalog se automatski promoviše).
        </p>
      </header>

      <div className="flex flex-col gap-2 rounded-lg bg-surface-1 p-4 shadow-card sm:flex-row">
        <input
          type="email"
          placeholder="email@primer.rs"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-touch flex-1 rounded-md border border-surface-4 bg-surface-2 px-3 text-ink-primary outline-none focus:border-brand-500"
        />
        <select
          value={inviteRole}
          onChange={(e) => setInviteRole(e.target.value as InviteRole)}
          className="h-touch rounded-md border border-surface-4 bg-surface-2 px-3 text-ink-primary"
        >
          <option value="reporter">Reporter</option>
          <option value="admin">Administrator</option>
        </select>
        <button
          type="button"
          onClick={invite}
          disabled={busy || !email.trim()}
          className="inline-flex h-touch items-center justify-center gap-2 rounded-md bg-brand-600 px-4 font-600 text-ink-primary hover:bg-brand-500 disabled:opacity-60"
        >
          <Plus size={16} />
          Pozovi
        </button>
      </div>

      {error ? (
        <p className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">{error}</p>
      ) : null}

      {invites.length === 0 ? (
        <p className="rounded-md bg-surface-1 px-4 py-6 text-center text-sm text-ink-tertiary">
          Još nema pozivnica.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {invites.map((i) => (
            <li
              key={i.id}
              className="flex items-center gap-3 rounded-lg bg-surface-1 px-4 py-3 shadow-card"
            >
              <div className="flex flex-1 flex-col">
                <span className="font-500 text-ink-primary">{i.email}</span>
                <span className="text-xs text-ink-tertiary">
                  {i.role === 'admin' ? 'Administrator' : 'Reporter'}
                  {i.revoked ? ' · opozvana' : ''}
                  {i.consumedAt ? ' · prihvaćena' : ''}
                </span>
              </div>
              {!i.revoked ? (
                <button
                  type="button"
                  onClick={() => void revokeInvite(i.id)}
                  className="rounded-md border border-surface-4 px-3 py-1.5 text-xs text-ink-secondary hover:bg-surface-2"
                >
                  Opozovi
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  if (confirm('Trajno ukloniti?')) void removeInvite(i.id);
                }}
                className="rounded-md p-2 text-ink-tertiary hover:bg-surface-2 hover:text-danger"
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
