import { useState } from 'react';
import { Link } from 'react-router-dom';
import { get, type DailyRevenue, type PaymentSummary, type ServiceStat, type StylistStat, type Summary, type TopCustomer } from '../api';
import { useAuth } from '../auth';
import { addDays, fmtDay, isoDate, methodLabel, money, titleCase } from '../format';
import { TierBadge } from '../TreatmentComponents';
import { Empty, ErrorNote, Loading, PageHead, useLoad } from '../ui';

const monthStart = () => { const d = new Date(); return isoDate(new Date(d.getFullYear(), d.getMonth(), 1)); };

export default function ReportsPage() {
  const { is } = useAuth();
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(isoDate());
  const range = { from, to };
  const summary = useLoad(() => get<Summary>('/reports/summary', range), [from, to]);
  const daily = useLoad(() => get<DailyRevenue[]>('/reports/revenue-daily', range), [from, to]);
  const services = useLoad(() => get<ServiceStat[]>('/reports/top-services', { ...range, limit: 8 }), [from, to]);
  const stylists = useLoad(() => get<StylistStat[]>('/reports/stylist-performance', range), [from, to]);
  const payments = useLoad(() => get<PaymentSummary>('/reports/payments', range), [from, to]);
  const loyal = useLoad(() => get<TopCustomer[]>('/reports/top-customers', { limit: 10 }), []);

  const preset = (days: number) => { setTo(isoDate()); setFrom(addDays(isoDate(), -days)); };
  const s = summary.data;

  return (
    <div className="print-area">
      <PageHead title="Reports" sub="Only completed services count toward revenue.">
        <div className="range no-print">
          <button className="btn btn-quiet" onClick={() => preset(6)}>Last 7 days</button>
          <button className="btn btn-quiet" onClick={() => preset(29)}>Last 30 days</button>
          <button className="btn btn-quiet" onClick={() => { setFrom(monthStart()); setTo(isoDate()); }}>This month</button>
          {is('SUPER_ADMIN') && <button className="btn btn-primary" onClick={() => window.print()}>Print</button>}
        </div>
      </PageHead>
      <div className="filter-row no-print">
        <label className="inline">From <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="inline">To <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></label>
      </div>
      <p className="print-only print-range">{fmtDay(from)} – {fmtDay(to)}</p>

      {summary.error && <ErrorNote message={summary.error} onRetry={summary.reload} />}
      {summary.loading && !s && <Loading />}
      {s && (
        <dl className="stats">
          <div><dt>Revenue</dt><dd>{money(s.revenue)}</dd></div>
          <div><dt>Completed services</dt><dd>{s.completedAppointments}</dd></div>
          <div><dt>Average per visit</dt><dd>{money(s.averageTicket)}</dd></div>
          <div><dt>All bookings</dt><dd>{s.totalAppointments}</dd></div>
          <div><dt>Home service bookings</dt><dd>{s.homeServiceBookings}</dd></div>
          <div><dt>New customers</dt><dd>{s.newCustomers}</dd></div>
          <div><dt>Points given out</dt><dd>{s.loyaltyPointsIssued}</dd></div>
        </dl>
      )}
      {s && (
        <p className="statuses">
          {Object.entries(s.appointmentsByStatus).map(([k, v]) => <span key={k}><b>{v}</b> {titleCase(k)}</span>)}
        </p>
      )}

      <section className="report-block">
        <h2>Revenue by day</h2>
        {daily.error && <ErrorNote message={daily.error} onRetry={daily.reload} />}
        {daily.data && daily.data.length === 0 && <Empty title="No completed services in this period" hint="Pick a wider date range." />}
        {daily.data && daily.data.length > 0 && <RevenueBars rows={daily.data} />}
      </section>

      <div className="split">
        <section className="report-block">
          <h2>Most booked services</h2>
          {services.data && services.data.length === 0 && <p className="muted">No completed services yet.</p>}
          <HBars rows={(services.data ?? []).map((x) => ({ key: x.serviceId, label: x.serviceName, value: x.revenue, note: `${x.completedCount} done` }))} />
        </section>
        <section className="report-block">
          <h2>Stylist performance</h2>
          {stylists.data && stylists.data.length === 0 && <p className="muted">No completed services yet.</p>}
          <HBars rows={(stylists.data ?? []).map((x) => ({ key: x.stylistId, label: x.stylistName, value: x.revenue, note: `${x.completedCount} done` }))} />
        </section>
      </div>

      <div className="split">
        <section className="report-block">
          <h2>Payments collected</h2>
          {payments.error && <ErrorNote message={payments.error} onRetry={payments.reload} />}
          {payments.data && payments.data.byMethod.length === 0 && <p className="muted">No payments recorded in this period.</p>}
          <HBars rows={(payments.data?.byMethod ?? []).map((m) => ({ key: m.method, label: methodLabel(m.method), value: m.amount, note: `${m.count} ${m.count === 1 ? 'payment' : 'payments'}` }))} />
          {payments.data && payments.data.outstandingCount > 0 && (
            <p className="field-hint">Still waiting to be paid: <b>{money(payments.data.outstandingAmount)}</b> from {payments.data.outstandingCount} completed {payments.data.outstandingCount === 1 ? 'service' : 'services'}. <Link to="/payments">Open payments</Link></p>
          )}
        </section>
        <section className="report-block">
          <h2>Most loyal customers</h2>
          {loyal.error && <ErrorNote message={loyal.error} onRetry={loyal.reload} />}
          {loyal.data && loyal.data.length === 0 && <p className="muted">Customers appear here after their first completed service.</p>}
          <ol className="loyal-list">
            {(loyal.data ?? []).map((c) => (
              <li key={c.customerId}>
                <span><Link to={`/customers/${c.customerId}`}>{c.fullName}</Link> <TierBadge tier={c.tier} /></span>
                <span><b>{c.completedVisits}</b> <em>visits</em> · <b>{c.loyaltyPoints}</b> <em>pts</em></span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}

export function RevenueBars({ rows }: { rows: DailyRevenue[] }) {
  const max = Math.max(...rows.map((r) => r.revenue), 1);
  const H = 180, pad = 4;
  const w = Math.max(rows.length * 34, 320);
  return (
    <div className="chart-scroll">
      <svg width={w} height={H + 44} role="img" aria-label={`Daily revenue, highest ${money(max)}`}>
        <line x1="0" x2={w} y1={H} y2={H} className="axis" />
        {rows.map((r, i) => {
          const h = (r.revenue / max) * (H - 24);
          const x = i * 34 + pad;
          return (
            <g key={r.date}>
              <title>{`${fmtDay(r.date)}: ${money(r.revenue)} from ${r.completedAppointments} ${r.completedAppointments === 1 ? 'service' : 'services'}`}</title>
              <rect x={x} y={H - h} width={26} height={h} rx={2} className="bar" />
              {(h > 0 && (rows.length <= 14 || r.revenue === max)) && <text x={x + 13} y={H - h - 6} textAnchor="middle" className="bar-val">{money(r.revenue)}</text>}
              {(rows.length <= 14 || i % 3 === 0) && <text x={x + 13} y={H + 18} textAnchor="middle" className="bar-lbl">{new Date(`${r.date}T00:00:00`).getDate()}</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function HBars({ rows }: { rows: { key: number | string; label: string; value: number; note: string }[] }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="hbars">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="hb-top"><span>{r.label}</span><span><b>{money(r.value)}</b> <em>{r.note}</em></span></div>
          <div className="hb-track"><div className="hb-fill" style={{ width: `${(r.value / max) * 100}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}
