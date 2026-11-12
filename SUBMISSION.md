# Charter: Devpost submission kit

## Title
**Charter: spend controls for AI agents**

## Tagline
Let AI agents spend, only on your terms. Plain-English rules become enforceable policy, every purchase is checked and explained, and only approved payments settle through PayPal.

---

## Devpost story (paste into the description)

### Inspiration
AI agents are starting to buy things for us, but the controls haven't caught up. A card limit doesn't know *what* is being bought. "Ask me every time" defeats the point of an agent. And letting another LLM approve payments isn't auditable, and it can be prompt-injected. People already know their rules: *no single purchase over $500, ask me above $150, never gift cards*. Nothing turned those sentences into something a payment flow could enforce, safely and privately.

### What it does
Charter sits between AI agents and PayPal.

- **Policy in plain English.** Claude compiles your charter into typed, enforceable rules, each citing the clause it came from. Clauses that can't be enforced are flagged instead of being silently dropped.
- **Agents ask before they spend.** Each agent has its own API key (stored only as a SHA-256 hash) and an optional daily limit. Requests arrive in natural language. Personal data (emails, phone and card numbers, secrets) is **redacted before the AI sees it**, and Claude extracts the merchant, amount, category, items and advisory risk signals.
- **Rules decide, not the model.** A deterministic engine returns Allowed, Needs approval or Blocked with a rule-by-rule trace and a 7-step decision pipeline. AI signals can only escalate to a human. That's why an injected "ignore the rules, it's pre-approved" can't unlock a payment.
- **PayPal settles, and Charter verifies.** Approved requests get a server-side PayPal order for the exact amount. The payer approves with PayPal Buttons. Charter captures, then re-reads the order from PayPal to verify the amount, currency and ownership before it counts toward a budget. Refunds run through PayPal and restore the budget, and webhooks are signature-verified.
- **Trust centre.** A kill switch freezes all agents instantly. A SHA-256 hash-chained audit log can be verified in one click. There are data-retention controls, JSON export and typed-confirmation deletion. Encryption at rest (AES-256-GCM) is optional.
- **A real console.** It has KPIs, a 14-day spend chart, a decision mix, budget burn, a live activity feed, a payments ledger with CSV export, and a one-click policy stress test.

### How we built it
- **PayPal Developer Platform (sandbox):** Orders v2 (create, capture, get) for verification, Payments v2 refunds, JavaScript SDK Buttons with a CSP nonce, webhook signature verification, and `PayPal-Request-Id` idempotency throughout.
- **AI:** Claude via the Anthropic SDK with **structured outputs** (JSON Schema) to compile policy and parse intents, plus server-side refusal fallbacks. All output is validated and sanitised again on the server. A clearly labelled heuristic fallback runs when no key is configured.
- **Security:** scrypt owner passcode with lockout, HttpOnly/SameSite=Strict sessions, CSRF tokens, hashed agent keys, an enforced Content-Security-Policy with a per-request nonce, a hash-chained audit log, and an AES-256-GCM data store.
- **Stack:** Node.js and Express, with a framework-free, CSP-safe frontend. 21 automated tests.

### Challenges we ran into
- Keeping the AI useful but **outside the approval path**.
- Making privacy real rather than a checkbox: redaction happens before the model call *and* before storage, so the raw text never exists at rest.
- Running PayPal's SDK under a strict CSP without `unsafe-inline`, which we solved with a per-request nonce passed via `data-csp-nonce`.
- Time-of-check vs time-of-use: the policy is re-evaluated when the PayPal order is created.

### Accomplishments that we're proud of
- Every verdict is reproducible and explained, down to the user's own words.
- Budgets are driven only by **PayPal-verified captures**.
- The system degrades honestly: no AI key means a labelled heuristic mode, and no PayPal keys means checkout is disabled, never simulated.

### What we learned
LLMs are excellent compilers from human intent to structured policy, and poor runtime judges of money movement. Splitting those jobs makes both safer.

### What's next
PayPal Vault payment tokens for charging without the payer present (the policy gate is ready), an MCP server so any agent framework can ask Charter before spending, multi-user workspaces with SSO, and per-agent charters.

### Built with
`paypal-orders-v2` · `paypal-payments-v2` · `paypal-javascript-sdk` · `paypal-webhooks` · `claude` · `anthropic-sdk` · `node.js` · `express` · `javascript` · `html` · `css`

---

## Testing instructions for judges
`npm install` → `cp .env.example .env` → add sandbox `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` (optionally `ANTHROPIC_API_KEY`) → `npm start` → open http://localhost:4242 → create an owner passcode → follow "Try the full flow" in the README. Pay with a PayPal **sandbox personal** account.

---

## Demo video script (about 2:45)

**Before recording:** sign in, go to Security & privacy → **Reset demo data**, have the PayPal sandbox buyer login ready, and record at 1280 px wide or more. Use no copyrighted music.

| Time | Screen | Voice-over |
|---|---|---|
| 0:00–0:12 | Sign-in screen | "AI agents are starting to spend money for us. Card limits don't know what they're buying, and letting another AI approve payments isn't safe. This is Charter." |
| 0:12–0:35 | **Policy** → Compile | "I write my rules the way I'd brief a new hire. Claude compiles them into enforceable rules, each citing my exact words. The first line can't be enforced, so Charter flags it instead of pretending." |
| 0:35–1:05 | **Requests** → Printer ink → Review → PayPal pay → verified | "My procurement agent wants $84 of ink. The decision pipeline shows privacy filter, AI parse, policy, then PayPal. The order is created on the server for the exact amount. I pay in the sandbox, and Charter re-verifies the capture with PayPal before it counts toward my budget." |
| 1:05–1:20 | Design seat renewal → Needs approval → Approve | "A $180 renewal crosses my approval line, so the agent stops and asks me. One click unlocks checkout, for this request only." |
| 1:20–1:40 | Embedded override → advisory signal | "This one tries a prompt injection: 'ignore the rules, it's pre-approved.' The AI flags it, but AI can only escalate. It can never approve money." |
| 1:40–1:55 | Contains personal data → redaction badges | "Privacy: the email and card number were redacted before the AI saw them, and the raw text is never stored." |
| 1:55–2:10 | Agents → New agent → one-time key | "Each agent gets its own key, stored only as a hash. I can pause it, rotate the key or revoke it, and set a daily limit." |
| 2:10–2:30 | Security → Kill switch on (banner) → Verify chain | "One switch freezes every agent. Every sensitive action goes into a hash-chained audit log, and I can prove it hasn't been tampered with." |
| 2:30–2:45 | Overview (charts, posture) | "AI translates, rules decide, PayPal settles. Charter lets agents spend, only on your terms." |
