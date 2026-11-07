import { useState } from 'react';
import { Link } from 'react-router-dom';
import { get, post, put, type Appointment, type AppointmentType, type Customer, type OnlinePayment, type Page, type PayMethod, type PaymentSettings, type Service, type Stylist, type TreatmentRecord } from './api';
import { useAuth } from './auth';
import { fmtDay, fmtTime, fmtWhen, isoDate, methodLabel, money } from './format';
import { TreatmentCard, TreatmentFormDrawer } from './TreatmentComponents';
import { CustomerPicker, Drawer, Field, SlotPicker, StatusBadge, useLoad, useToast } from './ui';

/* ------------------------------------------------------------------ */
/* New booking                                                         */
/* ------------------------------------------------------------------ */

export function NewBookingDrawer({ onClose, onDone, defaultType = 'SALON', presetCustomer }: {
  onClose: () => void; onDone: () => void; defaultType?: AppointmentType; presetCustomer?: Customer;
}) {
  const toast = useToast();
  const stylists = useLoad(() => get<Stylist[]>('/stylists', { activeOnly: true }), []);
  const services = useLoad(() => get<Service[]>('/services', { activeOnly: true }), []);
  const [customer, setCustomer] = useState<Customer | null>(presetCustomer ?? null);
  const [type, setType] = useState<AppointmentType>(defaultType);
  const [serviceId, setServiceId] = useState<number>();
  const [stylistId, setStylistId] = useState<number>();
  const [date, setDate] = useState(isoDate());
  const [time, setTime] = useState('');
  const [address, setAddress] = useState(presetCustomer?.address ?? '');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const home = type === 'HOME_SERVICE';
  const serviceList = (services.data ?? []).filter((s) => !home || s.homeServiceAvailable);
  const service = serviceList.find((s) => s.id === serviceId);
  const valid = customer && service && stylistId && date && time && (!home || address.trim());

  async function save() {
    if (!valid || !customer || !service) return;
    if (new Date(`${date}T${time}:00`).getTime() < Date.now() - 5 * 60_000) {
      setError('Start time cannot be in the past.');
      return;
    }
    setBusy(true); setError(null);
    try {
      await post('/appointments', {
        customerId: customer.id, stylistId, serviceId: service.id, type,
        startTime: `${date}T${time}:00`, address: home ? address.trim() : undefined, notes: notes || undefined,
      });
      toast(home ? 'Home service requested. It stays pending until the stylist accepts.' : 'Booking confirmed.');
      onDone();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <Drawer title="New booking" onClose={onClose} footer={
      <>
        <button className="btn btn-quiet" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={!valid || busy} onClick={save}>{busy ? 'Saving…' : 'Book appointment'}</button>
      </>
    }>
      <Field label="Customer"><CustomerPicker value={customer} onChange={setCustomer} /></Field>
      <fieldset className="field seg">
        <legend className="field-label">Where</legend>
        <label className={!home ? 'on' : ''}><input type="radio" checked={!home} onChange={() => { setType('SALON'); setTime(''); }} />At the salon</label>
        <label className={home ? 'on' : ''}><input type="radio" checked={home} onChange={() => { setType('HOME_SERVICE'); setServiceId(undefined); setTime(''); }} />Home service</label>
      </fieldset>
      <Field label="Service">
        <select value={serviceId ?? ''} onChange={(e) => { setServiceId(e.target.value ? Number(e.target.value) : undefined); setTime(''); }}>
          <option value="">Choose a service</option>
          {serviceList.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.durationMinutes} min · {money(s.price)}</option>)}
        </select>
      </Field>
      <Field label="Stylist">
        <select value={stylistId ?? ''} onChange={(e) => { setStylistId(e.target.value ? Number(e.target.value) : undefined); setTime(''); }}>
          <option value="">Choose a stylist</option>
          {(stylists.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.fullName}{s.specialization ? ` · ${s.specialization}` : ''}</option>)}
        </select>
      </Field>
      <Field label="Date">
        <input type="date" value={date} min={isoDate()} onChange={(e) => { setDate(e.target.value); setTime(''); }} />
      </Field>
      <div className="field">
        <span className="field-label">Start time</span>
        <SlotPicker stylistId={stylistId} serviceId={service?.id} date={date} homeService={home} value={time} onChange={setTime} />
      </div>
      {home && (
        <Field label="Visit address" hint="The stylist travels here. A travel buffer is reserved around the visit.">
          <textarea rows={2} value={address} onChange={(e) => setAddress(e.target.value)} />
        </Field>
      )}
      <Field label="Notes"><textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      {error && <p className="field-error" role="alert">{error}</p>}
    </Drawer>
  );
}

