import { useState } from 'react';
import { del, get, post, put, type Role, type User } from '../api';
import { useAuth } from '../auth';
import { Drawer, ErrorNote, Field, Loading, PageHead, useLoad, useToast } from '../ui';

const ROLE_LABEL: Record<Role, string> = { SUPER_ADMIN: 'Super Admin', ADMIN: 'Admin', STYLIST: 'Stylist' };

function UserFormDrawer({ user, onClose, onSaved }: { user?: User; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({
    username: user?.username ?? '', password: '', fullName: user?.fullName ?? '', email: user?.email ?? '', phone: user?.phone ?? '',
  });
  const [role, setRole] = useState<Role>(user?.role ?? 'ADMIN');
  const [active, setActive] = useState(user?.active ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  async function save() {
    setBusy(true); setError(null);
    try {
      if (user) {
        await put(`/users/${user.id}`, { fullName: form.fullName.trim(), email: form.email || undefined, phone: form.phone || undefined, role, active });
      } else {
        await post('/users', { username: form.username.trim(), password: form.password, fullName: form.fullName.trim(), email: form.email || undefined, phone: form.phone || undefined, role });
      }
      toast(user ? 'Login updated.' : 'Login created.');
      onSaved();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  const valid = form.fullName.trim() && (user || (form.username.trim().length >= 3 && form.password.length >= 8));
  return (
    <Drawer title={user ? 'Edit login' : 'Add login'} onClose={onClose} footer={
      <>
        <button className="btn btn-quiet" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={busy || !valid} onClick={save}>{busy ? 'Saving…' : 'Save login'}</button>
      </>
    }>
      <Field label="Full name"><input value={form.fullName} onChange={set('fullName')} autoFocus /></Field>
      {!user && (
        <>
          <Field label="Username" hint="At least 3 characters."><input value={form.username} onChange={set('username')} autoComplete="off" /></Field>
          <Field label="Temporary password" hint="At least 8 characters. Share it securely."><input type="password" value={form.password} onChange={set('password')} autoComplete="new-password" /></Field>
        </>
      )}
      <Field label="Role" hint="Stylist logins are best created from the Stylists page so they are linked to a stylist profile.">
        <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
          <option value="SUPER_ADMIN">Super Admin: full access</option>
          <option value="ADMIN">Admin: bookings, customers, loyalty, reports</option>
          <option value="STYLIST">Stylist: own bookings and hours</option>
        </select>
      </Field>
      <Field label="Email"><input type="email" value={form.email} onChange={set('email')} /></Field>
      <Field label="Mobile number"><input value={form.phone} onChange={set('phone')} /></Field>
      {user && <label className="check"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />Can sign in</label>}
      {error && <p className="field-error" role="alert">{error}</p>}
    </Drawer>
  );
}

function PasswordDrawer({ user, onClose }: { user: User; onClose: () => void }) {
  const toast = useToast();
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save() {
    setBusy(true); setError(null);
    try { await put(`/users/${user.id}/password`, { newPassword: pw }); toast(`Password changed for ${user.fullName}.`); onClose(); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <Drawer title="Reset password" onClose={onClose} footer={
      <>
        <button className="btn btn-quiet" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={busy || pw.length < 8} onClick={save}>Set new password</button>
      </>
    }>
      <p className="sub">Choose a new password for {user.fullName} ({user.username}).</p>
      <Field label="New password" hint="At least 8 characters."><input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" autoFocus /></Field>
      {error && <p className="field-error" role="alert">{error}</p>}
    </Drawer>
  );
}

export default function UsersPage() {
  const { user: me } = useAuth();
  const toast = useToast();
  const list = useLoad(() => get<User[]>('/users'), []);
  const [editing, setEditing] = useState<User | 'new' | null>(null);
  const [resetting, setResetting] = useState<User | null>(null);

  async function deactivate(u: User) {
    if (!window.confirm(`Stop ${u.fullName} from signing in?`)) return;
    try { await del(`/users/${u.id}`); toast(`${u.fullName} can no longer sign in.`); list.reload(); }
    catch (e) { toast((e as Error).message, 'error'); }
  }

  return (
    <>
      <PageHead title="Team logins" sub="Who can sign in to Jonathan Hair Studio and what they can do.">
        <button className="btn btn-primary" onClick={() => setEditing('new')}>Add login</button>
      </PageHead>
      {list.loading && !list.data && <Loading />}
      {list.error && <ErrorNote message={list.error} onRetry={list.reload} />}
      {list.data && (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Name</th><th>Username</th><th>Role</th><th /></tr></thead>
            <tbody>
              {list.data.map((u) => (
                <tr key={u.id} className={u.active ? '' : 'dim'}>
                  <td><strong>{u.fullName}</strong>{!u.active && <span className="muted"> · cannot sign in</span>}{u.id === me?.id && <span className="muted"> · you</span>}</td>
                  <td>{u.username}</td>
                  <td>{ROLE_LABEL[u.role]}</td>
                  <td className="row-actions">
                    <button className="btn btn-quiet" onClick={() => setEditing(u)}>Edit</button>
                    <button className="btn btn-quiet" onClick={() => setResetting(u)}>Reset password</button>
                    {u.active && u.id !== me?.id && <button className="btn btn-danger-quiet" onClick={() => deactivate(u)}>Deactivate</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && <UserFormDrawer user={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); list.reload(); }} />}
      {resetting && <PasswordDrawer user={resetting} onClose={() => setResetting(null)} />}
    </>
  );
}
