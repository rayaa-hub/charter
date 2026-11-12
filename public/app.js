// Charter console. Framework-free, CSP-safe (no inline handlers, no eval).
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const money = (n, c = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency: c, maximumFractionDigits: 2 }).format(Number(n) || 0);
const money0 = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(n) || 0);
const label = (s) => String(s || '').replace(/_/g, ' ');
const cap = (s) => label(s).replace(/^./, (c) => c.toUpperCase());
const ago = (iso) => {
  if (!iso) return '—';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};
const shortDate = (d) => new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const PALETTE = ['#7c6cff', '#4f8cff', '#10b981', '#f59e0b', '#ec4899', '#14b8a6', '#f97316', '#a78bfa'];
const colorFor = (s) => PALETTE[[...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % PALETTE.length];
const mAvatar = (name) => `<span class="m-avatar" style="background:${colorFor(name)}">${esc(String(name || '?').trim().charAt(0).toUpperCase())}</span>`;

const ICONS = {
  grid: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/>',
  bot: '<rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><path d="M8 16h.01"/><path d="M16 16h.01"/>',
  card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  shieldcheck: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  rotate: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  pause: '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
  play: '<path d="m6 3 14 9-14 9V3z"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
  eyeoff: '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.53 13.53 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><path d="m2 2 20 20"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  sparkles: '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  ban: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  db: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>',
  arrow: '<path d="M5 12h14M12 5l7 7-7 7"/>',
  flask: '<path d="M9 3h6"/><path d="M10 9V3"/><path d="M14 9V3"/><path d="M10 9 4.5 19a2 2 0 0 0 1.7 3h11.6a2 2 0 0 0 1.7-3L14 9"/>',
  receipt: '<path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 3 2V2l-3 2-3-2-3 2-3-2-3 2z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
};
const icon = (n, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`;
const LOGO = '<svg viewBox="0 0 32 32" width="100%" height="100%" aria-hidden="true"><defs><linearGradient id="lgc" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8B7CFF"/><stop offset="1" stop-color="#4F9CFF"/></linearGradient></defs><rect width="32" height="32" rx="9" fill="url(#lgc)"/><path d="M21.5 11.2A7 7 0 1 0 21.5 20.8" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round"/><circle cx="16" cy="16" r="2.2" fill="#fff"/></svg>';

function hydrate(root = document) {
  // Unique gradient id per logo: a shared id breaks when the first instance is display:none.
  $$('[data-logo]', root).forEach((el, i) => (el.innerHTML = LOGO.replaceAll('lgc', `lgc${Math.random().toString(36).slice(2, 7)}${i}`)));
  $$('[data-icon]', root).forEach((el) => {
    el.innerHTML = icon(el.dataset.icon);
    el.removeAttribute('data-icon');
  });
  $$('[data-icon-inline]', root).forEach((el) => {
    el.insertAdjacentHTML('afterbegin', icon(el.dataset.iconInline, 'sm'));
    el.removeAttribute('data-icon-inline');
  });
}

const VERDICT = {
  allow: { text: 'Allowed', icon: 'check', sub: 'Passed every rule' },
  escalate: { text: 'Needs approval', icon: 'clock', sub: 'Waiting for your decision' },
  block: { text: 'Blocked', icon: 'ban', sub: 'Stopped before any payment' },
};
const STATUS = {
  ready_to_pay: ['Ready to pay', 'info'],
  awaiting_payer: ['Awaiting payer', 'info'],
  needs_approval: ['Needs approval', 'warn'],
  blocked: ['Blocked', 'bad'],
  declined: ['Declined', 'neutral'],
  paid: ['Paid · verified', 'ok'],
  refunded: ['Refunded', 'neutral'],
  payment_failed: ['Payment failed', 'bad'],
  payment_unverified: ['Unverified', 'bad'],
};
const statusBadge = (s) => {
  const [t, k] = STATUS[s] || [cap(s), 'neutral'];
  return `<span class="badge ${k}">${esc(t)}</span>`;
};
const verdictBadge = (v) => `<span class="badge ${v}">${icon(VERDICT[v]?.icon || 'check')}${VERDICT[v]?.text || esc(v)}</span>`;
const RULE_META = {
  max_per_transaction: ['card', 'Per-purchase cap'],
  approval_above: ['user', 'Approval threshold'],
  budget_per_period: ['activity', 'Rolling budget'],
  block_category: ['ban', 'Blocked category'],
  block_merchant: ['ban', 'Blocked merchant'],
  allow_only_merchants: ['check', 'Merchant allow-list'],
  active_hours: ['clock', 'Active hours'],
  new_merchant_review: ['user', 'New merchant review'],
};

// ------------------------------------------------------------------ state & api
const state = { config: null, csrf: null, data: null, raw: '', route: 'overview', current: null, paying: false, qFilter: 'all', pFilter: 'all', sim: null, chain: null, auditCount: -1, paypalKey: null };

class ApiError extends Error {}
async function api(path, { method, body } = {}) {
  const m = method || (body !== undefined ? 'POST' : 'GET');
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (m !== 'GET' && state.csrf) headers['X-CSRF-Token'] = state.csrf;
  let res;
  try {
    res = await fetch(path, { method: m, headers, body: body !== undefined ? JSON.stringify(body) : undefined, credentials: 'same-origin' });
  } catch {
    throw new ApiError('Network error: the Charter server is unreachable.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new ApiError(data.error || `Request failed (${res.status})`);
    Object.assign(err, data, { status: res.status });
    if (res.status === 401 && !path.startsWith('/api/auth/')) showAuth('login', 'Your session ended. Please sign in again.');
    throw err;
  }
  return data;
}

function toast(msg, kind = 'ok') {
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.innerHTML = `${icon(kind === 'bad' ? 'alert' : 'check')}<div class="grow">${esc(msg)}</div>`;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), kind === 'bad' ? 6500 : 3800);
}

async function busy(btn, text, fn) {
  if (!btn) return fn();
  const html = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="spin"></span>${esc(text)}`;
  try {
    return await fn();
  } finally {
    if (document.body.contains(btn)) {
      btn.disabled = false;
      btn.innerHTML = html;
    }
  }
}

function modal({ title, body, actions = [], wide = false }) {
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}" ${wide ? 'style="width:min(640px,100%)"' : ''}>
    <div class="modal-h"><h3>${esc(title)}</h3><button class="btn ghost icon-btn" data-close aria-label="Close">${icon('x')}</button></div>
    <div class="modal-b">${body}</div>
    ${actions.length ? `<div class="modal-f">${actions.map((a, i) => `<button class="btn ${a.kind || ''}" data-i="${i}">${a.label}</button>`).join('')}</div>` : ''}</div>`;
  const close = () => {
    bg.remove();
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e) => e.key === 'Escape' && close();
  document.addEventListener('keydown', onKey);
  bg.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (e.target === bg || e.target.closest('[data-close]')) return close();
    const b = e.target.closest('[data-i]');
    if (b) {
      const a = actions[Number(b.dataset.i)];
      if (a.onClick) await busy(b, a.busy || 'Working…', () => a.onClick(close, bg));
      else close();
    }
  });
  $('#modal-root').appendChild(bg);
  setTimeout(() => $('input,select,textarea', bg)?.focus(), 50);
  return { el: bg, close };
}

function copy(text, msg = 'Copied to clipboard') {
  navigator.clipboard?.writeText(text).then(() => toast(msg), () => toast('Copy failed. Select and copy manually.', 'bad'));
}

// ------------------------------------------------------------------ auth
function showAuth(mode, message = '') {
  stopPolling();
  $('#boot').hidden = true;
  $('#shell').hidden = true;
  $('#auth').hidden = false;
  const setup = mode === 'setup';
  $('#auth-form').dataset.mode = mode;
  $('#auth-title').textContent = setup ? 'Secure your console' : 'Sign in to Charter';
  $('#auth-sub').textContent = setup ? 'First run: create the owner passcode that protects your policy, agents and payments.' : 'Enter your owner passcode to open the console.';
  $('#confirm-wrap').hidden = !setup;
  $('#passcode').setAttribute('autocomplete', setup ? 'new-password' : 'current-password');
  $('#auth-submit').textContent = setup ? 'Create passcode & continue' : 'Sign in';
  $('#auth-err').textContent = message;
  $('#passcode').value = '';
  $('#passcode2').value = '';
  setTimeout(() => $('#passcode').focus(), 50);
}

function strength(p) {
  let s = 0;
  if (p.length >= 10) s++;
  if (p.length >= 14) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  return p.length < 10 ? 0 : Math.min(4, s);
}

function bindAuth() {
  $('#passcode').addEventListener('input', (e) => {
    if ($('#auth-form').dataset.mode !== 'setup') return;
    const s = strength(e.target.value);
    const el = $('#strength');
    el.style.width = `${Math.max(8, (s / 4) * 100)}%`;
    el.style.background = ['#f87171', '#f87171', '#fbbf24', '#34d399', '#34d399'][s];
    $('#strength-hint').textContent = ['Too short: at least 10 characters.', 'Weak: try a longer passphrase.', 'Fair: add length or mixed characters.', 'Strong.', 'Very strong.'][s];
  });
  $('#auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const setup = $('#auth-form').dataset.mode === 'setup';
    const passcode = $('#passcode').value;
    $('#auth-err').textContent = '';
    if (passcode.length < 10) return ($('#auth-err').textContent = 'Passcode must be at least 10 characters.');
    if (setup && passcode !== $('#passcode2').value) return ($('#auth-err').textContent = 'Passcodes do not match.');
    await busy($('#auth-submit'), setup ? 'Securing…' : 'Signing in…', async () => {
      try {
        const out = await api(setup ? '/api/auth/setup' : '/api/auth/login', { body: { passcode } });
        state.csrf = out.csrfToken;
        $('#passcode').value = '';
        $('#passcode2').value = '';
        await enterApp();
        if (setup) toast('Console secured. Two demo agents were created for you.');
      } catch (err) {
        $('#auth-err').textContent = err.message;
      }
    });
  });
}

// ------------------------------------------------------------------ shell
let pollTimer = null;
function startPolling() {
  stopPolling();
  pollTimer = setInterval(() => {
    if (document.visibilityState === 'visible') refresh(true).catch(() => {});
  }, 4000);
}
function stopPolling() {
  clearInterval(pollTimer);
  pollTimer = null;
}

async function enterApp() {
  $('#auth').hidden = true;
  $('#boot').hidden = true;
  $('#shell').hidden = false;
  await refresh();
  route();
  startPolling();
}

function renderChrome() {
  const d = state.data;
  const sec = d.security || {};
  const pending = d.stats?.pendingApprovals || 0;
  const np = $('#nav-pending');
  np.hidden = !pending;
  np.textContent = pending;
  const kill = !!d.settings?.killSwitch;
  $('#kill-banner').hidden = !kill;
  const kq = $('#kill-quick');
  kq.className = `btn ${kill ? 'danger' : ''}`;
  kq.innerHTML = `${icon('zap')}<span class="txt">${kill ? 'Spending frozen' : 'Kill switch'}</span>`;
  const ai = state.config.ai;
  const pp = state.config.paypal;
  $('#sb-status').innerHTML = `
    <div><span class="dot ${ai.enabled ? 'ok' : 'warn'}"></span><span class="grow">${ai.enabled ? `AI · ${esc(ai.model)}` : 'AI · heuristic mode'}</span></div>
    <div><span class="dot ${pp.configured ? 'ok' : 'warn'}"></span><span class="grow">PayPal ${pp.configured ? `${esc(pp.env)} connected` : 'not connected'}</span></div>
    <div><span class="dot ${kill ? 'bad' : 'ok'}"></span><span class="grow">${kill ? 'Spending frozen' : 'Spending live'}</span></div>
    <div><span class="dot ok"></span><span class="grow">Audit chain · ${sec.auditCount ?? 0} events</span></div>`;
}

const ROUTES = {};
function route() {
  if ($('#shell').hidden || !state.data) return;
  const [name, arg] = (location.hash || '#overview').slice(1).split('/');
  const r = ROUTES[name] ? name : 'overview';
  if (r === 'requests' && arg) state.current = arg;
  state.route = r;
  $$('#nav a').forEach((a) => a.classList.toggle('active', a.dataset.route === r));
  $('#page-title').textContent = ROUTES[r].title;
  $('#page-sub').textContent = ROUTES[r].sub;
  document.title = `${ROUTES[r].title} · Charter`;
  const page = $('#page');
  page.innerHTML = ROUTES[r].mount();
  page.style.animation = 'none';
  void page.offsetWidth;
  page.style.animation = '';
  hydrate(page);
  $('#sidebar').classList.remove('open');
  ROUTES[r].update({ first: true });
  window.scrollTo({ top: 0 });
}
window.addEventListener('hashchange', route);

const sig = (id) => JSON.stringify(state.data?.requests.find((r) => r.id === id) || null);
async function refresh(background = false) {
  const before = state.current ? sig(state.current) : null;
  const next = await api('/api/state');
  const raw = JSON.stringify(next);
  if (background && raw === state.raw) return;
  state.raw = raw;
  state.data = next;
  renderChrome();
  if (!$('#shell').hidden && $('#page').childElementCount) ROUTES[state.route]?.update({ background, before });
}

// ------------------------------------------------------------------ charts
function spark(values, color) {
  const v = values.length ? values : [0];
  const max = Math.max(...v, 1);
  const pts = v.map((y, i) => `${((i / Math.max(1, v.length - 1)) * 96).toFixed(1)},${(32 - (y / max) * 28).toFixed(1)}`).join(' ');
  return `<svg class="spark" viewBox="0 0 96 34" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>`;
}

function niceMax(n) {
  if (n <= 10) return 10;
  const p = 10 ** Math.floor(Math.log10(n));
  return Math.ceil(n / p) * p;
}

function areaChart(series) {
  const W = 680, H = 240, L = 52, R = 12, T = 12, B = 28;
  const n = series.length || 1;
  const max = niceMax(Math.max(...series.map((d) => Math.max(d.spend, d.blocked)), 0));
  const x = (i) => L + (i / Math.max(1, n - 1)) * (W - L - R);
  const y = (v) => T + (1 - v / max) * (H - T - B);
  const line = (k) => series.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d[k]).toFixed(1)}`).join(' ');
  const area = `${line('spend')} L${x(n - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;
  const grid = [0, 0.25, 0.5, 0.75, 1]
    .map((f) => `<line class="gridline" x1="${L}" x2="${W - R}" y1="${y(max * f)}" y2="${y(max * f)}"/><text class="axis" x="${L - 8}" y="${y(max * f) + 4}" text-anchor="end">${money0(max * f)}</text>`)
    .join('');
  const labels = series.map((d, i) => (i % 3 === 0 || i === n - 1 ? `<text class="axis" x="${x(i).toFixed(1)}" y="${H - 6}" text-anchor="middle">${shortDate(d.date)}</text>` : '')).join('');
  const bw = (W - L - R) / Math.max(1, n - 1);
  const hits = series.map((d, i) => `<rect x="${(x(i) - bw / 2).toFixed(1)}" y="${T}" width="${bw.toFixed(1)}" height="${H - T - B}" fill="transparent" data-i="${i}"/>`).join('');
  const dots = series.map((d, i) => (d.spend ? `<circle cx="${x(i).toFixed(1)}" cy="${y(d.spend).toFixed(1)}" r="3.2" fill="#0e1117" stroke="#9d90ff" stroke-width="2"/>` : '')).join('');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Verified spend and blocked attempts over the last 14 days">
    <defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7c6cff" stop-opacity=".45"/><stop offset="1" stop-color="#7c6cff" stop-opacity="0"/></linearGradient></defs>
    ${grid}${labels}
    <path d="${area}" fill="url(#ag)"/>
    <path d="${line('spend')}" fill="none" stroke="#9d90ff" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>
    <path d="${line('blocked')}" fill="none" stroke="#f87171" stroke-width="1.8" stroke-dasharray="5 5" stroke-linejoin="round"/>
    ${dots}<line class="cursor" x1="0" x2="0" y1="${T}" y2="${H - B}" stroke="rgba(255,255,255,.2)" stroke-dasharray="3 3" visibility="hidden"/>${hits}</svg>
    <div class="chart-tip"></div>`;
}

