import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { get, type Availability, type AppointmentStatus, type Customer, type Page } from './api';
import { fmtTimeOfDay, hhmm, titleCase } from './format';

/* ---------- data loading ---------- */

export function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    setLoading(true);
    fn()
      .then((d) => { if (live) { setData(d); setError(null); } })
      .catch((e: Error) => { if (live) setError(e.message); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { data, error, loading, reload: useCallback(() => setTick((t) => t + 1), []) };
}

/* ---------- toasts ---------- */

type ToastKind = 'ok' | 'error';
const ToastContext = createContext<(message: string, kind?: ToastKind) => void>(() => undefined);
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ message: string; kind: ToastKind; id: number } | null>(null);
  const timer = useRef<number>();
  const show = useCallback((message: string, kind: ToastKind = 'ok') => {
    window.clearTimeout(timer.current);
    setToast({ message, kind, id: Date.now() });
    timer.current = window.setTimeout(() => setToast(null), kind === 'error' ? 6000 : 3000);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {toast && <div key={toast.id} className={`toast toast-${toast.kind}`}>{toast.message}</div>}
      </div>
    </ToastContext.Provider>
  );
}

/* ---------- icons ---------- */

/* 24×24 stroke icons; each string is the inner SVG path data. */
const ICONS: Record<string, string> = {
  today: 'M12 3v2M12 19v2M5.6 5.6 7 7M17 17l1.4 1.4M3 12h2M19 12h2M5.6 18.4 7 17M17 7l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
  calendar: 'M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7ZM4 10h16M8 3v4M16 3v4',
  home: 'M4 11 12 4l8 7M6 9.5V20h12V9.5M10 20v-5h4v5',
  people: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM2 21a7 7 0 0 1 14 0M16 3.5a4 4 0 0 1 0 7.5M22 21a7 7 0 0 0-4-6.3',
  scissors: 'M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM8.1 7.9 20 20M8.1 16.1 20 4M14.5 12 12 12',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3ZM19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7L19 16Z',
  wallet: 'M3 7a2 2 0 0 1 2-2h13v4M3 7v10a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2ZM16 14h.01',
  gift: 'M4 11h16v9H4v-9ZM3 7h18v4H3V7ZM12 7v13M12 7S10.5 3 8 3.5 7 7 12 7ZM12 7s1.5-4 4-3.5S17 7 12 7Z',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  key: 'M14 10a4 4 0 1 0-3.5 3.97L9 15.5V18H6.5v2.5H3v-3.4l6.03-6.03A4 4 0 0 0 14 10ZM15.5 8.5h.01',
  log: 'M8 4h11a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2ZM11 9h6M11 13h6M11 17h3M5 8v9',
};

export function Icon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

/* ---------- layout bits ---------- */

export function PageHead({ title, sub, children }: { title: string; sub?: ReactNode; children?: ReactNode }) {
  return (
    <header className="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <p className="sub">{sub}</p>}
      </div>
      {children && <div className="page-actions">{children}</div>}
    </header>
  );
}

export function Drawer({ title, onClose, children, footer, wide }: {
  title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="drawer-wrap">
      <div className="scrim" onClick={onClose} />
      <aside className={`drawer${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="drawer-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="drawer-body">{children}</div>
        {footer && <div className="drawer-foot">{footer}</div>}
      </aside>
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function Empty({ title, hint, children }: { title: string; hint?: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <p className="empty-title">{title}</p>
      {hint && <p className="empty-hint">{hint}</p>}
      {children}
    </div>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="error-note" role="alert">
      <span>{message}</span>
      {onRetry && <button className="btn btn-quiet" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function Loading({ label = 'Loading' }: { label?: string }) {
  return <p className="loading" aria-busy="true">{label}…</p>;
}

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  return <span className={`status status-${status.toLowerCase()}`}>{titleCase(status)}</span>;
}

export function Pager<T>({ page, onPage }: { page: Page<T>; onPage: (p: number) => void }) {
  if (page.totalPages <= 1) return null;
  return (
    <div className="pager">
      <button className="btn btn-quiet" disabled={page.page === 0} onClick={() => onPage(page.page - 1)}>Previous</button>
      <span>Page {page.page + 1} of {page.totalPages}</span>
      <button className="btn btn-quiet" disabled={page.page + 1 >= page.totalPages} onClick={() => onPage(page.page + 1)}>Next</button>
    </div>
  );
}

/* ---------- pickers ---------- */

/** Free start times for a stylist/service/date, straight from the availability endpoint. */
export function SlotPicker({ stylistId, serviceId, date, homeService, value, onChange, excludeAppointmentId }: {
  stylistId?: number; serviceId?: number; date: string; homeService: boolean;
  value: string; onChange: (hhmm: string) => void; excludeAppointmentId?: number;
}) {
  const ready = Boolean(stylistId && serviceId && date);
  const { data, loading, error } = useLoad<Availability | null>(
    () => (ready ? get<Availability>(`/stylists/${stylistId}/availability`, { date, serviceId, homeService }) : Promise.resolve(null)),
    [stylistId, serviceId, date, homeService, excludeAppointmentId],
  );
  if (!ready) return <p className="field-hint">Choose a stylist, service and date to see open times.</p>;
  if (loading) return <p className="field-hint">Checking open times…</p>;
  if (error) return <p className="field-error">{error}</p>;
  const slots = data?.availableStartTimes ?? [];
  if (slots.length === 0) {
    return <p className="field-hint">No open times that day. Try another date or stylist{homeService ? ', or check that the stylist offers home service on that day' : ''}.</p>;
  }
  return (
    <div className="slots" role="radiogroup" aria-label="Start time">
      {slots.map((s) => (
        <button type="button" key={s} role="radio" aria-checked={value === hhmm(s)}
          className={`slot${value === hhmm(s) ? ' on' : ''}`} onClick={() => onChange(hhmm(s))}>
          {fmtTimeOfDay(hhmm(s))}
        </button>
      ))}
    </div>
  );
}

export function CustomerPicker({ value, onChange }: { value: Customer | null; onChange: (c: Customer | null) => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Customer[]>([]);
  useEffect(() => {
    if (value || q.trim().length < 2) { setResults([]); return; }
    const id = window.setTimeout(() => {
      get<Page<Customer>>('/customers', { q, size: 6 }).then((p) => setResults(p.content.filter((c) => c.active))).catch(() => setResults([]));
    }, 250);
    return () => window.clearTimeout(id);
  }, [q, value]);

  if (value) {
    return (
      <div className="picked">
        <span><strong>{value.fullName}</strong> · {value.phone}</span>
        <button type="button" className="btn btn-quiet" onClick={() => { onChange(null); setQ(''); }}>Change</button>
      </div>
    );
  }
  return (
    <div className="picker">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or phone" autoComplete="off" />
      {results.length > 0 && (
        <ul className="picker-list">
          {results.map((c) => (
            <li key={c.id}><button type="button" onClick={() => onChange(c)}>{c.fullName}<span>{c.phone}</span></button></li>
          ))}
        </ul>
      )}
      {q.trim().length >= 2 && results.length === 0 && <p className="field-hint">No matching customer. Add them under Customers first.</p>}
    </div>
  );
}
