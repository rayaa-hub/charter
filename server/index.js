import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluate, sanitizePolicy, spentInPeriod, CATEGORIES } from './policy.js';
import { compileCharter, parseIntent, aiEnabled, aiModel, heuristicCompile } from './ai.js';
import {
  paypalConfigured,
  paypalEnv,
  createOrder,
  captureOrder,
  getOrder,
  verifyCapturedOrder,
  refundCapture,
  verifyWebhook,
  webhookConfigured,
  PayPalError,
} from './paypal.js';
import { load, save, encryptionEnabled } from './store.js';
import { DEFAULT_CHARTER, SCENARIOS, CLAUSE_SUGGESTIONS } from './scenarios.js';
import * as auth from './auth.js';
import { redact } from './privacy.js';
import { appendAudit, verifyAudit, auditHead } from './audit.js';
import { createAgent, rotateAgentKey, findAgentByKey, publicAgent, agentSpend } from './agents.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 4242);
const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'];
const RETENTION_OPTIONS = [7, 30, 90, 365];
const VERDICT_RANK = { allow: 0, escalate: 1, block: 2 };

// --- security headers --------------------------------------------------------
// Per-request nonce: PayPal's JS SDK runs a few inline scripts; it applies the nonce we pass via
// data-csp-nonce (PayPal's documented CSP approach), so we never need 'unsafe-inline' for scripts.
const buildCsp = (nonce) => [
  "default-src 'self'",
  `script-src 'self' 'nonce-${nonce}' https://*.paypal.com https://*.paypalobjects.com`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: https://*.paypal.com https://*.paypalobjects.com",
  "connect-src 'self' https://*.paypal.com https://*.paypalobjects.com",
  'frame-src https://*.paypal.com https://*.paypalobjects.com https://*.venmo.com',
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');
const CSP_MODE = process.env.CHARTER_CSP === 'report-only' ? 'report-only' : 'enforce';

app.disable('x-powered-by');
if (process.env.TRUST_PROXY === 'true') app.set('trust proxy', 1);
app.use((req, res, next) => {
  res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
  res.set({
    [CSP_MODE === 'enforce' ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only']: buildCsp(res.locals.cspNonce),
    'Cross-Origin-Opener-Policy': 'same-origin-allow-popups', // PayPal checkout uses a popup
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(self "https://www.paypal.com" "https://www.sandbox.paypal.com")',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
  });
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  if (req.path.startsWith('/api/')) res.set('Cache-Control', 'no-store');
  next();
});

// --- helpers -----------------------------------------------------------------
class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const newId = () => crypto.randomBytes(5).toString('hex');
const nowIso = () => new Date().toISOString();
const fmt = (n, c = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency: c }).format(Number(n) || 0);
const round2 = (n) => Math.round(Number(n) * 100) / 100;

// Fixed-window rate limiter (protects the AI budget and the agent API).
const hits = new Map();
function rateLimit(max = 20, windowMs = 60_000) {
  return (req, res, next) => {
    const key = `${req.ip}:${req.route?.path || req.path}`;
    const now = Date.now();
    const h = hits.get(key);
    if (!h || now - h.start > windowMs) hits.set(key, { start: now, n: 1 });
    else if (++h.n > max) {
      res.set('Retry-After', String(Math.ceil((windowMs - (now - h.start)) / 1000)));
      return next(new HttpError(429, 'Too many requests. Please wait a minute.'));
    }
    next();
  };
}

function requireText(value, field, { min = 3, max = 4000 } = {}) {
  if (typeof value !== 'string') throw new HttpError(400, `"${field}" must be a string.`);
  const v = value.trim();
  if (v.length < min) throw new HttpError(400, `"${field}" is too short.`);
  if (v.length > max) throw new HttpError(400, `"${field}" must be under ${max} characters.`);
  return v;
}

function validatePurchase(raw) {
  if (!raw || typeof raw !== 'object') throw new HttpError(400, 'Purchase request must be an object.');
  const merchant = String(raw.merchant || '').trim().slice(0, 120);
  const amount = round2(raw.amount);
  const currency = String(raw.currency || 'USD').toUpperCase();
  if (!merchant || merchant === 'Unknown merchant') throw new HttpError(422, 'Could not identify a merchant in the request. Name the seller, e.g. "from InkDepot".');
  if (!Number.isFinite(amount) || amount <= 0) throw new HttpError(422, 'Could not identify a positive amount. Include a price, e.g. "$84".');
  if (amount > 100000) throw new HttpError(422, 'Amount exceeds the 100,000 demo ceiling.');
  if (!CURRENCIES.includes(currency)) throw new HttpError(422, `Currency ${currency} is not supported (use ${CURRENCIES.join(', ')}).`);
  return {
    merchant,
    amount,
    currency,
    category: CATEGORIES.includes(raw.category) ? raw.category : 'other',
    items: Array.isArray(raw.items)
      ? raw.items.slice(0, 20).map((i) => ({ name: String(i?.name || '').slice(0, 120), quantity: Math.max(0, Number(i?.quantity) || 0), unit_price: Math.max(0, Number(i?.unit_price) || 0) }))
      : [],
    recurring: Boolean(raw.recurring),
    justification: String(raw.justification || '').slice(0, 400),
    risk_signals: Array.isArray(raw.risk_signals) ? raw.risk_signals.map((s) => String(s).slice(0, 160)).slice(0, 8) : [],
  };
}

function ensureCharter(db) {
  if (!db.charter) {
    const policy = sanitizePolicy(heuristicCompile(DEFAULT_CHARTER));
    db.charter = { version: 1, text: DEFAULT_CHARTER, policy, engine: 'heuristic', compiledAt: nowIso() };
    db.charterHistory = [{ version: 1, compiledAt: db.charter.compiledAt, engine: 'heuristic', rules: policy.rules.length }];
    appendAudit(db, { type: 'charter.compiled', actor: 'system', summary: `Default charter v1 loaded (${policy.rules.length} rules)`, data: { version: 1, rules: policy.rules.length, engine: 'heuristic' } });
  }
  return db;
}

function seedAgents(db) {
  if (db.agents.length) return;
  for (const spec of [
    { name: 'Procurement agent', dailyLimit: 400 },
    { name: 'Ops copilot', dailyLimit: null },
  ]) {
    const { agent } = createAgent(db, spec); // keys are generated but never returned; rotate to reveal a new one
    appendAudit(db, { type: 'agent.created', actor: 'system', summary: `Agent "${agent.name}" created`, data: { agentId: agent.id } });
  }
}

/** Charter rules + built-in security checks -> final decision. */
function decide(db, agent, request) {
  const decision = evaluate(db.charter.policy, request, db.payments);
  if (db.settings.killSwitch) {
    decision.checks.unshift({ id: 'security.kill_switch', label: 'Kill switch', outcome: 'block', detail: 'Owner froze all agent spending.' });
  }
  const active = agent.status === 'active';
  decision.checks.push({
    id: 'agent.status',
    label: 'Agent status',
    outcome: active ? 'pass' : 'block',
    detail: active ? `${agent.name} is active.` : `${agent.name} is ${agent.status}.`,
  });
  if (agent.dailyLimit) {
    const spent = agentSpend(db, agent.id);
    const after = spent + request.amount;
    decision.checks.push({
      id: 'agent.daily_limit',
      label: 'Agent daily limit',
      outcome: after > agent.dailyLimit ? 'block' : 'pass',
      detail:
        after > agent.dailyLimit
          ? `Would bring ${agent.name} to ${fmt(after, request.currency)} in 24h, over its ${fmt(agent.dailyLimit, request.currency)} limit.`
          : `${fmt(after, request.currency)} of ${fmt(agent.dailyLimit, request.currency)} agent limit used in the last 24h.`,
    });
  }
  let verdict = 'allow';
  for (const t of [...decision.trace, ...decision.checks]) {
    if (t.outcome in VERDICT_RANK && VERDICT_RANK[t.outcome] > VERDICT_RANK[verdict]) verdict = t.outcome;
  }
  decision.verdict = verdict;
  return decision;
}

const statusFor = (verdict) => (verdict === 'allow' ? 'ready_to_pay' : verdict === 'escalate' ? 'needs_approval' : 'blocked');

function agentForRecord(db, r) {
  return db.agents.find((a) => a.id === r.agentId) || { id: r.agentId || null, name: r.agent || 'Agent', status: r.agentId ? 'revoked' : 'active', dailyLimit: null };
}

/** Shared request pipeline: privacy filter -> AI parse -> policy + security checks -> record + audit. */
async function processRequest(db, { agent, body, actor }) {
  let parsed;
  let engine = 'structured';
  let aiError = null;
  let storedText = null;
  const privacy = { applied: Boolean(db.settings.redactPII), redactions: [] };
  const addFindings = (findings) => {
    for (const f of findings) {
      const ex = privacy.redactions.find((x) => x.type === f.type);
      if (ex) ex.count += f.count;
      else privacy.redactions.push({ ...f });
    }
  };

  if (body?.request) {
    parsed = validatePurchase(body.request);
    if (privacy.applied && parsed.justification) {
      const r = redact(parsed.justification);
      parsed.justification = r.text;
      addFindings(r.findings);
    }
  } else {
    const clean = requireText(body?.text, 'text', { min: 8, max: 2000 });
    let forAi = clean;
    if (privacy.applied) {
      const r = redact(clean);
      forAi = r.text;
      addFindings(r.findings);
    }
    storedText = forAi; // the raw text is never persisted
    const out = await parseIntent(forAi);
    engine = out.engine;
    aiError = out.aiError;
    parsed = validatePurchase(out.request);
  }

  const decision = decide(db, agent, parsed);
  const record = {
    id: newId(),
    createdAt: nowIso(),
    agentId: agent.id,
    agent: agent.name,
    text: storedText,
    request: parsed,
    parseEngine: engine,
    aiError,
    privacy,
    charterVersion: db.charter.version,
    decision,
    status: statusFor(decision.verdict),
    approval: null,
    paypal: null,
  };
  db.requests.push(record);
  appendAudit(db, {
    type: 'request.evaluated',
    actor,
    summary: `${agent.name}: ${parsed.merchant} ${fmt(parsed.amount, parsed.currency)} -> ${decision.verdict}`,
    data: { requestId: record.id, agentId: agent.id, amount: parsed.amount, currency: parsed.currency, verdict: decision.verdict, redactions: privacy.redactions.reduce((s, f) => s + f.count, 0) },
  });
  save();
  return record;
}

function dayKey(d) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

function buildStats(db) {
  const reqs = db.requests;
  const counts = { allow: 0, escalate: 0, block: 0 };
  reqs.forEach((r) => (counts[r.decision.verdict] = (counts[r.decision.verdict] || 0) + 1));
  const verified = db.payments.filter((p) => p.status === 'COMPLETED');
  const now = Date.now();

  const series = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - i);
    series.push({ date: dayKey(d), spend: 0, blocked: 0, requests: 0 });
  }
  const idx = Object.fromEntries(series.map((s, i) => [s.date, i]));
  for (const p of verified) {
    const i = idx[dayKey(p.capturedAt)];
    if (i !== undefined) series[i].spend += Number(p.amount);
  }
  for (const r of reqs) {
    const i = idx[dayKey(r.createdAt)];
    if (i === undefined) continue;
    series[i].requests += 1;
    if (r.decision.verdict === 'block') series[i].blocked += Number(r.request.amount);
  }
  series.forEach((s) => {
    s.spend = round2(s.spend);
    s.blocked = round2(s.blocked);
  });

  const since30 = now - 30 * 86400000;
  const cat = {};
  for (const p of verified) {
    if (new Date(p.capturedAt).getTime() < since30) continue;
    cat[p.category] = (cat[p.category] || 0) + Number(p.amount);
  }

  return {
    evaluated: reqs.length,
    counts,
    paidCount: verified.length,
    verifiedSpend30d: round2(spentInPeriod(db.payments, { period: 'month' })),
    heldBack: round2(reqs.filter((r) => r.decision.verdict === 'block').reduce((s, r) => s + r.request.amount, 0)),
    pendingApprovals: reqs.filter((r) => r.status === 'needs_approval').length,
    refundedTotal: round2(db.payments.filter((p) => p.status === 'REFUNDED').reduce((s, p) => s + Number(p.amount), 0)),
    budgets: db.charter.policy.rules
      .filter((r) => r.type === 'budget_per_period')
      .map((r) => ({ ruleId: r.id, category: r.category, period: r.period, limit: r.amount, spent: round2(spentInPeriod(db.payments, { category: r.category, period: r.period, now })), source: r.source_quote })),
    series,
    byCategory: Object.entries(cat)
      .map(([category, amount]) => ({ category, amount: round2(amount) }))
      .sort((a, b) => b.amount - a.amount),
  };
}

