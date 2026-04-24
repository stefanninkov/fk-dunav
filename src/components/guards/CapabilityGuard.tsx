import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

import type { Capability } from '@/lib/firestore/types';
import { useAuthStore } from '@/stores/useAuthStore';

interface Props {
  children: ReactNode;
  /** Required capability. Omit for admin-only pages. */
  cap?: Capability;
}

/**
 * Wraps an admin route and blocks access for users who lack the required
 * capability. Admins bypass the check. If the user is missing the cap,
 * they land back on the admin dashboard (which they can always see).
 */
export function CapabilityGuard({ cap, children }: Props) {
  const role = useAuthStore((s) => s.role);
  const caps = useAuthStore((s) => s.caps);

  if (role === 'admin') return <>{children}</>;

  // Admin-only route (no cap) → non-admin can't enter.
  if (!cap) return <Navigate to="/admin" replace />;

  if (caps.includes(cap)) return <>{children}</>;
  return <Navigate to="/admin" replace />;
}
