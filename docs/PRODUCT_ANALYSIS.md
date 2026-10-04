# Expensio — Product Assessment & Upgrade Plan
*StratifyX Global · prepared from review of the original DBMS-lab prototype, the three project proposals, and a market scan.*

## 1. Assessment of the original prototype

| Area | Finding | Risk |
|---|---|---|
| Data model | SQL tables; balances stored/mutated in place | Drift after edits; hard to audit |
| Splitting | Basic equal splits; floating-point amounts | Rounding errors, unfair totals |
| Auth | Basic login; no real email verification; no lockout/2FA | Fake accounts, account takeover |
| Business | No way to add partners; no identity data | Not usable for real partnerships |
| Security | No rate limiting, validation or audit trail; NID plain text if collected | Unsafe for public launch |
| UX | Course-project look, not mobile-first, no feedback/animation | Low retention |
| Branding | Course/team references throughout | Not launchable |

## 2. Market scan (competitors)

| Product | Strengths | Gaps relevant to us |
|---|---|---|
| **Splitwise** | Category leader; itemized splits with tax/tip; payment integrations | Several useful features moved behind a paid tier (e.g. receipt scanning, export); frequent "daily cap" complaints |
| **Tricount** (bunq) | Free core, link-based sharing without sign-up, offline | Fewer split options; no business mode |
| **Splid** | Offline-first, 150+ currencies, no account required | Free tier limits (groups); fewer features |
| **Settle Up** | Recurring expenses, flexible percentage splits, CSV/PDF export | Less brand recognition; ad-supported free tier |
| **Kittysplit** | Fast groups without registration | Minimal feature set |

*Sources: Tricount, SaaSHub, financer.de, finanjo, getfinny, packinglighttravel (2025–2026 comparison articles).*

**Common pattern:** every competitor records debts but **settles outside the app** (UPI/bank/PayPal). None targets Bangladesh’s mobile-financial-service habits (bKash/Nagad/Rocket) and **none offers an identity-verified business partnership ledger**. That is our differentiation.

## 3. Gap analysis → what was built

| Missing / weak in prototype | Industry expectation | Status in this build |
|---|---|---|
| Server calculation engine | Exact, auditable maths | ✅ Integer engine, 5 split types, multi-payer, tested |
| Real email verification | Verified accounts | ✅ Link + 6-digit code, expiry, attempt limits |
| NoSQL, user-centred data | Flexible documents | ✅ MongoDB models, derived balances, soft-delete + history |
| Partner invites by email | Collaboration | ✅ Token invitations (group + business), works pre-signup |
| NID for business security | KYC | ✅ Encrypted, masked, blind-indexed, reviewed, audited |
| Debt simplification | Fewer payments | ✅ Per-group toggle |
| Settlement trust | Confirm payments | ✅ Two-step approval, atomic, over-payment guard |
| Multi-currency | Travel groups | ✅ 12 currencies, saved FX rate |
| Recurring bills | Housemates | ✅ Weekly/monthly/yearly scheduler |
| Notifications | Engagement | ✅ In-app + live (SSE) + email prefs |
| Analytics & export | Insight | ✅ Category/trend/recap, CSV, print/PDF |
| Admin & compliance | Operate the product | ✅ RBAC admin, KYC queue, flags, audit, health |
| Professional UI | Trust & delight | ✅ Glass UI, animation, mobile-first, PWA |
| Legal pages & footer | Compliance | ✅ Terms, Privacy, Cookies, Security (editable) |
| Branding | StratifyX Global | ✅ Centralised, course info removed |

## 4. Roadmap (not yet built)

**Next (high value)**
1. Native iOS/Android app (React Native or Flutter) on the existing API; push notifications (FCM/APNs).
2. Receipt photo upload + OCR (flag `receiptOcr` is pre-wired).
3. Offline-first + guest/link-join groups (competitor strength: no-signup, offline).
4. Live FX provider; Bangla (বাংলা) localisation.
5. Automated e-KYC (NID API / face match) to complement manual review.
6. Payment-gateway deep links (bKash/Nagad request-money) and, later, licensed payment partners.

**Later**
Team workspaces, accountant exports (Excel/PDF statements), business invoices, referral programme (flag `referrals`), subscription tiers, admin impersonation with consent, SOC-2-style controls.

## 5. Key risks & mitigations
* **Regulatory** — storing NID and handling money-adjacent data: legal review, data-protection impact assessment, retention policy. Expensio deliberately never holds funds.
* **Fraud / identity misuse** — blind-index uniqueness, manual review, rate limits, audit trail; add automated e-KYC.
* **Key management** — `ENCRYPTION_KEY` loss = unreadable NIDs; move to a KMS/HSM for production.
* **Scale** — SSE/rate-limit state is per-instance; add Redis before horizontal scaling.
