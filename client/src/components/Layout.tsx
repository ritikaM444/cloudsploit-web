import { NavLink, Link, Outlet, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '../auth.tsx';

function NavItem({ to, children }: { to: string; children: ReactNode }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
          isActive ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
        }`
      }
    >
      {children}
    </NavLink>
  );
}

function initials(email: string): string {
  const local = email.split('@')[0] ?? email;
  const parts = local.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  if (parts.length === 0) return email.slice(0, 2).toUpperCase();
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  async function onSignOut() {
    setSigningOut(true);
    try {
      await logout();
    } finally {
      navigate('/login', { replace: true });
      setSigningOut(false);
    }
  }

  const roleLabel = user?.role === 'admin' ? 'Administrator' : 'User';

  return (
    <div className="min-h-full">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <Link to="/" className="text-lg font-semibold tracking-tight text-white">
              Cloud<span className="text-sky-400">Sploit</span>
            </Link>
            <nav className="hidden items-center gap-1 sm:flex">
              <NavItem to="/">Dashboard</NavItem>
              <NavItem to="/accounts">Accounts</NavItem>
              <NavItem to="/scans">Scans</NavItem>
              <NavItem to="/manual">Manual</NavItem>
            </nav>
          </div>

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="flex items-center gap-2 rounded-full border border-slate-700 py-1 pl-1 pr-3 hover:bg-slate-800"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-600 text-xs font-semibold text-white">
                {initials(user?.email ?? '?')}
              </span>
              <span className="hidden max-w-[12rem] truncate text-xs text-slate-300 sm:inline">
                {user?.email}
              </span>
            </button>

            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 z-30 mt-2 w-64 overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-xl"
              >
                <div className="border-b border-slate-800 px-4 py-3">
                  <div className="truncate text-sm text-white">{user?.email}</div>
                  <div className="text-xs text-slate-400">{roleLabel}</div>
                </div>
                <Link
                  to="/settings"
                  onClick={() => setMenuOpen(false)}
                  className="block px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
                >
                  Settings
                </Link>
                <Link
                  to="/manual"
                  onClick={() => setMenuOpen(false)}
                  className="block px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
                >
                  User manual
                </Link>
                <button
                  type="button"
                  onClick={onSignOut}
                  disabled={signingOut}
                  className="block w-full px-4 py-2 text-left text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50"
                >
                  {signingOut ? 'Signing out…' : 'Sign out'}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
