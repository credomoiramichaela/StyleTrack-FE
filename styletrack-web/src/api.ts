// Typed client for the StyleTrack API. Every request carries the JWT from localStorage.

export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'STYLIST';
export type AppointmentStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'COMPLETED' | 'CANCELLED';
export type AppointmentType = 'SALON' | 'HOME_SERVICE';
export type Tier = 'REGULAR' | 'SILVER' | 'GOLD';
export type PayMethod = 'CASH' | 'QRPH' | 'GCASH';

export interface User { id: number; username: string; fullName: string; email?: string; phone?: string; role: Role; active: boolean }
export interface Customer { id: number; fullName: string; phone: string; email?: string; address?: string; birthDate?: string; notes?: string; loyaltyPoints: number; completedVisits: number; tier: Tier; active: boolean; createdAt: string }
export interface Stylist { id: number; fullName: string; phone?: string; email?: string; specialization?: string; bio?: string; active: boolean; userId?: number; username?: string }
export interface Schedule { id: number; stylistId: number; dayOfWeek: string; startTime: string; endTime: string; homeServiceAvailable: boolean }
export interface Service { id: number; name: string; description?: string; category?: string; price: number; durationMinutes: number; homeServiceAvailable: boolean; pointsAwarded?: number | null; active: boolean }
export interface Appointment {
  id: number; customerId: number; customerName: string; customerPhone: string;
  stylistId: number; stylistName: string; serviceId: number; serviceName: string;
  startTime: string; endTime: string; type: AppointmentType; status: AppointmentStatus;
  address?: string; notes?: string; rejectionReason?: string; suggestedStylistId?: number; suggestedStylistName?: string;
  homeServiceFee: number; totalAmount: number;
  paymentStatus: 'UNPAID' | 'PAID'; paymentMethod?: string; paymentReference?: string; paidAt?: string; pointsEarned: number; createdAt: string;
}
export interface TreatmentRecord {
  id: number; customerId: number; customerName: string; appointmentId?: number; stylistId: number; stylistName: string;
  serviceId: number; serviceName: string; treatmentDate: string; details: string; productsUsed?: string; reactions?: string;
  followUpAdvice?: string; followUpServiceId?: number; followUpServiceName?: string; followUpAfterDays?: number; followUpDueDate?: string; createdAt: string;
}
export interface Reward { id: number; name: string; description?: string; pointsCost: number; active: boolean }
export interface PaymentSettings { qrPhImageUrl?: string; qrPhAccountName?: string }
export type OnlinePayStatus = 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED' | 'NEEDS_REFUND' | 'REFUNDED';
export interface OnlinePayment {
  id: number; appointmentId: number; customerName: string; serviceName: string; method: 'GCASH' | 'QRPH'; status: OnlinePayStatus;
  amount: number; paymentIntentId: string; paymongoPaymentId?: string; failureReason?: string; expiresAt?: string; paidAt?: string; createdAt: string;
}
export interface PaymentSummary { from: string; to: string; totalCollected: number; paidCount: number; byMethod: { method: string; count: number; amount: number }[]; outstandingCount: number; outstandingAmount: number }
export interface TopCustomer { customerId: number; fullName: string; phone: string; completedVisits: number; loyaltyPoints: number; tier: Tier }
export interface Page<T> { content: T[]; page: number; size: number; totalElements: number; totalPages: number }
export interface LoyaltyTx { id: number; points: number; balanceAfter: number; type: 'EARNED' | 'REDEEMED' | 'ADJUSTED'; description: string; createdAt: string; appointmentId?: number }
export interface Recommendation { id: number; customerId: number; serviceId: number; serviceName: string; stylistId?: number; stylistName?: string; message: string; source: 'MANUAL' | 'AUTO'; active: boolean }
export interface Suggestion { serviceId: number; serviceName: string; message: string }
export interface Dashboard { todayAppointments: number; pendingBookings: number; pendingHomeServiceBookings: number; totalCustomers: number; activeStylists: number; todayRevenue: number; monthRevenue: number; upcomingAppointments: Appointment[] }
export interface Summary { from: string; to: string; totalAppointments: number; appointmentsByStatus: Record<string, number>; homeServiceBookings: number; completedAppointments: number; revenue: number; averageTicket: number; newCustomers: number; loyaltyPointsIssued: number }
export interface DailyRevenue { date: string; revenue: number; completedAppointments: number }
export interface ServiceStat { serviceId: number; serviceName: string; completedCount: number; revenue: number }
export interface StylistStat { stylistId: number; stylistName: string; completedCount: number; revenue: number }
export interface Availability { stylistId: number; date: string; serviceId: number; availableStartTimes: string[] }
export type LogAction = 'LOGIN_SUCCESS' | 'LOGIN_FAILED' | 'USER_CREATED' | 'USER_UPDATED' | 'USER_DEACTIVATED'
  | 'ROLE_CHANGED' | 'APPOINTMENT_ACCEPTED' | 'APPOINTMENT_REJECTED' | 'APPOINTMENT_CANCELLED';
export interface ActivityLogEntry {
  id: number; createdAt: string; actorUserId?: number; actorName?: string; action: LogAction;
  targetType?: string; targetId?: number; details?: string;
}

const TOKEN_KEY = 'styletrack.token';
export const tokenStore = {
  get: () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } },
  set: (t: string) => { try { localStorage.setItem(TOKEN_KEY, t); } catch { /* storage unavailable */ } },
  clear: () => { try { localStorage.removeItem(TOKEN_KEY); } catch { /* storage unavailable */ } },
};

export class ApiError extends Error {
  constructor(message: string, public status: number, public fieldErrors?: Record<string, string>) { super(message); }
}

type Query = Record<string, string | number | boolean | undefined | null>;

function qs(query?: Query) {
  if (!query) return '';
  const p = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') p.set(k, String(v)); });
  const s = p.toString();
  return s ? `?${s}` : '';
}

export async function api<T = void>(path: string, opts: { method?: string; body?: unknown; query?: Query } = {}): Promise<T> {
  const token = tokenStore.get();
  let res: Response;
  try {
    res = await fetch(`/api${path}${qs(opts.query)}`, {
      method: opts.method ?? 'GET',
      headers: {
        ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection and try again.', 0);
  }
  if (res.status === 401 && path !== '/auth/login') {
    tokenStore.clear();
    window.dispatchEvent(new Event('styletrack:unauthorized'));
    throw new ApiError('Your session has ended. Sign in again.', 401);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    const fieldErrors = data?.fieldErrors as Record<string, string> | undefined;
    const detail = fieldErrors ? Object.entries(fieldErrors).map(([f, m]) => `${f}: ${m}`).join('; ') : undefined;
    throw new ApiError(detail ?? data?.message ?? `Request failed (${res.status})`, res.status, fieldErrors);
  }
  return data as T;
}

export const get = <T,>(path: string, query?: Query) => api<T>(path, { query });
export const post = <T = void,>(path: string, body?: unknown) => api<T>(path, { method: 'POST', body: body ?? {} });
export const put = <T = void,>(path: string, body?: unknown) => api<T>(path, { method: 'PUT', body: body ?? {} });
export const del = (path: string) => api(path, { method: 'DELETE' });
