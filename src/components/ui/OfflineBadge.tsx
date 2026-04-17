import { WifiOff } from 'lucide-react';

import { sr } from '@/i18n/sr';
import { useOfflineStore } from '@/stores/useOfflineStore';

export function OfflineBadge() {
  const online = useOfflineStore((s) => s.online);
  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-2 bg-warning-soft px-4 py-2 text-sm text-warning"
    >
      <WifiOff size={16} />
      <span>{sr.common.offline}</span>
    </div>
  );
}
