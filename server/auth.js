// Owner authentication: scrypt-hashed passcode, opaque server-side sessions,
// HttpOnly + SameSite=Strict cookies, per-session CSRF tokens and login lockout.
import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(crypto.scrypt);
export const KDF = Object.freeze({ name: 'scrypt', N: 16384, r: 8, p: 1, keylen: 64 });
const SCRYPT_OPTS = { N: KDF.N, r: KDF.r, p: KDF.p, maxmem: 64 * 1024 * 1024 };

export const COOKIE = 'charter_sid';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

export async function hashPasscode(passcode) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(passcode.normalize('NFKC'), salt, KDF.keylen, SCRYPT_OPTS);
  return { hash: hash.toString('base64'), salt: salt.toString('base64') };
}

export async function verifyPasscode(passcode, { hash, salt }) {
  const expected = Buffer.from(hash, 'base64');
  const actual = await scrypt(String(passcode).normalize('NFKC'), Buffer.from(salt, 'base64'), expected.length, SCRYPT_OPTS);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

// --- sessions (in memory, keyed by sha256(token) so raw tokens are never held as map keys)
const sessions = new Map();

export function createSession() {
  const token = crypto.randomBytes(32).toString('base64url');
  const csrf = crypto.randomBytes(32).toString('base64url');
  sessions.set(sha256(token), { csrf, expiresAt: Date.now() + SESSION_TTL_MS });
  return { token, csrf };
}

function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 1) continue;
    const k = part.slice(0, i).trim();
    try {
      out[k] = decodeURIComponent(part.slice(i + 1).trim());
    } catch {
      out[k] = part.slice(i + 1).trim();
    }
  }
  return out;
}

export function getSession(req) {
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (!token || token.length > 100) return null;
  const id = sha256(token);
  const s = sessions.get(id);
  if (!s) return null;
  if (s.expiresAt < Date.now()) {
    sessions.delete(id);
    return null;
  }
  return { id, csrf: s.csrf, expiresAt: s.expiresAt };
}

export function csrfMatches(session, header) {
  if (!session || typeof header !== 'string') return false;
  const a = Buffer.from(session.csrf);
  const b = Buffer.from(header);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export const destroySession = (session) => session && sessions.delete(session.id);
export const destroyAllSessions = () => sessions.clear();

const isSecure = (req) => Boolean(req.secure || req.headers['x-forwarded-proto'] === 'https');

export function setSessionCookie(req, res, token) {
  res.append('Set-Cookie', `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_MS / 1000}${isSecure(req) ? '; Secure' : ''}`);
}

export function clearSessionCookie(req, res) {
  res.append('Set-Cookie', `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${isSecure(req) ? '; Secure' : ''}`);
}

// --- brute-force lockout (per client IP)
const failures = new Map();

function failureEntry(ip) {
  const f = failures.get(ip);
  if (f && Date.now() - f.first > LOCKOUT_WINDOW_MS) {
    failures.delete(ip);
    return null;
  }
  return f || null;
}

export function lockoutRemainingMs(ip) {
  const f = failureEntry(ip);
  return f && f.count >= MAX_FAILURES ? LOCKOUT_WINDOW_MS - (Date.now() - f.first) : 0;
}

export function recordFailure(ip) {
  const f = failureEntry(ip) || { count: 0, first: Date.now() };
  f.count += 1;
  failures.set(ip, f);
  return Math.max(0, MAX_FAILURES - f.count);
}

export const clearFailures = (ip) => failures.delete(ip);

// Housekeeping
setInterval(() => {
  const now = Date.now();
  for (const [k, s] of sessions) if (s.expiresAt < now) sessions.delete(k);
  for (const [k, f] of failures) if (now - f.first > LOCKOUT_WINDOW_MS) failures.delete(k);
}, 10 * 60 * 1000).unref();
