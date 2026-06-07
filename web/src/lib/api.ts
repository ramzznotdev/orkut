export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string; details?: any } };

export const LS_EMAIL_KEY = 'pg_email';

export function getEmail(): string | null {
  const v = localStorage.getItem(LS_EMAIL_KEY);
  return v && v.trim() ? v.trim() : null;
}

export function setEmail(email: string) {
  localStorage.setItem(LS_EMAIL_KEY, email.trim());
}

export function clearEmail() {
  localStorage.removeItem(LS_EMAIL_KEY);
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<ApiResponse<T>> {
  const email = getEmail();
  const headers = new Headers(init?.headers || {});
  headers.set('content-type', 'application/json');
  if (email) headers.set('x-user-email', email);

  const res = await fetch(path, { ...init, headers });
  const txt = await res.text();
  let json: any = null;
  try { json = txt ? JSON.parse(txt) : null; } catch { json = null; }
  return json as ApiResponse<T>;
}


export async function registerWithEmail(email: string, password: string) {
  return apiFetch<{ email: string }>('/api/app/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function loginWithEmail(email: string, password: string) {
  return apiFetch<{ email: string }>('/api/app/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function fetchMe() {
  return apiFetch<{
    email: string;
    is_admin: boolean;
    merchant: { id: string; status: string };
  }>('/api/app/me');
}

export async function submitVerification(payload: {
  store_name: string;
  store_link: string;
  whatsapp: string;
  screenshot_url: string;
  note?: string;
}) {
  return apiFetch<{ ok: true }>('/api/app/verification/submit', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}


// =====================
// Admin API helpers
// =====================

export type VerificationQueueItem = {
  id: string;
  merchant_id: string;
  status: string;
  store_name: string;
  store_link: string;
  whatsapp: string;
  screenshot_path: string | null;
  note?: string | null;
  created_at: string;
  updated_at: string;
};

export async function adminGetOrderkuotaSettings() {
  return apiFetch<any>('/api/admin/settings/orderkuota');
}

export async function adminUpdateOrderkuotaSettings(payload: any) {
  return apiFetch<any>('/api/admin/settings/orderkuota', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function adminQrisTest(payload: { qris_static: string; amount: number }) {
  return apiFetch<any>('/api/admin/tools/qris-test', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function adminListVerificationQueue() {
  return apiFetch<VerificationQueueItem[]>('/api/admin/verification/queue');
}

export async function adminGetVerification(id: string) {
  return apiFetch<any>(`/api/admin/verification/${id}`);
}

export function adminVerificationScreenshotUrl(id: string) {
  return `/api/admin/verification/${id}/screenshot`;
}

export async function adminApproveVerification(id: string) {
  return apiFetch<any>(`/api/admin/verification/${id}/approve`, { method: 'POST' });
}
export async function adminRejectVerification(id: string, reason: string) {
  return apiFetch<any>(`/api/admin/verification/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}
export async function adminNeedMoreInfoVerification(id: string, note: string) {
  return apiFetch<any>(`/api/admin/verification/${id}/need-more-info`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  });
}

export async function adminGetStats() {
  return apiFetch<any>('/api/admin/stats');
}

export async function adminListAlerts() {
  return apiFetch<any>('/api/admin/alerts');
}
export async function adminResolveAlert(id: string) {
  return apiFetch<any>(`/api/admin/alerts/${id}/resolve`, { method: 'POST' });
}

export function adminExportInvoicesCsvUrl() {
  return '/api/admin/exports/invoices.csv';
}
export function adminExportWebhooksCsvUrl() {
  return '/api/admin/exports/webhooks.csv';
}
