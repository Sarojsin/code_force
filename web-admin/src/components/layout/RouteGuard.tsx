import type { ReactNode } from 'react';

import { useAuthStore } from 'src/stores/authStore';

/**
 * Blocks non-admin access. The backend `require_admin` is the real authority;
 * this guard only affects the UI.
 */
export function RouteGuard({ children }: { children: ReactNode }) {
  const user = useAuthStore(state => state.user);

  if (user && user.role !== 'admin') {
    return (
      <div className="empty-state">
        <div style={{ fontWeight: 600 }}>Access denied</div>
        <div>Only admin accounts can use this dashboard.</div>
      </div>
    );
  }
  return <>{children}</>;
}
