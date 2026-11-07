import { useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { get, put, type Appointment, type Dashboard, type DailyRevenue, type Page, type Stylist } from '../api';
import { useAuth } from '../auth';
import { AppointmentDrawer } from '../AppointmentDrawers';
import { RevenueBars } from './ReportsPage';
import { addDays, fmtDay, fmtLongDay, fmtTime, isoDate, money } from '../format';
import { Empty, ErrorNote, Icon, Loading, PageHead, useLoad, useToast } from '../ui';

const HOUR_PX = 64;
const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; };

export default function DashboardPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [date, setDate] = useState(isoDate());
  const [selected, setSelected] = useState<Appointment | null>(null);

  const summary = useLoad(() => get<Dashboard>('/dashboard'), []);
  const stylists = useLoad(() => get<Stylist[]>('/stylists', { activeOnly: true }), []);
  const day = useLoad(() => get<Page<Appointment>>('/appointments', { from: date, to: date, size: 100, sort: 'startTime,asc' }), [date]);
  const waiting = useLoad(() => get<Page<Appointment>>('/appointments', { status: 'PENDING', size: 8, sort: 'startTime,asc' }), []);
  const revenue = useLoad(() => get<DailyRevenue[]>('/reports/revenue-daily', { from: addDays(isoDate(), -13), to: isoDate() }), []);

  const refresh = () => { summary.reload(); day.reload(); waiting.reload(); revenue.reload(); };
  const isToday = date === isoDate();

  const booked = useMemo(
    () => (day.data?.content ?? []).filter((a) => a.status === 'PENDING' || a.status === 'ACCEPTED' || a.status === 'COMPLETED'),
    [day.data],
  );
  const columns = stylists.data ?? [];

  const { startHour, endHour } = useMemo(() => {
    let lo = 9, hi = 19;
    booked.forEach((a) => {
      lo = Math.min(lo, new Date(a.startTime).getHours());
      hi = Math.max(hi, Math.ceil(new Date(a.endTime).getHours() + new Date(a.endTime).getMinutes() / 60));
    });
    return { startHour: lo, endHour: hi };
  }, [booked]);

  async function quickAccept(a: Appointment) {
    try {
      await put(`/appointments/${a.id}/accept`);
      toast(`Accepted ${a.customerName}'s booking.`);
      refresh();
    } catch (e) { toast((e as Error).message, 'error'); }
  }

  const s = summary.data;
  const nowTop = (() => {
    const n = new Date();
    const h = n.getHours() + n.getMinutes() / 60;
    return h >= startHour && h <= endHour ? (h - startHour) * HOUR_PX : null;
  })();

  return (
    <>
      <PageHead title={isToday ? `${greeting()}, ${user?.fullName.split(' ')[0] ?? ''}!` : fmtLongDay(date)}
        sub={isToday ? "Here's what's happening in your salon today." : undefined}>
        {isToday && <p className="greet-date">{fmtLongDay(date)}</p>}
        <div className="day-nav">
          <button className="btn btn-quiet" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day">‹</button>
          <button className="btn btn-quiet" onClick={() => setDate(isoDate())} disabled={isToday}>Today</button>
          <button className="btn btn-quiet" onClick={() => setDate(addDays(date, 1))} aria-label="Next day">›</button>
        </div>
      </PageHead>

      {summary.error && <ErrorNote message={summary.error} onRetry={summary.reload} />}
      {s && (
        <dl className="kpis">
          <Link to="/appointments" className="kpi">
            <span className="kpi-ico"><Icon name="calendar" /></span>
            <div className="kpi-body"><dt>Total Bookings</dt><dd>{s.todayAppointments}<span className="kpi-note">{s.todayAppointments === 1 ? 'appointment' : 'appointments'} today</span></dd></div>
          </Link>
          <Link to="/appointments?status=PENDING" className={`kpi${s.pendingBookings > 0 ? ' hot' : ''}`}>
            <span className="kpi-ico"><Icon name="clock" /></span>
            <div className="kpi-body"><dt>Pending Booking Requests</dt><dd>{s.pendingBookings}<span className="kpi-note">{s.pendingHomeServiceBookings > 0 ? `incl. ${s.pendingHomeServiceBookings} home service` : 'requests to review'}</span></dd></div>
          </Link>
          <Link to="/payments" className="kpi">
            <span className="kpi-ico"><Icon name="wallet" /></span>
            <div className="kpi-body"><dt>Today's Earning</dt><dd>{money(s.todayRevenue)}<span className="kpi-note">from completed services</span></dd></div>
          </Link>
          <Link to="/reports" className="kpi feature">
            <span className="kpi-ico"><Icon name="sparkle" /></span>
            <div className="kpi-body"><dt>Monthly Revenue</dt><dd>{money(s.monthRevenue)}<span className="kpi-note">this month</span></dd></div>
          </Link>
        </dl>
      )}

      <section className="report-block" aria-label="Revenue earned">
        <h2>Revenue Earned</h2>
        {revenue.error && <ErrorNote message={revenue.error} onRetry={revenue.reload} />}
        {revenue.data && revenue.data.length === 0 && <Empty title="No completed services in the last 14 days" />}
        {revenue.data && revenue.data.length > 0 && <RevenueBars rows={revenue.data} />}
      </section>

      <section aria-label="Day sheet" className="sheet-wrap">
        {(day.loading || stylists.loading) && !day.data && <Loading />}
        {day.error && <ErrorNote message={day.error} onRetry={day.reload} />}
        {columns.length === 0 && stylists.data && <Empty title="No stylists to show" hint="Add a stylist and their weekly schedule to start taking bookings." />}
        {columns.length > 0 && day.data && (
          <div className="sheet" style={{ '--cols': columns.length, '--hour': `${HOUR_PX}px` } as CSSProperties}>
            <div className="sheet-head">
              <div className="sheet-corner" />
              {columns.map((c) => <div key={c.id} className="sheet-colhead"><strong>{c.fullName}</strong><span>{c.specialization}</span></div>)}
            </div>
            <div className="sheet-body" style={{ height: (endHour - startHour) * HOUR_PX }}>
              <div className="sheet-times">
                {Array.from({ length: endHour - startHour }, (_, i) => (
                  <div key={i} style={{ height: HOUR_PX }}>{new Date(2000, 0, 1, startHour + i).toLocaleTimeString('en-PH', { hour: 'numeric' })}</div>
                ))}
              </div>
              {columns.map((c) => (
                <div key={c.id} className="sheet-col">
                  {booked.filter((a) => a.stylistId === c.id).map((a) => {
                    const st = new Date(a.startTime), en = new Date(a.endTime);
                    const top = (st.getHours() + st.getMinutes() / 60 - startHour) * HOUR_PX;
                    const height = Math.max(26, ((en.getTime() - st.getTime()) / 3600000) * HOUR_PX - 2);
                    return (
                      <button key={a.id} className={`block b-${a.status.toLowerCase()}${a.type === 'HOME_SERVICE' ? ' home' : ''}${height < 56 ? ' short' : ''}`}
                        style={{ top, height }} onClick={() => setSelected(a)}
                        aria-label={`${a.customerName}, ${a.serviceName}, ${fmtTime(a.startTime)}, ${a.status.toLowerCase()}`}>
                        <strong>{a.customerName}{height < 56 && <> · {fmtTime(a.startTime)}</>}</strong>
                        <span>{a.serviceName}{a.type === 'HOME_SERVICE' ? ' · home service' : ''}</span>
                        <span>{fmtTime(a.startTime)}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
              {isToday && nowTop !== null && <div className="now-line" style={{ top: nowTop }} aria-hidden="true" />}
            </div>
            {booked.length === 0 && <p className="sheet-empty">Nothing booked for {isToday ? 'today' : fmtDay(date)} yet.</p>}
            <ul className="legend" aria-label="Legend">
              <li><i className="b-pending" />Waiting for reply</li>
              <li><i className="b-accepted" />Confirmed</li>
              <li><i className="b-completed" />Completed</li>
            </ul>
          </div>
        )}
      </section>

      <section className="waiting" aria-label="Pending booking requests">
        <h2>Pending Booking Requests</h2>
        {waiting.error && <ErrorNote message={waiting.error} onRetry={waiting.reload} />}
        {waiting.data && waiting.data.content.length === 0 && <p className="muted">Nothing is waiting. New home-service requests will appear here.</p>}
        {waiting.data && waiting.data.content.length > 0 && (
          <ul className="queue">
            {waiting.data.content.map((a) => (
              <li key={a.id}>
                <button className="queue-main" onClick={() => setSelected(a)}>
                  <strong>{a.customerName}</strong>
                  <span>{a.serviceName} with {a.stylistName}</span>
                  <span className="muted">{fmtDay(a.startTime)}, {fmtTime(a.startTime)}{a.type === 'HOME_SERVICE' ? ` · ${a.address}` : ''}</span>
                </button>
                <button className="btn btn-primary" onClick={() => quickAccept(a)}>Accept</button>
                <button className="btn btn-quiet" onClick={() => setSelected(a)}>Review</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {selected && <AppointmentDrawer appointment={selected} onClose={() => setSelected(null)} onChanged={refresh} />}
    </>
  );
}