function publicState(db) {
  ensureCharter(db);
  return {
    charter: db.charter,
    charterHistory: db.charterHistory,
    requests: [...db.requests].reverse().slice(0, 200),
    payments: [...db.payments].reverse().slice(0, 200),
    agents: db.agents.map((a) => publicAgent(db, a)),
    settings: db.settings,
    security: {
      encryptionAtRest: encryptionEnabled(),
      auditCount: db.audit.length,
      auditHead: auditHead(db),
      cspMode: CSP_MODE,
      webhookConfigured: webhookConfigured(),
      paypalConfigured: paypalConfigured(),
      aiEnabled: aiEnabled(),
      redactPII: db.settings.redactPII,
      killSwitch: db.settings.killSwitch,
    },
    stats: buildStats(db),
  };
}

function findRequest(db, reqId) {
  const r = db.requests.find((x) => x.id === reqId);
  if (!r) throw new HttpError(404, 'Request not found.');
  return r;
}

function findAgent(db, agentId) {
  const a = db.agents.find((x) => x.id === agentId);
  if (!a) throw new HttpError(404, 'Agent not found.');
  return a;
}

function applyRetention(db) {
  const cutoff = Date.now() - db.settings.retentionDays * 86400000;
  let purged = 0;
  for (const r of db.requests) {
    if (r.textPurged || new Date(r.createdAt).getTime() >= cutoff) continue;
    r.text = null;
    if (r.request) r.request.justification = '';
    r.textPurged = true;
    purged++;
  }
  if (purged) {
    appendAudit(db, { type: 'privacy.retention_applied', actor: 'system', summary: `Purged agent text from ${purged} request(s) older than ${db.settings.retentionDays} days`, data: { purged } });
  }
  return purged;
}

