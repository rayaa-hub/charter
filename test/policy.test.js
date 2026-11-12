import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, sanitizePolicy, spentInPeriod } from '../server/policy.js';
import { heuristicCompile, heuristicIntent } from '../server/ai.js';
import { verifyCapturedOrder } from '../server/paypal.js';
import { DEFAULT_CHARTER, SCENARIOS } from '../server/scenarios.js';

const policy = sanitizePolicy(heuristicCompile(DEFAULT_CHARTER));
const expected = { ink: 'allow', figma: 'escalate', gpu: 'block', giftcards: 'block', injection: 'escalate', pii: 'escalate', shady: 'block' };

test('default charter compiles to six enforceable rules plus one unmapped clause', () => {
  assert.equal(policy.rules.length, 6);
  assert.equal(policy.unmapped.length, 1);
});

for (const s of SCENARIOS) {
  test(`scenario "${s.key}" -> ${expected[s.key]}`, () => {
    assert.equal(evaluate(policy, s.request, []).verdict, expected[s.key]);
  });
}

test('budgets only count verified (COMPLETED) captures inside the window', () => {
  const now = Date.now();
  const ledger = [
    { status: 'COMPLETED', category: 'cloud_infrastructure', amount: 200, capturedAt: new Date(now - 86400000).toISOString() },
    { status: 'PENDING', category: 'cloud_infrastructure', amount: 999, capturedAt: new Date(now).toISOString() },
    { status: 'COMPLETED', category: 'cloud_infrastructure', amount: 999, capturedAt: new Date(now - 40 * 86400000).toISOString() },
  ];
  assert.equal(spentInPeriod(ledger, { category: 'cloud_infrastructure', period: 'month', now }), 200);
  const req = { merchant: 'AWS', amount: 120, currency: 'USD', category: 'cloud_infrastructure', items: [], risk_signals: [] };
  assert.equal(evaluate(policy, req, ledger).verdict, 'block'); // 200 + 120 > 300
  assert.equal(evaluate(policy, { ...req, amount: 90 }, ledger).verdict, 'allow');
});

test('AI advisory signals can escalate but never allow or block on their own', () => {
  const req = { merchant: 'InkDepot', amount: 20, currency: 'USD', category: 'office_supplies', items: [], risk_signals: ['odd'] };
  assert.equal(evaluate(policy, req, []).verdict, 'escalate');
});

test('line items that do not reconcile escalate', () => {
  const req = { merchant: 'InkDepot', amount: 84, currency: 'USD', category: 'office_supplies', items: [{ name: 'ink', quantity: 1, unit_price: 20 }], risk_signals: [] };
  assert.equal(evaluate(policy, req, []).verdict, 'escalate');
});

test('sanitizePolicy drops malformed rules', () => {
  const p = sanitizePolicy({ rules: [{ type: 'max_per_transaction', amount: -5 }, { type: 'nope' }, { type: 'block_merchant', merchants: [] }, { type: 'approval_above', amount: 10, action: 'block' }] });
  assert.equal(p.rules.length, 1);
  assert.equal(p.rules[0].action, 'escalate');
});

test('heuristic intent extraction prefers totals over unit prices', () => {
  const r = heuristicIntent('Buy 3 cartridges from InkDepot at $28 each, $84 total.');
  assert.equal(r.amount, 84);
  assert.equal(r.merchant, 'InkDepot');
});

test('PayPal verification rejects mismatched amount, foreign order, incomplete capture', () => {
  const request = { id: 'abc', amount: 84, currency: 'USD' };
  const good = { status: 'COMPLETED', purchase_units: [{ custom_id: 'abc', amount: { value: '84.00', currency_code: 'USD' }, payments: { captures: [{ id: 'C1', status: 'COMPLETED' }] } }] };
  assert.equal(verifyCapturedOrder(good, request).ok, true);
  const wrongAmt = structuredClone(good); wrongAmt.purchase_units[0].amount.value = '1.00';
  assert.equal(verifyCapturedOrder(wrongAmt, request).ok, false);
  const foreign = structuredClone(good); foreign.purchase_units[0].custom_id = 'zzz';
  assert.equal(verifyCapturedOrder(foreign, request).ok, false);
  const pending = structuredClone(good); pending.purchase_units[0].payments.captures[0].status = 'PENDING';
  assert.equal(verifyCapturedOrder(pending, request).ok, false);
});