/* ------------------------------------------------------------------ */
/* Appointment detail + actions                                        */
/* ------------------------------------------------------------------ */

const ONLINE_STATUS_LABEL: Record<OnlinePayment['status'], string> = {
  PENDING: 'waiting for the customer to pay', PAID: 'paid', FAILED: 'failed', EXPIRED: 'expired',
  NEEDS_REFUND: 'needs a refund', REFUNDED: 'refunded',
};

type Mode = 'view' | 'reject' | 'reschedule' | 'pay';

export function AppointmentDrawer({ appointment: initial, onClose, onChanged }: {
  appointment: Appointment; onClose: () => void; onChanged: () => void;
}) {
  const { is } = useAuth();
  const toast = useToast();
  const [a, setA] = useState(initial);
  const [mode, setMode] = useState<Mode>('view');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [reason, setReason] = useState('');
  const [suggestedStylistId, setSuggestedStylistId] = useState<number | ''>('');
  const [date, setDate] = useState(a.startTime.slice(0, 10));
  const [time, setTime] = useState('');
  const [stylistId, setStylistId] = useState(a.stylistId);
  const [method, setMethod] = useState<PayMethod>('CASH');
  const [writing, setWriting] = useState(false);
  const [reference, setReference] = useState('');
  const stylists = useLoad(() => (mode === 'reschedule' || mode === 'reject' ? get<Stylist[]>('/stylists', { activeOnly: true }) : Promise.resolve([] as Stylist[])), [mode]);

  const payInfo = useLoad<PaymentSettings | null>(() => (mode === 'pay' ? get<PaymentSettings>('/settings/payment') : Promise.resolve(null)), [mode]);
  const online = useLoad<OnlinePayment[]>(() => (is('SUPER_ADMIN', 'ADMIN') ? get<OnlinePayment[]>('/online-payments', { appointmentId: a.id }) : Promise.resolve([])), [a.id, a.paymentStatus]);
  const treatments = useLoad<Page<TreatmentRecord> | null>(() => (mode === 'view' ? get<Page<TreatmentRecord>>(`/customers/${a.customerId}/treatments`, { size: 5 }) : Promise.resolve(null)), [a.customerId, mode]);

  const desk = is('SUPER_ADMIN', 'ADMIN');
  const home = a.type === 'HOME_SERVICE';
  const open = a.status === 'PENDING' || a.status === 'ACCEPTED';

  async function run(action: () => Promise<Appointment | void>, success: string) {
    setBusy(true); setError(null);
    try {
      const updated = await action();
      if (updated) setA(updated);
      toast(success);
      setMode('view');
      onChanged();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  const accept = () => run(() => put<Appointment>(`/appointments/${a.id}/accept`), 'Booking accepted.');
  const complete = () => run(() => put<Appointment>(`/appointments/${a.id}/complete`), 'Marked complete. Loyalty points added.');
  const cancel = () => { if (window.confirm('Cancel this appointment? The time will open up again.')) run(() => put<Appointment>(`/appointments/${a.id}/cancel`), 'Appointment cancelled.'); };

  const records = treatments.data?.content ?? [];
  const hasRecord = records.some((t) => t.appointmentId === a.id);
  const canRecord = is('SUPER_ADMIN', 'STYLIST') && (a.status === 'ACCEPTED' || a.status === 'COMPLETED') && !hasRecord && !treatments.loading;
  const needsRef = method !== 'CASH';
  const latestOnline = online.data?.[0];
  const onlinePending = latestOnline?.status === 'PENDING';

  return (
    <>
    <Drawer title={mode === 'reject' ? 'Reject booking' : mode === 'reschedule' ? 'Reschedule' : mode === 'pay' ? 'Record payment' : 'Appointment'} onClose={onClose}
      footer={mode !== 'view' ? (
        <>
          <button className="btn btn-quiet" onClick={() => { setMode('view'); setError(null); }}>Back</button>
          {mode === 'reject' && <button className="btn btn-danger" disabled={busy || !reason.trim()} onClick={() => run(() => put<Appointment>(`/appointments/${a.id}/reject`, { reason: reason.trim(), suggestedStylistId: suggestedStylistId || undefined }), 'Booking rejected.')}>Reject booking</button>}
          {mode === 'reschedule' && <button className="btn btn-primary" disabled={busy || !time} onClick={() => {
            if (new Date(`${date}T${time}:00`).getTime() < Date.now() - 5 * 60_000) { setError('Start time cannot be in the past.'); return; }
            run(() => put<Appointment>(`/appointments/${a.id}/reschedule`, { startTime: `${date}T${time}:00`, stylistId }), home ? 'Rescheduled. The stylist needs to accept the new time.' : 'Rescheduled.');
          }}>Move appointment</button>}
          {mode === 'pay' && <button className="btn btn-primary" disabled={busy || (needsRef && !reference.trim())} onClick={() => run(() => put<Appointment>(`/appointments/${a.id}/payment`, { method, reference: reference.trim() || undefined }), 'Payment recorded.')}>Record payment</button>}
        </>
      ) : undefined}>
      {mode === 'view' && (
        <>
          <div className="detail-top">
            <StatusBadge status={a.status} />
            <span className={`chip ${home ? 'chip-home' : ''}`}>{home ? 'Home service' : 'At the salon'}</span>
            <span className={`chip ${a.paymentStatus === 'PAID' ? 'chip-paid' : ''}`}>{a.paymentStatus === 'PAID' ? `Paid · ${methodLabel(a.paymentMethod)}` : 'Unpaid'}</span>
          </div>
          <h3 className="detail-service">{a.serviceName}</h3>
          <p className="detail-when">{fmtDay(a.startTime)}, {fmtTime(a.startTime)} – {fmtTime(a.endTime)}</p>
          <dl className="facts">
            <dt>Customer</dt><dd><Link to={`/customers/${a.customerId}`}>{a.customerName}</Link> · {a.customerPhone}</dd>
            <dt>Stylist</dt><dd>{a.stylistName}</dd>
            {home && <><dt>Visit address</dt><dd>{a.address}</dd></>}
            <dt>Total</dt><dd>{money(a.totalAmount, true)}{a.homeServiceFee > 0 ? ` (includes ${money(a.homeServiceFee)} home service fee)` : ''}</dd>
            {a.paymentStatus === 'PAID' && a.paymentReference && <><dt>Payment ref.</dt><dd>{a.paymentReference}</dd></>}
            {latestOnline && <><dt>Online payment</dt><dd>{methodLabel(latestOnline.method)} · {ONLINE_STATUS_LABEL[latestOnline.status]}{latestOnline.failureReason ? ` (${latestOnline.failureReason})` : ''}</dd></>}
            {a.paidAt && <><dt>Paid on</dt><dd>{fmtWhen(a.paidAt)}</dd></>}
            {a.status === 'COMPLETED' && <><dt>Points earned</dt><dd>{a.pointsEarned}</dd></>}
            {a.notes && <><dt>Notes</dt><dd>{a.notes}</dd></>}
            {a.rejectionReason && <><dt>Rejected because</dt><dd>{a.rejectionReason}</dd></>}
            {a.suggestedStylistName && <><dt>Suggested stylist</dt><dd>{a.suggestedStylistName}</dd></>}
          </dl>
          {latestOnline?.status === 'NEEDS_REFUND' && <p className="field-error" role="status">This customer paid online, but the money could not be applied to this booking. Refund it in the PayMongo dashboard, then mark it refunded on the Payments page.</p>}
          {error && <p className="field-error" role="alert">{error}</p>}
          <div className="actions">
            {a.status === 'PENDING' && <button className="btn btn-primary" disabled={busy} onClick={accept}>Accept booking</button>}
            {a.status === 'PENDING' && <button className="btn btn-quiet" disabled={busy} onClick={() => setMode('reject')}>Reject</button>}
            {a.status === 'ACCEPTED' && <button className="btn btn-primary" disabled={busy} onClick={complete}>Mark complete</button>}
            {desk && open && <button className="btn btn-quiet" disabled={busy} onClick={() => { setMode('reschedule'); setTime(''); }}>Reschedule</button>}
            {desk && a.paymentStatus === 'UNPAID' && a.status !== 'CANCELLED' && a.status !== 'REJECTED' && <button className="btn btn-quiet" disabled={busy} onClick={() => setMode('pay')}>Record payment</button>}
            {canRecord && <button className="btn btn-quiet" disabled={busy} onClick={() => setWriting(true)}>Add treatment record</button>}
            {desk && open && <button className="btn btn-danger-quiet" disabled={busy} onClick={cancel}>Cancel appointment</button>}
          </div>
          <section className="drawer-section">
            <h3>Treatment history</h3>
            {treatments.error && <p className="muted">Could not load treatment history.</p>}
            {!treatments.error && records.length === 0 && !treatments.loading && <p className="muted">No treatments recorded for this customer yet.</p>}
            <ul className="treat-list compact">
              {records.map((t) => <TreatmentCard key={t.id} t={t} />)}
            </ul>
            {(treatments.data?.totalElements ?? 0) > records.length && <p className="muted"><Link to={`/customers/${a.customerId}`}>See all {treatments.data?.totalElements} records</Link></p>}
          </section>
        </>
      )}

      {mode === 'reject' && (
        <>
          <Field label="Reason" hint="The customer and front desk will see this.">
            <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
          </Field>
          <Field label="Suggest an alternative stylist" hint="Optional. Shown to the customer alongside the reason.">
            <select value={suggestedStylistId} onChange={(e) => setSuggestedStylistId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">No suggestion</option>
              {(stylists.data ?? []).filter((s) => s.id !== a.stylistId).map((s) => <option key={s.id} value={s.id}>{s.fullName}</option>)}
            </select>
          </Field>
        </>
      )}

      {mode === 'reschedule' && (
        <>
          <p className="sub">{a.serviceName} for {a.customerName}, currently {fmtWhen(a.startTime)}.</p>
          <Field label="Stylist">
            <select value={stylistId} onChange={(e) => { setStylistId(Number(e.target.value)); setTime(''); }}>
              {(stylists.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.fullName}</option>)}
            </select>
          </Field>
          <Field label="New date"><input type="date" min={isoDate()} value={date} onChange={(e) => { setDate(e.target.value); setTime(''); }} /></Field>
          <div className="field">
            <span className="field-label">New start time</span>
            <SlotPicker stylistId={stylistId} serviceId={a.serviceId} date={date} homeService={home} value={time} onChange={setTime} excludeAppointmentId={a.id} />
            <span className="field-hint">The appointment's current time may show as taken; pick a different time to move it.</span>
          </div>
        </>
      )}

      {mode === 'pay' && (
        <>
          <p className="sub">Amount due: <strong>{money(a.totalAmount, true)}</strong></p>
          {onlinePending && <p className="field-error" role="status">The customer has a {methodLabel(latestOnline?.method)} payment in progress in the app. If you record a payment here and they also finish paying online, their online payment will have to be refunded.</p>}
          <Field label="Payment method">
            <select value={method} onChange={(e) => setMethod(e.target.value as PayMethod)}>
              <option value="CASH">Cash</option>
              <option value="QRPH">QR Ph</option>
              <option value="GCASH">GCash</option>
            </select>
          </Field>
          {method === 'QRPH' && (
            <div className="qr-box">
              {payInfo.data?.qrPhImageUrl
                ? <img src={payInfo.data.qrPhImageUrl} alt={`QR Ph code for ${payInfo.data.qrPhAccountName ?? 'the salon'}`} />
                : <p className="muted">No QR Ph image is configured yet. Ask the owner to set QRPH_IMAGE_URL on the server.</p>}
              {payInfo.data?.qrPhAccountName && <p><strong>{payInfo.data.qrPhAccountName}</strong><br /><span className="muted">Customer scans with their banking or e-wallet app.</span></p>}
            </div>
          )}
          {needsRef && (
            <Field label="Reference number" hint={`Copy it from the customer's ${methodLabel(method)} confirmation screen. Each reference can only be used once.`}>
              <input value={reference} onChange={(e) => setReference(e.target.value)} autoFocus />
            </Field>
          )}
        </>
      )}
      {mode !== 'view' && error && <p className="field-error" role="alert">{error}</p>}
    </Drawer>
    {writing && (
      <TreatmentFormDrawer customerId={a.customerId} appointmentId={a.id} defaultServiceId={a.serviceId}
        onClose={() => setWriting(false)} onSaved={() => { setWriting(false); treatments.reload(); }} />
    )}
    </>
  );
}
