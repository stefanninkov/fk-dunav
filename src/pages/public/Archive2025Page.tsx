import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { onSnapshot } from 'firebase/firestore';

import { contentPageDoc } from '@/lib/firestore/refs';
import type { ContentPage } from '@/lib/firestore/types';
import { useTournamentStore } from '@/stores/useTournamentStore';
import { PagePlaceholder } from '@/components/ui/PagePlaceholder';
import { MarkdownView } from '@/features/content/components/MarkdownView';

export function Archive2025Page() {
  const active = useTournamentStore((s) => s.active);
  const [page, setPage] = useState<ContentPage | null>(null);

  useEffect(() => {
    if (!active) return;
    const unsub = onSnapshot(contentPageDoc(active.id, 'archive2025'), (snap) => {
      setPage(snap.exists() ? snap.data() : null);
    });
    return unsub;
  }, [active]);

  if (!active) {
    return <PagePlaceholder title="Turnir 2025" description="Čeka se aktivan turnir." />;
  }

  return (
    <section className="mx-auto max-w-[720px] px-page-x py-12 lg:px-page-x-lg">
      <div className="mb-6 rounded-md border border-surface-4 bg-surface-1 p-3 text-sm text-ink-secondary">
        Ovo je arhiva turnira iz 2025. Za trenutno izdanje idi na{' '}
        <NavLink to="/" className="text-brand-400 hover:text-brand-300">
          početnu stranicu
        </NavLink>
        .
      </div>
      <h1 className="font-display text-3xl font-700 sm:text-4xl">
        {page?.title ?? 'Turnir 2025'}
      </h1>
      {page && page.body.trim() ? (
        <div className="mt-6">
          <MarkdownView source={page.body} />
        </div>
      ) : (
        <p className="mt-6 rounded-md bg-surface-1 px-4 py-6 text-sm text-ink-secondary">
          Sadržaj arhive se priprema.
        </p>
      )}
    </section>
  );
}
