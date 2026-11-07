import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  del, get, post, put,
  type Appointment, type Customer, type LoyaltyTx, type Page, type Recommendation, type Reward, type Service, type Stylist, type Suggestion,
} from '../api';
import { useAuth } from '../auth';
import { AppointmentDrawer, NewBookingDrawer } from '../AppointmentDrawers';
import { fmtDay, fmtTime, money, titleCase } from '../format';
import { TierBadge, TreatmentHistory } from '../TreatmentComponents';
import { Drawer, Empty, ErrorNote, Field, Loading, PageHead, Pager, StatusBadge, useLoad, useToast } from '../ui';
import { CustomerFormDrawer } from './CustomersPage';

type Tab = 'history' | 'treatments' | 'loyalty' | 'recommendations';

export default function CustomerDetailPage() {
  const { id } = useParams();
  const customerId = Number(id);
  const { is } = useAuth();
  const [tab, setTab] = useState<Tab>('history');
  const [editing, setEditing] = useState(false);
  const [booking, setBooking] = useState(false);
  const customer = useLoad(() => get<Customer>(`/customers/${customerId}`), [customerId]);

  if (customer.loading && !customer.data) return <Loading />;
  if (customer.error || !customer.data) return <ErrorNote message={customer.error ?? 'Customer not found'} onRetry={customer.reload} />;
  const c = customer.data;
  const desk = is('SUPER_ADMIN', 'ADMIN');

  return (
    <>
      <p className="crumb"><Link to="/customers">Customers</Link></p>
      <PageHead title={c.fullName} sub={<>{c.phone}{c.email ? ` · ${c.email}` : ''}{!c.active ? ' · inactive' : ''} <TierBadge tier={c.tier} /></>}>
        {desk && <button className="btn btn-quiet" onClick={() => setEditing(true)}>Edit details</button>}
        {desk && c.active && <button className="btn btn-primary" onClick={() => setBooking(true)}>Book appointment</button>}
      </PageHead>

      <div className="profile-strip">
        <div><span className="k">Loyalty points</span><strong>{c.loyaltyPoints}</strong><span className="k">{c.completedVisits} completed {c.completedVisits === 1 ? 'visit' : 'visits'}</span></div>
        <div><span className="k">Address</span><span>{c.address || '–'}</span></div>
        <div><span className="k">Notes</span><span>{c.notes || '–'}</span></div>
      </div>

      <div className="tabs" role="tablist">
        {([['history', 'Visit history'], ['treatments', 'Treatment history'], ['loyalty', 'Loyalty points'], ['recommendations', 'Recommendations']] as [Tab, string][]).map(([key, label]) => (
          <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? 'on' : ''} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>

      {tab === 'history' && <History customerId={customerId} />}
      {tab === 'treatments' && <TreatmentHistory customerId={customerId} />}
      {tab === 'loyalty' && <Loyalty customer={c} onChanged={customer.reload} />}
      {tab === 'recommendations' && <Recommendations customerId={customerId} />}

      {editing && <CustomerFormDrawer customer={c} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); customer.reload(); }} />}
      {booking && <NewBookingDrawer presetCustomer={c} onClose={() => setBooking(false)} onDone={() => { setBooking(false); setTab('history'); customer.reload(); }} />}
    </>
  );
}

/* ---------------- history ---------------- */

