import { Content } from '../models/index.js';

const UPDATED = '1 October 2026';
const PAGES = {
  terms: ['Terms of Service', `# Terms of Service
_Last updated: ${UPDATED}_

> Draft prepared for legal review. Staff can edit and publish updates from the Admin → Content module.

## 1. About Expensio
Expensio ("the Service") is a shared-expense and business-partnership ledger operated by **StratifyX Global** ("we", "us"). By creating an account you agree to these Terms and our [Privacy Policy](#/privacy).

## 2. Your account
- You must be at least 18 years old and provide accurate information.
- You are responsible for keeping your password and any one-time codes confidential.
- You must verify your email address before creating groups, recording expenses or settlements.

## 3. What Expensio is — and is not
Expensio **records and calculates** who owes whom. It is **not a bank, payment processor or money transmitter** and never holds or moves your money. Payments made through bKash, Nagad, Rocket, bank transfer or cash happen outside Expensio; a settlement is only marked complete when the receiving person confirms it.

## 4. Your content and accuracy
You are responsible for the expenses, amounts and exchange rates you enter. Currency conversion rates shown by default are indicative; you may override them. Calculations are provided as a convenience and do not constitute financial, tax or legal advice.

## 5. Business module and identity verification
To create or join a business you must complete identity verification with a valid National ID (NID). You confirm the information is yours and truthful. Submitting another person's identity or false information is grounds for immediate suspension and may be reported to authorities. Business ledger entries are append-only; mistakes are voided, not erased.

## 6. Acceptable use
Do not misuse the Service, attempt unauthorised access, scrape data, overload our systems, or use Expensio for unlawful activity, fraud or money laundering.

## 7. Suspension and termination
We may suspend accounts that breach these Terms or put other users at risk. You may request deletion of your account at any time from Settings → Privacy & data.

## 8. Disclaimer and liability
The Service is provided "as is". To the extent permitted by law, StratifyX Global is not liable for indirect or consequential losses, or for disputes between group members or business partners.

## 9. Changes
We may update these Terms. Material changes will be announced in-app or by email before they take effect.

## 10. Contact
Reach us through the [contact page](#/contact). Company registration details: _to be inserted by StratifyX Global before public launch._`],
  privacy: ['Privacy Policy', `# Privacy Policy
_Last updated: ${UPDATED}_

> Draft prepared for legal review. Staff can edit and publish updates from the Admin → Content module.

## What we collect
- **Account data:** name, email, phone, and (optionally) your mobile-banking provider and number so friends can pay you.
- **Usage data:** groups, expenses, settlements and business ledger entries you create.
- **Identity data (business module only):** NID number, name and date of birth as on your NID, and optionally father's name and address.
- **Technical data:** IP address, device/browser type and sign-in times, for security and fraud prevention.

## How we protect NID data
Your NID number is encrypted at rest (AES-256-GCM). Everywhere in the product it is **masked** — only the last four digits are visible. Our staff can only see the full number after re-entering their password, and every reveal is recorded in an immutable audit log. A NID can be linked to one account only.

## How we use data
To operate the Service, send transactional emails (verification, security codes, invitations, payment confirmations), keep accounts safe, provide support, and comply with law. We do **not** sell your personal data.

## Sharing
Group members see your name, avatar and the expenses in shared groups. Business partners see your name, role, ownership share and verification status — never your NID number. We use service providers (e.g. email delivery, hosting) bound by confidentiality.

## Retention
We keep data while your account is active. Business ledger and audit records may be retained as required by law or to resolve disputes.

## Your rights
You can edit your profile, download a copy of your data, and request deletion in **Settings → Privacy & data**. Contact us via the [contact page](#/contact) for any privacy question.

## Security
HTTPS, hashed passwords (bcrypt), rotating session tokens, rate limiting, optional two-factor authentication (mandatory for business owners and staff), and regular reviews. No system is perfectly secure; tell us about concerns promptly.

## Cookies
We use a strictly-necessary, httpOnly cookie to keep you signed in. See the [Cookie Policy](#/cookies).`],
  cookies: ['Cookie Policy', `# Cookie Policy
_Last updated: ${UPDATED}_

Expensio uses the minimum storage needed to work:

- **Session cookie (strictly necessary)** — an httpOnly, SameSite cookie that keeps you signed in securely. It is not readable by scripts.
- **Local preferences** — your theme and small UI settings are stored in your browser's local storage on your device.

We do **not** use advertising or cross-site tracking cookies. Because we only use strictly necessary storage, no consent banner is required, but you can clear it at any time from your browser settings (you will be signed out).`],
  security: ['Security & Responsible Disclosure', `# Security
_Last updated: ${UPDATED}_

Protecting your money data and identity documents is core to Expensio.

## What we do
- Passwords hashed with bcrypt; rotating refresh tokens with reuse detection.
- Email verification for every account; optional two-factor sign-in (mandatory for business owners and staff).
- NID numbers encrypted at rest and masked everywhere; reveals need re-authentication and are audited.
- Rate limiting, account lockout, strict input validation and secure HTTP headers.
- Append-only audit trails for business activity and administrative actions.

## Report a vulnerability
Please use the [contact page](#/contact) with the category **Bug** and the subject "Security". Include steps to reproduce. Please give us reasonable time to fix issues before public disclosure and avoid accessing other users' data.`],
};

export async function ensureContent() {
  for (const [slug, [title, body]] of Object.entries(PAGES)) await Content.updateOne({ slug }, { $setOnInsert: { slug, title, body, version: 1 } }, { upsert: true });
}
