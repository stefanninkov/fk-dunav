import { useEffect, useState } from 'react';
import { onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { Check, Trash2, X } from 'lucide-react';

import { photosCol } from '@/lib/firestore/refs';
import type { Photo, PhotoStatus } from '@/lib/firestore/types';
import { sr } from '@/i18n/sr';
import { useAuthStore } from '@/stores/useAuthStore';
import { useTournamentStore } from '@/stores/useTournamentStore';
import {
  approvePhoto,
  purgePhoto,
  rejectPhoto,
} from '@/features/gallery/galleryActions';

const tabs: { id: PhotoStatus; label: string }[] = [
  { id: 'pending', label: 'Na čekanju' },
  { id: 'approved', label: 'Odobreno' },
  { id: 'rejected', label: 'Odbijeno' },
];

export function AdminGalleryPage() {
  const active = useTournamentStore((s) => s.active);
  const uid = useAuthStore((s) => s.uid);
  const [tab, setTab] = useState<PhotoStatus>('pending');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0 });

  useEffect(() => {
    if (!active) return;
    const unsub = onSnapshot(
      query(
        photosCol(active.id),
        where('status', '==', tab),
        orderBy('uploadedAt', 'desc'),
      ),
      (snap) => setPhotos(snap.docs.map((d) => d.data())),
    );
    return unsub;
  }, [active, tab]);

  // Count-only listener for the tab badges.
  useEffect(() => {
    if (!active) return;
    const unsub = onSnapshot(photosCol(active.id), (snap) => {
      const next = { pending: 0, approved: 0, rejected: 0 };
      for (const d of snap.docs) {
        const s = d.data().status;
        if (s === 'pending' || s === 'approved' || s === 'rejected') next[s] += 1;
      }
      setCounts(next);
    });
    return unsub;
  }, [active]);

  if (!active || !uid) {
    return (
      <section className="flex flex-col gap-3">
        <h1 className="font-display text-2xl font-700">{sr.admin.nav.gallery}</h1>
        <p className="rounded-md bg-surface-1 px-4 py-6 text-sm text-ink-secondary">
          {sr.admin.tournament.noActive}
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-700">{sr.admin.nav.gallery}</h1>

      <div className="flex gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-500 ${
              tab === t.id
                ? 'bg-brand-900 text-ink-primary'
                : 'bg-surface-2 text-ink-secondary hover:text-ink-primary'
            }`}
          >
            {t.label}
            <span className="tnum rounded-full bg-surface-3 px-2 py-0.5 text-xs">
              {counts[t.id]}
            </span>
          </button>
        ))}
      </div>

      {photos.length === 0 ? (
        <p className="rounded-md bg-surface-1 px-4 py-10 text-center text-sm text-ink-tertiary">
          {sr.common.empty}
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((p) => (
            <li
              key={p.id}
              className="flex flex-col gap-2 rounded-lg bg-surface-1 p-2 shadow-card"
            >
              <div className="aspect-square overflow-hidden rounded-md bg-surface-2">
                {p.type === 'image' ? (
                  <img
                    src={p.thumbnailUrl ?? p.fullUrl}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <video
                    src={p.videoUrl ?? p.fullUrl}
                    controls
                    preload="metadata"
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <div className="flex flex-col gap-1 px-1 text-xs text-ink-secondary">
                <span>
                  {p.uploaderName ? `@${p.uploaderName}` : 'Anonim'} ·{' '}
                  {(p.sizeBytes / 1024 / 1024).toFixed(1)} MB
                </span>
                <span className="text-ink-tertiary">
                  {p.uploadedAt?.toDate
                    ? p.uploadedAt.toDate().toLocaleString('sr-RS', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '—'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {tab !== 'approved' ? (
                  <Btn
                    label="Odobri"
                    icon={<Check size={14} />}
                    variant="success"
                    onClick={() => void approvePhoto(active.id, p.id, uid)}
                  />
                ) : null}
                {tab !== 'rejected' ? (
                  <Btn
                    label="Odbij"
                    icon={<X size={14} />}
                    variant="danger"
                    onClick={() => void rejectPhoto(active.id, p.id, uid)}
                  />
                ) : null}
                {tab === 'rejected' || tab === 'approved' ? (
                  <Btn
                    label="Obriši"
                    icon={<Trash2 size={14} />}
                    variant="ghost"
                    onClick={() => {
                      if (confirm('Trajno obrisati?')) void purgePhoto(active.id, p);
                    }}
                  />
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Btn({
  label,
  icon,
  variant,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  variant: 'success' | 'danger' | 'ghost';
  onClick: () => void;
}) {
  const cls =
    variant === 'success'
      ? 'bg-success-soft text-success'
      : variant === 'danger'
        ? 'bg-danger-soft text-danger'
        : 'border border-surface-4 text-ink-secondary';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-500 ${cls}`}
    >
      {icon}
      {label}
    </button>
  );
}