function pruneIdempotency(db) {
  const cutoff = Date.now() - 24 * 3600 * 1000;
  for (const [k, v] of Object.entries(db.idempotency)) if (v.at < cutoff) delete db.idempotency[k];
}

// --- PayPal webhook (raw body needed for signature verification) -----------
app.post(
  '/api/paypal/webhook',
  rateLimit(120),
  express.json({ limit: '256kb', verify: (req, _res, buf) => (req.rawBody = buf.toString('utf8')) }),
  wrap(async (req, res) => {
    if (!webhookConfigured() || !paypalConfigured()) throw new HttpError(503, 'PayPal webhooks are not configured (set PAYPAL_WEBHOOK_ID).');
    const event = req.body || {};
    const db = load();
    const verified = await verifyWebhook(req.headers, req.rawBody);
    if (!verified) {
      appendAudit(db, { type: 'webhook.received', actor: 'paypal', summary: `Rejected webhook with invalid signature (${String(event.event_type || 'unknown').slice(0, 60)})`, data: { verified: false } });
      save();
      throw new HttpError(400, 'Webhook signature verification failed.');
    }
    if (db.webhookEvents.includes(event.id)) return res.json({ ok: true, duplicate: true });
    db.webhookEvents.push(event.id);
    db.webhookEvents = db.webhookEvents.slice(-500);

    const resource = event.resource || {};
    const upCapture = (resource.links || []).find((l) => l.rel === 'up')?.href?.split('/').pop();
    const captureId = event.event_type === 'PAYMENT.CAPTURE.REFUNDED' ? upCapture : resource.id;
    const payment = db.payments.find((p) => p.id === captureId);
    const record = payment && db.requests.find((r) => r.id === payment.requestId);
    let effect = 'no matching payment';
    if (payment) {
      switch (event.event_type) {
        case 'PAYMENT.CAPTURE.COMPLETED':
          payment.webhookConfirmedAt = nowIso();
          effect = 'capture confirmed';
          break;
        case 'PAYMENT.CAPTURE.REFUNDED':
          payment.status = 'REFUNDED';
          payment.refundId = payment.refundId || resource.id;
          if (record) {
            record.status = 'refunded';
            record.refund = record.refund || { id: resource.id, status: resource.status, at: nowIso() };
          }
          effect = 'marked refunded';
          break;
        case 'PAYMENT.CAPTURE.DENIED':
        case 'PAYMENT.CAPTURE.REVERSED':
          payment.status = event.event_type.endsWith('DENIED') ? 'DENIED' : 'REVERSED';
          if (record) record.status = 'payment_failed';
          effect = `marked ${payment.status.toLowerCase()}`;
          break;
        default:
          effect = 'ignored';
      }
    }
    appendAudit(db, { type: 'webhook.received', actor: 'paypal', summary: `${event.event_type}: ${effect}`, data: { verified: true, eventId: event.id, captureId: captureId || null } });
    save();
    res.json({ ok: true });
  }),
);

