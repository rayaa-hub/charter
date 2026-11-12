import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { redact, luhnValid, ibanValid } from '../server/privacy.js';
import { appendAudit, verifyAudit } from '../server/audit.js';
import { hashPasscode, verifyPasscode } from '../server/auth.js';
import { encrypt, decrypt } from '../server/store.js';
import { createAgent, findAgentByKey, rotateAgentKey } from '../server/agents.js';

const types = (r) => Object.fromEntries(r.findings.map((f) => [f.type, f.count]));

test('redaction removes emails, phones, cards, SSNs, IBANs and secrets', () => {
  const r = redact(
    'Email jane.doe@example.com or call +1 415-555-0134. Card 4111 1111 1111 1111, SSN 123-45-6789, ' +
      'IBAN GB82 WEST 1234 5698 7654 32, key sk-ant-api03-abcdefghijklmnopqrstuv and AKIAIOSFODNN7EXAMPLE.',
  );
  assert.deepEqual(types(r), { SECRET: 2, EMAIL: 1, IBAN: 1, CARD: 1, SSN: 1, PHONE: 1 });
  for (const leaked of ['jane.doe', '415-555', '4111', '123-45-6789', 'GB82', 'sk-ant', 'AKIA']) assert.ok(!r.text.includes(leaked), `leaked ${leaked}: ${r.text}`);
  assert.match(r.text, /\[EMAIL_1\]/);
});

test('redaction leaves ordinary purchase text untouched', () => {
  const text = 'Buy 3 HP 67XL ink cartridges from InkDepot at $28 each, $84 total. Keep spend under $1,000 per month. Order 2026-11-12.';
  const r = redact(text);
  assert.equal(r.text, text);
  assert.deepEqual(r.findings, []);
});

test('Luhn check distinguishes real card numbers from random digits', () => {
  assert.equal(luhnValid('4111111111111111'), true);
  assert.equal(luhnValid('4111111111111112'), false);
  assert.ok(!types(redact('ref 4111 1111 1111 1112 thanks')).CARD);
  assert.equal(ibanValid('GB82 WEST 1234 5698 7654 32'), true);
  assert.equal(ibanValid('GB82 WEST 1234 5698 7654 33'), false);
});

test('audit chain verifies and detects tampering', () => {
  const db = { audit: [] };
  appendAudit(db, { type: 'a', summary: 'one' });
  appendAudit(db, { type: 'b', summary: 'two', data: { x: 1 } });
  appendAudit(db, { type: 'c', summary: 'three' });
  assert.equal(verifyAudit(db.audit).ok, true);
  const tampered = structuredClone(db.audit);
  tampered[1].summary = 'edited';
  const v = verifyAudit(tampered);
  assert.equal(v.ok, false);
  assert.equal(v.brokenAt, 2);
  const deleted = structuredClone(db.audit);
  deleted.splice(1, 1);
  assert.equal(verifyAudit(deleted).ok, false);
});

test('scrypt passcode hashing verifies correct and rejects wrong passcodes', async () => {
  const h = await hashPasscode('correct horse battery');
  assert.notEqual(h.hash, 'correct horse battery');
  assert.equal(await verifyPasscode('correct horse battery', h), true);
  assert.equal(await verifyPasscode('wrong passcode!!', h), false);
});

test('AES-256-GCM encryption round-trips and rejects tampering', () => {
  const key = crypto.randomBytes(32);
  const env = encrypt('{"secret":true}', key);
  assert.equal(decrypt(env, key), '{"secret":true}');
  const bad = { ...env, data: Buffer.from('{"secret":false}').toString('base64') };
  assert.throws(() => decrypt(bad, key));
  assert.throws(() => decrypt(env, crypto.randomBytes(32)));
});

test('agent keys are stored hashed and stop working after rotation', () => {
  const db = { agents: [], requests: [], payments: [] };
  const { agent, apiKey } = createAgent(db, { name: 'Test agent' });
  assert.ok(apiKey.startsWith('chr_sk_'));
  assert.ok(!JSON.stringify(db).includes(apiKey));
  assert.equal(findAgentByKey(db, apiKey), agent);
  const next = rotateAgentKey(agent);
  assert.equal(findAgentByKey(db, apiKey), null);
  assert.equal(findAgentByKey(db, next), agent);
  assert.equal(findAgentByKey(db, 'chr_sk_nope'), null);
});