function bindChart(el, series) {
  const svg = $('svg', el);
  const tip = $('.chart-tip', el);
  const cursor = $('.cursor', el);
  el.onmousemove = (e) => {
    const r = e.target.closest('rect[data-i]');
    if (!r) return;
    const d = series[Number(r.dataset.i)];
    if (!d) return;
    const box = el.getBoundingClientRect();
    const rb = r.getBoundingClientRect();
    const cx = Number(r.getAttribute('x')) + Number(r.getAttribute('width')) / 2;
    cursor.setAttribute('x1', cx);
    cursor.setAttribute('x2', cx);
    cursor.setAttribute('visibility', 'visible');
    tip.innerHTML = `<div class="dim xs" style="margin-bottom:4px">${shortDate(d.date)}</div>
      <div class="row" style="gap:8px"><i style="width:8px;height:8px;border-radius:2px;background:#9d90ff;display:inline-block"></i>Verified<b class="num" style="margin-left:auto;padding-left:14px">${money(d.spend)}</b></div>
      <div class="row" style="gap:8px"><i style="width:8px;height:8px;border-radius:2px;background:#f87171;display:inline-block"></i>Blocked<b class="num" style="margin-left:auto;padding-left:14px">${money(d.blocked)}</b></div>
      <div class="dim xs" style="margin-top:4px">${d.requests} request${d.requests === 1 ? '' : 's'}</div>`;
    tip.style.left = `${Math.min(Math.max(rb.left + rb.width / 2 - box.left, 80), box.width - 80)}px`;
    tip.style.top = `${e.clientY - box.top}px`;
    tip.classList.add('show');
    void svg;
  };
  el.onmouseleave = () => {
    tip.classList.remove('show');
    cursor.setAttribute('visibility', 'hidden');
  };
}

function donut(counts) {
  const total = (counts.allow || 0) + (counts.escalate || 0) + (counts.block || 0);
  const C = 2 * Math.PI * 54;
  let off = 0;
  const segs = [['allow', '#34d399'], ['escalate', '#fbbf24'], ['block', '#f87171']]
    .map(([k, c]) => {
      const len = total ? ((counts[k] || 0) / total) * C : 0;
      const s = len ? `<circle cx="70" cy="70" r="54" fill="none" stroke="${c}" stroke-width="14" stroke-dasharray="${Math.max(0.01, len - (len < C ? 3 : 0)).toFixed(2)} ${C.toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 70 70)"/>` : '';
      off += len;
      return s;
    })
    .join('');
  const rows = [['allow', 'Allowed', '#34d399'], ['escalate', 'Needs approval', '#fbbf24'], ['block', 'Blocked', '#f87171']]
    .map(([k, t, c]) => `<div class="mix-row"><span class="row" style="gap:8px"><i style="width:9px;height:9px;border-radius:3px;background:${c};display:inline-block"></i>${t}</span><span class="num"><b>${counts[k] || 0}</b> <span class="dim">${total ? Math.round(((counts[k] || 0) / total) * 100) : 0}%</span></span></div>`)
    .join('');
  return `<div class="donut-wrap"><div style="position:relative;width:140px;height:140px">
      <svg viewBox="0 0 140 140" width="140" height="140" aria-hidden="true"><circle cx="70" cy="70" r="54" fill="none" stroke="rgba(255,255,255,.06)" stroke-width="14"/>${segs}</svg>
      <div style="position:absolute;inset:0;display:grid;place-items:center;text-align:center"><div><div class="donut-center">${total}</div><div class="dim xs">requests</div></div></div></div>
    <div>${rows}</div></div>`;
}