app.use(express.json({ limit: '32kb' }));
// index.html is served with this request's CSP nonce injected (for the PayPal SDK).
const INDEX_HTML = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
app.get(['/', '/index.html'], (req, res) => {
  res.set('Cache-Control', 'no-store').type('html').send(INDEX_HTML.replaceAll('__CSP_NONCE__', res.locals.cspNonce));
});
app.use(express.static(path.join(__dirname, '..', 'public'), { extensions: ['html'], index: false }));

// --- authentication gate ----------------------------------------------------
const PUBLIC_API = [/^\/api\/auth\//, /^\/api\/config$/, /^\/api\/health$/, /^\/api\/v1\//, /^\/api\/paypal\/webhook$/];
app.use('/api', (req, res, next) => {
  const p = req.originalUrl.split('?')[0];
  if (PUBLIC_API.some((re) => re.test(p))) return next();
  const session = auth.getSession(req);
  if (!session || !load().owner) return next(new HttpError(401, 'Sign in required'));
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !auth.csrfMatches(session, req.get('X-CSRF-Token'))) {
    return next(new HttpError(403, 'Invalid CSRF token'));
  }
  req.session = session;
  next();
});

// --- public routes ----------------------------------------------------------
app.get('/api/health', (req, res) => res.json({ ok: true }));

app.get('/api/config', (req, res) => {
  res.json({
    ai: { enabled: aiEnabled(), model: aiModel() },
    paypal: { configured: paypalConfigured(), env: paypalEnv(), clientId: paypalConfigured() ? process.env.PAYPAL_CLIENT_ID : null },
    categories: CATEGORIES,
    scenarios: SCENARIOS.map(({ key, label, text }) => ({ key, label, text })),
    clauseSuggestions: CLAUSE_SUGGESTIONS,
    defaultCharter: DEFAULT_CHARTER,
  });
});

app.get('/api/auth/status', (req, res) => {
  const db = load();
  const session = db.owner ? auth.getSession(req) : null;
  res.json({ setupRequired: !db.owner, authenticated: Boolean(session), csrfToken: session ? session.csrf : null });
});

function readPasscode(body, { min = 1 } = {}) {
  const p = body?.passcode;
  if (typeof p !== 'string' || p.length > 200) throw new HttpError(400, 'Passcode must be a string under 200 characters.');
  if (p.length < min) throw new HttpError(400, `Passcode must be at least ${min} characters.`);
  return p;
}

app.post(
  '/api/auth/setup',
  rateLimit(10),
  wrap(async (req, res) => {
    const db = load();
    if (db.owner) throw new HttpError(409, 'Owner is already set up. Sign in instead.');
    const passcode = readPasscode(req.body, { min: 10 });
    const { hash, salt } = await auth.hashPasscode(passcode);
    if (db.owner) throw new HttpError(409, 'Owner is already set up. Sign in instead.');
    db.owner = { hash, salt, kdf: auth.KDF, createdAt: nowIso() };
    ensureCharter(db);
    appendAudit(db, { type: 'owner.setup', actor: 'owner', summary: 'Owner passcode created (scrypt)' });
    seedAgents(db);
    save();
    const { token, csrf } = auth.createSession();
    auth.setSessionCookie(req, res, token);
    res.status(201).json({ csrfToken: csrf });
  }),
);

