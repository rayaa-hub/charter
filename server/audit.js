// Tamper-evident audit log: every entry commits to the hash of the one before it,
// so editing or deleting any past entry breaks verification from that point on.
import crypto from 'node:crypto';

export const GENESIS = '0'.repeat(64);
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

const digest = (prevHash, e) =>
  sha256(prevHash + JSON.stringify({ seq: e.seq, at: e.at, type: e.type, actor: e.actor, summary: e.summary, data: e.data }));

export function appendAudit(db, { type, actor = 'system', summary, data = {} }) {
  const prev = db.audit[db.audit.length - 1];
  const prevHash = prev ? prev.hash : GENESIS;
  const entry = {
    seq: prev ? prev.seq + 1 : 1,
    at: new Date().toISOString(),
    type,
    actor,
    summary: String(summary || type).slice(0, 300),
    data: data && typeof data === 'object' ? data : {},
    prevHash,
  };
  entry.hash = digest(prevHash, entry);
  db.audit.push(entry);
  return entry;
}

export function verifyAudit(entries = []) {
  let prevHash = GENESIS;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (!e || e.prevHash !== prevHash || digest(prevHash, e) !== e.hash) {
      return { ok: false, count: entries.length, head: entries.at(-1)?.hash || GENESIS, brokenAt: e?.seq ?? i + 1 };
    }
    prevHash = e.hash;
  }
  return { ok: true, count: entries.length, head: prevHash, brokenAt: null };
}

export const auditHead = (db) => db.audit.at(-1)?.hash || GENESIS;
