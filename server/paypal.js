// PayPal Orders v2 (REST) — server-side only. The client secret never leaves this process.
// Docs: https://developer.paypal.com/docs/api/orders/v2/

const BASE = process.env.PAYPAL_API_BASE || 'https://api-m.sandbox.paypal.com';

export function paypalConfigured() {
  return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}
export const paypalEnv = () => (BASE.includes('sandbox') ? 'sandbox' : 'live');

export class PayPalError extends Error {
  constructor(message, { status, debugId, details } = {}) {
    super(message);
    this.status = status;
    this.debugId = debugId;
    this.details = details;
  }
}

let cached = { token: null, expiresAt: 0 };

async function accessToken() {
  if (!paypalConfigured()) throw new PayPalError('PayPal sandbox credentials are not configured.', { status: 503 });
  if (cached.token && Date.now() < cached.expiresAt - 60_000) return cached.token;
  const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64');
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
    signal: AbortSignal.timeout(15_000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new PayPalError(`PayPal authentication failed: ${body.error_description || res.status}`, { status: 502 });
  cached = { token: body.access_token, expiresAt: Date.now() + Number(body.expires_in || 0) * 1000 };
  return cached.token;
}

async function call(method, path, { body, rawBody, requestId } = {}) {
  const token = await accessToken();
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=representation' };
  if (requestId) headers['PayPal-Request-Id'] = requestId; // idempotency
  const payload = rawBody ?? (body ? JSON.stringify(body) : undefined);
  const res = await fetch(`${BASE}${path}`, { method, headers, body: payload, signal: AbortSignal.timeout(20_000) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const issue = data?.details?.[0]?.issue;
    throw new PayPalError(`PayPal ${method} ${path.split('?')[0]} failed: ${issue || data.message || res.status}`, {
      status: res.status === 422 ? 422 : 502,
      debugId: data.debug_id || res.headers.get('paypal-debug-id'),
      details: data.details,
    });
  }
  return data;
}

const money2 = (n) => (Math.round(Number(n) * 100) / 100).toFixed(2);

export async function createOrder(request) {
  const value = money2(request.amount);
  const unit = {
    reference_id: request.id,
    custom_id: request.id,
    invoice_id: `CHARTER-${request.id}-${Date.now().toString(36)}`,
    description: `Charter-approved agent purchase: ${request.merchant}`.slice(0, 127),
    amount: { currency_code: request.currency, value },
  };
  // Itemize only when the line items reconcile to the cent; PayPal rejects mismatched breakdowns.
  const items = (request.items || []).filter((i) => i.name && Number(i.unit_price) > 0 && Number(i.quantity) >= 1 && Number.isInteger(Number(i.quantity)));
  const itemTotal = items.reduce((s, i) => s + Number(money2(i.unit_price)) * Number(i.quantity), 0);
  if (items.length && money2(itemTotal) === value) {
    unit.amount.breakdown = { item_total: { currency_code: request.currency, value } };
    unit.items = items.slice(0, 20).map((i) => ({
      name: String(i.name).slice(0, 127),
      quantity: String(i.quantity),
      unit_amount: { currency_code: request.currency, value: money2(i.unit_price) },
    }));
  }
  return call('POST', '/v2/checkout/orders', {
    requestId: `create-${request.id}-${request.approvalNonce || 0}`,
    // Standard Checkout shape for JS SDK Buttons: no payment_source here, so every
    // funding option the SDK shows (PayPal wallet, debit/credit card) can approve the order.
    body: {
      intent: 'CAPTURE',
      purchase_units: [unit],
    },
  });
}

export const getOrder = (orderId) => call('GET', `/v2/checkout/orders/${encodeURIComponent(orderId)}`);

export const captureOrder = (orderId, requestId) =>
  call('POST', `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, { requestId: `capture-${requestId}-${orderId}` });

/** Full refund of a completed capture (Payments v2). Idempotent per request. */
export const refundCapture = (captureId, requestId) =>
  call('POST', `/v2/payments/captures/${encodeURIComponent(captureId)}/refund`, { requestId: `refund-${requestId}`, body: {} });

export const webhookConfigured = () => Boolean(process.env.PAYPAL_WEBHOOK_ID);

/**
 * Verify a webhook with PayPal's verify-webhook-signature API.
 * Uses the raw request body so the event is byte-identical to what PayPal signed.
 */
export async function verifyWebhook(headers, rawEvent) {
  const h = (n) => {
    const v = headers[n];
    return typeof v === 'string' ? v : '';
  };
  const fields = {
    auth_algo: h('paypal-auth-algo'),
    cert_url: h('paypal-cert-url'),
    transmission_id: h('paypal-transmission-id'),
    transmission_sig: h('paypal-transmission-sig'),
    transmission_time: h('paypal-transmission-time'),
    webhook_id: process.env.PAYPAL_WEBHOOK_ID,
  };
  if (!fields.transmission_id || !fields.transmission_sig || !fields.cert_url || !fields.auth_algo || !rawEvent) return false;
  const prefix = JSON.stringify(fields).slice(0, -1); // drop closing brace, append raw event
  const out = await call('POST', '/v1/notifications/verify-webhook-signature', { rawBody: `${prefix},"webhook_event":${rawEvent}}` });
  return out?.verification_status === 'SUCCESS';
}

/**
 * Trust nothing from the browser: re-read the order from PayPal and check that it is the
 * order we created for this request, for the exact amount, and that the capture completed.
 */
export function verifyCapturedOrder(order, request) {
  const problems = [];
  const unit = order?.purchase_units?.[0];
  const capture = unit?.payments?.captures?.[0];
  if (order?.status !== 'COMPLETED') problems.push(`order status is ${order?.status}`);
  if (unit?.custom_id !== request.id) problems.push('order does not belong to this request');
  if (unit?.amount?.value !== money2(request.amount) || unit?.amount?.currency_code !== request.currency)
    problems.push(`amount ${unit?.amount?.value} ${unit?.amount?.currency_code} does not match approved ${money2(request.amount)} ${request.currency}`);
  if (!capture || capture.status !== 'COMPLETED') problems.push(`capture status is ${capture?.status || 'missing'}`);
  return { ok: problems.length === 0, problems, capture };
}