app.post(
  '/api/auth/login',
  wrap(async (req, res) => {
    const db = load();
    if (!db.owner) throw new HttpError(409, 'No owner yet. Create a passcode first.');
    const wait = auth.lockoutRemainingMs(req.ip);
    if (wait > 0) {
      const mins = Math.ceil(wait / 60000);
      throw new HttpError(429, `Too many failed attempts. Try again in ${mins} minute${mins === 1 ? '' : 's'}.`);
    }
    const passcode = readPasscode(req.body);
    if (!(await auth.verifyPasscode(passcode, db.owner))) {
      const left = auth.recordFailure(req.ip);
      appendAudit(db, { type: 'owner.login_failed', actor: 'system', summary: 'Failed sign-in attempt' });
      save();
      throw new HttpError(401, left > 0 ? `Incorrect passcode. ${left} attempt${left === 1 ? '' : 's'} left.` : 'Incorrect passcode. Sign-in locked for 15 minutes.');
    }
    auth.clearFailures(req.ip);
    const { token, csrf } = auth.createSession();
    auth.setSessionCookie(req, res, token);
    appendAudit(db, { type: 'owner.login', actor: 'owner', summary: 'Owner signed in' });
    save();
    res.json({ csrfToken: csrf });
  }),
);

app.post('/api/auth/logout', (req, res) => {
  const session = auth.getSession(req);
  if (session) {
    if (!auth.csrfMatches(session, req.get('X-CSRF-Token'))) throw new HttpError(403, 'Invalid CSRF token');
    auth.destroySession(session);
    const db = load();
    appendAudit(db, { type: 'owner.logout', actor: 'owner', summary: 'Owner signed out' });
    save();
  }
  auth.clearSessionCookie(req, res);
  res.json({ ok: true });
});

// --- agent API (bearer key) -------------------------------------------------
function agentAuth(req, res) {
  const m = (req.get('Authorization') || '').match(/^Bearer\s+(\S+)$/i);
  const db = load();
  const agent = m ? findAgentByKey(db, m[1]) : null;
  if (!agent) {
    res.set('WWW-Authenticate', 'Bearer realm="charter-agents"');
    throw new HttpError(401, 'Invalid or revoked agent API key.');
  }
  agent.lastUsedAt = nowIso();
  return { db, agent };
}

const agentView = (r) => ({
  id: r.id,
  verdict: r.decision.verdict,
  status: r.status,
  reasons: [...r.decision.trace, ...r.decision.checks].filter((t) => t.outcome === 'block' || t.outcome === 'escalate').map((t) => t.detail),
  createdAt: r.createdAt,
});

const inFlight = new Set();
app.post(
  '/api/v1/purchase-requests',
  rateLimit(60),
  wrap(async (req, res) => {
    const { db, agent } = agentAuth(req, res);
    const idemKey = req.get('Idempotency-Key');
    if (idemKey !== undefined && (idemKey.length < 1 || idemKey.length > 80)) throw new HttpError(400, 'Idempotency-Key must be 1-80 characters.');
    pruneIdempotency(db);
    const cacheKey = idemKey ? `${agent.id}:${idemKey}` : null;
    if (cacheKey && db.idempotency[cacheKey]) {
      res.set('Idempotent-Replayed', 'true');
      return res.status(201).json(db.idempotency[cacheKey].response);
    }
    if (cacheKey && inFlight.has(cacheKey)) throw new HttpError(409, 'A request with this Idempotency-Key is already in progress.');
    if (cacheKey) inFlight.add(cacheKey);
    try {
      const record = await processRequest(db, { agent, body: req.body, actor: `agent:${agent.name}` });
      const response = agentView(record);
      if (cacheKey) db.idempotency[cacheKey] = { at: Date.now(), response };
      save();
      res.status(201).json(response);
    } finally {
      if (cacheKey) inFlight.delete(cacheKey);
    }
  }),
);

app.get('/api/v1/purchase-requests/:id', (req, res) => {
  const { db, agent } = agentAuth(req, res);
  const r = db.requests.find((x) => x.id === req.params.id && x.agentId === agent.id);
  if (!r) throw new HttpError(404, 'Request not found.');
  res.json({ id: r.id, verdict: r.decision.verdict, status: r.status, paid: r.status === 'paid' });
});

// --- owner routes -----------------------------------------------------------
app.get('/api/state', (req, res) => res.json(publicState(load())));

app.post(
  '/api/charter/compile',
  rateLimit(15),
  wrap(async (req, res) => {
    const text = requireText(req.body?.text, 'text', { min: 10, max: 4000 });
    const { policy: raw, engine, aiError } = await compileCharter(text);
    const policy = sanitizePolicy(raw);
    if (!policy.rules.length) throw new HttpError(422, 'No enforceable rules were found in that charter. Try concrete limits like "No single purchase over $500".', { unmapped: policy.unmapped, engine, aiError });
    const db = ensureCharter(load());
    const version = (db.charter?.version || 0) + 1;
    db.charter = { version, text, policy, engine, compiledAt: nowIso(), aiError };
    db.charterHistory.push({ version, compiledAt: db.charter.compiledAt, engine, rules: policy.rules.length });
    appendAudit(db, { type: 'charter.compiled', actor: 'owner', summary: `Charter v${version} compiled: ${policy.rules.length} rules (${engine})`, data: { version, rules: policy.rules.length, unmapped: policy.unmapped.length, engine } });
    save();
    res.json({ charter: db.charter });
  }),
);

app.post(
  '/api/requests',
  rateLimit(30),
  wrap(async (req, res) => {
    const db = ensureCharter(load());
    let agent;
    if (req.body?.agentId) agent = findAgent(db, String(req.body.agentId));
    else agent = db.agents.find((a) => a.status === 'active');
    if (!agent) throw new HttpError(409, 'Create or activate an agent first.');
    const record = await processRequest(db, { agent, body: req.body, actor: 'owner' });
    res.status(201).json({ record });
  }),
);

