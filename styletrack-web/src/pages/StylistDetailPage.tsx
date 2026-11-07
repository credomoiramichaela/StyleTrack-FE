import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { del, get, post, put, type Schedule, type Stylist } from '../api';
import { useAuth } from '../auth';
import { fmtTimeOfDay, hhmm, titleCase } from '../format';
import { Drawer, ErrorNote, Field, Loading, PageHead, useLoad, useToast } from '../ui';

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

export default function StylistDetailPage() {
  const { id } = useParams();
  const stylistId = Number(id);
  const { user, is } = useAuth();
  const toast = useToast();
  const stylist = useLoad(() => get<Stylist>(`/stylists/${stylistId}`), [stylistId]);
  const schedule = useLoad(() => get<Schedule[]>(`/stylists/${stylistId}/schedules`), [stylistId]);
  const [editing, setEditing] = useState<{ block?: Schedule; day?: string } | null>(null);

  if (stylist.loading && !stylist.data) return <Loading />;
  if (stylist.error || !stylist.data) return <ErrorNote message={stylist.error ?? 'Stylist not found'} onRetry={stylist.reload} />;
  const s = stylist.data;
  const canEdit = is('SUPER_ADMIN') || (is('STYLIST') && s.userId === user?.id);

  async function remove(b: Schedule) {
    if (!window.confirm(`Remove ${titleCase(b.dayOfWeek)} ${fmtTimeOfDay(hhmm(b.startTime))} – ${fmtTimeOfDay(hhmm(b.endTime))}?`)) return;
    try { await del(`/stylists/${stylistId}/schedules/${b.id}`); toast('Hours removed.'); schedule.reload(); }
    catch (e) { toast((e as Error).message, 'error'); }
  }

  return (
    <>
      <p className="crumb"><Link to="/stylists">Stylists</Link></p>
      <PageHead title={s.fullName} sub={[s.specialization, s.phone].filter(Boolean).join(' · ') || undefined} />
      <div className="section-head">
        <h2>Weekly hours</h2>
        {canEdit && <button className="btn btn-primary" onClick={() => setEditing({})}>Add hours</button>}
      </div>
      {schedule.error && <ErrorNote message={schedule.error} onRetry={schedule.reload} />}
      {schedule.loading && !schedule.data && <Loading />}
      {schedule.data && (
        <ul className="week">
          {DAYS.map((d) => {
            const blocks = schedule.data!.filter((b) => b.dayOfWeek === d);
            return (
              <li key={d}>
                <span className="week-day">{titleCase(d)}</span>
                <div className="week-blocks">
                  {blocks.length === 0 && <span className="muted">Day off</span>}
                  {blocks.map((b) => (
                    <span key={b.id} className="hours">
                      {fmtTimeOfDay(hhmm(b.startTime))} – {fmtTimeOfDay(hhmm(b.endTime))}
                      {b.homeServiceAvailable && <em>home service</em>}
                      {canEdit && (
                        <>
                          <button className="link-btn" onClick={() => setEditing({ block: b })}>Edit</button>
                          <button className="link-btn danger" onClick={() => remove(b)}>Remove</button>
                        </>
                      )}
                    </span>
                  ))}
                </div>
                {canEdit && <button className="link-btn add" onClick={() => setEditing({ day: d })}>Add</button>}
              </li>
            );
          })}
        </ul>
      )}
      {!canEdit && <p className="field-hint">Only the owner and this stylist can change these hours.</p>}
      {editing && <ScheduleDrawer stylistId={stylistId} block={editing.block} day={editing.day} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); schedule.reload(); }} />}
    </>
  );
}

function ScheduleDrawer({ stylistId, block, day, onClose, onSaved }: {
  stylistId: number; block?: Schedule; day?: string; onClose: () => void; onSaved: () => void;
}) {
  const toast = useToast();
  const [dayOfWeek, setDayOfWeek] = useState(block?.dayOfWeek ?? day ?? 'MONDAY');
  const [start, setStart] = useState(block ? hhmm(block.startTime) : '09:00');
  const [end, setEnd] = useState(block ? hhmm(block.endTime) : '18:00');
  const [home, setHome] = useState(block?.homeServiceAvailable ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true); setError(null);
    const body = { dayOfWeek, startTime: start, endTime: end, homeServiceAvailable: home };
    try {
      if (block) await put(`/stylists/${stylistId}/schedules/${block.id}`, body);
      else await post(`/stylists/${stylistId}/schedules`, body);
      toast('Hours saved.');
      onSaved();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <Drawer title={block ? 'Edit hours' : 'Add hours'} onClose={onClose} footer={
      <>
        <button className="btn btn-quiet" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" disabled={busy || !start || !end || end <= start} onClick={save}>Save hours</button>
      </>
    }>
      <Field label="Day">
        <select value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value)}>
          {DAYS.map((d) => <option key={d} value={d}>{titleCase(d)}</option>)}
        </select>
      </Field>
      <div className="two">
        <Field label="Starts"><input type="time" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
        <Field label="Ends"><input type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
      </div>
      {end <= start && <p className="field-error">End time must be after the start time.</p>}
      <label className="check"><input type="checkbox" checked={home} onChange={(e) => setHome(e.target.checked)} />Available for home service during these hours</label>
      {error && <p className="field-error" role="alert">{error}</p>}
    </Drawer>
  );
}
