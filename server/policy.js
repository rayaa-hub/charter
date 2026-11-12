// Deterministic policy engine.
// The AI *compiles* plain-English charters into these rules, but it never decides
// a verdict at payment time: every verdict below is reproducible from the rules,
// the purchase request and the ledger alone.

export const CATEGORIES = [
  'software',
  'cloud_infrastructure',
  'advertising',
  'office_supplies',
  'electronics',
  'travel',
  'food',
  'subscriptions',
  'gift_cards',
  'crypto',
  'gambling',
  'other',
];

export const RULE_TYPES = [
  'max_per_transaction', // amount > X  -> action
  'budget_per_period', // spent(category, period) + amount > X -> action
  'block_category', // category in categories -> action
  'block_merchant', // merchant matches any in merchants -> action
  'allow_only_merchants', // merchant not in merchants -> action
  'approval_above', // amount > X -> escalate (sugar for max_per_transaction with escalate)
  'active_hours', // outside [start_hour, end_hour) local server time -> action
  'new_merchant_review', // merchant never paid before -> action
];

export const PERIOD_DAYS = { day: 1, week: 7, month: 30 };

const VERDICT_RANK = { allow: 0, escalate: 1, block: 2 };

export function normalizeMerchant(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\.(com|net|io|co|org|ai|app|store|shop)(\/.*)?$/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function merchantMatches(merchant, pattern) {
  const m = normalizeMerchant(merchant);
  const p = normalizeMerchant(pattern);
  if (!m || !p) return false;
  return m === p || m.includes(p) || p.includes(m);
}

const fmt = (n, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(n) || 0);

/** Sum of verified captured spend in the rolling window, optionally filtered by category. */
export function spentInPeriod(ledger, { category = null, period = 'month', now = Date.now() } = {}) {
  const days = PERIOD_DAYS[period] ?? 30;
  const since = now - days * 86400000;
  return ledger
    .filter((p) => p.status === 'COMPLETED' && new Date(p.capturedAt).getTime() >= since)
    .filter((p) => !category || category === 'any' || p.category === category)
    .reduce((sum, p) => sum + Number(p.amount), 0);
}

function appliesToCategory(rule, category) {
  return !rule.category || rule.category === 'any' || rule.category === category;
}

/**
 * Evaluate a purchase request against a compiled policy.
 * @returns {{verdict:'allow'|'escalate'|'block', trace:Array, checks:Array}}
 */
export function evaluate(policy, request, ledger = [], { now = new Date() } = {}) {
  const trace = [];
  const amount = Number(request.amount);
  const currency = request.currency || policy?.currency || 'USD';
  const rules = Array.isArray(policy?.rules) ? policy.rules : [];

  for (const rule of rules) {
    const entry = {
      ruleId: rule.id,
      type: rule.type,
      source: rule.source_quote,
      explanation: rule.explanation,
      outcome: 'pass',
      detail: '',
    };
    const action = rule.type === 'approval_above' ? 'escalate' : rule.action === 'escalate' ? 'escalate' : 'block';

    switch (rule.type) {
      case 'max_per_transaction':
      case 'approval_above': {
        if (!appliesToCategory(rule, request.category)) {
          entry.outcome = 'skip';
          entry.detail = `Only applies to ${rule.category}.`;
          break;
        }
        if (amount > Number(rule.amount)) {
          entry.outcome = action;
          entry.detail = `${fmt(amount, currency)} exceeds the ${fmt(rule.amount, currency)} limit.`;
        } else {
          entry.detail = `${fmt(amount, currency)} is within ${fmt(rule.amount, currency)}.`;
        }
        break;
      }
      case 'budget_per_period': {
        if (!appliesToCategory(rule, request.category)) {
          entry.outcome = 'skip';
          entry.detail = `Budget covers ${rule.category} only.`;
          break;
        }
        const spent = spentInPeriod(ledger, { category: rule.category, period: rule.period, now: now.getTime() });
        const after = spent + amount;
        entry.budget = { spent, limit: Number(rule.amount), after, period: rule.period, category: rule.category || 'any' };
        if (after > Number(rule.amount)) {
          entry.outcome = action;
          entry.detail = `Would bring ${rule.category && rule.category !== 'any' ? rule.category.replace(/_/g, ' ') : 'total'} spend this ${rule.period} to ${fmt(after, currency)} of ${fmt(rule.amount, currency)}.`;
        } else {
          entry.detail = `${fmt(after, currency)} of ${fmt(rule.amount, currency)} used this ${rule.period} after this purchase.`;
        }
        break;
      }
      case 'block_category': {
        const cats = rule.categories?.length ? rule.categories : rule.category ? [rule.category] : [];
        if (cats.includes(request.category)) {
          entry.outcome = action;
          entry.detail = `Category "${request.category.replace(/_/g, ' ')}" is restricted.`;
        } else {
          entry.detail = `Category "${request.category.replace(/_/g, ' ')}" is not restricted.`;
        }
        break;
      }
      case 'block_merchant': {
        const hit = (rule.merchants || []).find((m) => merchantMatches(request.merchant, m));
        if (hit) {
          entry.outcome = action;
          entry.detail = `Merchant matches restricted "${hit}".`;
        } else {
          entry.detail = 'Merchant is not on the restricted list.';
        }
        break;
      }
      case 'allow_only_merchants': {
        if (!appliesToCategory(rule, request.category)) {
          entry.outcome = 'skip';
          entry.detail = `Allow-list covers ${rule.category} only.`;
          break;
        }
        const hit = (rule.merchants || []).find((m) => merchantMatches(request.merchant, m));
        if (!hit) {
          entry.outcome = action;
          entry.detail = `"${request.merchant}" is not on the approved merchant list.`;
        } else {
          entry.detail = `Approved merchant "${hit}".`;
        }
        break;
      }
      case 'active_hours': {
        const h = now.getHours();
        const start = Number(rule.start_hour ?? 0);
        const end = Number(rule.end_hour ?? 24);
        const inside = start <= end ? h >= start && h < end : h >= start || h < end;
        if (!inside) {
          entry.outcome = action;
          entry.detail = `Requested at ${String(h).padStart(2, '0')}:00, outside ${start}:00–${end}:00.`;
        } else {
          entry.detail = `Within active hours ${start}:00–${end}:00.`;
        }
        break;
      }
      case 'new_merchant_review': {
        const seen = ledger.some((p) => p.status === 'COMPLETED' && merchantMatches(p.merchant, request.merchant));
        if (!seen) {
          entry.outcome = action;
          entry.detail = `First payment to "${request.merchant}".`;
        } else {
          entry.detail = 'Merchant has been paid before.';
        }
        break;
      }
      default:
        entry.outcome = 'skip';
        entry.detail = `Unknown rule type "${rule.type}" ignored.`;
    }
    trace.push(entry);
  }

  // Built-in integrity checks (not configurable, deterministic).
  const checks = [];
  if (Array.isArray(request.items) && request.items.length) {
    const sum = request.items.reduce((s, i) => s + Number(i.quantity || 1) * Number(i.unit_price || 0), 0);
    const ok = sum === 0 || Math.abs(sum - amount) <= Math.max(0.01, amount * 0.01);
    checks.push({
      id: 'integrity.line_items',
      label: 'Line items reconcile with total',
      outcome: ok ? 'pass' : 'escalate',
      detail: ok ? `Items sum to ${fmt(sum, currency)}.` : `Items sum to ${fmt(sum, currency)} but agent requested ${fmt(amount, currency)}.`,
    });
  }
  const signals = Array.isArray(request.risk_signals) ? request.risk_signals.filter(Boolean) : [];
  checks.push({
    id: 'advisory.ai_signals',
    label: 'AI advisory signals',
    outcome: signals.length ? 'escalate' : 'pass',
    detail: signals.length
      ? `AI flagged: ${signals.join('; ')}. Advisory signals can only escalate to a human, never auto-block.`
      : 'No advisory signals raised.',
  });

  let verdict = 'allow';
  for (const t of [...trace, ...checks]) {
    if (t.outcome in VERDICT_RANK && VERDICT_RANK[t.outcome] > VERDICT_RANK[verdict]) verdict = t.outcome;
  }
  return { verdict, trace, checks, evaluatedAt: now.toISOString() };
}

/** Validate & normalize a compiled policy (from AI or heuristic). Throws on unusable input. */
export function sanitizePolicy(raw) {
  if (!raw || !Array.isArray(raw.rules)) throw new Error('Compiled policy has no rules array.');
  const rules = [];
  raw.rules.forEach((r, i) => {
    if (!r || !RULE_TYPES.includes(r.type)) return;
    const rule = {
      id: `R${rules.length + 1}`,
      type: r.type,
      action: r.type === 'approval_above' ? 'escalate' : r.action === 'escalate' ? 'escalate' : 'block',
      amount: r.amount == null || r.amount === '' ? null : Math.max(0, Number(r.amount)),
      period: PERIOD_DAYS[r.period] ? r.period : 'month',
      category: CATEGORIES.includes(r.category) ? r.category : 'any',
      categories: Array.isArray(r.categories) ? r.categories.filter((c) => CATEGORIES.includes(c)) : [],
      merchants: Array.isArray(r.merchants) ? r.merchants.map((m) => String(m).slice(0, 80)).filter(Boolean).slice(0, 50) : [],
      start_hour: r.start_hour == null ? null : Math.min(24, Math.max(0, Math.round(Number(r.start_hour)))),
      end_hour: r.end_hour == null ? null : Math.min(24, Math.max(0, Math.round(Number(r.end_hour)))),
      source_quote: String(r.source_quote || '').slice(0, 400),
      explanation: String(r.explanation || '').slice(0, 400),
    };
    const needsAmount = ['max_per_transaction', 'budget_per_period', 'approval_above'].includes(rule.type);
    if (needsAmount && !(rule.amount > 0)) return;
    if (rule.type === 'block_category' && !rule.categories.length && rule.category === 'any') return;
    if (['block_merchant', 'allow_only_merchants'].includes(rule.type) && !rule.merchants.length) return;
    if (rule.type === 'active_hours' && (rule.start_hour == null || rule.end_hour == null)) return;
    rules.push(rule);
    void i;
  });
  return {
    currency: /^[A-Z]{3}$/.test(raw.currency || '') ? raw.currency : 'USD',
    rules,
    unmapped: Array.isArray(raw.unmapped_clauses)
      ? raw.unmapped_clauses.slice(0, 20).map((u) => ({ quote: String(u.quote || '').slice(0, 300), reason: String(u.reason || '').slice(0, 300) }))
      : [],
  };
}