app.post('/api/requests/:id/decision', (req, res) => {
  const db = load();
  const r = findRequest(db, req.params.id);
  const action = req.body?.action;
  if (!['approve', 'decline'].includes(action)) throw new HttpError(400, 'action must be "approve" or "decline".');
  if (r.status !== 'needs_approval') throw new HttpError(409, `Request is ${r.status.replace(/_/g, ' ')}; only escalated requests can be approved or declined.`);
  const note = typeof req.body?.note === 'string' ? req.body.note.slice(0, 300) : '';
  r.approval = { action, note, at: nowIso(), by: 'owner' };
  r.status = action === 'approve' ? 'ready_to_pay' : 'declined';
  appendAudit(db, {
    type: action === 'approve' ? 'request.approved' : 'request.declined',
    actor: 'owner',
    summary: `${action === 'approve' ? 'Approved' : 'Declined'} ${r.request.merchant} ${fmt(r.request.amount, r.request.currency)}`,
    data: { requestId: r.id },
  });
  save();
  res.json({ record: r });
});

// Create the PayPal order. Re-checks the charter *now* (budgets may have changed since evaluation).
app.post(
  '/api/requests/:id/paypal/order',
  wrap(async (req, res) => {
    if (!paypalConfigured()) throw new HttpError(503, 'PayPal sandbox is not configured. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in .env.');
    const db = load();
    if (db.settings.killSwitch) throw new HttpError(423, 'Kill switch is on. Payments are frozen.');
    const r = findRequest(db, req.params.id);
    if (r.status === 'paid') throw new HttpError(409, 'This request is already paid.');
    if (!['ready_to_pay', 'awaiting_payer'].includes(r.status)) throw new HttpError(409, `Payment not permitted: request is ${r.status.replace(/_/g, ' ')}.`);
    const recheck = decide(db, agentForRecord(db, r), r.request);
    const approvedEscalation = r.approval?.action === 'approve';
    if (recheck.verdict === 'block' || (recheck.verdict === 'escalate' && !approvedEscalation)) {
      r.decision = recheck;
      r.status = recheck.verdict === 'block' ? 'blocked' : 'needs_approval';
      save();
      throw new HttpError(409, `Charter re-check at payment time returned "${recheck.verdict}". Payment stopped.`, { record: r });
    }
    r.approvalNonce = (r.approvalNonce || 0) + 1;
    const order = await createOrder({ ...r.request, id: r.id, approvalNonce: r.approvalNonce });
    r.paypal = { orderId: order.id, status: order.status, createdAt: nowIso() };
    r.status = 'awaiting_payer';
    appendAudit(db, { type: 'payment.order_created', actor: 'owner', summary: `PayPal order ${order.id} created for ${fmt(r.request.amount, r.request.currency)}`, data: { requestId: r.id, orderId: order.id, amount: r.request.amount } });
    save();
    res.json({ orderId: order.id });
  }),
);

app.post(
  '/api/requests/:id/paypal/capture',
  wrap(async (req, res) => {
    const db = load();
    const r = findRequest(db, req.params.id);
    const orderId = requireText(req.body?.orderId, 'orderId', { min: 5, max: 64 });
    if (!r.paypal?.orderId || r.paypal.orderId !== orderId) throw new HttpError(400, 'Order does not match this request.');
    if (r.status === 'paid') return res.json({ record: r, verified: true, problems: [] });

    let captureResponse;
    try {
      captureResponse = await captureOrder(orderId, r.id);
    } catch (err) {
      // ORDER_ALREADY_CAPTURED is safe to verify; anything else is a failure.
      if (!(err instanceof PayPalError && err.details?.some((d) => d.issue === 'ORDER_ALREADY_CAPTURED'))) {
        r.paypal = { ...r.paypal, status: 'CAPTURE_FAILED', error: err.message, debugId: err.debugId };
        r.status = err.details?.some((d) => d.issue === 'INSTRUMENT_DECLINED') ? 'awaiting_payer' : 'payment_failed';
        save();
        throw err;
      }
    }
    // Independent server-side verification against PayPal (never trust the browser).
    const order = await getOrder(orderId);
    const check = verifyCapturedOrder(order, { ...r.request, id: r.id });
    r.paypal = {
      ...r.paypal,
      status: order.status,
      captureId: check.capture?.id || null,
      captureStatus: check.capture?.status || null,
      payer: order.payer?.email_address ? order.payer.email_address.replace(/^(.).*(@.*)$/, '$1•••$2') : null,
      verifiedAt: nowIso(),
      verification: check.ok ? 'verified' : `failed: ${check.problems.join('; ')}`,
      captureCallStatus: captureResponse?.status || 'ALREADY_CAPTURED',
    };
    if (check.ok) {
      r.status = 'paid';
      db.payments.push({
        id: check.capture.id,
        requestId: r.id,
        orderId,
        agentId: r.agentId || null,
        agent: r.agent,
        merchant: r.request.merchant,
        category: r.request.category,
        amount: r.request.amount,
        currency: r.request.currency,
        status: 'COMPLETED',
        capturedAt: check.capture.create_time || nowIso(),
      });
      appendAudit(db, { type: 'payment.captured', actor: 'paypal', summary: `Captured and verified ${fmt(r.request.amount, r.request.currency)} (${check.capture.id})`, data: { requestId: r.id, orderId, captureId: check.capture.id, amount: r.request.amount } });
    } else {
      r.status = 'payment_unverified';
      appendAudit(db, { type: 'payment.verification_failed', actor: 'system', summary: `Verification failed for order ${orderId}`, data: { requestId: r.id, orderId, problems: check.problems } });
    }
    save();
    res.status(check.ok ? 200 : 409).json({ record: r, verified: check.ok, problems: check.problems });
  }),
);

