import { useState } from 'react';
import { del, get, post, put, type Service } from '../api';
import { useAuth } from '../auth';
import { money } from '../format';
import { Drawer, Empty, ErrorNote, Field, Loading, PageHead, useLoad, useToast } from '../ui';

function ServiceFormDrawer({ service, onClose, onSaved }: { service?: Service; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({
    name: service?.name ?? '', category: service?.category ?? '', description: service?.description ?? '',
    price: service ? String(service.price) : '', durationMinutes: service ? String(service.durationMinutes) : '60',
    pointsAwarded: service?.pointsAwarded != null ? String(service.pointsAwarded) : '',
  });
  const [home, setHome] = useState(service?.homeServiceAvailable ?? false);
  const [active, setActive] = useState(service?.active ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  async function save() {
    setBusy(true); setError(null);
    const body = {
      name: form.name.trim(), category: form.category || undefined, description: form.description || undefined,
      price: Number(form.price), durationMinutes: Number(form.durationMinutes),
      pointsAwarded: form.pointsAwarded === '' ? undefined : Number(form.pointsAwarded),
      homeServiceAvailable: home, active,
    };
    try {
      if (service) await put(`/services/${service.id}`, body); else await post('/services', body);
      toast(service ? 'Service updated.' : 'Service added.');
      onSaved();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <Drawer title={service ? 'Edit service' : 'Add service'} onClose={onClose} footer={
      <>
        <button className="btn btn-quiet" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={busy || !form.name.trim() || form.price === '' || Number(form.durationMinutes) < 5} onClick={save}>{busy ? 'Saving…' : 'Save service'}</button>
      </>
    }>
      <Field label="Name"><input value={form.name} onChange={set('name')} autoFocus /></Field>
      <Field label="Category" hint="For example: Hair, Nails, Spa."><input value={form.category} onChange={set('category')} /></Field>
      <div className="two">
        <Field label="Price (₱)"><input type="number" min="0" step="1" value={form.price} onChange={set('price')} /></Field>
        <Field label="Duration (minutes)"><input type="number" min="5" step="5" value={form.durationMinutes} onChange={set('durationMinutes')} /></Field>
      </div>
      <Field label="Loyalty points" hint="Leave blank to give 1 point per ₱100 spent."><input type="number" min="0" value={form.pointsAwarded} onChange={set('pointsAwarded')} /></Field>
      <Field label="Description"><textarea rows={3} value={form.description} onChange={set('description')} /></Field>
      <label className="check"><input type="checkbox" checked={home} onChange={(e) => setHome(e.target.checked)} />Can be done as a home service</label>
      {service && <label className="check"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />Offered to customers</label>}
      {error && <p className="field-error" role="alert">{error}</p>}
    </Drawer>
  );
}

export default function ServicesPage() {
  const { is } = useAuth();
  const toast = useToast();
  const list = useLoad(() => get<Service[]>('/services'), []);
  const [editing, setEditing] = useState<Service | 'new' | null>(null);
  const admin = is('SUPER_ADMIN');

  async function deactivate(s: Service) {
    if (!window.confirm(`Stop offering ${s.name}? Past bookings keep their record.`)) return;
    try { await del(`/services/${s.id}`); toast(`${s.name} is no longer offered.`); list.reload(); }
    catch (e) { toast((e as Error).message, 'error'); }
  }

  return (
    <>
      <PageHead title="Services" sub="What customers can book, how long it takes and what it costs.">
        {admin && <button className="btn btn-primary" onClick={() => setEditing('new')}>Add service</button>}
      </PageHead>
      {list.loading && !list.data && <Loading />}
      {list.error && <ErrorNote message={list.error} onRetry={list.reload} />}
      {list.data && list.data.length === 0 && <Empty title="No services yet" hint="Add the services your salon offers so they can be booked." />}
      {list.data && list.data.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Service</th><th>Category</th><th className="num">Duration</th><th className="num">Price</th><th>Home service</th>{admin && <th />}</tr></thead>
            <tbody>
              {list.data.map((s) => (
                <tr key={s.id} className={s.active ? '' : 'dim'}>
                  <td><strong>{s.name}</strong>{!s.active && <span className="muted"> · not offered</span>}{s.description && <><br /><span className="muted">{s.description}</span></>}</td>
                  <td>{s.category ?? <span className="muted">–</span>}</td>
                  <td className="num">{s.durationMinutes} min</td>
                  <td className="num">{money(s.price)}</td>
                  <td>{s.homeServiceAvailable ? 'Yes' : <span className="muted">No</span>}</td>
                  {admin && (
                    <td className="row-actions">
                      <button className="btn btn-quiet" onClick={() => setEditing(s)}>Edit</button>
                      {s.active && <button className="btn btn-danger-quiet" onClick={() => deactivate(s)}>Stop offering</button>}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && <ServiceFormDrawer service={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); list.reload(); }} />}
    </>
  );
}
