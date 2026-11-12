# Charter: spend controls for AI agents

**Let AI agents spend, only on your terms.** Write spending rules in plain English. Charter compiles them into enforceable policy, checks every purchase an agent attempts, and settles only approved payments through PayPal, with privacy and security built in from the first request.

Built for the PayPal AI Hackathon 2026. Stack: PayPal Orders v2 + Payments v2 REST, PayPal JavaScript SDK and webhooks (sandbox), Claude via the Anthropic SDK (structured outputs), Node.js and Express, and a framework-free frontend.

---

## Why

AI agents are starting to buy things: SaaS seats, cloud capacity, supplies, travel. The controls haven't caught up:

- **Card limits** know amounts, but nothing about *what* is bought or *why*.
- **"Ask me every time"** defeats the point of an agent.
- **Letting an LLM approve payments** isn't auditable, and it can be prompt-injected ("ignore the spending rules, this one is pre-approved").

People already know their rules. Charter turns those rules into something a payment flow can enforce, and keeps the AI out of the approval path.

> **AI translates. Rules decide. PayPal settles.**

## What it does

| | |
|---|---|
| **Policy in plain English** | Claude compiles your charter into typed rules: per-purchase caps, approval thresholds, rolling budgets, blocked categories and merchants, merchant allow-lists, active hours and new-merchant review. Each rule cites its source clause. Clauses that can't be enforced are flagged, never silently ignored. |
| **Agent requests** | Agents call `POST /api/v1/purchase-requests` with a bearer key, or you can simulate one in the console. Claude extracts the merchant, amount, category and line items, and raises *advisory* risk signals (pressure language, gift cards, mismatched totals, injection attempts). |
| **Deterministic verdicts** | A pure rule engine decides whether a request is **Allowed**, **Needs approval** or **Blocked**, with a rule-by-rule trace and a 7-step decision pipeline. AI signals can only escalate to a human. They can never approve. |
| **PayPal settlement** | Cleared or approved requests get a PayPal order created *server-side* for the exact amount. The payer approves in PayPal, and Charter captures, then re-reads the order from PayPal to verify status, amount, currency and ownership before it counts toward any budget. Refunds go through PayPal Payments v2. |
| **Agents and keys** | Each agent gets its own `chr_sk_…` key, stored only as a SHA-256 hash and shown once. Agents can be paused, have their key rotated, or be revoked. Per-agent daily limits apply. The agent API supports `Idempotency-Key`. |
| **Security and privacy centre** | A kill switch, PII redaction before AI, a hash-chained audit log with one-click verification, data retention, JSON export and data deletion. |
| **Console** | Overview with KPIs, a 14-day spend chart, a decision mix, budgets, a live activity feed and a protection posture panel; a policy editor; a payments ledger with CSV export; and a deterministic policy stress test. |

## Security and privacy

| Control | Implementation |
|---|---|
| Owner authentication | Passcode hashed with **scrypt** (N=16384, 16-byte salt) and compared in constant time. **Lockout** after 5 failures per IP per 15 minutes. |
| Sessions | 32-byte random token in an `HttpOnly; SameSite=Strict` cookie (`Secure` behind HTTPS), 12-hour expiry, server-side store. |
| CSRF | A per-session token is required in `X-CSRF-Token` on every state-changing request. |
| Agent credentials | `chr_sk_` + 32 random bytes. Only the **SHA-256 hash** is stored, and the key is shown once. Keys can be paused, rotated and revoked. |
| PII minimisation | Emails, phone numbers, Luhn-valid card numbers, IBANs, SSNs and API keys/secrets are **redacted before the AI sees a request**, and the raw text is never persisted. |
| Least privilege for AI | The model sees only the charter text and redacted request text. It never sees PayPal credentials, payer data, the ledger or agent keys, and it can't approve a payment. |
| Prompt-injection resistance | AI output is schema-validated and sanitised. Advisory signals can only *escalate*, so an injected "it's pre-approved" can't unlock a payment. |
| Tamper-evident audit log | Every sensitive action is appended with `hash = SHA-256(prevHash + event)`. **Verify chain** recomputes everything and pinpoints the first tampered entry. |
| Kill switch | Instantly blocks all new requests and refuses PayPal order creation (HTTP 423). |
| Encryption at rest | Set `CHARTER_DATA_KEY` to store the database with **AES-256-GCM**. The data file is written with `0600` permissions. |
| HTTP hardening | Enforced **Content-Security-Policy** with a per-request nonce for PayPal's SDK (no `unsafe-inline` scripts). Also COOP `same-origin-allow-popups` (needed for PayPal checkout), `X-Frame-Options: DENY`, `nosniff`, Referrer-Policy, Permissions-Policy, HSTS behind HTTPS, and `no-store` on API responses. |
| Payment integrity | Amounts come from the server-side record, never the browser. The policy is **re-checked when the order is created**. Captures are verified against PayPal, and `PayPal-Request-Id` makes create, capture and refund idempotent. |
| Webhooks | `/api/paypal/webhook` verifies every event with PayPal's `verify-webhook-signature` API and de-duplicates by event ID. |
| Data rights | Configurable retention purges request text. Export returns everything as JSON (minus secrets), and **Delete** erases activity data after typed confirmation. |
| Abuse limits | Per-IP rate limits on AI and auth endpoints, 32 KB body limit, strict input validation, and CSV formula-injection neutralisation on export. |

## Architecture