// The payer closed the PayPal window or an error happened client-side.
app.post('/api/requests/:id/paypal/cancel', (req, res) => {
  const db = load();
  const r = findRequest(db, req.params.id);
  if (r.status === 'awaiting_payer') {
    r.status = 'ready_to_pay';
    r.paypal = { ...r.paypal, status: 'PAYER_CANCELLED' };
    save();
  }
  res.json({ record: r });
});

app.post(
  '/api/requests/:id/refund',
  wrap(async (req, res) => {
    if (!paypalConfigured()) throw new HttpError(503, 'PayPal sandbox is not configured.');
    const db = load();
    const r = findRequest(db, req.params.id);
    if (r.status !== 'paid') throw new HttpError(409, 'Only paid requests can be refunded.');
    const payment = db.payments.find((p) => p.requestId === r.id && p.status === 'COMPLETED');
    if (!payment) throw new HttpError(409, 'No completed capture found for this request.');
    const refund = await refundCapture(payment.id, r.id);
    if (!['COMPLETED', 'PENDING'].includes(refund.status)) throw new HttpError(502, `PayPal refund returned status ${refund.status}.`);
    const at = nowIso();
    payment.status = 'REFUNDED';
    payment.refundId = refund.id;
    payment.refundedAt = at;
    r.status = 'refunded';
    r.refund = { id: refund.id, status: refund.status, at };
    appendAudit(db, { type: 'payment.refunded', actor: 'owner', summary: `Refunded ${fmt(payment.amount, payment.currency)} (${refund.id}, ${refund.status})`, data: { requestId: r.id, captureId: payment.id, refundId: refund.id } });
    save();
    res.json({ record: r });
  }),
);

// Deterministic stress test: run every demo scenario through the current charter. No AI, no money.
app.post('/api/simulate', (req, res) => {
  const db = ensureCharter(load());
  const results = SCENARIOS.map((s) => {
    const d = evaluate(db.charter.policy, s.request, db.payments);
    const fired = [...d.trace, ...d.checks].filter((t) => t.outcome === 'block' || t.outcome === 'escalate');
    return { key: s.key, label: s.label, merchant: s.request.merchant, amount: s.request.amount, category: s.request.category, verdict: d.verdict, fired: fired.map((f) => f.ruleId || f.id) };
  });
  res.json({ charterVersion: db.charter.version, results });
});

// --- agents -----------------------------------------------------------------
function readDailyLimit(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = round2(v);
  if (!Number.isFinite(n) || n <= 0 || n > 1_000_000) throw new HttpError(400, 'dailyLimit must be a positive number or null.');
  return n;
}

app.post('/api/agents', (req, res) => {
  const db = load();
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  if (name.length < 2 || name.length > 40) throw new HttpError(400, 'Agent name must be 2-40 characters.');
  if (db.agents.filter((a) => a.status !== 'revoked').length >= 25) throw new HttpError(409, 'Agent limit reached. Revoke an agent first.');
  const { agent, apiKey } = createAgent(db, { name, dailyLimit: readDailyLimit(req.body?.dailyLimit) });
  appendAudit(db, { type: 'agent.created', actor: 'owner', summary: `Agent "${agent.name}" created`, data: { agentId: agent.id, dailyLimit: agent.dailyLimit } });
  save();
  res.status(201).json({ agent: publicAgent(db, agent), apiKey });
});

app.post('/api/agents/:id/rotate', (req, res) => {
  const db = load();
  const agent = findAgent(db, req.params.id);
  if (agent.status === 'revoked') throw new HttpError(409, 'Revoked agents cannot get new keys.');
  const apiKey = rotateAgentKey(agent);
  appendAudit(db, { type: 'agent.key_rotated', actor: 'owner', summary: `API key rotated for "${agent.name}" (…${agent.last4})`, data: { agentId: agent.id } });
  save();
  res.json({ agent: publicAgent(db, agent), apiKey });
});

app.post('/api/agents/:id/status', (req, res) => {
  const db = load();
  const agent = findAgent(db, req.params.id);
  const status = req.body?.status;
  if (!['active', 'paused'].includes(status)) throw new HttpError(400, 'status must be "active" or "paused".');
  if (agent.status === 'revoked') throw new HttpError(409, 'Revoked agents cannot be reactivated.');
  if (agent.status !== status) {
    agent.status = status;
    appendAudit(db, { type: status === 'paused' ? 'agent.paused' : 'agent.resumed', actor: 'owner', summary: `Agent "${agent.name}" ${status === 'paused' ? 'paused' : 'resumed'}`, data: { agentId: agent.id } });
    save();
  }
  res.json({ agent: publicAgent(db, agent) });
});

app.post('/api/agents/:id/revoke', (req, res) => {
  const db = load();
  const agent = findAgent(db, req.params.id);
  if (agent.status !== 'revoked') {
    agent.status = 'revoked';
    agent.keyHash = null;
    agent.revokedAt = nowIso();
    appendAudit(db, { type: 'agent.revoked', actor: 'owner', summary: `Agent "${agent.name}" revoked; API key destroyed`, data: { agentId: agent.id } });
    save();
  }
  res.json({ agent: publicAgent(db, agent) });
});

