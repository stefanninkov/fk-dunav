import { useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';

import { sr } from '@/i18n/sr';
import { uploadPhoto } from '@/features/gallery/galleryActions';

interface Props {
  tournamentId: string;
  onClose: () => void;
}

interface QueueItem {
  file: File;
  status: 'idle' | 'uploading' | 'done' | 'error';
  progress: number;
  error?: string;
}

const MAX_FILES = 5;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

export function UploadModal({ tournamentId, onClose }: Props) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [name, setName] = useState('');
  const fileRef = useRef<HTMLInputElement | null>(null);

  function onPick(files: FileList | null) {
    if (!files) return;
    const taken = queue.length;
    const incoming = [...files].slice(0, MAX_FILES - taken);
    const validated = incoming.map((f): QueueItem => {
      const isVideo = f.type.startsWith('video/');
      const max = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
      if (f.size > max) {
        return {
          file: f,
          status: 'error',
          progress: 0,
          error: `Prevelik fajl (${(f.size / 1024 / 1024).toFixed(1)} MB).`,
        };
      }
      return { file: f, status: 'idle', progress: 0 };
    });
    setQueue((prev) => [...prev, ...validated]);
  }

  async function startAll() {
    for (let i = 0; i < queue.length; i += 1) {
      const item = queue[i];
      if (item.status !== 'idle') continue;
      setQueue((prev) =>
        prev.map((q, idx) => (idx === i ? { ...q, status: 'uploading' } : q)),
      );
      try {
        await uploadPhoto(
          tournamentId,
          { file: item.file, uploaderName: name.trim() || undefined },
          (p) => {
            setQueue((prev) =>
              prev.map((q, idx) =>
                idx === i
                  ? { ...q, progress: p.bytesTransferred / p.totalBytes }
                  : q,
              ),
            );
          },
        );
        setQueue((prev) =>
          prev.map((q, idx) => (idx === i ? { ...q, status: 'done', progress: 1 } : q)),
        );
      } catch (e) {
        setQueue((prev) =>
          prev.map((q, idx) =>
            idx === i
              ? {
                  ...q,
                  status: 'error',
                  error: e instanceof Error ? e.message : sr.common.errorGeneric,
                }
              : q,
          ),
        );
      }
    }
  }

  const pending = queue.filter((q) => q.status === 'idle' || q.status === 'uploading');
  const done = queue.filter((q) => q.status === 'done');
  const anyUploading = queue.some((q) => q.status === 'uploading');

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-surface-0/80 p-page-x backdrop-blur-sm"
    >
      <div className="my-8 flex w-full max-w-lg flex-col gap-4 rounded-lg bg-surface-1 p-6 shadow-elevated">
        <header className="flex items-center justify-between">
          <h2 className="font-display text-xl font-700">Pošalji fotke / video</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-ink-secondary hover:bg-surface-2"
            aria-label={sr.common.close}
          >
            <X size={18} />
          </button>
        </header>

        <p className="text-sm text-ink-secondary">
          Najviše {MAX_FILES} fajlova odjednom. Slike do 10 MB, video do 100 MB.
          Svaki upload prolazi kroz odobrenje pre nego što se pojavi u galeriji.
        </p>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-500 text-ink-secondary">
            Tvoje ime (opciono — za zahvalnicu)
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-touch rounded-md border border-surface-4 bg-surface-2 px-3 text-ink-primary outline-none focus:border-brand-500"
          />
        </label>

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex h-24 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-surface-4 text-ink-secondary hover:border-brand-500 hover:text-ink-primary"
        >
          <Upload size={24} />
          <span>Izaberi fajlove</span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          multiple
          hidden
          onChange={(e) => onPick(e.target.files)}
        />

        {queue.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {queue.map((q, i) => (
              <li
                key={`${q.file.name}-${i}`}
                className="flex items-center gap-3 rounded-md bg-surface-2 px-3 py-2 text-sm"
              >
                <span className="flex-1 truncate">{q.file.name}</span>
                {q.status === 'uploading' ? (
                  <div className="h-2 w-24 overflow-hidden rounded-full bg-surface-3">
                    <div
                      className="h-2 rounded-full bg-brand-500"
                      style={{ width: `${Math.round(q.progress * 100)}%` }}
                    />
                  </div>
                ) : null}
                <span
                  className={`text-xs ${
                    q.status === 'done'
                      ? 'text-success'
                      : q.status === 'error'
                        ? 'text-danger'
                        : 'text-ink-tertiary'
                  }`}
                >
                  {q.status === 'done'
                    ? 'Gotovo'
                    : q.status === 'error'
                      ? (q.error ?? 'Greška')
                      : q.status === 'uploading'
                        ? `${Math.round(q.progress * 100)}%`
                        : 'Čekam'}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        <footer className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-surface-4 px-4 py-2 text-sm text-ink-secondary hover:bg-surface-2"
          >
            {done.length > 0 ? sr.common.close : sr.common.cancel}
          </button>
          <button
            type="button"
            onClick={startAll}
            disabled={pending.length === 0 || anyUploading}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-600 text-ink-primary hover:bg-brand-500 disabled:opacity-60"
          >
            {anyUploading
              ? 'Šalje se…'
              : `Pošalji ${pending.length > 0 ? `(${pending.length})` : ''}`.trim()}
          </button>
        </footer>
      </div>
    </div>
  );
}
