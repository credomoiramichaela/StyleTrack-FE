import { useState } from 'react';
import { Link } from 'react-router-dom';
import { del, get, post, put, type Stylist } from '../api';
import { useAuth } from '../auth';
import { Drawer, Empty, ErrorNote, Field, Loading, PageHead, useLoad, useToast } from '../ui';

function StylistFormDrawer({ stylist, onClose, onSaved }: { stylist?: Stylist; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({
    fullName: stylist?.fullName ?? '', phone: stylist?.phone ?? '', email: stylist?.email ?? '',
    specialization: stylist?.specialization ?? '', bio: stylist?.bio ?? '', username: '', password: '',
  });
  const [active, setActive] = useState(stylist?.active ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  async function save() {
    setBusy(true); setError(null);
    const body = {
      fullName: form.fullName.trim(), phone: form.phone || undefined, email: form.email || undefined,
      specialization: form.specialization || undefined, bio: form.bio || undefined, active,
      ...(stylist ? {} : { username: form.username.trim() || undefined, password: form.password || undefined }),
    };
    try {
      if (stylist) await put(`/stylists/${stylist.id}`, body); else await post('/stylists', body);
      toast(stylist ? 'Stylist updated.' : 'Stylist added.');
      onSaved();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <Drawer title={stylist ? 'Edit stylist' : 'Add stylist'} onClose={onClose} footer={
      <>
        <button className="btn btn-quiet" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={busy || !form.fullName.trim()} onClick={save}>{busy ? 'Saving…' : 'Save stylist'}</button>
      </>
    }>
      <Field label="Full name"><input value={form.fullName} onChange={set('fullName')} autoFocus /></Field>
      <Field label="Specialty" hint="For example: hair color, nails, bridal."><input value={form.specialization} onChange={set('specialization')} /></Field>
      <Field label="Mobile number"><input value={form.phone} onChange={set('phone')} inputMode="tel" /></Field>
      <Field label="Email"><input type="email" value={form.email} onChange={set('email')} /></Field>
      <Field label="About"><textarea rows={3} value={form.bio} onChange={set('bio')} /></Field>
      {stylist ? (
        <label className="check"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />Active (can be booked)</label>
      ) : (
        <fieldset className="fieldset">
          <legend>Sign-in for this stylist (optional)</legend>
          <p className="field-hint">Lets the stylist view their own bookings and manage their schedule.</p>
          <Field label="Username"><input value={form.username} onChange={set('username')} autoComplete="off" /></Field>
          <Field label="Temporary password" hint="At least 8 characters."><input type="password" value={form.password} onChange={set('password')} autoComplete="new-password" /></Field>
        </fieldset>
      )}
      {error && <p className="field-error" role="alert">{error}</p>}
    </Drawer>
  );
}

export default function StylistsPage() {
  const { is } = useAuth();
  const toast = useToast();
  const list = useLoad(() => get<Stylist[]>('/stylists'), []);
  const [editing, setEditing] = useState<Stylist | 'new' | null>(null);

  async function deactivate(s: Stylist) {
    if (!window.confirm(`Deactivate ${s.fullName}? They can no longer be booked or sign in. Past bookings are kept.`)) return;
    try { await del(`/stylists/${s.id}`); toast(`${s.fullName} deactivated.`); list.reload(); }
    catch (e) { toast((e as Error).message, 'error'); }
  }

  return (
    <>
      <PageHead title="Stylists" sub="Open a stylist to see or change their weekly schedule.">
        {is('SUPER_ADMIN') && <button className="btn btn-primary" onClick={() => setEditing('new')}>Add stylist</button>}
      </PageHead>
      {list.loading && !list.data && <Loading />}
      {list.error && <ErrorNote message={list.error} onRetry={list.reload} />}
      {list.data && list.data.length === 0 && <Empty title="No stylists yet" hint="Add a stylist, then set the days and hours they work." />}
      {list.data && list.data.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Name</th><th>Specialty</th><th>Contact</th><th>Sign-in</th><th /></tr></thead>
            <tbody>
              {list.data.map((s) => (
                <tr key={s.id} className={s.active ? '' : 'dim'}>
                  <td><Link to={`/stylists/${s.id}`}><strong>{s.fullName}</strong></Link>{!s.active && <span className="muted"> · inactive</span>}</td>
                  <td>{s.specialization ?? <span className="muted">–</span>}</td>
                  <td>{s.phone ?? <span className="muted">–</span>}</td>
                  <td>{s.username ?? <span className="muted">None</span>}</td>
                  <td className="row-actions">
                    <Link className="btn btn-quiet" to={`/stylists/${s.id}`}>Schedule</Link>
                    {is('SUPER_ADMIN') && <button className="btn btn-quiet" onClick={() => setEditing(s)}>Edit</button>}
                    {is('SUPER_ADMIN') && s.active && <button className="btn btn-danger-quiet" onClick={() => deactivate(s)}>Deactivate</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && <StylistFormDrawer stylist={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); list.reload(); }} />}
    </>
  );
}
