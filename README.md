<div align="center">

# Expensio
### Split expenses. Settle with trust.
**A product of StratifyX Global**

Shared-expense splitting · confirmed settlements · NID-verified business partnerships

</div>

---

## 1. What is Expensio?

Expensio lets friends, families, hostel/mess mates and business partners share money fairly:

* **Groups** for trips, homes, events — add expenses, see live balances, settle up.
* **A real calculation engine** on the server (integer minor units, largest-remainder allocation — splits *always* add up to the exact total).
* **Business module** — partnership ledger (investment / profit / expense / withdrawal) with **partners invited by email** and **NID identity verification**.
* **Real email verification**, optional 2-factor sign-in, notifications (in-app + live + email), admin panel.

It was rebuilt from the original DBMS-lab prototype into a production-oriented product: **Node.js + Express + MongoDB** backend, and a **glass-morphism, mobile-first** web app. All course/team references have been removed and replaced by StratifyX Global branding (`web/js/core/brand.js`).

> The API is versioned (`/api/v1`) and client-agnostic, so the future cross-platform mobile app (React Native / Flutter) will use the same backend. See [§10](#10-mobile-app-readiness).

---

## 2. Quick start (from scratch)

### Prerequisites
| Tool | Version | Notes |
|---|---|---|
| Node.js | 18.18+ (22 recommended) | https://nodejs.org |
| MongoDB | 6+ | Docker (easiest), local install, or free MongoDB Atlas cluster |

### Steps

```bash
# 1. Install dependencies
npm install

# 2. Create .env with freshly generated secrets
npm run setup

# 3. Start MongoDB (pick ONE)
docker compose up -d mongo          # Docker
#   …or use a local mongod, or paste an Atlas URI into MONGODB_URI in .env

# 4. Create the first Super Admin (add --demo for sample users & a sample trip)
npm run seed -- --demo

# 5. Run
npm run dev          # auto-restart on change   (or: npm start)
```

Open **http://localhost:5000**

### Emails in development
If `SMTP_HOST` is empty, emails are **not sent**. Instead, every email is printed in the terminal (with the verification link/code highlighted) **and** saved as an HTML file in `./.dev-mail/` so you can open it in a browser. This lets you test real verification flows with no mail server.

To send real email set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` in `.env` (works with Brevo, SendGrid, Mailgun, Amazon SES, Gmail app-passwords, Zoho, etc.). Admin → *System health* shows whether SMTP connects.

### Demo accounts (only with `--demo`)
| Account | Password |
|---|---|
| `rafi@demo.expensio.app`, `nusrat@…`, `tanvir@…` | `Demo!12345a` |
| Super Admin: `SEED_ADMIN_EMAIL` from `.env` | `SEED_ADMIN_PASSWORD` from `.env` |

Staff sign-in always requires an emailed 6-digit code (printed in the terminal in dev).

---

## 3. Commands

| Command | Purpose |
|---|---|
| `npm run setup` | Create `.env` with random secrets (never overwrites) |
| `npm run dev` / `npm start` | Run the server (serves API **and** web app) |
| `npm run seed [-- --demo]` | Create Super Admin (+ demo data). Idempotent |
| `npm test` | Unit tests for the calculation engine (no database needed) |
| `npm run check` | Syntax-check every JS file |

---

## 4. Project structure

```
expensio/
├─ server/
│  ├─ index.js              # bootstrap, DB connect, graceful shutdown
│  ├─ app.js                # security middleware + route mounting + static web
│  ├─ config/env.js         # validated environment (zod); refuses weak prod config
│  ├─ engine/               # ★ PURE calculation engine (unit-tested)
│  │   ├─ split.js          #   equal / percent / shares / exact / itemized, multi-payer
│  │   ├─ debt.js           #   balances, debt simplification, pairwise debts
│  │   ├─ business.js       #   ledger summary + profit-share by ownership
│  │   ├─ money.js, fx.js   #   integer money, currencies, FX
│  ├─ models/               # Mongoose schemas (user, group, business, system)
│  ├─ routes/               # auth, me, groups, expenses, settlements, invitations,
│  │                        # business, notifications, analytics, support, admin, public
│  ├─ services/             # groups (expense builder, balances), tokens, notify (SSE),
│  │                        # kyc, scheduler (recurring), settings/flags, audit, content
│  ├─ middleware/           # auth + RBAC, rate limiting, NoSQL-injection guard, errors
│  └─ lib/                  # crypto (AES-256-GCM), mailer, email templates, validation
├─ web/                     # Frontend (no build step)
│  ├─ index.html, sw.js, manifest.webmanifest (PWA)
│  ├─ css/app.css           # design system: glass, dark/light, animations, responsive
│  └─ js/  core/ (api, ui, store, brand)  pages/ (landing, auth, dashboard, groups,
│          business, settings, info)  admin/ (staff panel, lazy-loaded)
├─ scripts/  setup.js · seed.js · check.js
├─ tests/    engine.test.js
├─ docs/     PRODUCT_ANALYSIS.md
├─ Dockerfile · docker-compose.yml · .env.example
```

---

## 5. Feature overview

**Accounts & security** — email verification (link **and** 6-digit code), bcrypt (cost 12), JWT access tokens (15 min) + rotating refresh tokens in an httpOnly cookie with **reuse detection**, account lockout, rate limiting, optional email-OTP 2FA (mandatory for business owners and all staff), session list & remote sign-out, password reset, Helmet + strict CSP, NoSQL-injection guard.

**Groups & expenses** — categories, 12 currencies with per-expense FX rate, 5 split types, multiple payers, tax/tip spread on itemized bills, edit with version history, soft-delete, search & filters, CSV export (spreadsheet-injection safe), print/PDF, recurring expenses (weekly/monthly/yearly), live server-side **preview** of the exact split before saving.

**Settlements** — debt simplification (toggle per group), *two-step confirmation* (one party records, the **other** confirms/declines — atomic, race-safe), over-payment protection, reminders (rate-limited), bKash/Nagad/Rocket/Upay/Bank/Cash with transaction reference.

**Business** — create business (owner NID required), **invite partners by email** (works for people without an account), roles (owner/partner/investor/accountant), ownership % that always totals 100%, partners must submit NID to join, **append-only ledger** (void with reason), profit share by ownership, audit trail, compliance flagging.

**NID handling** — number encrypted with **AES-256-GCM**, only last 4 digits ever displayed, HMAC blind-index prevents one NID on many accounts, review queue for KYC reviewers, full number revealed only after password re-auth and **audited**.

**Notifications** — in-app, real-time (Server-Sent Events), email with per-category preferences, announcement broadcast.

**Admin panel** (`/#/admin`) — RBAC roles (Super Admin, KYC Reviewer, Support, Content Editor): KPIs, user management, KYC review, business oversight/flagging, support tickets, editable Terms/Privacy/Cookie/Security pages (versioned), feature flags, maintenance mode & banner, audit log, system health.

**Frontend** — glass-morphism, dark/light, animated aurora background, count-up numbers, scroll-reveal, ripple buttons, confetti on milestones, tilt hero, skeleton loaders, bottom-sheet modals + tab bar + FAB on mobile, sidebar on desktop, PWA install, reduced-motion respected.

---

## 6. Configuration (`.env`)

| Variable | Description |
|---|---|
| `NODE_ENV` | `development` or `production` (production enforces secrets + SMTP) |
| `PORT`, `APP_URL` | Listen port and public URL (used in email links & CORS) |
| `MONGODB_URI` | Mongo connection string |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | ≥32 chars each (auto-generated by `npm run setup`) |
| `ENCRYPTION_KEY` | 64 hex chars (32 bytes). **Back this up** — losing it makes stored NIDs unreadable |
| `SMTP_*`, `MAIL_FROM` | Outgoing email |
| `CORS_ORIGINS` | Extra allowed origins (comma-separated) |
| `SEED_ADMIN_EMAIL/PASSWORD` | First Super Admin created by `npm run seed` |
| `FX_RATES_JSON` | Optional override of FX rates per 1 USD |

---

## 7. API summary (`/api/v1`)

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/register · verify-email · resend-verification · login · 2fa/verify · refresh · logout · logout-all · forgot-password · reset-password` |
| Me | `GET/PATCH /me · POST /me/change-password · GET/DELETE /me/sessions · POST /me/2fa/{request,enable,disable} · GET/POST /me/kyc · GET /me/export · POST /me/delete-request` |
| Groups | `GET/POST /groups · GET/PATCH /groups/:id · POST /groups/:id/invite · DELETE/PATCH /groups/:id/members/:uid · GET /groups/:id/{balances,activity,export.csv}` |
| Expenses | `GET/POST /groups/:id/expenses · POST …/expenses/preview · GET/PUT/DELETE /expenses/:id · GET/POST /groups/:id/recurring` |
| Settlements | `GET/POST /groups/:id/settlements · POST /settlements/:id/{confirm,reject,cancel} · POST /groups/:id/remind` |
| Invitations | `GET /invitations · GET /invitations/preview/:token (public) · POST /invitations/:id/{accept,decline}` |
| Business | `GET/POST /business · GET/PATCH /business/:id · POST …/invite · PATCH/DELETE …/partners/:uid · GET/POST …/transactions · POST …/transactions/:id/void · GET …/audit` |
| Other | `GET /analytics/overview · /notifications… · POST /support/tickets · GET /content/:slug · GET /config · GET /health` |
| Admin | `/admin/{overview,users,kyc,businesses,tickets,content,flags,settings,broadcast,audit,health}` |

Errors are always `{ "error": "message", "code": "MACHINE_CODE", "details": {field: message} }`.

---

## 8. Calculation engine (the heart of the product)

* Money is **integer minor units** (paisa/cents). No floats in any ledger path.
* Every split type reduces to one function, `allocate(total, weights)` — **largest-remainder** method with BigInt arithmetic, deterministic tie-breaking → Σ shares **=** total, always.
* Balances are **derived** from expenses + confirmed settlements, never stored, so edits/deletes/retries can’t cause drift.
* Foreign-currency expenses are converted **once** (rate saved on the expense) and then split in the group’s base currency.
* `npm test` includes a 2,000-case fuzz test proving reconciliation, plus tests for every split type, multi-payer, itemized tax/tip, debt simplification and business profit shares.

---

## 9. Deploying to production

1. Provision MongoDB (Atlas or self-hosted with auth + backups).
2. Set `NODE_ENV=production`, a real `APP_URL` (https), strong secrets, SMTP credentials.
3. Run behind HTTPS (Nginx/Caddy/Cloudflare, load balancer). `trust proxy` is already enabled in production so rate-limits/IPs work behind one proxy.
4. `docker compose up -d --build` (app + mongo), or `npm ci --omit=dev && npm start` under systemd/PM2.
5. Run `npm run seed` once, **sign in as the Super Admin, change the password**, then review Admin → Content (legal pages) and Flags.
6. Monitor `GET /api/v1/health`. Back up MongoDB **and** `ENCRYPTION_KEY`.

**Scaling notes:** the app is stateless except (a) the SSE connection registry and (b) in-memory rate-limit counters. For multiple instances, put Redis behind SSE pub/sub and `express-rate-limit`. The recurring-expense scheduler already claims jobs atomically and is safe with several instances.

---

## 10. Mobile app readiness

The backend is ready for the planned cross-platform app:
* Send header `X-Client: mobile` on `/auth/*` calls to receive the **refresh token in the JSON body** (stored in the OS keychain) instead of a cookie.
* All money is integer minor units + ISO currency codes; all IDs are strings; all timestamps ISO-8601.
* Push notifications: add a `devices` collection and hook FCM/APNs into `services/notify.js` (the single place all notifications flow through).

---

## 11. Before public launch — checklist

- [ ] **Legal review** of Terms / Privacy / Cookie pages (seeded as drafts; edit in Admin → Content). Insert company registration details.
- [ ] Confirm compliance requirements for collecting NID data in your jurisdiction (data-protection law, retention, consent wording).
- [ ] Add real social URLs in `web/js/core/brand.js`.
- [ ] Production SMTP + domain authentication (SPF/DKIM/DMARC).
- [ ] Replace indicative FX rates with a live provider (`engine/fx.js → setRates()` from a scheduled job).
- [ ] Penetration test, backups, uptime monitoring, error tracking (e.g. Sentry).
- [ ] Optionally integrate automated e-KYC (NID API) to complement manual review.

## 12. Verification status (please read)

The calculation engine is covered by automated tests (`npm test`, 10 tests passing). Every server and client file passes syntax checks, cross-file imports are verified, and the web app was exercised in a real browser (no JavaScript errors, no horizontal overflow at 390 px and 1366 px) against a mocked API.

The server **was written in an environment without MongoDB or npm registry access**, so it has not yet been run end-to-end against a live database. Expect to run through the checklist once on your machine: register → verify email → create group → add expense → invite → settle → create business → admin KYC approve. If anything misbehaves, the terminal log and the browser console are verbose in development.

## 13. Troubleshooting

| Symptom | Fix |
|---|---|
| `Cannot reach MongoDB` | Start Mongo (`docker compose up -d mongo`) or fix `MONGODB_URI` |
| No verification email | Dev mode: look in the terminal and `./.dev-mail/`. Prod: check Admin → System health |
| Signed out after every restart | `.env` missing → run `npm run setup` (dev uses ephemeral secrets otherwise) |
| NIDs unreadable after moving servers | `ENCRYPTION_KEY` changed — restore the original key |
| Port in use | Change `PORT` and `APP_URL` in `.env` |

---

© StratifyX Global. All rights reserved.