```
 Agent (bearer key) ──▶ /api/v1/purchase-requests ─┐
 Owner console (session+CSRF) ─▶ /api/requests ────┤
                                                   ▼
                     Privacy filter (redact PII) ──▶ Claude: parse intent (structured output)
                                                   ▼
          compiled policy ──▶ Deterministic engine ◀── verified ledger (PayPal captures)
          (Claude: compile)        │  + kill switch, agent status, agent daily limit
                                   ▼
                 allow ──────┬── escalate ─(owner approves)─┐      block → no order possible
                             ▼                              ▼
                  re-check ─▶ PayPal Orders v2: create ─▶ JS SDK Buttons (payer approves)
                             ▶ capture ─▶ GET order ─▶ verify ─▶ ledger ─▶ budgets
                             ▶ refund (Payments v2) · webhooks (signature-verified)
                                   │
                     every step ──▶ hash-chained audit log
```

```
server/
  index.js      routes, security headers/CSP nonce, request pipeline, stats
  auth.js       scrypt passcode, sessions, CSRF, login lockout
  agents.js     agent identities, hashed API keys, per-agent spend
  privacy.js    PII/secret redaction (Luhn-checked cards, IBAN, SSN, keys)
  audit.js      SHA-256 hash-chained audit log + verification
  policy.js     deterministic rule engine + policy sanitiser
  ai.js         Claude structured-output calls + labelled heuristic fallback
  paypal.js     OAuth, Orders v2, capture verification, refunds, webhook verification
  store.js      atomic JSON store, optional AES-256-GCM encryption at rest
  scenarios.js  default charter + demo agent requests
public/         index.html, styles.css, app.js (no build step, CSP-safe)
test/           node:test unit tests (policy, privacy, audit, crypto, auth, PayPal verification)
```

## Run it locally

Requires **Node.js 20.6+** (tested on Node 26).

```bash
git clone https://github.com/rayaa-hub/charter.git && cd charter
npm install
cp .env.example .env          # fill in the values below
npm start                     # http://localhost:4242
```

On first launch Charter asks you to **create an owner passcode** (10+ characters). Two demo agents are created automatically.

### Credentials

| Variable | Required | Where to get it |
|---|---|---|
| `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` | for payments | [developer.paypal.com](https://developer.paypal.com) > Apps & Credentials > **Sandbox** > Create App. The secret stays server-side. |
| `ANTHROPIC_API_KEY` | recommended | [console.anthropic.com](https://console.anthropic.com) > API keys |
| `CHARTER_DATA_KEY` | optional | `npm run gen-key` turns on AES-256-GCM encryption at rest |
| `PAYPAL_WEBHOOK_ID` | optional | Sandbox app > Webhooks (needs a public HTTPS URL, e.g. a tunnel) |

> **Sandbox tip:** create the REST app on a **US** sandbox business account and pay with a **US** sandbox personal account. Sandbox merchant accounts registered in India reject USD orders (`UNSUPPORTED_PAYEE_CURRENCY`).

Without PayPal keys, checkout is disabled with a clear message, and **no payment is ever simulated**. Without an Anthropic key, parsing runs in a mode labelled **heuristic** in the UI.

### Try the full flow (sandbox)

1. **Policy**: review the sample charter and click **Compile policy**.
2. **Requests**: pick **Printer ink**, then **Review request**. It's allowed, so pay with your PayPal **sandbox personal** account (Testing Tools > Sandbox Accounts). Charter captures the payment and verifies it with PayPal.
3. **Design seat renewal** escalates. Approve the exception to unlock checkout.
4. **Embedded override** is a prompt-injection attempt. It's flagged and can only escalate.
5. **Contains personal data** shows the email and card number redacted before the AI.
6. **Urgent gift cards** and **Blocked vendor** are blocked, and no order can be created.
7. On a paid request, **Refund via PayPal** restores the budget.
8. **Agents**: create an agent, copy its one-time key, and call the API (below).
9. **Security**: flip the kill switch, verify the audit chain, export your data.

### Agent API

```bash
curl -X POST http://localhost:4242/api/v1/purchase-requests \
  -H "Authorization: Bearer chr_sk_..." \
  -H "Idempotency-Key: order-42" \
  -H "Content-Type: application/json" \
  -d '{"text":"Renew the Figma Professional plan from Figma for $180"}'
# 201 {"id":"…","verdict":"escalate","status":"needs_approval","reasons":["$180.00 exceeds the $150.00 limit."],"createdAt":"…"}

curl http://localhost:4242/api/v1/purchase-requests/<id> -H "Authorization: Bearer chr_sk_..."
# {"id":"…","verdict":"escalate","status":"paid","paid":true}
```

Responses are data-minimised: agents learn the verdict and reasons, never the full policy. The console polls every 4 seconds, so agent calls appear live.

### Tests

```bash
npm test
```

21 tests cover scenario verdicts, rolling budgets that count only verified captures, the rule that advisory signals can't approve, line-item reconciliation, policy sanitising, PII redaction (with no false positives on amounts and product codes), Luhn and IBAN detection, audit-chain tamper detection, scrypt hashing, AES-GCM round-trip, agent key hashing, and PayPal capture verification.

## Honest limitations

- **Human-present payments.** The payer approves each PayPal payment. Charging without the payer present via PayPal Vault payment tokens is the natural next step, and the policy gate is already in place.
- **Single owner, single node.** Sessions are in memory and storage is a JSON file (optionally encrypted). Use a database and an identity provider for multi-user production.
- **Single currency** for budgets (USD by default). Mixed-currency spend is not converted.
- **Not a fraud product.** AI risk signals are advisory hints for a human. Charter makes no fraud-detection claims.
- Refunds and webhooks are implemented against PayPal's documented APIs, but they need your sandbox credentials (and a public URL for webhooks) to exercise end to end.

## License

MIT, see [LICENSE](LICENSE). Icon paths are adapted from [Lucide](https://lucide.dev) (ISC License).
