const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 });
const pesoExact = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

export const money = (n: number | undefined | null, exact = false) => (exact ? pesoExact : peso).format(n ?? 0);

/** Local YYYY-MM-DD without timezone shifting. */
export const isoDate = (d: Date = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return isoDate(d);
};

const dayFmt = new Intl.DateTimeFormat('en-PH', { weekday: 'short', month: 'short', day: 'numeric' });
const longDayFmt = new Intl.DateTimeFormat('en-PH', { weekday: 'long', month: 'long', day: 'numeric' });
const timeFmt = new Intl.DateTimeFormat('en-PH', { hour: 'numeric', minute: '2-digit' });

export const fmtDay = (iso: string) => dayFmt.format(new Date(iso));
export const fmtLongDay = (iso: string) => longDayFmt.format(new Date(`${iso}T00:00:00`));
export const fmtTime = (iso: string) => timeFmt.format(new Date(iso));
export const fmtTimeOfDay = (hhmm: string) => timeFmt.format(new Date(`2000-01-01T${hhmm}`));
export const fmtWhen = (iso: string) => `${fmtDay(iso)}, ${fmtTime(iso)}`;

export const titleCase = (s: string) => s.toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
export const hhmm = (t: string) => t.slice(0, 5);

export const METHOD_LABEL: Record<string, string> = { CASH: 'Cash', QRPH: 'QR Ph', GCASH: 'GCash' };
export const methodLabel = (m?: string | null) => (m ? METHOD_LABEL[m] ?? titleCase(m) : '');
export const TIER_LABEL: Record<string, string> = { REGULAR: 'Regular', SILVER: 'Silver', GOLD: 'Gold' };