const empty = (ic, title, text) => `<div class="empty"><div class="ic">${icon(ic, 'lg')}</div><h4>${esc(title)}</h4><p>${esc(text)}</p></div>`;

// ------------------------------------------------------------------ OVERVIEW
ROUTES.overview = {
  title: 'Overview',
  sub: 'How your agents are spending, and what Charter stopped.',
  mount: () => `
    <div class="grid g-4" id="kpis"></div>
    <div class="grid g-main">
      <section class="card"><div class="card-h"><div><h3>Agent spend</h3><p>Verified PayPal captures vs. blocked attempts · last 14 days</p></div>
        <div class="legend"><span><i style="background:#9d90ff"></i>Verified</span><span><i style="background:#f87171"></i>Blocked</span></div></div>
        <div class="chart" id="spend-chart"></div></section>
      <section class="card"><div class="card-h"><div><h3>Decisions</h3><p>Every agent request, by verdict</p></div></div><div id="donut"></div></section>
    </div>
    <div class="grid g-3">
      <section class="card"><div class="card-h"><div><h3>Budgets</h3><p>Rolling windows · verified spend only</p></div><a class="btn sm ghost" href="#policy">Edit</a></div><div id="budgets"></div></section>
      <section class="card"><div class="card-h"><div><h3>Live activity</h3><p>Agent requests as they arrive</p></div><span class="badge neutral"><span class="dot ok"></span>Live</span></div><div class="feed" id="feed"></div></section>
      <section class="card"><div class="card-h"><div><h3>Protection</h3><p>Security &amp; privacy posture</p></div><a class="btn sm ghost" href="#security">Manage</a></div><div class="posture" id="posture"></div></section>
    </div>
    <section class="card"><div class="card-h"><div><h3>Policy stress test</h3><p>Six realistic agent behaviours run against your live policy. Deterministic: no AI calls, no money moved.</p></div>
      <button class="btn" data-action="sim">${icon('flask')}Run stress test</button></div><div class="sim" id="sim"></div></section>`,
  update() {
    const { stats, requests } = state.data;
    const series = stats.series || [];
    const counts = stats.counts || {};
    const autoRate = stats.evaluated ? Math.round(((counts.allow || 0) / stats.evaluated) * 100) : 0;
    $('#kpis').innerHTML = [
      { c: 'violet', ic: 'wallet', k: 'Verified spend · 30d', v: money(stats.verifiedSpend30d), s: `${stats.paidCount} PayPal capture${stats.paidCount === 1 ? '' : 's'}`, sp: spark(series.map((d) => d.spend), '#9d90ff') },
      { c: 'ok', ic: 'check', k: 'Auto-approved', v: `${autoRate}%`, s: `${counts.allow || 0} of ${stats.evaluated} requests`, sp: spark(series.map((d) => d.requests), '#34d399') },
      { c: 'warn', ic: 'clock', k: 'Needs your approval', v: stats.pendingApprovals || 0, s: stats.pendingApprovals ? 'Click to review' : 'Nothing waiting', link: '#requests' },
      { c: 'bad', ic: 'ban', k: 'Held back', v: money(stats.heldBack), s: `${counts.block || 0} blocked request${counts.block === 1 ? '' : 's'}`, sp: spark(series.map((d) => d.blocked), '#f87171') },
    ]
      .map((k) => `<div class="card kpi ${k.c} ${k.link ? 'clickable' : ''}" ${k.link ? `data-href="${k.link}"` : ''}><div class="k"><span class="ic">${icon(k.ic, 'sm')}</span>${k.k}</div><div class="v">${esc(k.v)}</div><div class="s">${esc(k.s)}</div>${k.sp || ''}</div>`)
      .join('');
    const ser = series.length ? series : [{ date: new Date().toISOString().slice(0, 10), spend: 0, blocked: 0, requests: 0 }];
    const chart = $('#spend-chart');
    chart.innerHTML = areaChart(ser);
    bindChart(chart, ser);
    $('#donut').innerHTML = stats.evaluated ? donut(counts) : empty('activity', 'No decisions yet', 'Send an agent request to see allowed, escalated and blocked decisions here.');
    $('#budgets').innerHTML = stats.budgets?.length
      ? stats.budgets
          .map((b) => {
            const pct = Math.min(100, (b.spent / b.limit) * 100);
            return `<div class="budget"><div class="top"><span class="name">${esc(b.category === 'any' ? 'All spending' : label(b.category))} <span class="dim sm">· per ${esc(b.period)}</span></span><span class="num sm">${money(b.spent)} <span class="dim">/ ${money(b.limit)}</span></span></div>
              <div class="bar ${pct >= 100 ? 'over' : pct >= 75 ? 'hot' : ''}"><span style="width:${pct}%"></span></div>
              <div class="row between xs dim"><span>${Math.round(pct)}% used</span><span>${money(Math.max(0, b.limit - b.spent))} left</span></div></div>`;
          })
          .join('')
      : empty('activity', 'No budgets', 'Add a clause like “Keep cloud spend under $300 per month”.');
    $('#feed').innerHTML = requests.length
      ? requests
          .slice(0, 6)
          .map((r) => `<div class="feed-item" data-open="${esc(r.id)}">${mAvatar(r.request.merchant)}<div style="min-width:0"><div class="t">${esc(r.request.merchant)} · ${money(r.request.amount, r.request.currency)}</div><div class="s">${esc(r.agent || 'Agent')} · ${ago(r.createdAt)}</div></div>${statusBadge(r.status)}</div>`)
          .join('')
      : empty('inbox', 'Quiet so far', 'Agent requests will stream in here.');
    $('#posture').innerHTML = posture();
    renderSim();
  },
};

function posture() {
  const d = state.data;
  const s = d.security || {};
  const set = d.settings || {};
  const activeAgents = (d.agents || []).filter((a) => a.status === 'active').length;
  const items = [
    [!set.killSwitch, set.killSwitch ? 'Kill switch engaged: spending frozen' : 'Kill switch armed, spending live'],
    [!!set.redactPII, set.redactPII ? 'PII redacted before AI' : 'PII redaction is off'],
    [true, `Audit log hash-chained · ${s.auditCount ?? 0} events`],
    [!!s.encryptionAtRest, s.encryptionAtRest ? 'Data encrypted at rest (AES-256-GCM)' : 'Encryption at rest off: set CHARTER_DATA_KEY'],
    [true, `${activeAgents} agent key${activeAgents === 1 ? '' : 's'} active · stored as SHA-256 hashes`],
    [s.cspMode !== 'report-only', `Content-Security-Policy ${s.cspMode === 'report-only' ? 'report-only' : 'enforced'}`],
    [!!s.webhookConfigured, s.webhookConfigured ? 'PayPal webhooks signature-verified' : 'PayPal webhooks not configured'],
  ];
  return items.map(([ok, t]) => `<div>${ok ? `<span class="ok-ic">${icon('shieldcheck', 'sm')}</span>` : `<span class="warn-ic">${icon('alert', 'sm')}</span>`}<span class="grow">${esc(t)}</span></div>`).join('');
}

function renderSim() {
  const el = $('#sim');
  if (!el) return;
  if (!state.sim) {
    el.innerHTML = `<div style="grid-column:1/-1">${empty('flask', 'Test your policy before agents do', 'Runs printer ink, a SaaS renewal, a GPU burst, urgent gift cards, a prompt-injection attempt and a blocked vendor through your current rules.')}</div>`;
    return;
  }
  el.innerHTML = state.sim
    .map((r, i) => `<div class="sim-card" style="animation-delay:${i * 50}ms"><div class="row between"><span class="t">${esc(r.label)}</span>${verdictBadge(r.verdict)}</div>
      <div class="muted sm">${esc(r.merchant)} · ${money(r.amount)} · ${esc(label(r.category))}</div>
      <div class="mono dim">${r.fired.length ? `fired ${r.fired.map(esc).join(', ')}` : 'no rules fired'}</div></div>`)
    .join('');
}

