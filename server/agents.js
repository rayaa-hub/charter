// Agent identities. Each agent authenticates with its own API key (`chr_sk_…`).
// Only a SHA-256 hash and the last 4 characters are stored; the raw key is shown once.
import crypto from 'node:crypto';

export const KEY_PREFIX = 'chr_sk_';
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

export function issueKey() {
  const apiKey = KEY_PREFIX + crypto.randomBytes(32).toString('base64url');
  return { apiKey, keyHash: sha256(apiKey), last4: apiKey.slice(-4) };
}

export function createAgent(db, { name, dailyLimit = null }) {
  const { apiKey, keyHash, last4 } = issueKey();
  const agent = {
    id: `agt_${crypto.randomBytes(6).toString('hex')}`,
    name,
    status: 'active',
    keyHash,
    last4,
    dailyLimit,
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
  };
  db.agents.push(agent);
  return { agent, apiKey };
}

export function rotateAgentKey(agent) {
  const { apiKey, keyHash, last4 } = issueKey();
  agent.keyHash = keyHash;
  agent.last4 = last4;
  agent.keyRotatedAt = new Date().toISOString();
  return apiKey;
}

/** Constant-time lookup of an active/paused agent by raw API key. */
export function findAgentByKey(db, key) {
  if (typeof key !== 'string' || !key.startsWith(KEY_PREFIX) || key.length > 128) return null;
  const probe = Buffer.from(sha256(key), 'hex');
  let found = null;
  for (const a of db.agents) {
    if (!a.keyHash || a.status === 'revoked') continue;
    if (crypto.timingSafeEqual(Buffer.from(a.keyHash, 'hex'), probe)) found = a;
  }
  return found;
}

export function agentSpend(db, agentId, hours = 24) {
  const since = Date.now() - hours * 3600 * 1000;
  return db.payments
    .filter((p) => p.agentId === agentId && p.status === 'COMPLETED' && new Date(p.capturedAt).getTime() >= since)
    .reduce((s, p) => s + Number(p.amount), 0);
}

export function publicAgent(db, a) {
  return {
    id: a.id,
    name: a.name,
    status: a.status,
    keyPrefix: KEY_PREFIX,
    last4: a.last4,
    dailyLimit: a.dailyLimit ?? null,
    createdAt: a.createdAt,
    lastUsedAt: a.lastUsedAt,
    requestCount: db.requests.filter((r) => r.agentId === a.id).length,
    spend24h: Math.round(agentSpend(db, a.id) * 100) / 100,
  };
}
