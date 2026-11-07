import { useState } from 'react';
import { del, get, post, put, type Page, type Service, type Tier, type TreatmentRecord } from './api';
import { useAuth } from './auth';
import { fmtDay, isoDate, TIER_LABEL } from './format';
import { Drawer, Empty, ErrorNote, Field, Loading, Pager, useLoad, useToast } from './ui';

export function TierBadge({ tier }: { tier?: Tier }) {
  if (!tier || tier === 'REGULAR') return null;
  return <span className={`chip tier tier-${tier.toLowerCase()}`}>{TIER_LABEL[tier]} customer</span>;
}

/* ------------------------------------------------------------------ */
/* Add / edit a treatment record                                       */
/* ------------------------------------------------------------------ */

export function TreatmentFormDrawer({ customerId, appointmentId, defaultServiceId, record, onClose, onSaved }: {
  customerId: number; appointmentId?: number; defaultServiceId?: number; record?: TreatmentRecord;
  onClose: () => void; onSaved: () => void;
}) {
  const toast = useToast();
  const services = useLoad(() => get<Service[]>('/services', { activeOnly: true }), []);
  const [form, setForm] = useState({
    serviceId: String(record?.serviceId ?? defaultServiceId ?? ''),
    treatmentDate: record?.treatmentDate ?? isoDate(),
    details: record?.details ?? '',
    productsUsed: record?.productsUsed ?? '',
    reactions: record?.reactions ?? '',
    followUpAdvice: record?.followUpAdvice ?? '',
    followUpServiceId: String(record?.followUpServiceId ?? ''),
    followUpAfterDays: String(record?.followUpAfterDays ?? ''),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  async function save() {
    setBusy(true); setError(null);
    const body = {
      customerId, appointmentId: record?.appointmentId ?? appointmentId,
      serviceId: Number(form.serviceId), treatmentDate: form.treatmentDate, details: form.details.trim(),
      productsUsed: form.productsUsed.trim() || undefined, reactions: form.reactions.trim() || undefined,
      followUpAdvice: form.followUpAdvice.trim() || undefined,
      followUpServiceId: form.followUpServiceId ? Number(form.followUpServiceId) : undefined,
      followUpAfterDays: form.followUpServiceId && form.followUpAfterDays ? Number(form.followUpAfterDays) : undefined,
    };
    try {
      if (record) await put(`/treatments/${record.id}`, body); else await post('/treatments', body);
      toast(record ? 'Treatment record updated.' : 'Treatment record saved.');
      onSaved();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  const serviceOptions = (services.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>);
  return (
    <Drawer title={record ? 'Edit treatment record' : 'Add treatment record'} onClose={onClose} footer={
      <>
        <button className="btn btn-quiet" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={busy || !form.serviceId || !form.details.trim() || !form.treatmentDate} onClick={save}>{busy ? 'Saving…' : 'Save record'}</button>
      </>
    }>
      <Field label="Service done"><select value={form.serviceId} onChange={set('serviceId')}><option value="">Choose a service</option>{serviceOptions}</select></Field>
      <Field label="Date"><input type="date" value={form.treatmentDate} max={isoDate()} onChange={set('treatmentDate')} /></Field>
      <Field label="What was done" hint="Technique, hair or scalp condition, results."><textarea rows={4} maxLength={2000} value={form.details} onChange={set('details')} autoFocus /></Field>
      <Field label="Products or colour formula used"><textarea rows={2} maxLength={500} value={form.productsUsed} onChange={set('productsUsed')} /></Field>
      <Field label="Allergies or reactions noticed"><textarea rows={2} maxLength={500} value={form.reactions} onChange={set('reactions')} /></Field>
      <Field label="Follow-up advice for the customer"><textarea rows={2} maxLength={1000} value={form.followUpAdvice} onChange={set('followUpAdvice')} /></Field>
      <Field label="Recommended next service" hint="Becomes a personalised recommendation for this customer.">
        <select value={form.followUpServiceId} onChange={set('followUpServiceId')}><option value="">None</option>{serviceOptions}</select>
      </Field>
      {form.followUpServiceId && (
        <Field label="Due in how many days?"><input type="number" min={1} max={730} value={form.followUpAfterDays} onChange={set('followUpAfterDays')} /></Field>
      )}
      {error && <p className="field-error" role="alert">{error}</p>}
    </Drawer>
  );
}

/* ------------------------------------------------------------------ */
/* One record, shown read-only                                         */
/* ------------------------------------------------------------------ */

export function TreatmentCard({ t, onEdit, onDelete }: { t: TreatmentRecord; onEdit?: () => void; onDelete?: () => void }) {
  return (
    <li className="treat">
      <div className="treat-head">
        <div><strong>{t.serviceName}</strong> <span className="muted">· {fmtDay(`${t.treatmentDate}T00:00:00`)} · {t.stylistName}</span></div>
        {(onEdit || onDelete) && (
          <div className="rec-actions">
            {onEdit && <button className="btn btn-quiet" onClick={onEdit}>Edit</button>}
            {onDelete && <button className="btn btn-danger-quiet" onClick={onDelete}>Delete</button>}
          </div>
        )}
      </div>
      <p>{t.details}</p>
      <dl className="facts treat-facts">
        {t.productsUsed && <><dt>Products</dt><dd>{t.productsUsed}</dd></>}
        {t.reactions && <><dt>Reactions</dt><dd>{t.reactions}</dd></>}
        {t.followUpAdvice && <><dt>Advice</dt><dd>{t.followUpAdvice}</dd></>}
        {t.followUpServiceName && <><dt>Next visit</dt><dd>{t.followUpServiceName}{t.followUpDueDate ? ` around ${fmtDay(`${t.followUpDueDate}T00:00:00`)}` : ''}</dd></>}
      </dl>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Full treatment history tab                                          */
/* ------------------------------------------------------------------ */

export function TreatmentHistory({ customerId }: { customerId: number }) {
  const { is } = useAuth();
  const toast = useToast();
  const [pageNo, setPageNo] = useState(0);
  const [editing, setEditing] = useState<TreatmentRecord | 'new' | null>(null);
  const list = useLoad(() => get<Page<TreatmentRecord>>(`/customers/${customerId}/treatments`, { page: pageNo, size: 10 }), [customerId, pageNo]);
  const canWrite = is('SUPER_ADMIN', 'STYLIST');

  async function remove(t: TreatmentRecord) {
    if (!window.confirm('Delete this treatment record?')) return;
    try { await del(`/treatments/${t.id}`); toast('Treatment record deleted.'); list.reload(); }
    catch (e) { toast((e as Error).message, 'error'); }
  }

  return (
    <>
      {canWrite && <div className="actions inline-actions"><button className="btn btn-primary" onClick={() => setEditing('new')}>Add treatment record</button></div>}
      {list.loading && !list.data && <Loading />}
      {list.error && <ErrorNote message={list.error} onRetry={list.reload} />}
      {list.data && list.data.content.length === 0 && <Empty title="No treatments recorded" hint="Stylists record what was done, products used and follow-up advice after each service." />}
      {list.data && list.data.content.length > 0 && (
        <>
          <ul className="treat-list">
            {list.data.content.map((t) => (
              <TreatmentCard key={t.id} t={t} onEdit={canWrite ? () => setEditing(t) : undefined} onDelete={is('SUPER_ADMIN') ? () => remove(t) : undefined} />
            ))}
          </ul>
          <Pager page={list.data} onPage={setPageNo} />
        </>
      )}
      {editing && (
        <TreatmentFormDrawer customerId={customerId} record={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)} onSaved={() => { setEditing(null); list.reload(); }} />
      )}
    </>
  );
}
