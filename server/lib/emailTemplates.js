import { config } from '../config/env.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function layout({ preheader, title, bodyHtml, cta, footnote }) {
  return `<!doctype html><html><body style="margin:0;background:#0b1020;font-family:Inter,Segoe UI,Arial,sans-serif;">
<span style="display:none;opacity:0;height:0;overflow:hidden">${esc(preheader || '')}</span>
<table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#0b1020,#16233F);padding:32px 12px"><tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.35)">
<tr><td style="background:linear-gradient(120deg,#16233F,#0E7C7B);padding:26px 32px">
<table cellpadding="0" cellspacing="0"><tr><td style="width:38px;height:38px;border-radius:11px;background:#fff;text-align:center;font-weight:800;font-size:20px;color:#0E7C7B">E</td>
<td style="padding-left:12px;color:#fff;font-size:20px;font-weight:700;letter-spacing:.2px">Expensio<br><span style="font-size:11px;font-weight:500;opacity:.8;letter-spacing:1.5px">BY STRATIFYX GLOBAL</span></td></tr></table></td></tr>
<tr><td style="padding:32px;color:#1f2937;font-size:15px;line-height:1.65">
<h1 style="margin:0 0 14px;font-size:22px;color:#16233F">${esc(title)}</h1>${bodyHtml}
${cta ? `<p style="margin:26px 0"><a href="${esc(cta.url)}" style="background:#0E7C7B;color:#fff;text-decoration:none;padding:13px 26px;border-radius:12px;font-weight:600;display:inline-block">${esc(cta.label)}</a></p>` : ''}
${footnote ? `<p style="color:#6B7280;font-size:13px">${footnote}</p>` : ''}
</td></tr>
<tr><td style="background:#f3f5f9;padding:18px 32px;color:#6B7280;font-size:12px">© ${new Date().getFullYear()} StratifyX Global · Expensio. You received this because of activity on your Expensio account.<br>
<a href="${config.APP_URL}/#/privacy" style="color:#0E7C7B">Privacy</a> · <a href="${config.APP_URL}/#/terms" style="color:#0E7C7B">Terms</a> · <a href="${config.APP_URL}/#/contact" style="color:#0E7C7B">Support</a></td></tr>
</table></td></tr></table></body></html>`;
}

const code = (c) => `<p style="font-size:34px;letter-spacing:10px;font-weight:800;color:#0E7C7B;background:#eef7f7;border-radius:14px;padding:14px 10px;text-align:center;margin:18px 0">${esc(c)}</p>`;

export const T = {
  verify: ({ name, token, otp }) => ({
    subject: 'Verify your Expensio email',
    html: layout({ preheader: `Your code is ${otp}`, title: `Welcome, ${name.split(' ')[0]}! 🎉`,
      bodyHtml: `<p>Confirm your email to start splitting expenses. Click the button, or enter this 6-digit code in the app:</p>${code(otp)}`,
      cta: { label: 'Verify my email', url: `${config.APP_URL}/#/verify-email?token=${token}` },
      footnote: 'This link and code expire in 24 hours. If you didn’t create an account, you can safely ignore this email.' }),
  }),
  reset: ({ name, token }) => ({
    subject: 'Reset your Expensio password',
    html: layout({ preheader: 'Password reset requested', title: 'Reset your password',
      bodyHtml: `<p>Hi ${esc(name)}, we received a request to reset your password. This link works once and expires in 60 minutes.</p>`,
      cta: { label: 'Choose a new password', url: `${config.APP_URL}/#/reset-password?token=${token}` },
      footnote: 'Didn’t request this? Your password is unchanged — you can ignore this email.' }),
  }),
  otp: ({ name, otp, purpose }) => ({
    subject: `Your Expensio security code: ${otp}`,
    html: layout({ preheader: `Code ${otp}`, title: purpose === 'login' ? 'Confirm your sign-in' : 'Confirm this action',
      bodyHtml: `<p>Hi ${esc(name)}, use this one-time code. It expires in 10 minutes.</p>${code(otp)}`,
      footnote: 'If this wasn’t you, change your password immediately.' }),
  }),
  invite: ({ inviter, kind, targetName, role, token, existing }) => ({
    subject: `${inviter} invited you to ${kind === 'business' ? 'partner in' : 'join'} “${targetName}” on Expensio`,
    html: layout({ preheader: `${inviter} invited you`, title: kind === 'business' ? 'You’ve been invited as a business partner' : 'You’ve been invited to a group',
      bodyHtml: `<p><b>${esc(inviter)}</b> invited you to ${kind === 'business' ? `partner in the business <b>${esc(targetName)}</b> as <b>${esc(role)}</b>` : `the group <b>${esc(targetName)}</b>`}.</p>
        <p>${existing ? 'Sign in to review and accept.' : 'Create a free Expensio account with this email address to accept.'}</p>`,
      cta: { label: 'View invitation', url: `${config.APP_URL}/#/invite/${token}` },
      footnote: kind === 'business' ? 'Business partners must verify their identity (NID) before joining. The invitation expires in 7 days.' : 'The invitation expires in 7 days.' }),
  }),
  notify: ({ name, title, body, link }) => ({
    subject: title,
    html: layout({ preheader: body, title, bodyHtml: `<p>Hi ${esc(name)},</p><p>${esc(body)}</p>`,
      cta: link ? { label: 'Open in Expensio', url: `${config.APP_URL}/#${link}` } : null,
      footnote: 'Manage email preferences in Settings → Notifications.' }),
  }),
  support: ({ name, ticketId, subject }) => ({
    subject: `We got your message [#${ticketId}]`,
    html: layout({ preheader: 'Support request received', title: 'We’re on it',
      bodyHtml: `<p>Hi ${esc(name)}, thanks for contacting StratifyX Global support. Ticket <b>#${esc(ticketId)}</b> — “${esc(subject)}” — has been received. We usually reply within one business day.</p>` }),
  }),
};
