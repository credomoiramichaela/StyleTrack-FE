import { useState } from 'react';
import { get, put, type Appointment, type OnlinePayment, type Page, type PaymentSummary } from '../api';
import { useAuth } from '../auth';
import { AppointmentDrawer } from '../AppointmentDrawers';
import { fmtWhen, isoDate, methodLabel, money } from '../format';
import { Empty, ErrorNote, Loading, PageHead, Pager, StatusBadge, useLoad, useToast } from '../ui';

const monthStart = () => { const d = new Date(); return isoDate(new Date(d.getFullYear(), d.getMonth(), 1)); };

type Tab = 'UNPAID' | 'PAID';

export default function PaymentsPage() {
  const [tab, setTab] = useState<Tab>('UNPAID');
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(isoDate());
  const [pageNo, setPageNo] = useState(0);
  const [selected, setSelected] = useState<Appointment | null>(null);

  const summary = useLoad(() => get<PaymentSummary>('/reports/payments', { from, to }), [from, to]);
  const list = useLoad(() => get<Page<Appointment>>('/appointments', tab === 'UNPAID'
    ? { paymentStatus: 'UNPAID', status: 'COMPLETED', page: pageNo, size: 20 }
    : { paymentStatus: 'PAID', page: pageNo, size: 20 }), [tab, pageNo]);
  const s = summary.data;

  const { is } = useAuth();
  const toast = useToast();
  const refunds = useLoad(() => get<OnlinePayment[]>('/online-payments', { status: 'NEEDS_REFUND' }), []);
  const refundList = refunds.data ?? [];

  async function markRefunded(p: OnlinePayment) {
    if (!window.confirm(`Mark ${money(p.amount, true)} for ${p.customerName} as refunded? Only do this after you have refunded it in the PayMongo dashboard.`)) return;
    try {
      await put(`/online-payments/${p.id}/refunded`);
      toast('Marked as refunded.');
      refunds.reload();
    } catch (e) { toast((e as Error).message, 'error'); }
  }

  function changed() { list.reload(); summary.reload(); refunds.reload(); }

  return (
    <>
      <PageHead title="Payments" sub="Cash, QR Ph and GCash. Record each payment with its reference number as it comes in." />
      <div className="filter-row">
        <label className="inline">Collected from <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="inline">to <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></label>
      </div>
      {summary.error && <ErrorNote message={summary.error} onRetry={summary.reload} />}
      {s && (
        <dl className="stats">
          <div><dt>Collected</dt><dd>{money(s.totalCollected)}</dd></div>
          <div><dt>Payments</dt><dd>{s.paidCount}</dd></div>
          {s.byMethod.map((m) => <div key={m.method}><dt>{methodLabel(m.method)}</dt><dd>{money(m.amount)}</dd><dd className="stat-note">{m.count} {m.count === 1 ? 'payment' : 'payments'}</dd></div>)}
          <div className={s.outstandingCount > 0 ? 'attn' : ''}><dt>Waiting to be paid</dt><dd>{money(s.outstandingAmount)}</dd><dd className="stat-note">{s.outstandingCount} completed {s.outstandingCount === 1 ? 'service' : 'services'}</dd></div>
        </dl>
      )}

      {refundList.length > 0 && (
        <section aria-label="Online payments to refund" style={{ border: '1px solid var(--danger, #b3261e)', borderRadius: 12, padding: 16, margin: '16px 0' }}>
          <h2>Refund needed ({refundList.length})</h2>
          <p className="muted">These customers paid online, but the booking was already paid or cancelled. Refund them in the PayMongo dashboard.</p>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Booking</th><th>Customer</th><th>Method</th><th>PayMongo ref.</th><th className="num">Amount</th>{is('SUPER_ADMIN') && <th />}</tr></thead>
              <tbody>
                {refundList.map((p) => (
                  <tr key={p.id}>
                    <td><strong>{p.serviceName}</strong><br /><span className="muted">Booking #{p.appointmentId}{p.paidAt ? ` · paid ${fmtWhen(p.paidAt)}` : ''}</span></td>
                    <td>{p.customerName}</td>
                    <td>{methodLabel(p.method)}</td>
                    <td>{p.paymongoPaymentId ?? p.paymentIntentId}</td>
                    <td className="num">{money(p.amount, true)}</td>
                    {is('SUPER_ADMIN') && <td><button className="btn btn-quiet" onClick={() => markRefunded(p)}>Mark refunded</button></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="tabs" role="tablist">
        {([['UNPAID', 'Waiting to be paid'], ['PAID', 'Paid']] as [Tab, string][]).map(([key, label]) => (
          <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? 'on' : ''} onClick={() => { setTab(key); setPageNo(0); }}>{label}</button>
        ))}
      </div>

      {list.loading && !list.data && <Loading />}
      {list.error && <ErrorNote message={list.error} onRetry={list.reload} />}
      {list.data && list.data.content.length === 0 && (
        <Empty title={tab === 'UNPAID' ? 'Nothing waiting to be paid' : 'No payments recorded yet'} hint={tab === 'UNPAID' ? 'Completed services that have not been paid for appear here.' : 'Payments you record will be listed here.'} />
      )}
      {list.data && list.data.content.length > 0 && (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Service</th><th>Customer</th><th>{tab === 'PAID' ? 'Paid' : 'Status'}</th>{tab === 'PAID' && <th>Reference</th>}<th className="num">Amount</th></tr>
              </thead>
              <tbody>
                {list.data.content.map((a) => (
                  <tr key={a.id} className="click" tabIndex={0} onClick={() => setSelected(a)} onKeyDown={(e) => { if (e.key === 'Enter') setSelected(a); }}>
                    <td><strong>{a.serviceName}</strong><br /><span className="muted">{fmtWhen(a.startTime)} · {a.stylistName}</span></td>
                    <td>{a.customerName}</td>
                    {tab === 'PAID'
                      ? <td>{methodLabel(a.paymentMethod)}{a.paidAt && <><br /><span className="muted">{fmtWhen(a.paidAt)}</span></>}</td>
                      : <td><StatusBadge status={a.status} /></td>}
                    {tab === 'PAID' && <td>{a.paymentReference ?? <span className="muted">–</span>}</td>}
                    <td className="num">{money(a.totalAmount, true)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={list.data} onPage={setPageNo} />
        </>
      )}
      {selected && <AppointmentDrawer appointment={selected} onClose={() => setSelected(null)} onChanged={changed} />}
    </>
  );
}
