import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { get, post, put, type Customer, type Page } from '../api';
import { useAuth } from '../auth';
import { TierBadge } from '../TreatmentComponents';
import { Drawer, Empty, ErrorNote, Field, Loading, PageHead, Pager, useLoad, useToast } from '../ui';

export function CustomerFormDrawer({ customer, onClose, onSaved }: {
  customer?: Customer; onClose: () => void; onSaved: (c: Customer) => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({
    fullName: customer?.fullName ?? '', phone: customer?.phone ?? '', email: customer?.email ?? '',
    address: customer?.address ?? '', birthDate: customer?.birthDate ?? '', notes: customer?.notes ?? '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  async function save() {
    setBusy(true); setError(null);
    const body = { ...form, email: form.email || undefined, birthDate: form.birthDate || undefined };
    try {
      const saved = customer ? await put<Customer>(`/customers/${customer.id}`, body) : await post<Customer>('/customers', body);
      toast(customer ? 'Customer updated.' : 'Customer added.');
      onSaved(saved);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <Drawer title={customer ? 'Edit customer' : 'Add customer'} onClose={onClose} footer={
      <>
        <button className="btn btn-quiet" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={busy || !form.fullName.trim() || !form.phone.trim()} onClick={save}>{busy ? 'Saving…' : 'Save customer'}</button>
      </>
    }>
      <Field label="Full name"><input value={form.fullName} onChange={set('fullName')} autoFocus /></Field>
      <Field label="Mobile number"><input value={form.phone} onChange={set('phone')} inputMode="tel" /></Field>
      <Field label="Email"><input type="email" value={form.email} onChange={set('email')} /></Field>
      <Field label="Home address" hint="Used as the default address for home service."><textarea rows={2} value={form.address} onChange={set('address')} /></Field>
      <Field label="Birthday"><input type="date" value={form.birthDate} onChange={set('birthDate')} /></Field>
      <Field label="Notes" hint="Allergies, preferences, anything the stylist should know."><textarea rows={3} value={form.notes} onChange={set('notes')} /></Field>
      {error && <p className="field-error" role="alert">{error}</p>}
    </Drawer>
  );
}

export default function CustomersPage() {
  const { is } = useAuth();
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const [pageNo, setPageNo] = useState(0);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => { setTerm(q.trim()); setPageNo(0); }, 300);
    return () => window.clearTimeout(id);
  }, [q]);

  const list = useLoad(() => get<Page<Customer>>('/customers', { q: term, page: pageNo, size: 20 }), [term, pageNo]);

  return (
    <>
      <PageHead title="Customers" sub={list.data ? `${list.data.totalElements} ${list.data.totalElements === 1 ? 'customer' : 'customers'}${term ? ' match your search' : ''}` : undefined}>
        {is('SUPER_ADMIN', 'ADMIN') && <button className="btn btn-primary" onClick={() => setAdding(true)}>Add customer</button>}
      </PageHead>
      <div className="filters">
        <input className="search" type="search" placeholder="Search by name, phone or email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search customers" />
      </div>
      {list.loading && !list.data && <Loading />}
      {list.error && <ErrorNote message={list.error} onRetry={list.reload} />}
      {list.data && list.data.content.length === 0 && (
        <Empty title={term ? 'No customers match that search' : 'No customers yet'} hint={term ? 'Check the spelling or search by phone number.' : 'Add your first customer to start booking appointments.'} />
      )}
      {list.data && list.data.content.length > 0 && (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Name</th><th>Mobile</th><th>Email</th><th className="num">Visits</th><th className="num">Points</th></tr></thead>
              <tbody>
                {list.data.content.map((c) => (
                  <tr key={c.id} className={c.active ? '' : 'dim'}>
                    <td><Link to={`/customers/${c.id}`}><strong>{c.fullName}</strong></Link>{!c.active && <span className="muted"> · inactive</span>} <TierBadge tier={c.tier} /></td>
                    <td>{c.phone}</td>
                    <td>{c.email ?? <span className="muted">–</span>}</td>
                    <td className="num">{c.completedVisits}</td>
                    <td className="num">{c.loyaltyPoints}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={list.data} onPage={setPageNo} />
        </>
      )}
      {adding && <CustomerFormDrawer onClose={() => setAdding(false)} onSaved={() => { setAdding(false); list.reload(); }} />}
    </>
  );
}
