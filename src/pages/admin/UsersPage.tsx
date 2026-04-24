import { useEffect, useState } from 'react';
import { onSnapshot, orderBy, query } from 'firebase/firestore';
import { Plus, Save, Trash2 } from 'lucide-react';

import { invitesCol, usersCol } from '@/lib/firestore/refs';
import type { AppUser, Capability, Invite } from '@/lib/firestore/types';
import { ALL_CAPABILITIES } from '@/lib/firestore/types';
import { sr } from '@/i18n/sr';
import { useAuthStore } from '@/stores/useAuthStore';
import {
  inviteUser,
  removeInvite,
  revokeInvite,
  updateUserCapabilities,
} from '@/features/users/inviteActions';

const CAP_LABELS: Record<Capability, string> = {
  matches: 'Utakmice (rezultat + statistika)',
  teams: 'Timovi i igrači',
  photos: 'Moderacija galerije',
  side_events: 'Bočna takmičenja (Kup Šanka, Prečka, Lutrija, Nagrade)',
  content: 'Obaveštenja, sadržaj, sponzori',
};

export function UsersPage() {
  const uid = useAuthStore((s) => s.uid);
  const role = useAuthStore((s) => s.role);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [email, setEmail] = useState('');
  const [caps, setCaps] = useState<Set<Capability>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (role !== 'admin') return;
    const unsubInvites = onSnapshot(
      query(invitesCol(), orderBy('invitedAt', 'desc')),
      (snap) => setInvites(snap.docs.map((d) => d.data())),
      (e) => setError(e.message),
    );
    const unsubUsers = onSnapshot(
      usersCol(),
      (snap) => setUsers(snap.docs.map((d) => d.data())),
      (e) => setError(e.message),
    );
    return () => {
      unsubInvites();
      unsubUsers();
    };
  }, [role]);

  function toggleCap(cap: Capability) {
    setCaps((prev) => {
      const next = new Set(prev);
      if (next.has(cap)) next.delete(cap);
      else next.add(cap);
      return next;
    });
  }

  async function sendInvite() {
    if (!uid || !email.trim() || caps.size === 0) return;
    setBusy(true);
    setError(null);
    try {
      // Write caps in canonical order so rule `hasAll/hasOnly` equality
      // matches whatever the client later writes in the same order.
      const ordered = ALL_CAPABILITIES.filter((c) => caps.has(c));
      await inviteUser(email.trim(), ordered, uid);
      setEmail('');
      setCaps(new Set());
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
          Pozovi saradnika i izaberi kojim tabovima ima pristup. Pristup
          važi čim se prvi put prijavi — posle toga ga ti menjaš sa strane.
        </p>
      </header>

      {/* Invite form */}
      <section className="flex flex-col gap-3 rounded-lg bg-surface-1 p-4 shadow-card">
        <h2 className="font-display text-base font-600">Nova pozivnica</h2>
        <input
          type="email"
          placeholder="email@primer.rs"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-touch w-full rounded-md border border-surface-4 bg-surface-2 px-3 text-ink-primary outline-none focus:border-brand-500"
        />
        <div className="flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-wide text-ink-tertiary">
            Dozvole
          </span>
          {ALL_CAPABILITIES.map((cap) => (
            <label
              key={cap}
              className="flex items-center gap-2 rounded-md bg-surface-2 px-3 py-2 text-sm text-ink-primary"
            >
              <input
                type="checkbox"
                checked={caps.has(cap)}
                onChange={() => toggleCap(cap)}
                className="h-4 w-4 accent-brand-400"
              />
              <span>{CAP_LABELS[cap]}</span>
            </label>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void sendInvite()}
          disabled={busy || !email.trim() || caps.size === 0}
          className="inline-flex h-touch items-center justify-center gap-2 self-start rounded-md bg-brand-600 px-4 font-600 text-ink-primary hover:bg-brand-500 disabled:opacity-60"
        >
          <Plus size={16} />
          Pošalji pozivnicu
        </button>
      </section>

      {error ? (
        <p className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">{error}</p>
      ) : null}

      {/* Existing staff */}
      {users.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-base font-600">Aktivni saradnici</h2>
          <ul className="flex flex-col gap-2">
            {users.map((u) => (
              <UserRow key={u.uid} user={u} />
            ))}
          </ul>
        </section>
      ) : null}

      {/* Invites */}
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-base font-600">Pozivnice</h2>
        {invites.length === 0 ? (
          <p className="rounded-md bg-surface-1 px-4 py-6 text-center text-sm text-ink-tertiary">
            Još nema pozivnica.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {invites.map((i) => (
              <li
                key={i.id}
                className="flex flex-wrap items-center gap-3 rounded-lg bg-surface-1 px-4 py-3 shadow-card"
              >
                <div className="flex min-w-[10rem] flex-1 flex-col">
                  <span className="font-500 text-ink-primary">{i.email}</span>
                  <span className="text-xs text-ink-tertiary">
                    {i.caps.length > 0
                      ? i.caps.map((c) => CAP_LABELS[c]).join(' · ')
                      : 'bez dozvola'}
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
    </section>
  );
}

// ---------------------------------------------------------------------------

function UserRow({ user }: { user: AppUser }) {
  const [caps, setCaps] = useState<Set<Capability>>(
    () => new Set(user.caps ?? []),
  );
  const [saving, setSaving] = useState(false);
  const dirty = !sameCaps(caps, user.caps ?? []);

  function toggle(cap: Capability) {
    setCaps((prev) => {
      const next = new Set(prev);
      if (next.has(cap)) next.delete(cap);
      else next.add(cap);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    try {
      const ordered = ALL_CAPABILITIES.filter((c) => caps.has(c));
      await updateUserCapabilities(user.uid, ordered);
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="flex flex-col gap-3 rounded-lg bg-surface-1 px-4 py-3 shadow-card">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-500 text-ink-primary">{user.email}</span>
        <span className="text-xs text-ink-tertiary">{user.uid}</span>
      </div>
      <div className="flex flex-col gap-1">
        {ALL_CAPABILITIES.map((cap) => (
          <label
            key={cap}
            className="flex items-center gap-2 text-sm text-ink-primary"
          >
            <input
              type="checkbox"
              checked={caps.has(cap)}
              onChange={() => toggle(cap)}
              className="h-4 w-4 accent-brand-400"
            />
            <span>{CAP_LABELS[cap]}</span>
          </label>
        ))}
      </div>
      <div className="flex">
        <button
          type="button"
          onClick={() => void save()}
          disabled={!dirty || saving}
          className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-600 text-ink-primary hover:bg-brand-500 disabled:opacity-60"
        >
          <Save size={14} />
          {saving ? sr.common.loading : sr.common.save}
        </button>
      </div>
    </li>
  );
}

function sameCaps(a: Set<Capability>, b: Capability[]): boolean {
  if (a.size !== b.length) return false;
  for (const c of b) if (!a.has(c)) return false;
  return true;
}
