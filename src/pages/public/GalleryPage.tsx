import { useEffect, useState } from 'react';
import { onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { Upload, X } from 'lucide-react';

import { photosCol } from '@/lib/firestore/refs';
import type { Photo } from '@/lib/firestore/types';
import { sr } from '@/i18n/sr';
import { useTournamentStore } from '@/stores/useTournamentStore';
import { PagePlaceholder } from '@/components/ui/PagePlaceholder';
import { UploadModal } from '@/features/gallery/components/UploadModal';

export function GalleryPage() {
  const active = useTournamentStore((s) => s.active);
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'image' | 'video'>('all');
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  useEffect(() => {
    if (!active) return;
    const unsub = onSnapshot(
      query(
        photosCol(active.id),
        where('status', '==', 'approved'),
        orderBy('uploadedAt', 'desc'),
      ),
      (snap) => setPhotos(snap.docs.map((d) => d.data())),
    );
    return unsub;
  }, [active]);

  const filtered =
    photos?.filter((p) => filter === 'all' || p.type === filter) ?? null;

  if (!active) {
    return <PagePlaceholder title={sr.nav.gallery} description="Čeka se aktivan turnir." />;
  }

  return (
    <section className="mx-auto max-w-[1200px] px-page-x py-10 lg:px-page-x-lg">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-3xl font-700 sm:text-4xl">{sr.nav.gallery}</h1>
        <div className="flex items-center gap-2">
          <Filter active={filter === 'all'} onClick={() => setFilter('all')}>
            Sve
          </Filter>
          <Filter active={filter === 'image'} onClick={() => setFilter('image')}>
            Foto
          </Filter>
          <Filter active={filter === 'video'} onClick={() => setFilter('video')}>
            Video
          </Filter>
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className="inline-flex h-touch items-center gap-2 rounded-md bg-brand-600 px-4 font-600 text-ink-primary hover:bg-brand-500"
          >
            <Upload size={16} />
            Pošalji
          </button>
        </div>
      </header>

      {filtered === null ? (
        <p className="mt-6 text-sm text-ink-secondary">{sr.common.loading}</p>
      ) : filtered.length === 0 ? (
        <p className="mt-6 rounded-md bg-surface-1 px-4 py-10 text-center text-sm text-ink-secondary">
          Galerija se puni kad krene turnir. Pošalji svoje fotke pritiskom na dugme iznad.
        </p>
      ) : (
        <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((p, i) => (
            <li
              key={p.id}
              className="group relative aspect-square overflow-hidden rounded-lg bg-surface-2"
            >
              <button
                type="button"
                onClick={() => setLightboxIdx(i)}
                className="block h-full w-full"
                aria-label="Pregledaj"
              >
                {p.type === 'image' ? (
                  <img
                    src={p.thumbnailUrl ?? p.fullUrl}
                    alt={p.uploaderName ?? ''}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <video
                    src={p.videoUrl ?? p.fullUrl}
                    className="h-full w-full object-cover"
                    preload="metadata"
                  />
                )}
              </button>
              {p.uploaderName ? (
                <span className="pointer-events-none absolute bottom-1 left-1 rounded bg-surface-0/70 px-1.5 py-0.5 text-[10px] text-ink-primary">
                  @{p.uploaderName}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {lightboxIdx !== null && filtered ? (
        <Lightbox
          items={filtered}
          index={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
          onNav={(dx) =>
            setLightboxIdx((i) =>
              i === null
                ? null
                : (i + dx + filtered.length) % filtered.length,
            )
          }
        />
      ) : null}

      {uploadOpen ? (
        <UploadModal tournamentId={active.id} onClose={() => setUploadOpen(false)} />
      ) : null}
    </section>
  );
}

function Filter({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-touch rounded-md px-3 text-sm font-500 ${
        active ? 'bg-brand-900 text-ink-primary' : 'bg-surface-2 text-ink-secondary'
      }`}
    >
      {children}
    </button>
  );
}

function Lightbox({
  items,
  index,
  onClose,
  onNav,
}: {
  items: Photo[];
  index: number;
  onClose: () => void;
  onNav: (dx: number) => void;
}) {
  const p = items[index];
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onNav(1);
      if (e.key === 'ArrowLeft') onNav(-1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onNav]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-0/95 p-4">
      <button
        type="button"
        onClick={onClose}
        aria-label={sr.common.close}
        className="absolute right-4 top-4 rounded-md p-2 text-ink-primary hover:bg-surface-2"
      >
        <X size={20} />
      </button>
      <div className="flex max-h-full max-w-full items-center justify-center">
        {p.type === 'image' ? (
          <img src={p.fullUrl} alt="" className="max-h-[90vh] max-w-full object-contain" />
        ) : (
          <video
            src={p.videoUrl ?? p.fullUrl}
            controls
            autoPlay
            className="max-h-[90vh] max-w-full"
          />
        )}
      </div>
      <button
        type="button"
        onClick={() => onNav(-1)}
        className="absolute left-4 top-1/2 -translate-y-1/2 rounded-md bg-surface-2 px-3 py-2 text-ink-primary hover:bg-surface-3"
      >
        ←
      </button>
      <button
        type="button"
        onClick={() => onNav(1)}
        className="absolute right-4 top-1/2 -translate-y-1/2 rounded-md bg-surface-2 px-3 py-2 text-ink-primary hover:bg-surface-3"
      >
        →
      </button>
    </div>
  );
}
