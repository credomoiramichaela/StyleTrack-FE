import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { get, type Appointment, type AppointmentStatus, type Page, type Stylist } from '../api';
import { useAuth } from '../auth';
import { AppointmentDrawer, NewBookingDrawer } from '../AppointmentDrawers';
import { fmtDay, fmtTime, money } from '../format';
import { Empty, ErrorNote, Loading, PageHead, Pager, StatusBadge, useLoad } from '../ui';

const STATUSES: AppointmentStatus[] = ['PENDING', 'ACCEPTED', 'COMPLETED', 'REJECTED', 'CANCELLED'];
const label = (s: AppointmentStatus) => s.charAt(0) + s.slice(1).toLowerCase();

export default function AppointmentsPage() {
  const { is } = useAuth();
  const [params] = useSearchParams();
  const initialStatus = params.get('status') ?? '';
  const [status, setStatus] = useState<string>(STATUSES.includes(initialStatus as AppointmentStatus) ? initialStatus : '');
  const [type, setType] = useState('');
  const [stylistId, setStylistId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [pageNo, setPageNo] = useState(0);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [creating, setCreating] = useState(false);

  const stylists = useLoad(() => get<Stylist[]>('/stylists'), []);
  const list = useLoad(() => get<Page<Appointment>>('/appointments', {
    status, type, stylistId, from, to, page: pageNo, size: 20,
  }), [status, type, stylistId, from, to, pageNo]);

  const desk = is('SUPER_ADMIN', 'ADMIN');
  const reset = (fn: () => void) => { fn(); setPageNo(0); };

  return (
    <>
      <PageHead title={is('STYLIST') ? 'My bookings' : 'Appointments'}>
        {desk && <button className="btn btn-primary" onClick={() => setCreating(true)}>New booking</button>}
      </PageHead>

      <div className="filters">
        <div className="tabs" role="tablist" aria-label="Status">
          <button role="tab" aria-selected={status === ''} className={status === '' ? 'on' : ''} onClick={() => reset(() => setStatus(''))}>All</button>
          {STATUSES.map((s) => (
            <button key={s} role="tab" aria-selected={status === s} className={status === s ? 'on' : ''} onClick={() => reset(() => setStatus(s))}>{label(s)}</button>
          ))}
        </div>
        <div className="filter-row">
          <select aria-label="Where" value={type} onChange={(e) => reset(() => setType(e.target.value))}>
            <option value="">Salon and home service</option>
            <option value="SALON">At the salon</option>
            <option value="HOME_SERVICE">Home service</option>
          </select>
          {!is('STYLIST') && (
            <select aria-label="Stylist" value={stylistId} onChange={(e) => reset(() => setStylistId(e.target.value))}>
              <option value="">All stylists</option>
              {(stylists.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.fullName}</option>)}
            </select>
          )}
          <label className="inline">From <input type="date" value={from} onChange={(e) => reset(() => setFrom(e.target.value))} /></label>
          <label className="inline">To <input type="date" value={to} onChange={(e) => reset(() => setTo(e.target.value))} /></label>
          {(from || to || type || stylistId) && (
            <button className="btn btn-quiet" onClick={() => reset(() => { setFrom(''); setTo(''); setType(''); setStylistId(''); })}>Clear filters</button>
          )}
        </div>
      </div>

      {list.loading && !list.data && <Loading />}
      {list.error && <ErrorNote message={list.error} onRetry={list.reload} />}
      {list.data && list.data.content.length === 0 && (
        <Empty title="No appointments match" hint="Try a different status or date range." />
      )}
      {list.data && list.data.content.length > 0 && (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>When</th><th>Customer</th><th>Service</th><th>Stylist</th><th>Status</th><th className="num">Total</th></tr>
              </thead>
              <tbody>
                {list.data.content.map((a) => (
                  <tr key={a.id} className="click" tabIndex={0} onClick={() => setSelected(a)} onKeyDown={(e) => { if (e.key === 'Enter') setSelected(a); }}>
                    <td><strong>{fmtDay(a.startTime)}</strong><br /><span className="muted">{fmtTime(a.startTime)}</span></td>
                    <td>{a.customerName}<br /><span className="muted">{a.type === 'HOME_SERVICE' ? `Home service · ${a.address ?? ''}` : 'At the salon'}</span></td>
                    <td>{a.serviceName}</td>
                    <td>{a.stylistName}</td>
                    <td><StatusBadge status={a.status} /></td>
                    <td className="num">{money(a.totalAmount)}{a.paymentStatus === 'PAID' && <span className="paid-dot" title="Paid" />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={list.data} onPage={setPageNo} />
        </>
      )}

      {selected && <AppointmentDrawer appointment={selected} onClose={() => setSelected(null)} onChanged={list.reload} />}
      {creating && <NewBookingDrawer defaultType="SALON" onClose={() => setCreating(false)} onDone={() => { setCreating(false); list.reload(); }} />}
    </>
  );
}