// ------------------------------------------------------------------ REQUESTS
ROUTES.requests = {
  title: 'Requests',
  sub: 'Every purchase an agent attempts, with a full decision trail.',
  mount: () => `
    <div class="grid g-split">
      <div class="stack">
        <section class="card">
          <div class="card-h"><div><h3>Simulate an agent</h3><p>Send a purchase request exactly as an AI agent would.</p></div><span class="badge brand">${icon('sparkles')}${state.config.ai.enabled ? 'Claude' : 'Heuristic'}</span></div>
          <div class="stack">
            <div class="field"><label class="label" for="agent-sel">Agent</label><select class="select" id="agent-sel"></select></div>
            <div class="field"><label class="label" for="intent">Purchase request</label>
              <textarea class="textarea" id="intent" maxlength="2000" placeholder="e.g. Buy 3 HP 67XL ink cartridges from InkDepot at $28 each, $84 total."></textarea>
              <span class="hint row" style="gap:6px;align-items:flex-start">${icon('eyeoff', 'sm')}<span>Emails, phone and card numbers and secrets are redacted before the AI sees them. <kbd>Ctrl</kbd>+<kbd>Enter</kbd> to send.</span></span></div>
            <div><div class="label" style="margin-bottom:8px">Scenarios</div><div class="chips">${state.config.scenarios.map((s) => `<button class="chip" data-action="scenario" data-key="${esc(s.key)}">${esc(s.label)}</button>`).join('')}</div></div>
            <div class="err" id="intent-err" role="alert"></div>
            <div class="row end"><button class="btn primary" data-action="submit-intent" id="submit-intent">Review request ${icon('arrow')}</button></div>
          </div>
        </section>
        <section class="card flush">
          <div class="card-h card-pad" style="margin:0;padding-bottom:12px;flex-wrap:wrap"><div><h3>Queue</h3><p>Newest first</p></div>
            <div class="seg" id="q-filter"><button data-q="all">All</button><button data-q="needs_approval">Needs approval</button><button data-q="ready_to_pay">Ready to pay</button></div></div>
          <div id="queue" style="padding:0 14px 10px"></div>
        </section>
      </div>
      <section class="card" id="detail"></section>
    </div>`,
  update({ first, background, before } = {}) {
    const sel = $('#agent-sel');
    const agents = (state.data.agents || []).filter((a) => a.status !== 'revoked');
    const prev = sel.value;
    const opts = agents.map((a) => `<option value="${esc(a.id)}">${esc(a.name)}${a.status === 'paused' ? ' (paused)' : ''}</option>`).join('');
    if (sel.dataset.opts !== opts) {
      sel.innerHTML = opts;
      sel.dataset.opts = opts;
      if (prev && agents.some((a) => a.id === prev)) sel.value = prev;
    }
    $$('#q-filter button').forEach((b) => b.classList.toggle('on', b.dataset.q === state.qFilter));
    const list = state.data.requests.filter((r) => state.qFilter === 'all' || r.status === state.qFilter || (state.qFilter === 'ready_to_pay' && r.status === 'awaiting_payer'));
    $('#queue').innerHTML = list.length
      ? list
          .slice(0, 12)
          .map((r) => `<div class="feed-item" data-open="${esc(r.id)}" style="${r.id === state.current ? 'background:rgba(124,108,255,.09)' : ''}">${mAvatar(r.request.merchant)}<div style="min-width:0"><div class="t">${esc(r.request.merchant)} · ${money(r.request.amount, r.request.currency)}</div><div class="s">${esc(r.agent || 'Agent')} · ${ago(r.createdAt)}</div></div>${statusBadge(r.status)}</div>`)
          .join('')
      : `<div style="padding:10px 6px 16px" class="dim sm">No requests in this view yet.</div>`;
    const changed = !background || sig(state.current) !== before;
    if (first || (changed && !state.paying)) renderDetail();
  },
};

function pipeline(r) {
  const v = r.decision.verdict;
  const s = r.status;
  const red = (r.privacy?.redactions || []).reduce((a, x) => a + x.count, 0);
  const paid = ['paid', 'refunded'].includes(s);
  const steps = [
    ['inbox', 'Received', 'done'],
    ['eyeoff', red ? `${red} redacted` : 'Privacy', 'done'],
    ['sparkles', r.parseEngine === 'structured' ? 'Structured' : r.parseEngine === 'heuristic' ? 'Parsed' : 'AI parsed', 'done'],
    ['file', 'Policy', v === 'block' ? 'stop' : 'done'],
    ['user', v === 'allow' ? 'Auto-OK' : 'Owner', v === 'block' ? '' : v === 'allow' ? 'done' : s === 'needs_approval' ? 'wait' : s === 'declined' ? 'stop' : 'done'],
    ['card', 'PayPal', paid ? 'done' : ['ready_to_pay', 'awaiting_payer'].includes(s) ? 'wait' : s === 'payment_failed' ? 'stop' : ''],
    ['shieldcheck', s === 'refunded' ? 'Refunded' : 'Verified', paid ? 'done' : s === 'payment_unverified' ? 'stop' : ''],
  ];
  return `<div class="pipeline">${steps.map(([ic, t, st]) => `<div class="step ${st}"><span class="n">${icon(st === 'stop' ? 'x' : st === 'done' ? 'check' : ic)}</span>${esc(t)}</div>`).join('')}</div>`;
}

function renderDetail() {
  const box = $('#detail');
  if (!box) return;
  const r = state.data.requests.find((x) => x.id === state.current);
  if (!r) {
    box.innerHTML = empty('receipt', 'Select or send a request', 'Pick a scenario on the left, or open any request from the queue to see the verdict, every rule checked, and PayPal checkout once it’s cleared.');
    return;
  }
  const d = r.decision;
  const q = r.request;
  const V = VERDICT[d.verdict];
  const reds = r.privacy?.redactions || [];
  const checks = [...(d.trace || []), ...(d.checks || []).map((c) => ({ ...c, ruleId: c.id, source: null }))];
  box.innerHTML = `
    <div class="decision-h">
      <div><div class="dim sm">${esc(r.agent || 'Agent')} · ${ago(r.createdAt)} · policy v${esc(r.charterVersion)}</div>
        <div class="amt" style="margin-top:6px">${money(q.amount, q.currency)}</div>
        <div class="row" style="margin-top:8px">${mAvatar(q.merchant)}<div><div style="font-weight:600">${esc(q.merchant)}</div><div class="dim sm">${esc(cap(q.category))}${q.recurring ? ' · recurring' : ''}</div></div></div></div>
      <div class="verdict-big ${d.verdict}">${icon(V.icon)}<div>${V.text}<small>${V.sub}</small></div></div>
    </div>
    ${pipeline(r)}
    ${q.justification && !r.textPurged ? `<div class="sec-label">Agent’s reason</div><div class="quote">${esc(q.justification)}</div>` : ''}
    ${reds.length ? `<div class="sec-label">${icon('eyeoff', 'sm')} Privacy filter</div><div class="row wrap">${reds.map((x) => `<span class="badge info">${esc(x.type)} ×${x.count}</span>`).join('')}<span class="dim sm">redacted before AI · raw text never stored</span></div>` : ''}
    ${q.items?.length ? `<div class="sec-label">Line items</div><table class="items">${q.items.map((i) => `<tr><td>${esc(i.quantity)} × ${esc(i.name)}</td><td>${money(i.unit_price * i.quantity, q.currency)}</td></tr>`).join('')}</table>` : ''}
    <div class="sec-label">Decision trace <span class="dim" style="text-transform:none;letter-spacing:0;font-weight:500">· ${checks.filter((c) => c.outcome === 'block' || c.outcome === 'escalate').length} triggered of ${checks.length} checks</span></div>
    <div class="trace">${checks
      .map((t, i) => `<div class="tr ${t.outcome === 'block' ? 'hit-block' : t.outcome === 'escalate' ? 'hit-escalate' : ''}" style="animation-delay:${i * 25}ms">
        <span>${t.outcome === 'pass' ? '<span class="badge neutral">Pass</span>' : t.outcome === 'skip' ? '<span class="badge neutral" style="opacity:.6">N/A</span>' : verdictBadge(t.outcome)}</span>
        <div><div class="d"><span class="rid">${esc(t.ruleId)}</span>${esc(t.detail)}</div>${t.source ? `<div class="src">“${esc(t.source)}”</div>` : ''}</div></div>`)
      .join('')}</div>
    <div id="action">${actionBox(r)}</div>
    <div class="meta"><span>${icon('receipt', 'sm')}<span class="mono">${esc(r.id)}</span></span><span>${icon('sparkles', 'sm')}${r.parseEngine === 'heuristic' ? 'Heuristic parser' : esc(r.parseEngine)}${r.aiError ? ' (AI unavailable)' : ''}</span><span>${icon('lock', 'sm')}Deterministic verdict</span></div>`;
  if (['ready_to_pay', 'awaiting_payer'].includes(r.status) && !state.data.settings?.killSwitch) mountPayPal(r);
}

