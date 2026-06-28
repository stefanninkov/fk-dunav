import { Share, X } from 'lucide-react';

interface Props {
  onClose: () => void;
}

/**
 * Bottom-sheet hint shown when an iOS Safari user taps "Prati meč" before
 * installing the site as a PWA. iOS web push only works post-install
 * (iOS 16.4+), so we walk them through the Share → Add to Home Screen
 * flow rather than silently failing.
 */
export function IosInstallSheet({ onClose }: Props) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-center"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Zatvori"
        className="absolute inset-0 bg-black/60"
      />
      <div
        className="relative z-10 w-full max-w-md rounded-t-2xl bg-surface-1 p-6 pb-8 shadow-elevated"
        style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-lg font-700 text-ink-primary">
            Dodaj na početni ekran
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zatvori"
            className="-mr-2 -mt-2 rounded-md p-2 text-ink-secondary hover:bg-surface-2"
          >
            <X size={18} />
          </button>
        </div>
        <p className="mt-2 text-sm text-ink-secondary">
          Da bi dobijao notifikacije za utakmice na iPhone-u, prvo dodaj sajt
          na početni ekran. Posle toga, ponovo otvori ovu stranicu sa ikonice
          i klikni <strong>Prati meč</strong>.
        </p>
        <ol className="mt-4 flex flex-col gap-3 text-sm text-ink-primary">
          <li className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 font-700 text-ink-primary">
              1
            </span>
            <span className="flex flex-1 items-center gap-2">
              Klikni <Share size={16} className="inline-block" /> u Safari traci.
            </span>
          </li>
          <li className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 font-700 text-ink-primary">
              2
            </span>
            <span className="flex-1">
              Skroluj dole i izaberi <strong>"Add to Home Screen"</strong>.
            </span>
          </li>
          <li className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 font-700 text-ink-primary">
              3
            </span>
            <span className="flex-1">
              Otvori ikonicu sa početnog ekrana — sad možeš da pratiš utakmicu.
            </span>
          </li>
        </ol>
      </div>
    </div>
  );
}
