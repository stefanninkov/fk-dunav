import { useEffect, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';

import { contentPageDoc } from '@/lib/firestore/refs';
import type { ContentPage, ContentPageId } from '@/lib/firestore/types';
import { sr } from '@/i18n/sr';
import { useAuthStore } from '@/stores/useAuthStore';
import { useTournamentStore } from '@/stores/useTournamentStore';
import { saveContentPage } from '@/features/content/contentActions';
import { MarkdownView } from '@/features/content/components/MarkdownView';

const pages: { id: ContentPageId; label: string; defaultTitle: string }[] = [
  { id: 'pravilnik', label: 'Pravilnik', defaultTitle: 'Pravilnik turnira' },
  { id: 'oTurniru', label: 'O turniru', defaultTitle: 'O turniru' },
];

export function ContentAdminPage() {
  const active = useTournamentStore((s) => s.active);
  const uid = useAuthStore((s) => s.uid);
  const [activePage, setActivePage] = useState<ContentPageId>('pravilnik');

  if (!active || !uid) {
    return (
      <section className="flex flex-col gap-3">
        <h1 className="font-display text-2xl font-700">Sadržaj stranica</h1>
        <p className="rounded-md bg-surface-1 px-4 py-6 text-sm text-ink-secondary">
          {sr.admin.tournament.noActive}
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-2xl font-700">Sadržaj stranica</h1>
        <p className="mt-1 text-sm text-ink-secondary">
          Pravilnik turnira i O turniru — Markdown formatiranje podržano.
        </p>
      </header>

      <div className="flex gap-2">
        {pages.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setActivePage(p.id)}
            className={`rounded-md px-4 py-2 text-sm font-500 ${
              activePage === p.id
                ? 'bg-brand-900 text-ink-primary'
                : 'bg-surface-2 text-ink-secondary hover:text-ink-primary'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <PageEditor
        tournamentId={active.id}
        pageId={activePage}
        defaultTitle={
          pages.find((p) => p.id === activePage)?.defaultTitle ?? activePage
        }
        uid={uid}
      />
    </section>
  );
}

function PageEditor({
  tournamentId,
  pageId,
  defaultTitle,
  uid,
}: {
  tournamentId: string;
  pageId: ContentPageId;
  defaultTitle: string;
  uid: string;
}) {
  const [page, setPage] = useState<ContentPage | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(contentPageDoc(tournamentId, pageId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setPage(data);
        setTitle(data.title);
        setBody(data.body);
      } else {
        setPage(null);
        setTitle(defaultTitle);
        setBody('');
      }
    });
    return unsub;
  }, [tournamentId, pageId, defaultTitle]);

  async function save() {
    setSaving(true);
    try {
      await saveContentPage(tournamentId, pageId, title, body, uid);
      setSavedAt(Date.now());
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <section className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-500 text-ink-secondary">Naslov</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-touch rounded-md border border-surface-4 bg-surface-2 px-3 text-ink-primary outline-none focus:border-brand-500"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-500 text-ink-secondary">
            Tekst (Markdown)
          </span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={22}
            className="rounded-md border border-surface-4 bg-surface-2 px-3 py-2 font-mono text-sm text-ink-primary outline-none focus:border-brand-500"
          />
        </label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={saving || !title.trim()}
            className="h-touch rounded-md bg-brand-600 px-4 font-600 text-ink-primary hover:bg-brand-500 disabled:opacity-60"
          >
            {saving ? sr.common.loading : sr.common.save}
          </button>
          {savedAt ? (
            <span className="text-xs text-ink-tertiary">
              Sačuvano {new Date(savedAt).toLocaleTimeString('sr-RS')}
            </span>
          ) : null}
          {page?.updatedAt ? (
            <span className="text-xs text-ink-tertiary">
              Poslednja izmena:{' '}
              {page.updatedAt.toDate().toLocaleString('sr-RS')}
            </span>
          ) : null}
        </div>
      </section>

      <section className="rounded-lg bg-surface-1 p-5 shadow-card">
        <h3 className="mb-3 text-xs uppercase tracking-wide text-ink-tertiary">
          Pregled
        </h3>
        {body.trim().length === 0 ? (
          <p className="text-sm text-ink-tertiary">
            Pregled se prikazuje ovde kako kucaš.
          </p>
        ) : (
          <MarkdownView source={body} />
        )}
      </section>
    </div>
  );
}