function actionBox(r) {
  const p = r.paypal || {};
  const kill = state.data.settings?.killSwitch;
  switch (r.status) {
    case 'blocked':
      return `<div class="action-box"><h4>${icon('shield')}No payment can be created</h4><p>This request broke the policy. Charter’s server refuses to create a PayPal order for blocked requests, even when its API is called directly.</p></div>`;
    case 'needs_approval':
      return `<div class="action-box"><h4>${icon('user')}Your decision</h4><p>The agent paused here. Approving creates a one-off exception for this request only. Your policy doesn’t change.</p>
        <div class="row wrap"><button class="btn ok" data-action="decide" data-v="approve">${icon('check')}Approve exception</button><button class="btn danger" data-action="decide" data-v="decline">${icon('x')}Decline</button></div></div>`;
    case 'declined':
      return `<div class="action-box"><h4>${icon('x')}Declined by you</h4><p>${ago(r.approval?.at)}. No money moved.</p></div>`;
    case 'ready_to_pay':
    case 'awaiting_payer':
      if (kill) return `<div class="action-box"><h4>${icon('zap')}Payments frozen</h4><p>The kill switch is on. Release it to continue to checkout.</p></div>`;
      if (!state.config.paypal.configured)
        return `<div class="action-box"><h4>${icon('card')}${r.approval ? 'Approved' : 'Cleared by policy'}. Connect PayPal to pay.</h4><p>Add sandbox <span class="mono">PAYPAL_CLIENT_ID</span> and <span class="mono">PAYPAL_CLIENT_SECRET</span> to <span class="mono">.env</span> and restart. Charter never simulates a payment.</p></div>`;
      return `<div class="action-box"><h4>${icon('card')}${r.approval ? 'Approved by you. Ready for checkout.' : 'Cleared by policy. Ready for checkout.'}</h4>
        <p>Pay ${money(r.request.amount, r.request.currency)} with a PayPal sandbox buyer account. The order is created server-side for this exact amount, then captured and verified with PayPal.</p>
        <div class="paypal-slot" id="paypal-slot"><div class="loading">Loading PayPal checkout…</div></div>${p.status === 'PAYER_CANCELLED' ? '<p class="dim sm">Previous checkout was cancelled. Nothing was charged.</p>' : ''}</div>`;
    case 'paid':
      return `<div class="action-box"><h4 style="color:var(--ok)">${icon('shieldcheck')}Paid via PayPal and verified server-side</h4>
        <dl class="kv"><dt>Order</dt><dd>${esc(p.orderId)}</dd><dt>Capture</dt><dd>${esc(p.captureId)}</dd><dt>Capture status</dt><dd>${esc(p.captureStatus)}</dd>${p.payer ? `<dt>Payer</dt><dd>${esc(p.payer)}</dd>` : ''}<dt>Verified</dt><dd>${esc(p.verifiedAt ? new Date(p.verifiedAt).toLocaleString() : '—')}</dd></dl>
        <div class="row wrap"><button class="btn sm danger" data-action="refund">${icon('undo', 'sm')}Refund via PayPal</button><span class="dim sm">Refunds restore the budget automatically.</span></div></div>`;
    case 'refunded':
      return `<div class="action-box"><h4>${icon('undo')}Refunded through PayPal</h4><dl class="kv"><dt>Capture</dt><dd>${esc(p.captureId)}</dd><dt>Refund</dt><dd>${esc(r.refund?.id || '—')}</dd><dt>Status</dt><dd>${esc(r.refund?.status || '—')}</dd></dl></div>`;
    case 'payment_unverified':
      return `<div class="action-box"><h4 style="color:var(--bad)">${icon('alert')}Payment could not be verified</h4><p>${esc(p.verification)}. It does not count toward budgets.</p></div>`;
    case 'payment_failed':
      return `<div class="action-box"><h4 style="color:var(--bad)">${icon('alert')}Payment failed</h4><p>${esc(p.error || 'PayPal reported a failure.')}${p.debugId ? ` (PayPal debug ID ${esc(p.debugId)})` : ''}</p></div>`;
    default:
      return '';
  }
}

function loadPayPal(currency) {
  const key = `${state.config.paypal.clientId}:${currency}`;
  if (state.paypalKey === key && window.paypal) return Promise.resolve();
  $$('script[data-paypal]').forEach((s) => s.remove());
  delete window.paypal;
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(state.config.paypal.clientId)}&currency=${encodeURIComponent(currency)}&intent=capture&components=buttons`;
    s.dataset.paypal = '1';
    const nonce = document.querySelector('meta[name="csp-nonce"]')?.content;
    if (nonce && !nonce.startsWith('__')) s.setAttribute('data-csp-nonce', nonce);
    s.onload = () => {
      state.paypalKey = key;
      resolve();
    };
    s.onerror = () => reject(new Error('Could not load PayPal checkout. Check your connection or allow paypal.com in content blockers.'));
    document.head.appendChild(s);
  });
}

async function mountPayPal(r) {
  const slot = $('#paypal-slot');
  if (!slot) return;
  try {
    await loadPayPal(r.request.currency);
    if (!document.body.contains(slot) || state.current !== r.id) return;
    slot.innerHTML = '';
    await window.paypal
      .Buttons({
        style: { layout: 'vertical', shape: 'rect', label: 'pay', height: 44 },
        createOrder: async () => {
          state.paying = true;
          try {
            return (await api(`/api/requests/${r.id}/paypal/order`, { body: {} })).orderId;
          } catch (e) {
            state.paying = false;
            toast(e.message, 'bad');
            refresh();
            throw e;
          }
        },
        onApprove: async (data, actions) => {
          try {
            const out = await api(`/api/requests/${r.id}/paypal/capture`, { body: { orderId: data.orderID } });
            state.paying = false;
            toast(out.verified === false ? 'Captured, but PayPal verification failed.' : 'Payment captured and verified with PayPal.', out.verified === false ? 'bad' : 'ok');
          } catch (e) {
            if (Array.isArray(e.details) && e.details.some((x) => x.issue === 'INSTRUMENT_DECLINED')) {
              toast('That funding source was declined. Choose another one.', 'bad');
              return actions.restart();
            }
            state.paying = false;
            toast(e.message, 'bad');
          }
          await refresh();
        },
        onCancel: async () => {
          state.paying = false;
          await api(`/api/requests/${r.id}/paypal/cancel`, { body: {} }).catch(() => {});
          toast('Checkout cancelled. Nothing was charged.', 'ok');
          refresh();
        },
        onError: (err) => {
          state.paying = false;
          console.error('[paypal]', err);
          toast('PayPal reported an error. No payment was captured.', 'bad');
        },
      })
      .render(slot);
  } catch (e) {
    slot.innerHTML = `<div class="loading" style="color:#b91c1c">${esc(e.message)}</div>`;
  }
}

// ------------------------------------------------------------------ POLICY
ROUTES.policy = {
  title: 'Policy',
  sub: 'Your spending rules in plain English, compiled into enforceable policy.',
  mount: () => `
    <div class="grid g-split">
      <section class="card">
        <div class="card-h"><div><h3>Charter</h3><p>Write it the way you’d brief a new hire.</p></div><span class="badge" id="pol-engine"></span></div>
        <div class="editor"><div class="gutter" id="gutter"></div><textarea id="charter-text" spellcheck="false" wrap="off" maxlength="4000" aria-label="Charter text" style="white-space:pre;overflow-x:auto"></textarea></div>
        <div class="label" style="margin:16px 0 8px">Add a clause</div>
        <div class="chips">${state.config.clauseSuggestions.map((c) => `<button class="chip" data-action="clause" data-clause="${esc(c)}">${icon('plus', 'sm')}${esc(c)}</button>`).join('')}</div>
        <div class="err" id="charter-err" role="alert" style="margin-top:14px"></div>
        <div class="row between wrap" style="margin-top:16px"><span class="hint" id="charter-count"></span>
          <div class="row"><button class="btn ghost" data-action="charter-sample">Restore sample</button><button class="btn primary" data-action="compile" id="compile-btn">${icon('sparkles')}Compile policy</button></div></div>
      </section>
      <div class="stack">
        <section class="card"><div class="card-h"><div><h3>Enforceable rules</h3><p id="rules-sub"></p></div></div><div class="stack" id="rules" style="gap:10px"></div><div id="unmapped" style="margin-top:14px"></div></section>
        <section class="card"><div class="card-h"><div><h3>How a decision is made</h3><p>AI translates. Rules decide. PayPal settles.</p></div></div>
          <div class="timeline">
            <div class="tl"><span class="p"></span><div><b>Claude compiles your charter</b><div class="dim sm">Each rule must cite the clause it came from. Anything that can’t be enforced is flagged, never silently ignored.</div></div></div>
            <div class="tl"><span class="p"></span><div><b>A deterministic engine evaluates every request</b><div class="dim sm">Same request + same policy + same ledger = same verdict. AI risk signals can only escalate to you, never approve.</div></div></div>
            <div class="tl"><span class="p"></span><div><b>Policy is re-checked at payment time</b><div class="dim sm">Budgets used up between approval and checkout still stop the payment.</div></div></div>
          </div>
          <div class="sec-label" style="margin-top:6px">Version history</div><div id="versions" class="stack" style="gap:8px"></div></section>
      </div>
    </div>`,
  update({ first } = {}) {
    const { charter, charterHistory } = state.data;
    const ta = $('#charter-text');
    if (first || !ta.dataset.dirty) {
      ta.value = charter.text;
      delete ta.dataset.dirty;
    }
    syncGutter();
    const eng = charter.engine === 'heuristic' ? 'Heuristic compiler' : charter.engine;
    $('#pol-engine').className = `badge ${charter.engine === 'heuristic' ? 'warn' : 'brand'}`;
    $('#pol-engine').innerHTML = `${icon('sparkles')}v${esc(charter.version)} · ${esc(eng)}`;
    const rules = charter.policy.rules;
    $('#rules-sub').textContent = `${rules.length} rule${rules.length === 1 ? '' : 's'} · compiled ${ago(charter.compiledAt)}`;
    $('#rules').innerHTML = rules
      .map((r, i) => {
        const [ic, t] = RULE_META[r.type] || ['file', label(r.type)];
        return `<div class="rule" style="animation-delay:${i * 35}ms"><span class="ic">${icon(ic)}</span><div><div class="ttl">${esc(r.explanation || t)}</div><div class="row wrap" style="gap:6px;margin-top:6px"><span class="tag">${esc(r.id)}</span><span class="badge neutral">${esc(t)}</span>${r.category && r.category !== 'any' && r.type !== 'block_category' ? `<span class="badge neutral">${esc(label(r.category))}</span>` : ''}</div>${r.source_quote ? `<div class="src">“${esc(r.source_quote)}”</div>` : ''}</div>${verdictBadge(r.action === 'escalate' ? 'escalate' : 'block')}</div>`;
      })
      .join('');
    const un = charter.policy.unmapped || [];
    $('#unmapped').innerHTML = un.length
      ? `<div class="note"><b class="row" style="gap:6px">${icon('alert', 'sm')} ${un.length} clause${un.length === 1 ? '' : 's'} not enforced</b><span class="sm">These can’t be expressed as a checkable rule, so Charter won’t pretend to enforce them:</span><ul>${un.map((u) => `<li>“${esc(u.quote)}”: ${esc(u.reason)}</li>`).join('')}</ul></div>`
      : '';
    $('#versions').innerHTML = [...(charterHistory || [])]
      .reverse()
      .slice(0, 6)
      .map((h) => `<div class="row between sm"><span class="row" style="gap:8px"><span class="tag">v${esc(h.version)}</span><span class="muted">${esc(h.rules)} rules · ${esc(h.engine === 'heuristic' ? 'heuristic' : h.engine)}</span></span><span class="dim">${ago(h.compiledAt)}</span></div>`)
      .join('');
  },
};

function syncGutter() {
  const ta = $('#charter-text');
  const g = $('#gutter');
  if (!ta || !g) return;
  const n = ta.value.split('\n').length;
  g.innerHTML = Array.from({ length: Math.max(n, 14) }, (_, i) => `<div>${i + 1}</div>`).join('');
  g.scrollTop = ta.scrollTop;
  $('#charter-count').textContent = `${ta.value.length.toLocaleString()} / 4,000 characters`;
}

// ------------------------------------------------------------------ AGENTS
ROUTES.agents = {
  title: 'Agents',
  sub: 'Identities, API keys and per-agent limits for every AI agent that can spend.',
  mount: () => `
    <div class="row between wrap"><div class="muted sm">Agents authenticate with a bearer key. Charter stores only its SHA-256 hash, so each key is shown exactly once.</div>
      <button class="btn primary" data-action="new-agent">${icon('plus')}New agent</button></div>
    <div class="grid g-3" id="agent-list"></div>
    <section class="card"><div class="card-h"><div><h3>Connect an agent</h3><p>Any agent framework can ask Charter before it spends. Responses are data-minimised: agents get the verdict and reasons, never your full policy.</p></div></div>
      <div class="code" id="agent-code"><button class="btn sm copy" data-action="copy-code">${icon('copy', 'sm')}Copy</button><span id="agent-snippet">curl -X POST ${esc(location.origin)}/api/v1/purchase-requests \\
  -H "Authorization: Bearer chr_sk_your_agent_key" \\
  -H "Idempotency-Key: order-42" \\
  -H "Content-Type: application/json" \\
  -d '{"text":"Renew the Figma Professional plan from Figma for $180"}'

