import { NavLink } from 'react-router-dom';

import { sr } from '@/i18n/sr';
import { useAuthStore } from '@/stores/useAuthStore';
import { useTournamentStore } from '@/stores/useTournamentStore';

export function AdminHomePage() {
  const email = useAuthStore((s) => s.email);
  const role = useAuthStore((s) => s.role);
  const active = useTournamentStore((s) => s.active);
  const loading = useTournamentStore((s) => s.loading);

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-2xl font-700">{sr.admin.nav.dashboard}</h1>
        <p className="mt-1 text-sm text-ink-secondary">
          Prijavljen: <span className="text-ink-primary">{email}</span>
          {role ? (
            <span className="ml-2 rounded-full bg-brand-900 px-2 py-0.5 text-xs">{role}</span>
          ) : null}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <Card title="Aktivan turnir" body={sr.common.loading} />
        ) : active ? (
          <Card
            title="Aktivan turnir"
            body={`${active.name} (${active.year})`}
            linkTo="/admin/turnir"
            linkLabel="Podesi"
          />
        ) : (
          <Card
            title="Aktivan turnir"
            body={sr.admin.tournament.noActive}
            linkTo="/admin/turnir"
            linkLabel={sr.admin.tournament.newButton}
          />
        )}
        <Card title="Utakmice uživo" body="Nema utakmica u toku." />
        <Card title="Fotografije na čekanju" body="0 — sve je obrađeno." />
      </div>

      <p className="text-xs text-ink-tertiary">
        Ostali odeljci (igrači, raspored, galerija, nagrade…) se pune u narednim fazama.
      </p>
    </section>
  );
}

function Card({
  title,
  body,
  linkTo,
  linkLabel,
}: {
  title: string;
  body: string;
  linkTo?: string;
  linkLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg bg-surface-1 p-5 shadow-card">
      <h2 className="font-display text-sm font-600 text-ink-secondary">{title}</h2>
      <p className="flex-1 text-base text-ink-primary">{body}</p>
      {linkTo && linkLabel ? (
        <NavLink
          to={linkTo}
          className="text-sm font-600 text-brand-400 hover:text-brand-300"
        >
          {linkLabel} →
        </NavLink>
      ) : null}
    </div>
  );
}
