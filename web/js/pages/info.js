import { api } from '../core/api.js';
import { store } from '../core/store.js';
import { $, on, icon, esc, toast, withBtn, btnHtml, fieldErrors, ago, empty, modal } from '../core/ui.js';
import { BRAND } from '../core/brand.js';

// Tiny, safe markdown renderer for admin-editable legal content (escapes first, then formats).
export function md(src) {
  const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/_(.+?)_/g, '<i>$1</i>').replace(/\[([^\]]+)\]\((#\/[^)\s]*|https:\/\/[^)\s]+)\)/g, (_m, t, u) => `<a href="${u}"${u.startsWith('http') ? ' target="_blank" rel="noopener noreferrer"' : ''}>${t}</a>`);
  const out = []; let list = false;
  for (const raw of String(src).split('\n')) {
    const l = raw.trimEnd();
    if (/^- /.test(l)) { if (!list) { out.push('<ul>'); list = true; } out.push(`<li>${inline(l.slice(2))}</li>`); continue; }
    if (list) { out.push('</ul>'); list = false; }
    if (/^### /.test(l)) out.push(`<h3>${inline(l.slice(4))}</h3>`); else if (/^## /.test(l)) out.push(`<h2>${inline(l.slice(3))}</h2>`); else if (/^# /.test(l)) out.push(`<h1>${inline(l.slice(2))}</h1>`);
    else if (/^> /.test(l)) out.push(`<blockquote>${inline(l.slice(2))}</blockquote>`); else if (l) out.push(`<p>${inline(l)}</p>`);
  }
  if (list) out.push('</ul>'); return out.join('\n');
}

export const legal = (slug) => async () => {
  let c; try { c = await api.get(`/content/${slug}`); } catch (e) { return { title: 'Not found', html: `<div class="container legal"><h1>Unavailable</h1><p class="muted">${esc(e.message)}</p></div>` }; }
  return { title: c.title, html: `<div class="container"><article class="legal card pad-lg" style="margin-top:20px">${md(c.body)}<hr><p class="faint" style="font-size:.85rem">Version ${c.version} · updated ${new Date(c.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} · <a href="#/contact">Questions?</a></p></article></div>` };
};

export async function about() {
  const html = `<div class="container"><section class="section" style="padding-bottom:20px"><div class="section-head reveal in"><span class="eyebrow"><b>ABOUT</b> ${esc(BRAND.company)}</span><h1 style="font-size:clamp(2rem,5vw,3.4rem);margin-top:16px">We build tools that make <span class="grad-text">shared money simple</span></h1><p>${esc(BRAND.company)} is a technology company building trustworthy financial-coordination products. Expensio is our first: a fair, transparent way for friends, families and partners to share costs and settle up.</p></div>
  <div class="grid g3">${[['heart', 'People first', 'Money is personal. We design for clarity, kindness and zero awkwardness.'], ['shield', 'Trust by design', 'Verified accounts, confirmed payments, encrypted identity data and audit trails.'], ['globe', 'Built for Bangladesh, ready for the world', 'bKash, Nagad and Rocket context today, multi-currency from day one.']].map(([i, t, d]) => `<div class="card feature reveal"><div class="ico-wrap">${icon(i)}</div><h3>${t}</h3><p>${d}</p></div>`).join('')}</div></section>
  <section class="section" style="padding-top:20px"><div class="card pad-lg"><h2>Roadmap</h2><div class="timeline">${[['Now', 'Expensio Web — groups, smart splitting, settlements, NID-verified business ledger.'], ['Next', 'Native iOS & Android apps (cross-platform) with push notifications and receipt scanning.'], ['Later', 'Deeper wallet integrations, e-KYC automation, team workspaces and richer analytics.']].map(([t, d]) => `<div class="tl-item"><b>${t}</b><div class="muted">${d}</div></div>`).join('')}</div></div></section></div>`;
  return { title: 'About', html };
}

export async function contact() {
  const u = store.user;
  const html = `<div class="container auth-wrap"><div class="card auth-card wide pad-lg glow"><div class="center" style="margin-bottom:18px"><span class="big-emoji">💬</span><h2 style="font-size:1.8rem">How can we help?</h2><p class="muted">Our team usually replies within one business day.</p></div>
  <form class="stack" id="f" novalidate><div class="form-grid two"><div class="field"><label>Your name</label><input class="input" name="name" value="${esc(u?.name || '')}" autocomplete="name"></div><div class="field"><label>Email</label><input class="input" type="email" name="email" value="${esc(u?.email || '')}" autocomplete="email"></div></div>
  <div class="form-grid two"><div class="field"><label>Topic</label><select class="input" name="category">${[['general', 'General question'], ['account', 'My account'], ['billing', 'Billing'], ['business', 'Business & NID verification'], ['bug', 'Report a bug / security'], ['feedback', 'Feedback']].map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></div><div class="field"><label>Subject</label><input class="input" name="subject" maxlength="140"></div></div>
  <div class="field"><label>Message</label><textarea class="input" name="message" maxlength="4000" placeholder="Tell us what’s going on…"></textarea></div><input name="website" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true">${btnHtml('Send message', 'btn-primary block lg', 'type="submit"')}</form></div></div>`;
  return { title: 'Contact', html, mount(root) {
    $('#f', root).addEventListener('submit', async (e) => { e.preventDefault(); const f = e.target; fieldErrors(f);
      try { const d = await withBtn($('button[type=submit]', f), () => api.post('/support/tickets', { name: f.elements.name.value, email: f.email.value, category: f.category.value, subject: f.subject.value, message: f.message.value, website: f.website.value })); $('.auth-card', root).innerHTML = `<div class="center"><span class="big-emoji">✅</span><h2>Message sent!</h2><p class="muted">Your reference is <b class="mono">${esc(d.ref)}</b>. We’ve emailed you a confirmation.</p><a class="btn btn-primary" href="#/">Back home</a></div>`; }
      catch (err) { if (err.details) fieldErrors(f, err.details); else toast(err.message, 'bad'); } });
  } };
}

export async function myTickets() {
  let { tickets } = await api.get('/support/tickets');
  const paint = () => tickets.length ? tickets.map((t) => `<div class="card" style="margin-bottom:14px"><div class="row between wrap"><div><b>${esc(t.subject)}</b> <span class="mono faint">#${esc(t.ref)}</span></div><span class="badge ${t.status === 'resolved' ? 'good' : t.status === 'pending' ? 'info' : 'warn'}">${t.status}</span></div>
    <div class="stack-sm" style="margin:14px 0">${t.messages.map((m) => `<div class="card tight flat" style="${m.from === 'staff' ? 'border-color:var(--primary)' : ''}"><div class="faint" style="font-size:.75rem;font-weight:700">${m.from === 'staff' ? '🛟 Expensio Support' : 'You'} · ${ago(m.at)}</div><div style="white-space:pre-wrap">${esc(m.body)}</div></div>`).join('')}</div>
    <form class="row" data-reply="${t.id}"><input class="input grow" name="message" placeholder="Reply…" maxlength="4000"><button class="btn btn-primary" type="submit">${icon('send')}</button></form></div>`).join('') : `<div class="card">${empty('🛟', 'No support requests', 'Need help? Send us a message and track the conversation here.')}</div>`;
  const html = `<div class="stack" style="gap:18px"><div class="row between wrap"><h2 style="margin:0">Help & support</h2><a class="btn btn-primary" href="#/contact">${icon('plus')} New request</a></div><div id="tl">${paint()}</div></div>`;
  return { title: 'Support', html, mount(root) {
    root.addEventListener('submit', async (e) => { const id = e.target.dataset.reply; if (!id) return; e.preventDefault(); const msg = e.target.message.value.trim(); if (!msg) return;
      try { await api.post(`/support/tickets/${id}/reply`, { message: msg }); ({ tickets } = await api.get('/support/tickets')); $('#tl', root).innerHTML = paint(); toast('Reply sent', 'good'); } catch (err) { toast(err.message, 'bad'); } });
  } };
}

export async function notFound() {
  return { title: 'Not found', html: `<div class="container auth-wrap"><div class="card auth-card center pad-lg"><span class="big-emoji">🧭</span><h2>Page not found</h2><p class="muted">That page doesn’t exist or has moved.</p><a class="btn btn-primary" href="#/">Take me home</a></div></div>` };
}