# 201 {"id":"…","verdict":"escalate","status":"needs_approval","reasons":["$180.00 exceeds the $150.00 limit."]}
# Poll  GET /api/v1/purchase-requests/{id}   ->  {"status":"paid","paid":true}</span></div>
      <div class="grid g-3" style="margin-top:16px">
        <div class="row" style="align-items:flex-start">${icon('key')}<div class="sm"><b>Scoped keys</b><div class="dim">Pause, rotate or revoke any agent instantly.</div></div></div>
        <div class="row" style="align-items:flex-start">${icon('rotate')}<div class="sm"><b>Idempotent</b><div class="dim">Retries with the same Idempotency-Key never create duplicates.</div></div></div>
        <div class="row" style="align-items:flex-start">${icon('wallet')}<div class="sm"><b>Per-agent limits</b><div class="dim">Daily caps on top of your global policy.</div></div></div>
      </div></section>`,
  update() {
    const agents = state.data.agents || [];
    $('#agent-list').innerHTML = agents.length
      ? agents
          .map((a) => `<section class="card agent-card" style="${a.status === 'revoked' ? 'opacity:.55' : ''}">
          <div class="agent-top"><span class="agent-ic">${icon('bot')}</span><div class="grow" style="min-width:0"><div style="font-weight:600">${esc(a.name)}</div><div class="dim xs">Created ${ago(a.createdAt)} · last used ${a.lastUsedAt ? ago(a.lastUsedAt) : 'never'}</div></div>
            <span class="badge ${a.status === 'active' ? 'ok' : a.status === 'paused' ? 'warn' : 'neutral'}">${esc(cap(a.status))}</span></div>
          <div class="keybox">${icon('key', 'sm')}<span class="grow">${a.status === 'revoked' ? 'Key destroyed' : `${esc(a.keyPrefix || 'chr_sk_')}••••••••${esc(a.last4 || '')}`}</span></div>
          <div class="agent-stats"><div><b>${esc(a.requestCount ?? 0)}</b><span>Requests</span></div><div><b>${money0(a.spend24h)}</b><span>Spend 24h</span></div><div><b>${a.dailyLimit ? money0(a.dailyLimit) : '—'}</b><span>Daily limit</span></div></div>
          ${a.status === 'revoked' ? '' : `<div class="row wrap">
            <button class="btn sm" data-action="agent-status" data-id="${esc(a.id)}" data-to="${a.status === 'active' ? 'paused' : 'active'}">${icon(a.status === 'active' ? 'pause' : 'play', 'sm')}${a.status === 'active' ? 'Pause' : 'Resume'}</button>
            <button class="btn sm" data-action="agent-rotate" data-id="${esc(a.id)}">${icon('rotate', 'sm')}Rotate key</button>
            <button class="btn sm danger" data-action="agent-revoke" data-id="${esc(a.id)}">${icon('trash', 'sm')}Revoke</button></div>`}
        </section>`)
          .join('')
      : `<div style="grid-column:1/-1">${empty('bot', 'No agents yet', 'Create an agent to issue it an API key and spending limits.')}</div>`;
  },
};

function showKey(agent, apiKey) {
  const snippet = `curl -X POST ${location.origin}/api/v1/purchase-requests \\\n  -H "Authorization: Bearer ${apiKey}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"text":"Buy 3 ink cartridges from InkDepot at $28 each, $84 total"}'`;
  const m = modal({
    title: `API key for ${agent.name}`,
    wide: true,
    body: `<div class="secret"><span class="grow">${esc(apiKey)}</span><button class="btn sm" data-copy-key>${icon('copy', 'sm')}Copy</button></div>
      <div class="note"><b class="row" style="gap:6px">${icon('alert', 'sm')} This is the only time this key is shown.</b><span class="sm">Charter stores just its SHA-256 hash. Keep it in your agent’s secret manager. If it’s lost, rotate it.</span></div>
      <div class="code">${esc(snippet)}</div>`,
    actions: [{ label: 'I’ve stored it', kind: 'primary' }],
  });
  $('[data-copy-key]', m.el).addEventListener('click', () => copy(apiKey, 'API key copied'));
}

// ------------------------------------------------------------------ PAYMENTS
ROUTES.payments = {
  title: 'Payments',
  sub: 'The complete ledger: every request, verdict and PayPal transaction.',
  mount: () => `
    <div class="grid g-4" id="pay-kpis"></div>
    <section class="card flush">
      <div class="card-h card-pad" style="margin:0;padding-bottom:14px;flex-wrap:wrap">
        <div class="seg" id="p-filter"><button data-p="all">All</button><button data-p="paid">Paid</button><button data-p="needs_approval">Needs approval</button><button data-p="blocked">Blocked</button><button data-p="refunded">Refunded</button></div>
        <button class="btn sm" data-action="csv">${icon('download', 'sm')}Export CSV</button>
      </div>
      <div class="table-wrap" id="ledger"></div>
    </section>`,
  update() {
    const { stats, requests } = state.data;
    $('#pay-kpis').innerHTML = [
      ['wallet', 'Verified spend · 30d', money(stats.verifiedSpend30d), 'violet'],
      ['receipt', 'PayPal captures', stats.paidCount, 'ok'],
      ['undo', 'Refunded', money(stats.refundedTotal || 0), ''],
      ['ban', 'Blocked before payment', money(stats.heldBack), 'bad'],
    ]
      .map(([ic, k, v, c]) => `<div class="card kpi ${c}"><div class="k"><span class="ic">${icon(ic, 'sm')}</span>${k}</div><div class="v">${esc(v)}</div></div>`)
      .join('');
    $$('#p-filter button').forEach((b) => b.classList.toggle('on', b.dataset.p === state.pFilter));
    const rows = requests.filter((r) => state.pFilter === 'all' || r.status === state.pFilter);
    $('#ledger').innerHTML = rows.length
      ? `<table class="t"><thead><tr><th>Date</th><th>Merchant</th><th>Agent</th><th>Category</th><th class="r">Amount</th><th>Verdict</th><th>Status</th><th>PayPal reference</th></tr></thead><tbody>
        ${rows
          .map((r) => `<tr data-open="${esc(r.id)}"><td class="dim">${new Date(r.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</td>
          <td><div class="cell-m">${mAvatar(r.request.merchant)}<b>${esc(r.request.merchant)}</b></div></td><td class="muted">${esc(r.agent || '—')}</td><td class="muted">${esc(cap(r.request.category))}</td>
          <td class="r num"><b>${money(r.request.amount, r.request.currency)}</b></td><td>${verdictBadge(r.decision.verdict)}</td><td>${statusBadge(r.status)}</td><td class="mono dim">${esc(r.paypal?.captureId || r.paypal?.orderId || '—')}</td></tr>`)
          .join('')}</tbody></table>`
      : empty('receipt', 'No transactions in this view', 'Requests, approvals and PayPal captures will be recorded here.');
  },
};

function exportCsv() {
  const cols = ['id', 'createdAt', 'agent', 'merchant', 'category', 'amount', 'currency', 'verdict', 'status', 'paypalOrderId', 'paypalCaptureId'];
  const cell = (v) => {
    let s = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // neutralise spreadsheet formula injection
    return `"${s.replace(/"/g, '""')}"`;
  };
  const lines = [cols.join(',')].concat(
    state.data.requests.map((r) => [r.id, r.createdAt, r.agent, r.request.merchant, r.request.category, r.request.amount, r.request.currency, r.decision.verdict, r.status, r.paypal?.orderId, r.paypal?.captureId].map(cell).join(',')),
  );
  download(new Blob([lines.join('\n')], { type: 'text/csv' }), `charter-ledger-${new Date().toISOString().slice(0, 10)}.csv`);
  toast('Ledger exported as CSV.');
}
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 500);
}