// --- settings, privacy, audit -------------------------------------------------
app.post('/api/settings', (req, res) => {
  const db = load();
  const b = req.body || {};
  const changes = {};
  for (const k of ['killSwitch', 'redactPII']) {
    if (!(k in b)) continue;
    if (typeof b[k] !== 'boolean') throw new HttpError(400, `${k} must be true or false.`);
    db.settings[k] = b[k];
    changes[k] = b[k];
  }
  if ('retentionDays' in b) {
    const n = Number(b.retentionDays);
    if (!RETENTION_OPTIONS.includes(n)) throw new HttpError(400, `retentionDays must be one of ${RETENTION_OPTIONS.join(', ')}.`);
    db.settings.retentionDays = n;
    changes.retentionDays = n;
  }
  if (!Object.keys(changes).length) throw new HttpError(400, 'No valid settings provided.');
  const parts = [];
  if ('killSwitch' in changes) parts.push(changes.killSwitch ? 'Kill switch ENGAGED: all agent spending frozen' : 'Kill switch released');
  if ('redactPII' in changes) parts.push(`PII redaction ${changes.redactPII ? 'on' : 'off'}`);
  if ('retentionDays' in changes) parts.push(`Retention set to ${changes.retentionDays} days`);
  appendAudit(db, { type: 'settings.updated', actor: 'owner', summary: parts.join('; '), data: changes });
  if ('retentionDays' in changes) applyRetention(db);
  save();
  res.json({ settings: db.settings });
});

app.get('/api/privacy/export', (req, res) => {
  const db = load();
  appendAudit(db, { type: 'privacy.exported', actor: 'owner', summary: 'Full data export downloaded' });
  save();
  const payload = {
    exportedAt: nowIso(),
    charter: db.charter,
    charterHistory: db.charterHistory,
    requests: db.requests,
    payments: db.payments,
    agents: db.agents.map((a) => publicAgent(db, a)),
    settings: db.settings,
    audit: db.audit,
  };
  res.set('Content-Disposition', 'attachment; filename="charter-export.json"');
  res.type('application/json').send(JSON.stringify(payload, null, 2));
});

app.post('/api/privacy/wipe', (req, res) => {
  if (req.body?.confirm !== 'DELETE') throw new HttpError(400, 'Type DELETE to confirm.');
  const db = load();
  const n = db.requests.length;
  const m = db.payments.length;
  db.requests = [];
  db.payments = [];
  db.idempotency = {};
  appendAudit(db, { type: 'privacy.wiped', actor: 'owner', summary: `Deleted ${n} request(s) and ${m} payment record(s)`, data: { requests: n, payments: m } });
  save();
  res.json({ ok: true });
});

app.get('/api/audit', (req, res) => {
  const db = load();
  const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 100));
  res.json({ events: db.audit.slice(-limit).reverse(), head: auditHead(db), count: db.audit.length });
});

app.post('/api/audit/verify', (req, res) => res.json(verifyAudit(load().audit)));

app.post('/api/reset', (req, res) => {
  if (process.env.CHARTER_ALLOW_RESET === 'false') throw new HttpError(403, 'Reset disabled.');
  const db = load();
  db.requests = [];
  db.payments = [];
  db.idempotency = {};
  db.webhookEvents = [];
  db.charter = null;
  db.charterHistory = [];
  db.audit = [];
  appendAudit(db, { type: 'data.reset', actor: 'owner', summary: 'Demo data reset; audit chain restarted' });
  ensureCharter(db);
  save();
  res.json(publicState(db));
});

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || (err.type === 'entity.parse.failed' ? 400 : err.type === 'entity.too.large' ? 413 : 500);
  if (status >= 500) console.error('[charter]', err.message, err.debugId ? `(PayPal debug id ${err.debugId})` : '');
  res.status(status).json({
    error: status === 500 ? 'Something went wrong on our side.' : err.type === 'entity.parse.failed' ? 'Request body is not valid JSON.' : err.message,
    debugId: err.debugId,
    details: err instanceof PayPalError ? err.details : undefined,
    ...(err.extra || {}),
  });
});

// --- boot -------------------------------------------------------------------
const db = ensureCharter(load());
applyRetention(db);
save();
setInterval(() => {
  const d = load();
  if (applyRetention(d)) save();
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [k, h] of hits) if (h.start < cutoff) hits.delete(k);
}, 60 * 60 * 1000).unref();

app.listen(PORT, () => {
  console.log(`Charter running on http://localhost:${PORT}`);
  console.log(`  AI:       ${aiEnabled() ? `Claude (${aiModel()})` : 'heuristic fallback (set ANTHROPIC_API_KEY for Claude)'}`);
  console.log(`  PayPal:   ${paypalConfigured() ? `${paypalEnv()} configured` : 'NOT configured (set PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET)'}${webhookConfigured() ? ' + webhooks' : ''}`);
  console.log(`  Security: CSP ${CSP_MODE}, data at rest ${encryptionEnabled() ? 'AES-256-GCM encrypted' : 'plaintext (set CHARTER_DATA_KEY)'}, owner ${db.owner ? 'configured' : 'NOT set up yet (open the app)'}`);
});
