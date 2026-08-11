import { type ReactNode } from 'react';
import {
  FiBarChart2,
  FiSend,
  FiBookOpen,
  FiUsers,
  FiCpu,
  FiArchive,
  FiCheckSquare,
  FiActivity,
  FiLogOut,
} from 'react-icons/fi';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';

import { useAuthStore } from 'src/stores/authStore';
import { layout, motion } from 'src/theme/tokens';

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  end?: boolean;
}

const NAV: NavItem[] = [
  { to: '/', label: 'Overview', icon: <FiBarChart2 />, end: true },
  { to: '/users', label: 'Users', icon: <FiUsers /> },
  { to: '/content', label: 'Content Library', icon: <FiBookOpen /> },
    { to: '/broadcast', label: 'Broadcast', icon: <FiSend /> },
  { to: '/training', label: 'Training Runs', icon: <FiCpu /> },
  { to: '/models', label: 'Model Registry', icon: <FiArchive /> },
  { to: '/evaluation', label: 'Evaluation', icon: <FiCheckSquare /> },
  { to: '/audit', label: 'Audit Logs', icon: <FiActivity /> },
];

export function AppShell() {
  const user = useAuthStore(state => state.user);
  const logout = useAuthStore(state => state.logout);
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  const displayName = user?.display_name ?? user?.email ?? 'Admin';
  const initial = (displayName.charAt(0) ?? 'A').toUpperCase();

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside
        style={{
          width: layout.sidebarWidth,
          borderRight: '1px solid var(--border)',
          background: 'var(--surface)',
          position: 'sticky',
          top: 0,
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                background: 'var(--primary)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 16,
              }}
            >
              S
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>SheCare</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Admin Console</div>
            </div>
          </div>
        </div>

        <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className="btn btn-ghost"
              style={({ isActive }) => ({
                justifyContent: 'flex-start',
                width: '100%',
                gap: 10,
                fontSize: 14,
                fontWeight: isActive ? 700 : 500,
                minHeight: 40,
                color: isActive ? 'var(--primary)' : 'var(--text)',
                background: isActive ? 'var(--primary-soft)' : 'transparent',
                borderRadius: 10,
                transition: `background ${motion.fast}, color ${motion.fast}`,
              })}
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div style={{ padding: 12, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              background: 'var(--surface-alt)',
              color: 'var(--text)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
            }}
          >
            {initial}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {displayName}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{user?.role}</div>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleLogout}
            aria-label="Log out"
            title="Log out"
          >
            <FiLogOut />
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, minWidth: 0, padding: '28px 32px 48px', background: 'var(--bg)' }}>
        <Outlet />
      </main>
    </div>
  );
}
