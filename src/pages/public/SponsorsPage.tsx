import { useEffect, useState } from 'react';
import { onSnapshot, orderBy, query, where } from 'firebase/firestore';

import { sponsorsCol } from '@/lib/firestore/refs';
import type { Sponsor, SponsorTier } from '@/lib/firestore/types';
import { sr } from '@/i18n/sr';
import { useTournamentStore } from '@/stores/useTournamentStore';
import { PagePlaceholder } from '@/components/ui/PagePlaceholder';

const tierOrder: SponsorTier[] = ['gold', 'silver', 'bronze', 'friend'];

export function SponsorsPage() {
  const active = useTournamentStore((s) => s.active);
  const [sponsors, setSponsors] = useState<Sponsor[] | null>(null);

  useEffect(() => {
    if (!active) return;
    const unsub = onSnapshot(
      query(
        sponsorsCol(active.id),
        where('active', '==', true),
        orderBy('order', 'asc'),
      ),
      (snap) => setSponsors(snap.docs.map((d) => d.data())),
    );
    return unsub;
  }, [active]);

  if (!active) {
    return <PagePlaceholder title={sr.nav.sponsors} description="Čeka se aktivan turnir." />;
  }

  const grouped = new Map<SponsorTier, Sponsor[]>();
  for (const s of sponsors ?? []) {
    const list = grouped.get(s.tier) ?? [];
    list.push(s);
    grouped.set(s.tier, list);
  }

  return (
    <section className="mx-auto max-w-[1200px] px-page-x py-10 lg:px-page-x-lg">
      <h1 className="font-display text-3xl font-700 sm:text-4xl">{sr.nav.sponsors}</h1>
      <p className="mt-2 text-sm text-ink-secondary">Hvala svima koji podržavaju turnir.</p>

      {sponsors === null ? (
        <p className="mt-6 text-sm text-ink-secondary">{sr.common.loading}</p>
      ) : sponsors.length === 0 ? (
        <p className="mt-6 text-sm text-ink-secondary">Još nema sponzora.</p>
      ) : (
        <div className="mt-10 flex flex-col gap-10">
          {tierOrder.map((tier) => {
            const list = grouped.get(tier);
            if (!list || list.length === 0) return null;
            return (
              <section key={tier}>
                <h2 className="mb-3 font-display text-lg font-600 uppercase tracking-wide text-ink-tertiary">
                  {/* Fallback to tier key if i18n lookup fails */}
                  {sr.admin?.sponsors?.tier?.[tier] ?? tier}
                </h2>
                <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  {list.map((s) => (
                    <li key={s.id}>
                      <SponsorCard sponsor={s} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}

function SponsorCard({ sponsor }: { sponsor: Sponsor }) {
  const inner = (
    <div className="flex h-full flex-col items-center gap-3 rounded-lg bg-surface-1 p-4 shadow-card transition-shadow hover:shadow-card-hov">
      {sponsor.logoUrl ? (
        <img
          src={sponsor.logoUrl}
          alt={sponsor.name}
          className="h-20 w-full object-contain"
          loading="lazy"
        />
      ) : (
        <div className="flex h-20 w-full items-center justify-center rounded bg-surface-2 text-xs text-ink-tertiary">
          {sponsor.name}
        </div>
      )}
      <span className="text-center font-500 text-ink-primary">{sponsor.name}</span>
      {sponsor.thanksText ? (
        <span className="text-center text-xs text-ink-tertiary">{sponsor.thanksText}</span>
      ) : null}
    </div>
  );
  return sponsor.link ? (
    <a href={sponsor.link} target="_blank" rel="noreferrer">
      {inner}
    </a>
  ) : (
    inner
  );
}
