import { useAuthStore } from '@/stores/useAuthStore';
import { sr } from '@/i18n/sr';

export function AdminHomePage() {
  const email = useAuthStore((s) => s.email);
  const role = useAuthStore((s) => s.role);

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-2xl font-700">{sr.admin.nav.dashboard}</h1>
        <p className="mt-1 text-sm text-ink-secondary">
          Prijavljen: <span className="text-ink-primary">{email}</span>
          {role ? <span className="ml-2 rounded-full bg-brand-900 px-2 py-0.5 text-xs">{role}</span> : null}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card title="Aktivan turnir" body="Nema aktivnog turnira. Kreiraj turnir u odeljku Turnir." />
        <Card title="Utakmice uživo" body="Nema utakmica u toku." />
        <Card title="Fotografije na čekanju" body="0 — sve je obrađeno." />
      </div>

      <p className="text-xs text-ink-tertiary">
        Pregled, prečice i poslednja aktivnost se pune u sledećim nedeljama razvoja.
      </p>
    </section>
  );
}

function Card({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg bg-surface-1 p-5 shadow-card">
      <h2 className="font-display text-sm font-600 text-ink-secondary">{title}</h2>
      <p className="mt-2 text-base text-ink-primary">{body}</p>
    </div>
  );
}