function History({ customerId }: { customerId: number }) {
  const [pageNo, setPageNo] = useState(0);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const list = useLoad(() => get<Page<Appointment>>(`/customers/${customerId}/history`, { page: pageNo, size: 10 }), [customerId, pageNo]);
  if (list.loading && !list.data) return <Loading />;
  if (list.error) return <ErrorNote message={list.error} onRetry={list.reload} />;
  if (!list.data || list.data.content.length === 0) return <Empty title="No visits yet" hint="Bookings and completed services will be listed here." />;
  return (
    <>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>When</th><th>Service</th><th>Stylist</th><th>Status</th><th className="num">Total</th></tr></thead>
          <tbody>
            {list.data.content.map((a) => (
              <tr key={a.id} className="click" tabIndex={0} onClick={() => setSelected(a)} onKeyDown={(e) => { if (e.key === 'Enter') setSelected(a); }}>
                <td><strong>{fmtDay(a.startTime)}</strong><br /><span className="muted">{fmtTime(a.startTime)}</span></td>
                <td>{a.serviceName}{a.type === 'HOME_SERVICE' && <span className="muted"> · home service</span>}</td>
                <td>{a.stylistName}</td>
                <td><StatusBadge status={a.status} /></td>
                <td className="num">{money(a.totalAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={list.data} onPage={setPageNo} />
      {selected && <AppointmentDrawer appointment={selected} onClose={() => setSelected(null)} onChanged={list.reload} />}
    </>
  );
}

/* ---------------- loyalty ---------------- */

function Loyalty({ customer, onChanged }: { customer: Customer; onChanged: () => void }) {
  const { is } = useAuth();
  const toast = useToast();
  const [pageNo, setPageNo] = useState(0);
  const [mode, setMode] = useState<null | 'redeem' | 'adjust' | 'reward'>(null);
  const [rewardId, setRewardId] = useState<number | null>(null);
  const [points, setPoints] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canSeeLedger = is('SUPER_ADMIN', 'ADMIN');
  const rewards = useLoad<Reward[] | null>(() => (canSeeLedger ? get<Reward[]>('/rewards', { activeOnly: true }) : Promise.resolve(null)), [canSeeLedger]);
  const list = useLoad<Page<LoyaltyTx> | null>(() => (canSeeLedger ? get<Page<LoyaltyTx>>(`/loyalty/customers/${customer.id}/transactions`, { page: pageNo, size: 10 }) : Promise.resolve(null)), [customer.id, pageNo, customer.loyaltyPoints]);

  async function submit() {
    setBusy(true); setError(null);
    try {
      const n = Number(points);
      if (mode === 'reward') await post(`/loyalty/customers/${customer.id}/redeem-reward`, { rewardId });
      else if (mode === 'redeem') await post(`/loyalty/customers/${customer.id}/redeem`, { points: n, description: description || undefined });
      else await post(`/loyalty/customers/${customer.id}/adjust`, { points: n, description });
      toast(mode === 'reward' ? 'Reward redeemed.' : mode === 'redeem' ? `${n} points redeemed.` : 'Points adjusted.');
      setMode(null); setPoints(''); setDescription(''); setRewardId(null);
      onChanged(); list.reload();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <>
      {canSeeLedger && (
        <div className="actions inline-actions">
          <button className="btn btn-primary" onClick={() => { setMode('reward'); setRewardId(null); setError(null); }}>Redeem a reward</button>
          <button className="btn btn-quiet" onClick={() => { setMode('redeem'); setError(null); }}>Redeem points</button>
          {is('SUPER_ADMIN') && <button className="btn btn-quiet" onClick={() => { setMode('adjust'); setError(null); }}>Adjust points</button>}
        </div>
      )}
      {!canSeeLedger && <p className="muted">Balance: {customer.loyaltyPoints} points.</p>}
      {list.error && <ErrorNote message={list.error} onRetry={list.reload} />}
      {list.data && list.data.content.length === 0 && <Empty title="No point activity yet" hint="Points are added automatically when a service is completed." />}
      {list.data && list.data.content.length > 0 && (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Date</th><th>What happened</th><th className="num">Points</th><th className="num">Balance</th></tr></thead>
              <tbody>
                {list.data.content.map((t) => (
                  <tr key={t.id}>
                    <td>{fmtDay(t.createdAt)}</td>
                    <td>{t.description}<br /><span className="muted">{titleCase(t.type)}</span></td>
                    <td className={`num ${t.points < 0 ? 'neg' : 'pos'}`}>{t.points > 0 ? `+${t.points}` : t.points}</td>
                    <td className="num">{t.balanceAfter}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={list.data} onPage={setPageNo} />
        </>
      )}
      {mode === 'reward' && (
        <Drawer title="Redeem a reward" onClose={() => setMode(null)} footer={
          <>
            <button className="btn btn-quiet" onClick={() => setMode(null)}>Cancel</button>
            <button className="btn btn-primary" disabled={busy || rewardId === null} onClick={submit}>{busy ? 'Redeeming…' : 'Redeem reward'}</button>
          </>
        }>
          <p className="sub">{customer.fullName} has <strong>{customer.loyaltyPoints}</strong> points.</p>
          {rewards.error && <ErrorNote message={rewards.error} onRetry={rewards.reload} />}
          {rewards.data && rewards.data.length === 0 && <Empty title="No rewards set up" hint={is('SUPER_ADMIN') ? 'Add rewards on the Rewards page, or use "Redeem points" for a custom amount.' : 'Ask the owner to add rewards, or use "Redeem points" for a custom amount.'} />}
          <ul className="reward-pick">
            {(rewards.data ?? []).map((r) => {
              const short = r.pointsCost > customer.loyaltyPoints;
              return (
                <li key={r.id}>
                  <label className={`${rewardId === r.id ? 'on' : ''} ${short ? 'dim' : ''}`}>
                    <input type="radio" name="reward" disabled={short} checked={rewardId === r.id} onChange={() => setRewardId(r.id)} />
                    <span><strong>{r.name}</strong>{r.description && <><br /><span className="muted">{r.description}</span></>}</span>
                    <span className="cost">{r.pointsCost} pts{short ? <><br /><span className="muted">needs {r.pointsCost - customer.loyaltyPoints} more</span></> : null}</span>
                  </label>
                </li>
              );
            })}
          </ul>
          {error && <p className="field-error" role="alert">{error}</p>}
        </Drawer>
      )}
      {(mode === 'redeem' || mode === 'adjust') && (
        <Drawer title={mode === 'redeem' ? 'Redeem points' : 'Adjust points'} onClose={() => setMode(null)} footer={
          <>
            <button className="btn btn-quiet" onClick={() => setMode(null)}>Cancel</button>
            <button className="btn btn-primary" disabled={busy || !points || Number(points) === 0 || (mode === 'adjust' && !description.trim())} onClick={submit}>{mode === 'redeem' ? 'Redeem' : 'Save adjustment'}</button>
          </>
        }>
          <p className="sub">{customer.fullName} has <strong>{customer.loyaltyPoints}</strong> points.</p>
          <Field label={mode === 'redeem' ? 'Points to redeem' : 'Points to add (use a minus sign to remove)'}>
            <input type="number" value={points} onChange={(e) => setPoints(e.target.value)} min={mode === 'redeem' ? 1 : undefined} autoFocus />
          </Field>
          <Field label={mode === 'redeem' ? 'What was it used for? (optional)' : 'Reason'}>
            <input value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          {error && <p className="field-error" role="alert">{error}</p>}
        </Drawer>
      )}
    </>
  );
}

/* ---------------- recommendations ---------------- */

function Recommendations({ customerId }: { customerId: number }) {
  const { is } = useAuth();
  const toast = useToast();
  const desk = is('SUPER_ADMIN', 'ADMIN');
  const saved = useLoad(() => get<Recommendation[]>(`/recommendations/customer/${customerId}`), [customerId]);
  const suggestions = useLoad(() => get<Suggestion[]>(`/recommendations/customer/${customerId}/suggestions`), [customerId]);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    try {
      await post(`/recommendations/customer/${customerId}/generate`);
      toast('Suggestions saved to this customer.');
      saved.reload();
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }

  async function toggle(r: Recommendation) {
    try {
      await put(`/recommendations/${r.id}`, { customerId, serviceId: r.serviceId, stylistId: r.stylistId, message: r.message, active: !r.active });
      saved.reload();
    } catch (e) { toast((e as Error).message, 'error'); }
  }

  async function remove(r: Recommendation) {
    if (!window.confirm('Delete this recommendation?')) return;
    try { await del(`/recommendations/${r.id}`); toast('Recommendation deleted.'); saved.reload(); }
    catch (e) { toast((e as Error).message, 'error'); }
  }

  return (
    <>
      <section className="split">
        <div>
          <div className="section-head">
            <h2>Saved for this customer</h2>
            {desk && <button className="btn btn-quiet" onClick={() => setAdding(true)}>Write a recommendation</button>}
          </div>
          {saved.error && <ErrorNote message={saved.error} onRetry={saved.reload} />}
          {saved.data && saved.data.length === 0 && <Empty title="Nothing saved yet" hint="Write one yourself, or save the suggestions from their visit history." />}
          <ul className="rec-list">
            {(saved.data ?? []).map((r) => (
              <li key={r.id} className={r.active ? '' : 'dim'}>
                <div>
                  <strong>{r.serviceName}</strong>{r.stylistName && <span className="muted"> with {r.stylistName}</span>}
                  <p>{r.message}</p>
                  <span className="muted">{r.source === 'AUTO' ? 'From visit history' : 'Written by staff'}{!r.active && ' · hidden'}</span>
                </div>
                {desk && (
                  <div className="rec-actions">
                    <button className="btn btn-quiet" onClick={() => toggle(r)}>{r.active ? 'Hide' : 'Show'}</button>
                    <button className="btn btn-danger-quiet" onClick={() => remove(r)}>Delete</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="section-head">
            <h2>Based on their visits</h2>
            {desk && <button className="btn btn-primary" disabled={busy || (suggestions.data?.length ?? 0) === 0} onClick={generate}>{busy ? 'Saving…' : 'Save these'}</button>}
          </div>
          {suggestions.error && <ErrorNote message={suggestions.error} onRetry={suggestions.reload} />}
          {suggestions.data && suggestions.data.length === 0 && <Empty title="No suggestions yet" hint="Suggestions appear once the customer has completed a service." />}
          <ul className="rec-list">
            {(suggestions.data ?? []).map((s) => (
              <li key={s.serviceId}><div><strong>{s.serviceName}</strong><p>{s.message}</p></div></li>
            ))}
          </ul>
          {desk && <p className="field-hint">Saving replaces any earlier suggestions saved from visit history. Recommendations you wrote are kept.</p>}
        </div>
      </section>
      {adding && <RecommendationDrawer customerId={customerId} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); saved.reload(); }} />}
    </>
  );
}

function RecommendationDrawer({ customerId, onClose, onSaved }: { customerId: number; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const services = useLoad(() => get<Service[]>('/services', { activeOnly: true }), []);
  const stylists = useLoad(() => get<Stylist[]>('/stylists', { activeOnly: true }), []);
  const [serviceId, setServiceId] = useState('');
  const [stylistId, setStylistId] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true); setError(null);
    try {
      await post('/recommendations', { customerId, serviceId: Number(serviceId), stylistId: stylistId ? Number(stylistId) : undefined, message: message.trim() });
      toast('Recommendation saved.');
      onSaved();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <Drawer title="Write a recommendation" onClose={onClose} footer={
      <>
        <button className="btn btn-quiet" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={busy || !serviceId || !message.trim()} onClick={save}>Save recommendation</button>
      </>
    }>
      <Field label="Service">
        <select value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
          <option value="">Choose a service</option>
          {(services.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </Field>
      <Field label="Suggested stylist (optional)">
        <select value={stylistId} onChange={(e) => setStylistId(e.target.value)}>
          <option value="">Any stylist</option>
          {(stylists.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.fullName}</option>)}
        </select>
      </Field>
      <Field label="Message to the customer"><textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} /></Field>
      {error && <p className="field-error" role="alert">{error}</p>}
    </Drawer>
  );
}
