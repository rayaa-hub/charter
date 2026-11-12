// JSON-file store with atomic writes and optional AES-256-GCM encryption at rest.
// Set CHARTER_DATA_KEY (64 hex chars; `npm run gen-key`) to encrypt the database file.
// Good enough for a single-node deployment; swap for Postgres/SQLite in production.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const DIR = process.env.CHARTER_DATA_DIR || path.resolve('data');
const FILE = path.join(DIR, 'charter-db.json');

export const DEFAULT_SETTINGS = Object.freeze({ killSwitch: false, redactPII: true, retentionDays: 90 });

export const emptyDb = () => ({
  owner: null,
  charter: null,
  charterHistory: [],
  requests: [],
  payments: [],
  agents: [],
  audit: [],
  settings: { ...DEFAULT_SETTINGS },
  idempotency: {},
  webhookEvents: [],
});

let db = null;

function dataKey() {
  const k = process.env.CHARTER_DATA_KEY;
  if (!k) return null;
  if (!/^[0-9a-fA-F]{64}$/.test(k)) {
    throw new Error('CHARTER_DATA_KEY must be 64 hex characters (32 bytes). Generate one with `npm run gen-key`.');
  }
  return Buffer.from(k, 'hex');
}

export const encryptionEnabled = () => Boolean(process.env.CHARTER_DATA_KEY);

export function encrypt(plaintext, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return { v: 1, alg: 'AES-256-GCM', iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') };
}

export function decrypt(envelope, key) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(envelope.data, 'base64')), decipher.final()]).toString('utf8');
}

const isEnvelope = (o) => o && o.v === 1 && typeof o.iv === 'string' && typeof o.tag === 'string' && typeof o.data === 'string';

export function load() {
  if (db) return db;
  let raw;
  try {
    raw = fs.readFileSync(FILE, 'utf8');
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    db = emptyDb();
    return db;
  }
  let parsed = JSON.parse(raw);
  if (isEnvelope(parsed)) {
    const key = dataKey();
    if (!key) throw new Error('The data file is encrypted. Set CHARTER_DATA_KEY to the key it was written with.');
    try {
      parsed = JSON.parse(decrypt(parsed, key));
    } catch {
      throw new Error('Could not decrypt the data file: CHARTER_DATA_KEY is wrong or the file was tampered with.');
    }
  }
  const base = emptyDb();
  db = { ...base, ...parsed, settings: { ...base.settings, ...(parsed.settings || {}) } };
  return db;
}

export function save() {
  if (!db) return;
  fs.mkdirSync(DIR, { recursive: true });
  const key = dataKey();
  const json = JSON.stringify(db, null, key ? 0 : 2);
  const out = key ? JSON.stringify(encrypt(json, key)) : json;
  const tmp = `${FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, out, { mode: 0o600 });
  fs.renameSync(tmp, FILE);
}
