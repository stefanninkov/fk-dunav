import { useEffect, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';

import { contentPageDoc } from '@/lib/firestore/refs';
import type { ContentPage } from '@/lib/firestore/types';
import { sr } from '@/i18n/sr';
import { useTournamentStore } from '@/stores/useTournamentStore';
import { PagePlaceholder } from '@/components/ui/PagePlaceholder';
import { MarkdownView } from '@/features/content/components/MarkdownView';

export function RulesPage() {
  const active = useTournamentStore((s) => s.active);
  const [page, setPage] = useState<ContentPage | null>(null);

  useEffect(() => {
    if (!active) return;
    const unsub = onSnapshot(contentPageDoc(active.id, 'pravilnik'), (snap) => {
      setPage(snap.exists() ? snap.data() : null);
    });
    return unsub;
  }, [active]);

  if (!active) {
    return <PagePlaceholder title={sr.nav.rules} description="Čeka se aktivan turnir." />;
  }

  return (
    <section className="mx-auto max-w-[720px] px-page-x py-12 lg:px-page-x-lg">
      <h1 className="font-display text-3xl font-700 sm:text-4xl">
        {page?.title ?? sr.nav.rules}
      </h1>
      {page && page.body.trim() ? (
        <div className="mt-6">
          <MarkdownView source={page.body} />
        </div>
      ) : (
        <p className="mt-6 rounded-md bg-surface-1 px-4 py-6 text-sm text-ink-secondary">
          Pravilnik se uskoro objavljuje.
        </p>
      )}
    </section>
  );
}
