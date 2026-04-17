import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { sr } from '@/i18n/sr';
import { useAuthStore } from '@/stores/useAuthStore';

interface Props {
  children: ReactNode;
}

export function AuthGuard({ children }: Props) {
  const location = useLocation();
  const loading = useAuthStore((s) => s.loading);
  const uid = useAuthStore((s) => s.uid);
  const role = useAuthStore((s) => s.role);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-0 text-ink-secondary">
        {sr.common.loading}
      </div>
    );
  }

  if (!uid || !role) {
    return <Navigate to="/admin/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}
