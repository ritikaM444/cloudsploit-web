import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.ts';
import { useAuth } from '../auth.tsx';

export function Settings() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const change = useMutation({
    mutationFn: () => api.changePassword({ currentPassword, newPassword }),
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      setConfirm('');
      setError(null);
      setNotice('Password updated. Use it the next time you sign in.');
    },
    onError: (err: unknown) =>
      setError(err instanceof Error ? err.message : 'Failed to change password'),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (newPassword !== confirm) {
      setError('The new passwords do not match');
      return;
    }
    if (newPassword.length < 10) {
      setError('The new password must be at least 10 characters');
      return;
    }
    change.mutate();
  }

  async function onSignOut() {
    try {
      await logout();
    } finally {
      navigate('/login', { replace: true });
    }
  }

  const roleLabel = user?.role === 'admin' ? 'Administrator' : 'User';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Settings</h1>
        <p className="text-sm text-slate-400">Your profile and account security.</p>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60">
        <h2 className="border-b border-slate-800 px-5 py-3 text-sm font-semibold text-white">
          Profile
        </h2>
        <dl className="divide-y divide-slate-800">
          <div className="flex items-center justify-between px-5 py-3">
            <dt className="text-sm text-slate-400">Email</dt>
            <dd className="text-sm text-white">{user?.email}</dd>
          </div>
          <div className="flex items-center justify-between px-5 py-3">
            <dt className="text-sm text-slate-400">Role</dt>
            <dd className="text-sm text-white">{roleLabel}</dd>
          </div>
        </dl>
      </div>

      <form onSubmit={onSubmit} className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <h2 className="mb-4 text-sm font-semibold text-white">Change password</h2>

        <label className="mb-1 block text-xs text-slate-400">Current password</label>
        <input
          type="password"
          required
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className="mb-4 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-sky-500"
        />

        <label className="mb-1 block text-xs text-slate-400">New password</label>
        <input
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="mb-4 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-sky-500"
        />

        <label className="mb-1 block text-xs text-slate-400">Confirm new password</label>
        <input
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="mb-4 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-sky-500"
        />

        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}
        {notice && <p className="mb-3 text-sm text-emerald-400">{notice}</p>}

        <button
          type="submit"
          disabled={change.isPending}
          className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
        >
          {change.isPending ? 'Updating…' : 'Update password'}
        </button>
      </form>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <h2 className="mb-1 text-sm font-semibold text-white">Sign out</h2>
        <p className="mb-4 text-sm text-slate-400">End this session on the current device.</p>
        <button
          type="button"
          onClick={onSignOut}
          className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
