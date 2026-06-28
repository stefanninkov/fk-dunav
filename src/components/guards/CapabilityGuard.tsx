import type { ReactNode } from 'react';

import type { Capability } from '@/lib/firestore/types';

interface Props {
  children: ReactNode;
  /** Required capability. Omit for admin-only pages. */
  cap?: Capability;
}

/**
 * Tournament-day open mode: capability gating is disabled — the admin
 * panel is publicly reachable and the guard passes every visitor
 * through. The `cap` prop is kept on the API so the per-route call
 * sites don't have to change when we tighten back post-tournament.
 *
 * Original implementation (capability-based redirect to /admin):
 * https://github.com/stefanninkov/fk-dunav  — restore from git history
 * after the event.
 */
export function CapabilityGuard({ children }: Props) {
  return <>{children}</>;
}