// ------------------------------------------------------------------ SECURITY
ROUTES.security = {
  title: 'Security & privacy',
  sub: 'Controls, audit trail and data rights for agent spending.',
  mount: () => `
    <div class="grid g-2">
      <section class="card kill-card" id="kill-card">
        <div class="card-h"><div><h3>Kill switch</h3><p>Freeze every agent instantly. New requests are blocked and no PayPal order can be created until you release it.</p></div>
          <button class="switch danger" role="switch" aria-checked="false" aria-label="Kill switch" data-action="toggle-kill" id="kill-switch"></button></div>
        <div class="row" id="kill-state"></div>
      </section>
      <section class="card"><div class="card-h"><div><h3>Privacy controls</h3><p>Data minimisation by default.</p></div></div>
        <div class="setting"><div class="txt grow"><b>Redact personal data before AI</b><span>Emails, phone and card numbers, IBANs, SSNs and secrets become placeholders before Claude sees a request. Raw text is never stored.</span></div>
          <button class="switch" role="switch" aria-checked="true" aria-label="Redact personal data" data-action="toggle-redact" id="redact-switch"></button></div>
        <div class="setting"><div class="txt grow"><b>Data retention</b><span>Agent request text is purged after this window. Financial records are kept.</span></div>
          <select class="select" id="retention" style="width:130px" aria-label="Retention window"><option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option><option value="365">1 year</option></select></div>
        <div class="setting"><div class="txt grow"><b>Export your data</b><span>Download everything Charter holds about this workspace as JSON.</span></div><button class="btn sm" data-action="export">${icon('download', 'sm')}Export</button></div>
        <div class="setting"><div class="txt grow"><b>Delete activity data</b><span>Erase all requests and payment records. Keeps your policy and agents.</span></div><button class="btn sm danger" data-action="wipe">${icon('trash', 'sm')}Delete</button></div>
      </section>
    </div>
    <div class="grid g-main">
      <section class="card"><div class="card-h"><div><h3>Tamper-evident audit log</h3><p>Every sensitive action is SHA-256 chained to the one before it. Editing any past entry breaks the chain.</p></div>
        <button class="btn sm" data-action="verify-chain">${icon('link', 'sm')}Verify chain</button></div>
        <div class="chain" id="chain"><span class="spin"></span><span class="muted sm">Loading audit log…</span></div>
        <div class="audit" id="audit" style="margin-top:10px"></div></section>
      <div class="stack">
        <section class="card"><div class="card-h"><div><h3>Security posture</h3><p>Live configuration</p></div></div><div class="posture" id="sec-posture"></div></section>
        <section class="card"><div class="card-h"><div><h3>What the AI can see</h3><p>Least privilege for the model</p></div></div>
          <div class="posture">
            <div><span class="ok-ic">${icon('check', 'sm')}</span><span class="grow">Your charter text and redacted request text</span></div>
            <div><span class="warn-ic">${icon('x', 'sm')}</span><span class="grow">Never PayPal credentials, payer details or card data</span></div>
            <div><span class="warn-ic">${icon('x', 'sm')}</span><span class="grow">Never your ledger, budgets or agent keys</span></div>
            <div><span class="warn-ic">${icon('x', 'sm')}</span><span class="grow">Never the power to approve a payment</span></div>
          </div></section>
        <section class="card"><div class="card-h"><div><h3>Demo tools</h3><p>Reset requests, payments, policy and audit log before recording.</p></div></div>
          <button class="btn sm" data-action="reset">${icon('rotate', 'sm')}Reset demo data</button></section>
      </div>
    </div>`,
  update({ first } = {}) {
    const { settings, security } = state.data;
    $('#kill-switch').setAttribute('aria-checked', String(!!settings.killSwitch));
    $('#kill-card').classList.toggle('on', !!settings.killSwitch);
    $('#kill-state').innerHTML = settings.killSwitch ? `<span class="badge bad">${icon('zap')}Engaged</span><span class="muted sm">All agent spending is frozen.</span>` : `<span class="badge ok">${icon('check')}Armed</span><span class="muted sm">Agents can spend within policy.</span>`;
    $('#redact-switch').setAttribute('aria-checked', String(!!settings.redactPII));
    $('#retention').value = String(settings.retentionDays || 90);
    $('#sec-posture').innerHTML = posture();
    if (first || state.auditCount !== security?.auditCount) loadAudit();
  },
};

async function loadAudit() {
  try {
    const out = await api('/api/audit?limit=60');
    state.auditCount = out.count;
    const el = $('#audit');
    if (!el) return;
    if (!state.chain) {
      $('#chain').className = 'chain';
      $('#chain').innerHTML = `${icon('link')}<div class="grow"><b>${esc(out.count)} events</b><div class="dim xs mono">head ${esc(String(out.head || '').slice(0, 24))}…</div></div><span class="dim sm">Verify to recompute every hash.</span>`;
    }
    el.innerHTML = out.events?.length
      ? out.events
          .map((e) => `<div class="audit-row"><span class="mono dim">#${esc(e.seq)}</span><span class="dim sm when">${new Date(e.at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' })}</span>
          <div style="min-width:0"><div class="sm"><span class="tag">${esc(e.type)}</span> ${esc(e.summary)}</div><div class="h">${esc(e.actor)} · ${esc(String(e.hash).slice(0, 16))}…</div></div><span class="h">← ${esc(String(e.prevHash).slice(0, 8))}</span></div>`)
          .join('')
      : empty('link', 'No events yet', 'Sensitive actions will be recorded here.');
  } catch (e) {
    const c = $('#chain');
    if (c) c.innerHTML = `<span class="muted sm">${esc(e.message)}</span>`;
  }
}

// ------------------------------------------------------------------ actions
async function setSettings(patch, msg) {
  try {
    await api('/api/settings', { body: patch });
    await refresh();
    if (msg) toast(msg);
  } catch (e) {
    toast(e.message, 'bad');
  }
}

const confirmAction = (title, text, label, kind, run) =>
  modal({ title, body: `<p class="muted">${text}</p>`, actions: [{ label: 'Cancel' }, { label, kind, busy: 'Working…', onClick: run }] });

const ACTIONS = {
  scenario: (el) => {
    const s = state.config.scenarios.find((x) => x.key === el.dataset.key);
    $('#intent').value = s.text;
    $('#intent').focus();
  },
  'submit-intent': () => submitIntent(),
  decide: async (el) => {
    await busy(el, el.dataset.v === 'approve' ? 'Approving…' : 'Declining…', async () => {
      try {
        await api(`/api/requests/${state.current}/decision`, { body: { action: el.dataset.v } });
        await refresh();
        toast(el.dataset.v === 'approve' ? 'Exception approved. PayPal checkout unlocked.' : 'Request declined.');
      } catch (e) {
        toast(e.message, 'bad');
      }
    });
  },
  refund: () => {
    const r = state.data.requests.find((x) => x.id === state.current);
    confirmAction('Refund this payment?', `Charter will ask PayPal to refund the full ${money(r.request.amount, r.request.currency)} to the payer. It stops counting toward budgets.`, 'Refund via PayPal', 'danger', async (close) => {
      try {
        await api(`/api/requests/${r.id}/refund`, { body: {} });
        close();
        await refresh();
        toast('Refund issued through PayPal.');
      } catch (e) {
        toast(e.message, 'bad');
      }
    });
  },
  sim: async (el) => {
    await busy(el, 'Running…', async () => {
      try {
        state.sim = (await api('/api/simulate', { body: {} })).results;
        renderSim();
      } catch (e) {
        toast(e.message, 'bad');
      }
    });
  },
  clause: (el) => {
    const ta = $('#charter-text');
    ta.value = `${ta.value.trimEnd()}\n${el.dataset.clause}`;
    ta.dataset.dirty = '1';
    syncGutter();
    ta.focus();
  },
  'charter-sample': () => {
    const ta = $('#charter-text');
    ta.value = state.config.defaultCharter;
    ta.dataset.dirty = '1';
    syncGutter();
  },
  compile: async (el) => {
    const text = $('#charter-text').value.trim();
    $('#charter-err').textContent = '';
    if (text.length < 10) return ($('#charter-err').textContent = 'Write at least one rule, e.g. “No single purchase over $500.”');
    await busy(el, state.config.ai.enabled ? 'Claude is compiling…' : 'Compiling…', async () => {
      try {
        const { charter } = await api('/api/charter/compile', { body: { text } });
        delete $('#charter-text').dataset.dirty;
        await refresh();
        ROUTES.policy.update({ first: true });
        toast(`Policy v${charter.version} is live: ${charter.policy.rules.length} enforceable rules${charter.aiError ? ' (AI unavailable, heuristic used)' : ''}.`);
      } catch (e) {
        $('#charter-err').innerHTML = `${icon('alert', 'sm')}<span>${esc(e.message)}</span>`;
      }
    });
  },
  'new-agent': () => {
    modal({
      title: 'New agent',
      body: `<div class="field"><label class="label" for="na-name">Name</label><input class="input" id="na-name" maxlength="40" placeholder="e.g. Travel booker" /></div>
        <div class="field"><label class="label" for="na-limit">Daily spend limit (optional)</label><input class="input" id="na-limit" type="number" min="1" step="1" placeholder="e.g. 250" /><span class="hint">Applied on top of your policy, using this agent’s verified PayPal spend over the last 24 hours.</span></div>
        <div class="err" id="na-err"></div>`,
      actions: [
        { label: 'Cancel' },
        {
          label: 'Create agent & key',
          kind: 'primary',
          busy: 'Creating…',
          onClick: async (close, el) => {
            const name = $('#na-name', el).value.trim();
            const lim = $('#na-limit', el).value;
            if (name.length < 2) return ($('#na-err', el).textContent = 'Name must be at least 2 characters.');
            try {
              const out = await api('/api/agents', { body: { name, dailyLimit: lim ? Number(lim) : null } });
              close();
              await refresh();
              showKey(out.agent, out.apiKey);
            } catch (e) {
              $('#na-err', el).textContent = e.message;
            }
          },
        },
      ],
    });
  },
  'agent-status': async (el) => {
    await busy(el, '…', async () => {
      try {
        await api(`/api/agents/${el.dataset.id}/status`, { body: { status: el.dataset.to } });
        await refresh();
        toast(el.dataset.to === 'paused' ? 'Agent paused. Its requests will be blocked.' : 'Agent resumed.');
      } catch (e) {
        toast(e.message, 'bad');
      }
    });
  },
  'agent-rotate': (el) => {
    const a = state.data.agents.find((x) => x.id === el.dataset.id);
    confirmAction(`Rotate key for ${a.name}?`, 'The current key stops working immediately. You’ll see the new key once.', 'Rotate key', 'primary', async (close) => {
      try {
        const out = await api(`/api/agents/${a.id}/rotate`, { body: {} });
        close();
        await refresh();
        showKey(out.agent, out.apiKey);
      } catch (e) {
        toast(e.message, 'bad');
      }
    });
  },
  'agent-revoke': (el) => {
    const a = state.data.agents.find((x) => x.id === el.dataset.id);
    confirmAction(`Revoke ${a.name}?`, 'Its key is destroyed and every future request is rejected. This can’t be undone.', 'Revoke agent', 'danger', async (close) => {
      try {
        await api(`/api/agents/${a.id}/revoke`, { body: {} });
        close();
        await refresh();
        toast(`${a.name} revoked.`);
      } catch (e) {
        toast(e.message, 'bad');
      }
    });
  },
  'copy-code': () => copy($('#agent-snippet').textContent),
  csv: () => exportCsv(),
  'toggle-kill': () => toggleKill(),
  'kill-off': () => setSettings({ killSwitch: false }, 'Kill switch released. Agents can spend within policy.'),
  'toggle-redact': (el) => {
    const on = el.getAttribute('aria-checked') !== 'true';
    setSettings({ redactPII: on }, on ? 'PII redaction on.' : 'PII redaction off. Raw request text will reach the AI.');
  },
  export: async (el) => {
    await busy(el, 'Exporting…', async () => {
      try {
        const res = await fetch('/api/privacy/export', { credentials: 'same-origin' });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Export failed');
        download(await res.blob(), `charter-export-${new Date().toISOString().slice(0, 10)}.json`);
        toast('Export downloaded.');
        loadAudit();
      } catch (e) {
        toast(e.message, 'bad');
      }
    });
  },
  wipe: () => {
    modal({
      title: 'Delete all activity data?',
      body: `<p class="muted">This permanently erases every request and payment record from Charter. PayPal’s own records are not affected. Your policy, agents and settings are kept.</p>
        <div class="field"><label class="label" for="wipe-confirm">Type DELETE to confirm</label><input class="input" id="wipe-confirm" autocomplete="off" /></div><div class="err" id="wipe-err"></div>`,
      actions: [
        { label: 'Cancel' },
        {
          label: 'Delete permanently',
          kind: 'danger',
          busy: 'Deleting…',
          onClick: async (close, el) => {
            if ($('#wipe-confirm', el).value !== 'DELETE') return ($('#wipe-err', el).textContent = 'Type DELETE exactly to confirm.');
            try {
              await api('/api/privacy/wipe', { body: { confirm: 'DELETE' } });
              close();
              state.current = null;
              await refresh();
              toast('Activity data deleted.');
            } catch (e) {
              $('#wipe-err', el).textContent = e.message;
            }
          },
        },
      ],
    });
  },
  'verify-chain': async (el) => {
    await busy(el, 'Verifying…', async () => {
      try {
        const v = await api('/api/audit/verify', { body: {} });
        state.chain = v;
        $('#chain').className = `chain ${v.ok ? 'ok' : 'bad'}`;
        $('#chain').innerHTML = v.ok
          ? `${icon('shieldcheck')}<div class="grow"><b>Chain intact</b><div class="xs mono" style="opacity:.8">${esc(v.count)} events recomputed · head ${esc(String(v.head).slice(0, 24))}…</div></div>`
          : `${icon('alert')}<div class="grow"><b>Tampering detected at event #${esc(v.brokenAt)}</b><div class="xs">The audit log was modified outside Charter.</div></div>`;
        toast(v.ok ? `Audit chain verified: ${v.count} events intact.` : 'Audit chain verification FAILED.', v.ok ? 'ok' : 'bad');
      } catch (e) {
        toast(e.message, 'bad');
      }
    });
  },
  reset: () => {
    confirmAction('Reset demo data?', 'Clears requests, payments and the audit log, and restores the sample policy. Your passcode, agents and settings are kept.', 'Reset', 'primary', async (close) => {
      try {
        await api('/api/reset', { body: {} });
        close();
        state.current = null;
        state.sim = null;
        state.chain = null;
        await refresh();
        route();
        toast('Demo data reset.');
      } catch (e) {
        toast(e.message, 'bad');
      }
    });
  },
};

async function toggleKill() {
  const on = !state.data.settings.killSwitch;
  await setSettings({ killSwitch: on }, on ? 'Kill switch engaged. All agent spending is frozen.' : 'Kill switch released.');
}

async function submitIntent() {
  const btn = $('#submit-intent');
  const text = $('#intent').value.trim();
  $('#intent-err').textContent = '';
  if (text.length < 8) return ($('#intent-err').textContent = 'Describe the purchase: what, from whom, and how much.');
  await busy(btn, state.config.ai.enabled ? 'Claude is reading…' : 'Reviewing…', async () => {
    try {
      const { record } = await api('/api/requests', { body: { text, agentId: $('#agent-sel').value || undefined } });
      state.current = record.id;
      history.replaceState(null, '', `#requests/${record.id}`);
      await refresh();
      renderDetail();
      if (window.innerWidth < 1240) $('#detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      $('#intent-err').innerHTML = `${icon('alert', 'sm')}<span>${esc(e.message)}</span>`;
    }
  });
}

function bindGlobal() {
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-action]');
    if (a) {
      if (a.disabled) return;
      e.preventDefault();
      return ACTIONS[a.dataset.action]?.(a, e);
    }
    const o = e.target.closest('[data-open]');
    if (o) {
      state.current = o.dataset.open;
      if (state.route === 'requests') {
        history.replaceState(null, '', `#requests/${state.current}`);
        ROUTES.requests.update({ first: true });
        if (window.innerWidth < 1240) $('#detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else location.hash = `#requests/${state.current}`;
      return;
    }
    const h = e.target.closest('[data-href]');
    if (h) return (location.hash = h.dataset.href);
    const q = e.target.closest('[data-q]');
    if (q) {
      state.qFilter = q.dataset.q;
      return ROUTES.requests.update({ background: true, before: sig(state.current) });
    }
    const p = e.target.closest('[data-p]');
    if (p) {
      state.pFilter = p.dataset.p;
      ROUTES.payments.update();
    }
  });
  document.addEventListener('input', (e) => {
    if (e.target.id === 'charter-text') {
      e.target.dataset.dirty = '1';
      syncGutter();
    }
  });
  document.addEventListener(
    'scroll',
    (e) => {
      if (e.target.id === 'charter-text') $('#gutter').scrollTop = e.target.scrollTop;
    },
    true,
  );
  document.addEventListener('change', (e) => {
    if (e.target.id === 'retention') setSettings({ retentionDays: Number(e.target.value) }, `Request text will be purged after ${e.target.value} days.`);
  });
  document.addEventListener('keydown', (e) => {
    if (e.target.id === 'intent' && e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submitIntent();
  });
  $('#kill-quick').addEventListener('click', toggleKill);
  $('#menu').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
  $('#logout').addEventListener('click', async () => {
    try {
      await api('/api/auth/logout', { body: {} });
    } catch {
      /* already signed out */
    }
    state.csrf = null;
    state.data = null;
    state.raw = '';
    showAuth('login', 'You signed out.');
  });
}

// ------------------------------------------------------------------ boot
(async function boot() {
  hydrate();
  bindAuth();
  bindGlobal();
  try {
    state.config = await api('/api/config');
    const s = await api('/api/auth/status');
    if (s.setupRequired) return showAuth('setup');
    if (!s.authenticated) return showAuth('login');
    state.csrf = s.csrfToken;
    await enterApp();
  } catch (e) {
    $('#boot').innerHTML = `<div class="empty"><div class="ic">${icon('alert', 'lg')}</div><h4>Charter is unreachable</h4><p>${esc(e.message)}</p></div>`;
  }
})();
